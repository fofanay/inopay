import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Service type mapping
const SERVICE_PRICES: Record<string, { type: string; amount: number; currency: string; isSubscription: boolean }> = {
  "price_1RbLNGP6LGH3d3nX8yDjVVnk": { type: "deploy", amount: 9900, currency: "cad", isSubscription: false },
  "price_1RbLMbP6LGH3d3nXwvVDl91W": { type: "redeploy", amount: 4900, currency: "cad", isSubscription: false },
  "price_1RbLMIP6LGH3d3nXAUjSuwuO": { type: "monitoring", amount: 1900, currency: "cad", isSubscription: true },
  "price_1RbLLsP6LGH3d3nXrM2cWmil": { type: "server", amount: 7900, currency: "cad", isSubscription: false },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.text();
    const event = JSON.parse(body);

    logStep("Event received", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        logStep("Checkout session completed", { sessionId: session.id, mode: session.mode });

        const userId = session.metadata?.user_id;
        const serviceType = session.metadata?.service_type;
        const customerId = session.customer;

        if (!userId) {
          logStep("No user_id in metadata, skipping");
          break;
        }

        // Get the line items to determine the price
        let priceId: string | null = null;
        try {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          if (lineItems.data.length > 0) {
            priceId = lineItems.data[0].price?.id || null;
          }
        } catch (e) {
          logStep("Could not fetch line items", { error: e });
        }

        // Determine service info
        const serviceInfo = priceId && SERVICE_PRICES[priceId] 
          ? SERVICE_PRICES[priceId] 
          : { type: serviceType || "unknown", amount: session.amount_total || 0, currency: session.currency || "cad", isSubscription: session.mode === "subscription" };

        logStep("Service info determined", { serviceInfo, priceId });

        if (session.mode === "subscription") {
          // Monitoring subscription
          const subscriptionId = session.subscription as string;
          let subscriptionEnd: string | null = null;
          
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
          } catch (e) {
            logStep("Could not fetch subscription details", { error: e });
          }

          // Create purchase record for subscription
          const { error: purchaseError } = await supabaseClient
            .from("user_purchases")
            .insert({
              user_id: userId,
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent,
              service_type: serviceInfo.type,
              amount: serviceInfo.amount,
              currency: serviceInfo.currency,
              status: "completed",
              is_subscription: true,
              subscription_status: "active",
              subscription_ends_at: subscriptionEnd,
              metadata: { 
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                price_id: priceId
              }
            });

          if (purchaseError) {
            logStep("Error creating purchase record", { error: purchaseError });
          } else {
            logStep("Subscription purchase recorded", { userId, serviceType: serviceInfo.type });
          }

          // Also update old subscriptions table for backwards compatibility
          await supabaseClient
            .from("subscriptions")
            .upsert({
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan_type: "monitoring",
              status: "active",
              current_period_end: subscriptionEnd,
            }, { onConflict: "user_id" });

        } else {
          // One-time payment (deploy, redeploy, server)
          const { error: purchaseError } = await supabaseClient
            .from("user_purchases")
            .insert({
              user_id: userId,
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent,
              service_type: serviceInfo.type,
              amount: serviceInfo.amount,
              currency: serviceInfo.currency,
              status: "completed",
              is_subscription: false,
              used: false,
              metadata: { 
                stripe_customer_id: customerId,
                price_id: priceId
              }
            });

          if (purchaseError) {
            logStep("Error creating purchase record", { error: purchaseError });
          } else {
            logStep("One-time purchase recorded", { userId, serviceType: serviceInfo.type });
          }

          // Also update old subscriptions table for backwards compatibility (add credit)
          const { data: existingSub } = await supabaseClient
            .from("subscriptions")
            .select("credits_remaining")
            .eq("user_id", userId)
            .maybeSingle();

          const currentCredits = existingSub?.credits_remaining || 0;

          await supabaseClient
            .from("subscriptions")
            .upsert({
              user_id: userId,
              stripe_customer_id: customerId,
              plan_type: "pack",
              status: "active",
              credits_remaining: currentCredits + 1,
            }, { onConflict: "user_id" });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        logStep("Subscription update event", { status: subscription.status, customerId });

        // Update user_purchases subscription status
        const subscriptionStatus = subscription.status === "active" ? "active" : 
                                   subscription.status === "canceled" ? "canceled" : "expired";
        const subscriptionEnd = subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        // Find and update the purchase record
        const { error: updateError } = await supabaseClient
          .from("user_purchases")
          .update({
            subscription_status: subscriptionStatus,
            subscription_ends_at: subscriptionEnd,
          })
          .eq("is_subscription", true)
          .contains("metadata", { stripe_subscription_id: subscription.id });

        if (updateError) {
          logStep("Error updating purchase subscription status", { error: updateError });
        }

        // Also update old subscriptions table for backwards compatibility
        const { data: userSub } = await supabaseClient
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (userSub) {
          const status = subscription.status === "active" ? "active" : 
                        subscription.status === "canceled" ? "canceled" : "expired";
          
          await supabaseClient
            .from("subscriptions")
            .update({
              status,
              current_period_end: subscriptionEnd,
            })
            .eq("user_id", userSub.user_id);
          
          logStep("Subscription updated in legacy table", { userId: userSub.user_id, status });
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;

        logStep("Refund received", { paymentIntentId });

        // Update purchase status to refunded
        const { error: updateError } = await supabaseClient
          .from("user_purchases")
          .update({ status: "refunded" })
          .eq("stripe_payment_intent_id", paymentIntentId);

        if (updateError) {
          logStep("Error updating purchase to refunded", { error: updateError });
        } else {
          logStep("Purchase marked as refunded");
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
