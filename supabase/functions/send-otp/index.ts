import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOTPRequest {
  email: string;
  password: string;
  language?: string;
}

// Generate a 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Simple hash function for storing password temporarily
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
    const { email, password, language = "fr" }: SendOTPRequest = await req.json();

    console.log(`[send-otp] Received request for email: ${email.substring(0, 3)}***`);

    // Validate inputs
    if (!email || !password) {
      console.error("[send-otp] Missing email or password");
      return new Response(
        JSON.stringify({ error: "Email et mot de passe requis" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("[send-otp] Invalid email format");
      return new Response(
        JSON.stringify({ error: "Format d'email invalide" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate password length
    if (password.length < 6) {
      console.error("[send-otp] Password too short");
      return new Response(
        JSON.stringify({ error: "Le mot de passe doit contenir au moins 6 caractères" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user already exists using listUsers with email filter
    const { data: existingUsers } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    
    const userExists = existingUsers?.users?.some(u => u.email === email);
    if (userExists) {
      console.log("[send-otp] User already exists");
      return new Response(
        JSON.stringify({ error: language === "fr" ? "Un compte existe déjà avec cet email" : "An account already exists with this email" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check rate limiting - no more than 1 OTP per minute per email
    const { data: recentOTP } = await supabase
      .from("otp_verifications")
      .select("created_at")
      .eq("email", email)
      .gte("created_at", new Date(Date.now() - 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (recentOTP) {
      console.log("[send-otp] Rate limited - OTP sent too recently");
      return new Response(
        JSON.stringify({ 
          error: language === "fr" 
            ? "Veuillez attendre 1 minute avant de demander un nouveau code" 
            : "Please wait 1 minute before requesting a new code" 
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Delete any existing OTPs for this email
    await supabase
      .from("otp_verifications")
      .delete()
      .eq("email", email);

    // Generate OTP and hash password
    const otpCode = generateOTP();
    const passwordHash = await hashPassword(password);

    console.log(`[send-otp] Generated OTP for ${email.substring(0, 3)}***`);

    // Store OTP in database
    const { error: insertError } = await supabase
      .from("otp_verifications")
      .insert({
        email,
        otp_code: otpCode,
        password_hash: passwordHash,
      });

    if (insertError) {
      console.error("[send-otp] Database insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erreur lors de la création du code de vérification" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send OTP via email
    const emailContent = language === "fr" 
      ? {
          subject: "Votre code de vérification Inopay",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Inopay</h1>
              </div>
              <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
                <h2 style="color: #1a1a2e;">Vérification de votre email</h2>
                <p style="color: #4a4a4a;">Bienvenue sur Inopay ! Voici votre code de vérification :</p>
                <div style="background: white; border: 2px solid #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 8px;">${otpCode}</span>
                </div>
                <p style="color: #4a4a4a;">Ce code expire dans <strong>10 minutes</strong>.</p>
                <p style="color: #888; font-size: 12px;">Si vous n'avez pas demandé ce code, ignorez cet email.</p>
              </div>
            </div>
          `,
        }
      : {
          subject: "Your Inopay verification code",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Inopay</h1>
              </div>
              <div style="padding: 30px; background: #f8f9fa; border-radius: 0 0 12px 12px;">
                <h2 style="color: #1a1a2e;">Email Verification</h2>
                <p style="color: #4a4a4a;">Welcome to Inopay! Here is your verification code:</p>
                <div style="background: white; border: 2px solid #6366f1; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; color: #6366f1; letter-spacing: 8px;">${otpCode}</span>
                </div>
                <p style="color: #4a4a4a;">This code expires in <strong>10 minutes</strong>.</p>
                <p style="color: #888; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
              </div>
            </div>
          `,
        };

    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const emailResponse = await resend.emails.send({
      from: "Inopay <contact@getinopay.com>",
      to: [email],
      subject: emailContent.subject,
      html: emailContent.html,
    });

    console.log("[send-otp] Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: language === "fr" 
          ? "Code de vérification envoyé par email" 
          : "Verification code sent to your email" 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[send-otp] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erreur inattendue" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
