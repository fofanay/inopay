import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-USER-CREDITS] ${step}${detailsStr}`);
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    
    logStep("User authenticated", { userId: user.id });

    // Fetch all purchases for the user
    const { data: purchases, error: purchasesError } = await supabaseClient
      .from("user_purchases")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (purchasesError) {
      logStep("Error fetching purchases", { error: purchasesError });
      throw new Error("Failed to fetch purchases");
    }

    logStep("Purchases fetched", { count: purchases?.length || 0 });

    // Calculate available credits by service type
    const credits = {
      deploy: 0,
      redeploy: 0,
      server: 0,
    };

    // Active monitoring subscriptions
    const activeMonitoring: any[] = [];

    // Recent purchases for history
    const recentPurchases: any[] = [];

    for (const purchase of purchases || []) {
      // Add to recent purchases (for display)
      recentPurchases.push({
        id: purchase.id,
        service_type: purchase.service_type,
        amount: purchase.amount,
        currency: purchase.currency,
        status: purchase.status,
        is_subscription: purchase.is_subscription,
        subscription_status: purchase.subscription_status,
        subscription_ends_at: purchase.subscription_ends_at,
        used: purchase.used,
        deployment_id: purchase.deployment_id,
        created_at: purchase.created_at,
      });

      // Count available credits (not used, not refunded)
      if (purchase.status === "completed" && !purchase.used && !purchase.is_subscription) {
        if (purchase.service_type === "deploy") credits.deploy++;
        if (purchase.service_type === "redeploy") credits.redeploy++;
        if (purchase.service_type === "server") credits.server++;
      }

      // Track active monitoring subscriptions
      if (purchase.is_subscription && purchase.subscription_status === "active" && purchase.service_type === "monitoring") {
        activeMonitoring.push({
          id: purchase.id,
          subscription_ends_at: purchase.subscription_ends_at,
          created_at: purchase.created_at,
        });
      }
    }

    logStep("Credits calculated", { credits, activeMonitoringCount: activeMonitoring.length });

    // Check for legacy credits in subscriptions table
    const { data: legacySub } = await supabaseClient
      .from("subscriptions")
      .select("credits_remaining, free_credits, plan_type, status")
      .eq("user_id", user.id)
      .maybeSingle();

    // Include legacy credits
    const legacyCredits = (legacySub?.credits_remaining || 0) + (legacySub?.free_credits || 0);
    const isUnlimitedTester = legacyCredits >= 999999;
    const isPro = legacySub?.plan_type === "pro" && legacySub?.status === "active";

    return new Response(JSON.stringify({
      credits: {
        deploy: credits.deploy,
        redeploy: credits.redeploy,
        server: credits.server,
        legacy: legacyCredits > 0 && legacyCredits < 999999 ? legacyCredits : 0,
      },
      activeMonitoring,
      recentPurchases: recentPurchases.slice(0, 20),
      isUnlimitedTester,
      isPro,
      totalPurchases: purchases?.length || 0,
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
