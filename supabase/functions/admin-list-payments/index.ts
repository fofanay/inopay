import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-LIST-PAYMENTS] ${step}${detailsStr}`);
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
    const starting_after = url.searchParams.get("starting_after") || undefined;

    // Get payment intents
    const paymentIntents = await stripe.paymentIntents.list({
      limit,
      starting_after,
      expand: ["data.customer"],
    });
    logStep("Fetched payment intents", { count: paymentIntents.data.length });

    // Get balance
    const balance = await stripe.balance.retrieve();
    logStep("Fetched balance");

    // Get recent charges for refund info
    const charges = await stripe.charges.list({ limit: 100 });

    // Calculate stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthTimestamp = Math.floor(startOfMonth.getTime() / 1000);

    const monthlyRevenue = paymentIntents.data
      .filter((pi: Stripe.PaymentIntent) => pi.status === "succeeded" && pi.created >= startOfMonthTimestamp)
      .reduce((sum: number, pi: Stripe.PaymentIntent) => sum + (pi.amount || 0), 0);

    const totalRefunds = charges.data
      .filter((c: Stripe.Charge) => c.refunded)
      .reduce((sum: number, c: Stripe.Charge) => sum + (c.amount_refunded || 0), 0);

    const successfulPayments = paymentIntents.data.filter((pi: Stripe.PaymentIntent) => pi.status === "succeeded").length;

    return new Response(JSON.stringify({
      payments: paymentIntents.data.map((pi: Stripe.PaymentIntent) => ({
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
        created: pi.created,
        customer_email: typeof pi.customer === "object" && pi.customer ? (pi.customer as Stripe.Customer).email : null,
        customer_name: typeof pi.customer === "object" && pi.customer ? (pi.customer as Stripe.Customer).name : null,
        description: pi.description,
        metadata: pi.metadata,
      })),
      has_more: paymentIntents.has_more,
      balance: {
        available: balance.available,
        pending: balance.pending,
      },
      stats: {
        monthly_revenue: monthlyRevenue,
        total_refunds: totalRefunds,
        successful_payments: successfulPayments,
        total_payments: paymentIntents.data.length,
      },
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
