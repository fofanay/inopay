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

// PHASE 3: Get limits based on recent purchases (deploy credit = Enterprise limits for that project)
interface PurchaseBasedLimits {
  maxFiles: number;
  maxRepos: number;
  source: 'purchase' | 'tester' | 'subscription' | 'free';
  purchaseId?: string;
}

async function getPurchaseBasedLimits(
  supabase: any,
  userId: string
): Promise<PurchaseBasedLimits | null> {
  // Check for recent deploy purchases (used in last 30 days or unused)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: deployPurchases } = await supabase
    .from('user_purchases')
    .select('id, service_type, used, used_at, created_at')
    .eq('user_id', userId)
    .in('service_type', ['deploy', 'redeploy'])
    .eq('status', 'completed')
    .or(`used.eq.false,used_at.gte.${thirtyDaysAgo.toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(1);

  if (deployPurchases && deployPurchases.length > 0) {
    const purchase = deployPurchases[0];
    logStep('Found active deploy purchase', { 
      purchaseId: purchase.id, 
      serviceType: purchase.service_type,
      used: purchase.used
    });
    
    // Deploy purchase = Enterprise limits (no restrictions)
    return {
      maxFiles: 10000,
      maxRepos: -1, // Unlimited
      source: 'purchase',
      purchaseId: purchase.id
    };
  }

  return null;
}

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
    
    // PHASE 3: Check purchase-based limits FIRST (priority over plans)
    const purchaseLimits = await getPurchaseBasedLimits(supabaseClient, user.id);
    
    if (purchaseLimits) {
      logStep("User has purchase-based Enterprise limits", purchaseLimits);
      return new Response(JSON.stringify({ 
        subscribed: true,
        plan_type: "enterprise",
        limits: { maxFiles: purchaseLimits.maxFiles, maxRepos: purchaseLimits.maxRepos },
        limit_source: purchaseLimits.source,
        purchase_id: purchaseLimits.purchaseId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    // Check local subscription table (for testers and pack users)
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

    // Check if user is a tester (unlimited credits)
    const isUnlimitedTester = localSub && (
      (localSub.credits_remaining && localSub.credits_remaining >= 999999) ||
      (localSub.free_credits && localSub.free_credits >= 999999)
    );
    
    if (isUnlimitedTester || (localSub && localSub.plan_type === "pro" && localSub.status === "active")) {
      const planLimits = isUnlimitedTester 
        ? { maxFiles: 10000, maxRepos: -1 } // Enterprise limits for testers
        : { maxFiles: 500, maxRepos: 50 }; // Pro limits
      
      logStep("User has Pro access (tester or active subscription)", { isUnlimitedTester, planLimits });
      return new Response(JSON.stringify({ 
        subscribed: true,
        plan_type: isUnlimitedTester ? "enterprise" : "pro",
        credits_remaining: localSub.credits_remaining,
        subscription_end: localSub.current_period_end,
        limits: planLimits,
        limit_source: isUnlimitedTester ? 'tester' : 'subscription',
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
          limits: { maxFiles: 500, maxRepos: 20 }, // Pack limits (more generous)
          limit_source: 'subscription',
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
      
      return new Response(JSON.stringify({ 
        subscribed: false, 
        plan_type: "free",
        limits: { maxFiles: 100, maxRepos: 3 },
        limit_source: 'free',
      }), {
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
        limits: { maxFiles: 500, maxRepos: 50 },
        limit_source: 'subscription',
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
        limits: { maxFiles: 500, maxRepos: 20 }, // Pack limits
        limit_source: 'subscription',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("No active subscription or credits found");
    return new Response(JSON.stringify({ 
      subscribed: false, 
      plan_type: "free",
      limits: { maxFiles: 100, maxRepos: 3 },
      limit_source: 'free',
    }), {
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
