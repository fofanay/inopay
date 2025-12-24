// @inopay-core-protected
// INOPAY PAYMENT SYSTEM - Checkout Session Creator
// This file MUST NOT be cleaned or removed during self-liberation
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { withRateLimit } from "../_shared/rate-limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  profile_completed: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting - 10 requests per minute per user
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");
  let userId: string | null = null;
  
  if (token) {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data } = await supabaseClient.auth.getUser(token);
    userId = data.user?.id || null;
  }

  const rateLimitResponse = withRateLimit(req, userId, "create-checkout", corsHeaders);
  if (rateLimitResponse) {
    logStep("Rate limit exceeded", { userId: userId?.substring(0, 8) });
    return rateLimitResponse;
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const { priceId, mode, serviceType } = await req.json();
    logStep("Request body parsed", { priceId, mode, serviceType });

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Fetch user profile to verify completion and get billing info
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      logStep("Profile fetch error", { error: profileError.message });
      throw new Error("PROFILE_NOT_FOUND");
    }

    const userProfile = profile as UserProfile;
    logStep("Profile fetched", { 
      hasAddress: !!userProfile.billing_address_line1,
      hasCity: !!userProfile.billing_city,
      profileCompleted: userProfile.profile_completed 
    });

    // Check if profile is complete (minimum: name + billing address)
    const isProfileComplete = !!(
      userProfile.first_name &&
      userProfile.last_name &&
      userProfile.billing_address_line1 &&
      userProfile.billing_city &&
      userProfile.billing_postal_code &&
      userProfile.billing_country
    );

    if (!isProfileComplete) {
      logStep("Profile incomplete - blocking checkout");
      return new Response(JSON.stringify({ 
        error: "PROFILE_INCOMPLETE",
        message: "Veuillez compléter votre profil (nom et adresse de facturation) avant de procéder au paiement.",
        redirect: "/profil"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });

      // Update customer with profile data for Stripe Radar
      await stripe.customers.update(customerId, {
        name: `${userProfile.first_name} ${userProfile.last_name}`,
        phone: userProfile.phone || undefined,
        address: {
          line1: userProfile.billing_address_line1 || undefined,
          line2: userProfile.billing_address_line2 || undefined,
          city: userProfile.billing_city || undefined,
          postal_code: userProfile.billing_postal_code || undefined,
          country: userProfile.billing_country || undefined,
        },
      });
      logStep("Customer updated with profile data");
    }

    const origin = req.headers.get("origin") || "https://localhost:3000";

    // Determine plan type based on serviceType
    const planTypeMap: Record<string, string> = {
      deploy: "deploy",
      redeploy: "redeploy",
      monitoring: "monitoring",
      server: "server",
      confort: "confort",
      souverain: "souverain",
    };

    const planType = planTypeMap[serviceType] || (mode === "subscription" ? "monitoring" : "deploy");

    // Build success URL with plan parameter for subscription plans
    const isSubscriptionPlan = serviceType === "confort" || serviceType === "souverain";
    const successUrl = isSubscriptionPlan
      ? `${origin}/payment-success?plan=${serviceType}&session_id={CHECKOUT_SESSION_ID}`
      : `${origin}/payment-success?service=${serviceType || "deploy"}&session_id={CHECKOUT_SESSION_ID}`;

    // Create checkout session with billing address prefilled
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode || "payment",
      success_url: successUrl,
      cancel_url: `${origin}/tarifs`,
      // Prefill billing address from profile
      customer_update: customerId ? {
        address: 'auto',
        name: 'auto',
      } : undefined,
      // For new customers, prefill the address
      ...(customerId ? {} : {
        billing_address_collection: 'required',
      }),
      metadata: {
        user_id: user.id,
        service_type: serviceType || "deploy",
        plan_type: planType,
        customer_name: `${userProfile.first_name} ${userProfile.last_name}`,
        customer_phone: userProfile.phone || '',
        billing_city: userProfile.billing_city || '',
        billing_country: userProfile.billing_country || '',
      },
      // Pass phone to Stripe for fraud detection
      phone_number_collection: {
        enabled: false, // We already have phone from profile
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url, serviceType, planType });

    return new Response(JSON.stringify({ url: session.url }), {
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
