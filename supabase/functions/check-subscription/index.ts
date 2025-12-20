import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    // Check local subscription table first (for testers and pack users)
    const { data: localSub } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    
    logStep("Local subscription check", { 
      found: !!localSub, 
      plan_type: localSub?.plan_type,
      status: localSub?.status,
      credits_remaining: localSub?.credits_remaining,
      free_credits: localSub?.free_credits
    });

    // Check if user is a tester (unlimited credits) or has active pro subscription locally
    const isUnlimitedTester = localSub && (
      (localSub.credits_remaining && localSub.credits_remaining >= 999999) ||
      (localSub.free_credits && localSub.free_credits >= 999999)
    );
    
    if (isUnlimitedTester || (localSub && localSub.plan_type === "pro" && localSub.status === "active")) {
      logStep("User has Pro access (tester or active subscription)", { isUnlimitedTester });
      return new Response(JSON.stringify({ 
        subscribed: true,
        plan_type: "pro",
        credits_remaining: localSub.credits_remaining,
        subscription_end: localSub.current_period_end,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      
      // Check for pack credits
      if (localSub && localSub.credits_remaining > 0) {
        return new Response(JSON.stringify({ 
          subscribed: true,
          plan_type: localSub.plan_type || "pack",
          credits_remaining: localSub.credits_remaining,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      return new Response(JSON.stringify({ subscribed: false, plan_type: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Check for active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      const subscription = subscriptions.data[0];
      const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      logStep("Active subscription found", { subscriptionId: subscription.id });

      // Update local subscription table
      await supabaseClient
        .from("subscriptions")
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          plan_type: "pro",
          status: "active",
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: subscriptionEnd,
        }, { onConflict: "user_id" });

      return new Response(JSON.stringify({
        subscribed: true,
        plan_type: "pro",
        subscription_end: subscriptionEnd,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check for pack credits (using already fetched localSub)
    if (localSub && localSub.credits_remaining > 0) {
      return new Response(JSON.stringify({ 
        subscribed: true,
        plan_type: localSub.plan_type || "pack",
        credits_remaining: localSub.credits_remaining,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("No active subscription or credits found");
    return new Response(JSON.stringify({ subscribed: false, plan_type: "free" }), {
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
