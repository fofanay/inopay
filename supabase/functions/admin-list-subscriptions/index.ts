import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-LIST-SUBSCRIPTIONS] ${step}${detailsStr}`);
};

serve(async (req: Request) => {
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

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const status = url.searchParams.get("status") || "all";
    const starting_after = url.searchParams.get("starting_after") || undefined;

    // Get subscriptions - only expand customer to stay within Stripe's 4-level limit
    const subscriptionsParams: Stripe.SubscriptionListParams = {
      limit,
      starting_after,
      expand: ["data.customer"],
    };

    if (status !== "all") {
      subscriptionsParams.status = status as Stripe.SubscriptionListParams["status"];
    }

    const subscriptions = await stripe.subscriptions.list(subscriptionsParams);
    logStep("Fetched subscriptions", { count: subscriptions.data.length });

    // Get products for plan names
    const products = await stripe.products.list({ limit: 100, active: true });
    const productMap = new Map<string, Stripe.Product>(products.data.map((p: Stripe.Product) => [p.id, p]));

    // Get coupons
    const coupons = await stripe.coupons.list({ limit: 50 });
    logStep("Fetched coupons", { count: coupons.data.length });

    // Calculate stats
    const activeCount = subscriptions.data.filter((s: Stripe.Subscription) => s.status === "active").length;
    const canceledCount = subscriptions.data.filter((s: Stripe.Subscription) => s.status === "canceled").length;
    const trialingCount = subscriptions.data.filter((s: Stripe.Subscription) => s.status === "trialing").length;

    const mrr = subscriptions.data
      .filter((s: Stripe.Subscription) => s.status === "active")
      .reduce((sum: number, s: Stripe.Subscription) => {
        const item = s.items.data[0];
        if (item?.price?.recurring?.interval === "month") {
          return sum + (item.price.unit_amount || 0);
        } else if (item?.price?.recurring?.interval === "year") {
          return sum + Math.round((item.price.unit_amount || 0) / 12);
        }
        return sum;
      }, 0);

    return new Response(JSON.stringify({
      subscriptions: subscriptions.data.map((sub: Stripe.Subscription) => {
        const item = sub.items.data[0];
        const productId = typeof item?.price?.product === "string" 
          ? item.price.product 
          : (item?.price?.product as Stripe.Product)?.id;
        const product = productId ? productMap.get(productId) : null;

        return {
          id: sub.id,
          status: sub.status,
          customer_email: typeof sub.customer === "object" ? (sub.customer as Stripe.Customer)?.email : null,
          customer_name: typeof sub.customer === "object" ? (sub.customer as Stripe.Customer)?.name : null,
          customer_id: typeof sub.customer === "string" ? sub.customer : (sub.customer as Stripe.Customer)?.id,
          plan_name: product?.name || "Unknown",
          amount: item?.price?.unit_amount || 0,
          currency: item?.price?.currency || "eur",
          interval: item?.price?.recurring?.interval || "month",
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
          cancel_at_period_end: sub.cancel_at_period_end,
          created: sub.created,
        };
      }),
      has_more: subscriptions.has_more,
      coupons: coupons.data.map((c: Stripe.Coupon) => ({
        id: c.id,
        name: c.name,
        percent_off: c.percent_off,
        amount_off: c.amount_off,
        currency: c.currency,
        duration: c.duration,
        times_redeemed: c.times_redeemed,
        valid: c.valid,
      })),
      stats: {
        active: activeCount,
        canceled: canceledCount,
        trialing: trialingCount,
        mrr,
      },
      products: products.data.map((p: Stripe.Product) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        active: p.active,
      })),
    }), {
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
