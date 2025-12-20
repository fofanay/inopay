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
    const signature = req.headers.get("stripe-signature");
    
    // For now, we'll process without signature verification
    // In production, you should verify the webhook signature
    const event = JSON.parse(body);

    logStep("Event received", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        logStep("Checkout session completed", { sessionId: session.id, mode: session.mode });

        const userId = session.metadata?.user_id;
        const planType = session.metadata?.plan_type;
        const customerId = session.customer;

        if (!userId) {
          logStep("No user_id in metadata, skipping");
          break;
        }

        if (session.mode === "subscription") {
          // Pro subscription
          await supabaseClient
            .from("subscriptions")
            .upsert({
              user_id: userId,
              stripe_customer_id: customerId,
              stripe_subscription_id: session.subscription,
              plan_type: "pro",
              status: "active",
            }, { onConflict: "user_id" });
          logStep("Pro subscription activated", { userId });
        } else {
          // Pack purchase - add 1 credit
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
          logStep("Pack credit added", { userId, newCredits: currentCredits + 1 });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by stripe customer id
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
              current_period_end: subscription.current_period_end 
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
            })
            .eq("user_id", userSub.user_id);
          
          logStep("Subscription updated", { userId: userSub.user_id, status });
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
