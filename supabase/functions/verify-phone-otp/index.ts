import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PHONE-OTP] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Session invalide");
    }
    const user = userData.user;
    logStep("User authenticated", { userId: user.id });

    const { code, phone } = await req.json();
    
    if (!code || code.length !== 6) {
      throw new Error("Code invalide - 6 chiffres requis");
    }

    // Get stored OTP
    const { data: otpRecord, error: fetchError } = await supabaseClient
      .from('otp_verifications')
      .select('*')
      .eq('email', `phone:${user.id}`)
      .single();

    if (fetchError || !otpRecord) {
      logStep("OTP not found");
      throw new Error("Aucun code en attente. Veuillez en demander un nouveau.");
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      logStep("OTP expired");
      throw new Error("Le code a expiré. Veuillez en demander un nouveau.");
    }

    // Check attempts
    if (otpRecord.attempts >= 5) {
      logStep("Too many attempts");
      throw new Error("Trop de tentatives. Veuillez demander un nouveau code.");
    }

    // Increment attempts
    await supabaseClient
      .from('otp_verifications')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id);

    // Verify code
    if (otpRecord.otp_code !== code) {
      logStep("Invalid code");
      throw new Error("Code incorrect");
    }

    // Code is valid - mark phone as verified
    const verifiedPhone = otpRecord.password_hash; // Phone was stored here

    // Update profile
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ 
        phone: verifiedPhone,
        phone_verified: true 
      })
      .eq('id', user.id);

    if (updateError) {
      logStep("Error updating profile", { error: updateError.message });
      throw new Error("Erreur lors de la mise à jour du profil");
    }

    // Delete the OTP record
    await supabaseClient
      .from('otp_verifications')
      .delete()
      .eq('id', otpRecord.id);

    logStep("Phone verified successfully", { phone: verifiedPhone.substring(0, 4) + "****" });

    return new Response(JSON.stringify({ 
      success: true,
      message: "Téléphone vérifié avec succès",
      phone: verifiedPhone
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
