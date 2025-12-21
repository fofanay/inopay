import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Vérifier l'authentification admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      throw new Error("Non autorisé");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      console.error("Auth error:", authError?.message);
      throw new Error("Non autorisé");
    }

    console.log("User authenticated:", userData.user.id);

    // Vérifier le rôle admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      console.error("Role check failed:", roleError?.message);
      throw new Error("Accès admin requis");
    }

    console.log("Admin role verified");

    // Récupérer les paramètres
    const { to, subject, html } = await req.json();
    
    if (!to || !subject || !html) {
      console.error("Missing parameters:", { to: !!to, subject: !!subject, html: !!html });
      throw new Error("Paramètres manquants: to, subject et html sont requis");
    }

    console.log("Sending email to:", to, "Subject:", subject);

    // Envoyer l'email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Configuration Resend manquante");
    }

    const resend = new Resend(resendApiKey);
    const result = await resend.emails.send({
      from: "Inopay <contact@getinopay.com>",
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    console.log("Email sent successfully:", result);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error in send-email function:", message);
    
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
