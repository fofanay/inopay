import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOTPRequest {
  email: string;
  otpCode: string;
  language?: string;
}

// Simple hash function to verify password
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otpCode, language = "fr" }: VerifyOTPRequest = await req.json();

    console.log(`[verify-otp] Verifying OTP for email: ${email.substring(0, 3)}***`);

    // Validate inputs
    if (!email || !otpCode) {
      console.error("[verify-otp] Missing email or OTP code");
      return new Response(
        JSON.stringify({ error: "Email et code OTP requis" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otpCode)) {
      console.error("[verify-otp] Invalid OTP format");
      return new Response(
        JSON.stringify({ error: language === "fr" ? "Le code doit contenir 6 chiffres" : "Code must be 6 digits" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the OTP record
    const { data: otpRecord, error: fetchError } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("email", email)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      console.error("[verify-otp] No OTP record found:", fetchError);
      return new Response(
        JSON.stringify({ 
          error: language === "fr" 
            ? "Aucun code de vérification trouvé. Veuillez en demander un nouveau." 
            : "No verification code found. Please request a new one." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      console.log("[verify-otp] OTP expired");
      // Delete expired record
      await supabase.from("otp_verifications").delete().eq("id", otpRecord.id);
      return new Response(
        JSON.stringify({ 
          error: language === "fr" 
            ? "Le code a expiré. Veuillez en demander un nouveau." 
            : "Code has expired. Please request a new one." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      console.log("[verify-otp] Max attempts exceeded");
      // Delete record after max attempts
      await supabase.from("otp_verifications").delete().eq("id", otpRecord.id);
      return new Response(
        JSON.stringify({ 
          error: language === "fr" 
            ? "Trop de tentatives. Veuillez demander un nouveau code." 
            : "Too many attempts. Please request a new code." 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Increment attempts
    await supabase
      .from("otp_verifications")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    // Verify OTP code
    if (otpRecord.otp_code !== otpCode) {
      const remainingAttempts = otpRecord.max_attempts - otpRecord.attempts - 1;
      console.log(`[verify-otp] Invalid OTP. ${remainingAttempts} attempts remaining`);
      return new Response(
        JSON.stringify({ 
          error: language === "fr" 
            ? `Code incorrect. ${remainingAttempts} tentative(s) restante(s).` 
            : `Incorrect code. ${remainingAttempts} attempt(s) remaining.` 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[verify-otp] OTP verified successfully, creating user...");

    // OTP is valid - create the user
    // We need to get the original password from a separate secure mechanism
    // For now, we'll use a workaround with signUp using a temporary password
    // then immediately sign in
    
    // Mark OTP as verified
    await supabase
      .from("otp_verifications")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Create the user with admin API - using a temporary password
    // The password hash is stored, but we can't reverse it
    // So we'll use a different approach: create user with email confirmation skipped
    const tempPassword = crypto.randomUUID();
    
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Skip email confirmation since we already verified
    });

    if (createError) {
      console.error("[verify-otp] User creation error:", createError);
      
      // If user already exists, try to sign them in
      if (createError.message.includes("already registered") || createError.message.includes("already exists")) {
        return new Response(
          JSON.stringify({ 
            error: language === "fr" 
              ? "Un compte existe déjà avec cet email. Veuillez vous connecter." 
              : "An account already exists with this email. Please log in." 
          }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("[verify-otp] User created successfully:", createData.user?.id);

    // Update user password to the one they originally provided
    // We stored a hash, so we need the frontend to send the password again
    // This is handled by returning a special response that tells frontend to complete signup

    // Delete the OTP record
    await supabase.from("otp_verifications").delete().eq("id", otpRecord.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: language === "fr" 
          ? "Compte créé avec succès !" 
          : "Account created successfully!",
        userId: createData.user?.id,
        tempPassword, // Frontend will use this to sign in and then update password
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[verify-otp] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur inattendue" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
