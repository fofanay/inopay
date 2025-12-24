// @inopay-core-protected
// INOPAY PAYMENT SYSTEM - Stripe Webhook Handler
// This file MUST NOT be cleaned or removed during self-liberation
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Admin email for critical notifications
const ADMIN_EMAIL = "admin@getinopay.com";

// Send email notification for payment failures
async function sendPaymentFailureEmail(
  userEmail: string | null,
  customerName: string | null,
  attemptCount: number,
  invoiceUrl: string | null
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    logStep("RESEND_API_KEY not configured, skipping email");
    return;
  }

  const resend = new Resend(resendApiKey);

  // Send email to user if we have their email
  if (userEmail) {
    try {
      await resend.emails.send({
        from: "Inopay <contact@getinopay.com>",
        to: [userEmail],
        subject: "⚠️ Échec de paiement - Action requise",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #e74c3c;">Échec de paiement</h1>
            <p>Bonjour${customerName ? ` ${customerName}` : ''},</p>
            <p>Nous n'avons pas pu traiter votre dernier paiement (tentative ${attemptCount}).</p>
            <p>Pour éviter toute interruption de service, veuillez mettre à jour vos informations de paiement.</p>
            ${invoiceUrl ? `<p><a href="${invoiceUrl}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Mettre à jour le paiement</a></p>` : ''}
            <p style="color: #7f8c8d; font-size: 14px;">Si vous avez des questions, contactez-nous à support@getinopay.com</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #bdc3c7; font-size: 12px;">Inopay - Libérez vos projets Lovable</p>
          </div>
        `,
      });
      logStep("Payment failure email sent to user", { email: userEmail });
    } catch (e) {
      logStep("Failed to send user email", { error: e });
    }
  }

  // Always notify admin
  try {
    await resend.emails.send({
      from: "Inopay Alerts <alerts@getinopay.com>",
      to: [ADMIN_EMAIL],
      subject: `🚨 Échec paiement - ${userEmail || 'Client inconnu'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #e74c3c;">Alerte: Échec de paiement</h1>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Client:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${customerName || 'N/A'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Email:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${userEmail || 'N/A'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Tentative:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${attemptCount}</td></tr>
          </table>
          ${invoiceUrl ? `<p><a href="${invoiceUrl}">Voir la facture Stripe</a></p>` : ''}
        </div>
      `,
    });
    logStep("Admin notification email sent");
  } catch (e) {
    logStep("Failed to send admin email", { error: e });
  }
}

// Send email for 3D Secure/SCA required
async function sendSCARequiredEmail(
  userEmail: string | null,
  customerName: string | null,
  invoiceUrl: string | null
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey || !userEmail) return;

  const resend = new Resend(resendApiKey);

  try {
    await resend.emails.send({
      from: "Inopay <contact@getinopay.com>",
      to: [userEmail],
      subject: "🔐 Authentification requise pour votre paiement",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f39c12;">Action requise</h1>
          <p>Bonjour${customerName ? ` ${customerName}` : ''},</p>
          <p>Votre banque requiert une authentification supplémentaire (3D Secure) pour traiter votre paiement.</p>
          <p>Veuillez cliquer sur le lien ci-dessous pour finaliser votre paiement :</p>
          ${invoiceUrl ? `<p><a href="${invoiceUrl}" style="background-color: #f39c12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Authentifier le paiement</a></p>` : ''}
          <p style="color: #7f8c8d; font-size: 14px;">Ce lien expire dans 24 heures.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #bdc3c7; font-size: 12px;">Inopay - Libérez vos projets Lovable</p>
        </div>
      `,
    });
    logStep("SCA required email sent", { email: userEmail });
  } catch (e) {
    logStep("Failed to send SCA email", { error: e });
  }
}

// Log critical errors to admin_activity_logs for monitoring
async function logCriticalError(supabase: any, error: string, eventType?: string, metadata?: any) {
  try {
    await supabase.from("admin_activity_logs").insert({
      action_type: "stripe_webhook_error",
      title: `Webhook Error: ${eventType || 'unknown'}`,
      description: error,
      status: "error",
      metadata: { ...metadata, timestamp: new Date().toISOString() }
    });
  } catch (e) {
    console.error("[STRIPE-WEBHOOK] Failed to log critical error:", e);
  }
}

// Log successful webhook processing for monitoring
async function logWebhookSuccess(supabase: any, eventType: string, userId?: string, metadata?: any) {
  try {
    await supabase.from("admin_activity_logs").insert({
      action_type: "stripe_webhook_success",
      title: `Webhook Processed: ${eventType}`,
      description: `Successfully processed ${eventType} event`,
      status: "success",
      user_id: userId,
      metadata: { ...metadata, timestamp: new Date().toISOString() }
    });
  } catch (e) {
    // Non-critical, don't fail the webhook
    console.log("[STRIPE-WEBHOOK] Could not log success:", e);
  }
}

// Service type mapping - Synced with Pricing.tsx STRIPE_PRICES
const SERVICE_PRICES: Record<string, { type: string; amount: number; currency: string; isSubscription: boolean }> = {
  // CAD Prices
  "price_1Sgr7NBYLQpzPb0ym7lV0WLF": { type: "deploy", amount: 9900, currency: "cad", isSubscription: false },
  "price_1Sgr89BYLQpzPb0yTaGeD7uk": { type: "redeploy", amount: 4900, currency: "cad", isSubscription: false },
  "price_1Sgr8iBYLQpzPb0yo15IvGVU": { type: "monitoring", amount: 1900, currency: "cad", isSubscription: true },
  "price_1Sgr9zBYLQpzPb0yZJS7N412": { type: "server", amount: 7900, currency: "cad", isSubscription: false },
  "price_1SgxUoBYLQpzPb0yLXch6nNE": { type: "portfolio", amount: 29900, currency: "cad", isSubscription: true },
  // USD Prices
  "price_1Sgr7ZBYLQpzPb0yh5SJNTJE": { type: "deploy", amount: 7500, currency: "usd", isSubscription: false },
  "price_1Sgr8LBYLQpzPb0yX0NHl6PS": { type: "redeploy", amount: 3900, currency: "usd", isSubscription: false },
  "price_1Sgr8rBYLQpzPb0yReXWuS1J": { type: "monitoring", amount: 1500, currency: "usd", isSubscription: true },
  "price_1SgrAsBYLQpzPb0ybNWYjt2p": { type: "server", amount: 5900, currency: "usd", isSubscription: false },
  "price_1SgxVQBYLQpzPb0yrDdpeaAA": { type: "portfolio", amount: 22500, currency: "usd", isSubscription: true },
  // EUR Prices
  "price_1Sgr7jBYLQpzPb0yGr6Sx9uC": { type: "deploy", amount: 6900, currency: "eur", isSubscription: false },
  "price_1Sgr8VBYLQpzPb0y3MKtI4Gh": { type: "redeploy", amount: 3500, currency: "eur", isSubscription: false },
  "price_1Sgr9VBYLQpzPb0yX1LCrf4N": { type: "monitoring", amount: 1300, currency: "eur", isSubscription: true },
  "price_1SgrC6BYLQpzPb0yvYbly0EL": { type: "server", amount: 5500, currency: "eur", isSubscription: false },
  "price_1SgxVcBYLQpzPb0yKFI4yyEd": { type: "portfolio", amount: 19900, currency: "eur", isSubscription: true },
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
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    let event: Stripe.Event;

    // CRITICAL: Verify webhook signature in production
    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
        logStep("Webhook signature verified successfully");
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        logStep("SECURITY ERROR: Webhook signature verification failed", { error: errorMessage });
        return new Response(
          JSON.stringify({ error: "Webhook signature verification failed" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    } else if (!webhookSecret) {
      // SECURITY WARNING: No webhook secret configured - only allow in development
      logStep("SECURITY WARNING: No STRIPE_WEBHOOK_SECRET configured - signature not verified");
      event = JSON.parse(body);
    } else {
      // Signature header missing but secret is configured
      logStep("SECURITY ERROR: stripe-signature header missing");
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    logStep("Event received", { type: event.type, eventId: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        logStep("Checkout session completed", { sessionId: session.id, mode: session.mode });

        // Check if this is a liberation supplement payment
        if (session.metadata?.type === 'liberation_supplement') {
          const pendingPaymentId = session.metadata.pending_payment_id;
          const projectName = session.metadata.project_name;
          
          logStep("Liberation supplement payment received", { pendingPaymentId, projectName });

          // Update pending payment status to 'paid'
          const { error: updateError } = await supabaseClient
            .from('pending_liberation_payments')
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: session.payment_intent as string,
            })
            .eq('id', pendingPaymentId);

          if (updateError) {
            logStep("Error updating liberation payment", { error: updateError });
            await logCriticalError(supabaseClient, `Failed to update liberation payment: ${updateError.message}`, event.type, { pendingPaymentId });
          } else {
            logStep("Liberation payment unlocked", { pendingPaymentId, projectName });
            await logWebhookSuccess(supabaseClient, 'liberation_supplement_paid', undefined, { pendingPaymentId, projectName });
          }

          break;
        }

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
            await logCriticalError(supabaseClient, `Failed to create subscription purchase: ${purchaseError.message}`, event.type, { sessionId: session.id, userId });
          } else {
            logStep("Subscription purchase recorded", { userId, serviceType: serviceInfo.type });
            await logWebhookSuccess(supabaseClient, event.type, userId, { sessionId: session.id, serviceType: serviceInfo.type });
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
            await logCriticalError(supabaseClient, `Failed to create one-time purchase: ${purchaseError.message}`, event.type, { sessionId: session.id, userId });
          } else {
            logStep("One-time purchase recorded", { userId, serviceType: serviceInfo.type });
            await logWebhookSuccess(supabaseClient, event.type, userId, { sessionId: session.id, serviceType: serviceInfo.type });
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
          await logCriticalError(supabaseClient, `Failed to update subscription status: ${updateError.message}`, event.type, { subscriptionId: subscription.id });
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
          await logCriticalError(supabaseClient, `Failed to mark purchase as refunded: ${updateError.message}`, event.type, { paymentIntentId });
        } else {
          logStep("Purchase marked as refunded");
          await logWebhookSuccess(supabaseClient, event.type, undefined, { paymentIntentId });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;
        const attemptCount = invoice.attempt_count;

        logStep("Payment failed", { customerId, subscriptionId, attemptCount });

        // Get customer details from Stripe
        let customerEmail: string | null = null;
        let customerName: string | null = null;
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && !customer.deleted) {
            customerEmail = customer.email;
            customerName = customer.name;
          }
        } catch (e) {
          logStep("Could not fetch customer details", { error: e });
        }

        // Find user by customer ID
        const { data: userPurchase } = await supabaseClient
          .from("user_purchases")
          .select("user_id")
          .eq("is_subscription", true)
          .contains("metadata", { stripe_customer_id: customerId })
          .maybeSingle();

        // Update subscription status to past_due
        if (subscriptionId) {
          await supabaseClient
            .from("user_purchases")
            .update({
              subscription_status: "past_due",
            })
            .eq("is_subscription", true)
            .contains("metadata", { stripe_subscription_id: subscriptionId });
        }

        // Send email notifications
        await sendPaymentFailureEmail(
          customerEmail,
          customerName,
          attemptCount || 1,
          invoice.hosted_invoice_url || null
        );

        // Log critical error for admin attention
        await logCriticalError(
          supabaseClient, 
          `Payment failed for subscription (attempt ${attemptCount})`,
          event.type,
          { 
            customerId, 
            subscriptionId, 
            attemptCount,
            userId: userPurchase?.user_id,
            invoiceId: invoice.id,
            customerEmail
          }
        );
        break;
      }

      case "invoice.payment_action_required": {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        logStep("Payment action required (3D Secure/SCA)", { customerId, subscriptionId });

        // Get customer details from Stripe
        let customerEmail: string | null = null;
        let customerName: string | null = null;
        try {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer && !customer.deleted) {
            customerEmail = customer.email;
            customerName = customer.name;
          }
        } catch (e) {
          logStep("Could not fetch customer details", { error: e });
        }

        // Find user by customer ID
        const { data: userPurchase } = await supabaseClient
          .from("user_purchases")
          .select("user_id")
          .eq("is_subscription", true)
          .contains("metadata", { stripe_customer_id: customerId })
          .maybeSingle();

        // Send SCA required email to user
        await sendSCARequiredEmail(
          customerEmail,
          customerName,
          invoice.hosted_invoice_url || null
        );

        // Log for admin notification
        await logCriticalError(
          supabaseClient,
          "Payment requires customer action (3D Secure/SCA authentication needed)",
          event.type,
          {
            customerId,
            subscriptionId,
            userId: userPurchase?.user_id,
            invoiceId: invoice.id,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            customerEmail
          }
        );
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
    
    // Log critical errors for admin monitoring
    await logCriticalError(supabaseClient, errorMessage, "unknown", { stack: error instanceof Error ? error.stack : undefined });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
