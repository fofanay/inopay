import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-MANAGE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("User not authenticated");

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) throw new Error("Admin access required");
    logStep("Admin verified", { userId: userData.user.id });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const body = await req.json();
    const { action, subscription_id, payment_intent_id, amount, reason, coupon_name, percent_off, amount_off, duration } = body;

    logStep("Processing action", { action, subscription_id, payment_intent_id });

    let result: any;

    switch (action) {
      case "cancel_subscription":
        if (!subscription_id) throw new Error("subscription_id required");
        result = await stripe.subscriptions.cancel(subscription_id);
        logStep("Subscription canceled", { id: subscription_id });
        break;

      case "cancel_at_period_end":
        if (!subscription_id) throw new Error("subscription_id required");
        result = await stripe.subscriptions.update(subscription_id, {
          cancel_at_period_end: true,
        });
        logStep("Subscription set to cancel at period end", { id: subscription_id });
        break;

      case "reactivate_subscription":
        if (!subscription_id) throw new Error("subscription_id required");
        result = await stripe.subscriptions.update(subscription_id, {
          cancel_at_period_end: false,
        });
        logStep("Subscription reactivated", { id: subscription_id });
        break;

      case "refund":
        if (!payment_intent_id) throw new Error("payment_intent_id required");
        const refundParams: Stripe.RefundCreateParams = {
          payment_intent: payment_intent_id,
        };
        if (amount) refundParams.amount = amount;
        if (reason) refundParams.reason = reason;
        result = await stripe.refunds.create(refundParams);
        logStep("Refund created", { id: result.id, amount: result.amount });
        break;

      case "create_coupon":
        if (!coupon_name) throw new Error("coupon_name required");
        const couponParams: Stripe.CouponCreateParams = {
          name: coupon_name,
          duration: duration || "once",
        };
        if (percent_off) couponParams.percent_off = percent_off;
        if (amount_off) {
          couponParams.amount_off = amount_off;
          couponParams.currency = "eur";
        }
        result = await stripe.coupons.create(couponParams);
        logStep("Coupon created", { id: result.id });
        break;

      case "delete_coupon":
        if (!body.coupon_id) throw new Error("coupon_id required");
        result = await stripe.coupons.del(body.coupon_id);
        logStep("Coupon deleted", { id: body.coupon_id });
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
