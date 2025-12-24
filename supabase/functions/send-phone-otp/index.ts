import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PHONE-OTP] ${step}${detailsStr}`);
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
    logStep("Function started");

    // Get Twilio credentials
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      throw new Error("Twilio not configured");
    }

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

    const { phone } = await req.json();
    
    if (!phone) {
      throw new Error("Numéro de téléphone requis");
    }

    // Validate phone format (basic validation)
    const cleanPhone = phone.replace(/\s/g, "");
    if (!/^\+?[0-9]{10,15}$/.test(cleanPhone)) {
      throw new Error("Format de téléphone invalide");
    }

    logStep("Phone received", { phone: cleanPhone.substring(0, 4) + "****" });

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database (reuse otp_verifications table with phone as email)
    const { error: insertError } = await supabaseClient
      .from('otp_verifications')
      .upsert({
        email: `phone:${user.id}`, // Use user id as unique identifier
        otp_code: otpCode,
        password_hash: cleanPhone, // Store phone number
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        verified: false,
      }, {
        onConflict: 'email'
      });

    if (insertError) {
      logStep("Error storing OTP", { error: insertError.message });
      throw new Error("Erreur lors de la création du code");
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioAuth = btoa(`${accountSid}:${authToken}`);

    const smsBody = `Votre code de vérification Inopay est: ${otpCode}. Ce code expire dans 10 minutes.`;

    const smsResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${twilioAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: twilioPhone,
        To: cleanPhone,
        Body: smsBody,
      }),
    });

    if (!smsResponse.ok) {
      const errorData = await smsResponse.text();
      logStep("Twilio error", { status: smsResponse.status, error: errorData });
      throw new Error("Impossible d'envoyer le SMS. Vérifiez le numéro de téléphone.");
    }

    logStep("SMS sent successfully");

    return new Response(JSON.stringify({ 
      success: true,
      message: "Code envoyé par SMS"
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
