// @inopay-core-protected
// INOPAY LIBERATION PAYMENT - Volume Supplement Checkout
// This file MUST NOT be cleaned or removed during self-liberation
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cost calculation constants
const COST_PER_TOKEN_CENTS = 0.003; // Average cost per token for Claude
const CHARS_PER_TOKEN = 4;
const TOKENS_OVERHEAD_PER_FILE = 150;
const INOPAY_MARGIN_MULTIPLIER = 2.5;

interface LiberationQuoteRequest {
  projectName: string;
  projectId?: string;
  totalFiles: number;
  maxFilesAllowed: number;
  filesData?: { path: string; content: string }[];
  selectedPaths?: string[];
}

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

function calculateVolumeSupplement(
  totalFiles: number,
  maxFilesAllowed: number,
  totalChars: number
): { excessFiles: number; baseTokenCost: number; supplementAmount: number } {
  const excessFiles = Math.max(0, totalFiles - maxFilesAllowed);
  
  // Estimate tokens for excess files
  const avgCharsPerFile = totalChars / totalFiles;
  const excessChars = excessFiles * avgCharsPerFile;
  const excessTokens = (excessChars / CHARS_PER_TOKEN) + (excessFiles * TOKENS_OVERHEAD_PER_FILE);
  
  // Calculate base cost
  const baseTokenCost = Math.ceil(excessTokens * COST_PER_TOKEN_CENTS);
  
  // Apply Inopay margin
  const supplementAmount = Math.ceil(baseTokenCost * INOPAY_MARGIN_MULTIPLIER);
  
  // Minimum $5 supplement for large projects
  const finalSupplement = Math.max(500, supplementAmount);
  
  return { excessFiles, baseTokenCost, supplementAmount: finalSupplement };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) {
      throw new Error("Session invalide");
    }
    const user = userData.user;

    // Fetch user profile to verify completion and get billing info
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.log("[LIBERATION-CHECKOUT] Profile fetch error:", profileError.message);
      throw new Error("PROFILE_NOT_FOUND");
    }

    const userProfile = profile as UserProfile;

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
      console.log("[LIBERATION-CHECKOUT] Profile incomplete - blocking checkout");
      return new Response(JSON.stringify({ 
        error: "PROFILE_INCOMPLETE",
        message: "Veuillez compléter votre profil (nom et adresse de facturation) avant de procéder au paiement.",
        redirect: "/profil"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const body: LiberationQuoteRequest = await req.json();
    const { projectName, projectId, totalFiles, maxFilesAllowed, filesData, selectedPaths } = body;

    // Calculate total chars from files
    const totalChars = filesData?.reduce((sum, f) => sum + f.content.length, 0) || (totalFiles * 5000);

    // Calculate volume supplement
    const { excessFiles, baseTokenCost, supplementAmount } = calculateVolumeSupplement(
      totalFiles,
      maxFilesAllowed,
      totalChars
    );

    console.log(`[LIBERATION-CHECKOUT] Quote for ${projectName}: ${excessFiles} excess files, supplement: ${supplementAmount}¢`);

    // Store pending payment record
    const { data: pendingPayment, error: insertError } = await supabaseClient
      .from('pending_liberation_payments')
      .insert({
        user_id: user.id,
        project_name: projectName,
        project_id: projectId,
        total_files: totalFiles,
        max_files_allowed: maxFilesAllowed,
        excess_files: excessFiles,
        base_token_cost_cents: baseTokenCost,
        inopay_margin_multiplier: INOPAY_MARGIN_MULTIPLIER,
        supplement_amount_cents: supplementAmount,
        files_data: filesData,
        selected_paths: selectedPaths,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating pending payment:', insertError);
      throw new Error("Erreur lors de la création du devis");
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      // Return quote without payment link if Stripe not configured
      return new Response(JSON.stringify({
        success: true,
        quote: {
          id: pendingPayment.id,
          excessFiles,
          baseTokenCost,
          supplementAmount,
          supplementFormatted: `$${(supplementAmount / 100).toFixed(2)}`,
        },
        paymentUrl: null,
        message: "Devis calculé. Stripe non configuré.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" as any });

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;

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
      console.log("[LIBERATION-CHECKOUT] Customer updated with profile data");
    }

    // Create dynamic price for the supplement
    const origin = req.headers.get("origin") || "https://app.inopay.ca";
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: 'cad',
            product_data: {
              name: `Supplément Volume - ${projectName}`,
              description: `Libération complète: ${totalFiles} fichiers (${excessFiles} fichiers excédentaires)`,
            },
            unit_amount: supplementAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/dashboard?liberation=success&payment_id=${pendingPayment.id}`,
      cancel_url: `${origin}/dashboard?liberation=cancelled&payment_id=${pendingPayment.id}`,
      // Prefill billing address for new customers
      ...(customerId ? {} : {
        billing_address_collection: 'required',
      }),
      metadata: {
        type: 'liberation_supplement',
        pending_payment_id: pendingPayment.id,
        project_name: projectName,
        excess_files: String(excessFiles),
        customer_name: `${userProfile.first_name} ${userProfile.last_name}`,
        customer_phone: userProfile.phone || '',
        billing_city: userProfile.billing_city || '',
        billing_country: userProfile.billing_country || '',
      },
    });

    // Update pending payment with session ID
    await supabaseClient
      .from('pending_liberation_payments')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', pendingPayment.id);

    console.log(`[LIBERATION-CHECKOUT] Created checkout session ${session.id} for ${supplementAmount}¢`);

    return new Response(JSON.stringify({
      success: true,
      quote: {
        id: pendingPayment.id,
        excessFiles,
        baseTokenCost,
        supplementAmount,
        supplementFormatted: `$${(supplementAmount / 100).toFixed(2)} CAD`,
      },
      paymentUrl: session.url,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error in create-liberation-checkout:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erreur inconnue" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
