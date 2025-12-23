import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Template HTML professionnel - Onboarding Email #1: Bienvenue
const getWelcomeEmailTemplate = (userName: string, userEmail: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue chez Inopay</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0F172A;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #1A202C; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <!-- Header avec Logo -->
          <tr>
            <td style="background: linear-gradient(135deg, #1A202C 0%, #2D3748 100%); padding: 40px 30px; text-align: center; border-bottom: 1px solid rgba(59, 130, 246, 0.2);">
              <img src="https://getinopay.com/inopay-logo-email.png" alt="Inopay" style="height: 50px; margin-bottom: 24px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; line-height: 1.2;">
                🚀 Bienvenue chez Inopay
              </h1>
              <p style="margin: 12px 0 0; color: #94A3B8; font-size: 16px;">
                Préparez-vous à la souveraineté
              </p>
            </td>
          </tr>
          
          <!-- Badge Inovaq -->
          <tr>
            <td style="padding: 24px 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); padding: 8px 16px; border-radius: 50px;">
                <span style="color: #3B82F6; font-size: 12px; font-weight: 500;">
                  ✓ Une initiative d'Inovaq Canada Inc. (Québec) – Conforme Loi 25
                </span>
              </div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <p style="color: #E2E8F0; font-size: 18px; line-height: 1.6; margin: 0 0 24px;">
                Bonjour${userName ? ` <strong style="color: #ffffff;">${userName}</strong>` : ''},
              </p>
              
              <p style="color: #94A3B8; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">
                <strong style="color: #10B981;">Félicitations !</strong> Vous venez de rejoindre le mouvement des développeurs qui reprennent le contrôle de leur code.
              </p>
              
              <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 12px; padding: 24px; margin: 24px 0;">
                <p style="color: #ffffff; font-size: 18px; font-weight: 600; margin: 0 0 12px; font-style: italic;">
                  "Le code est une propriété, pas un abonnement."
                </p>
                <p style="color: #94A3B8; font-size: 14px; margin: 0;">
                  Votre code va enfin vous appartenir. Plus de lock-in, plus de dépendances cachées.
                </p>
              </div>
              
              <p style="color: #94A3B8; font-size: 16px; line-height: 1.7; margin: 24px 0;">
                Pour activer votre souveraineté complète, connectez vos outils en quelques clics :
              </p>
            </td>
          </tr>
          
          <!-- CTA Principal -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <a href="https://getinopay.com/dashboard?tab=sovereign" 
                 style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 18px 48px; border-radius: 8px; box-shadow: 0 8px 24px rgba(59, 130, 246, 0.4);">
                Configurer mes accès (GitHub & VPS) →
              </a>
            </td>
          </tr>
          
          <!-- 3 Étapes -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background-color: #0F172A; border-radius: 12px; padding: 24px;">
                <h4 style="margin: 0 0 20px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #64748B;">
                  Votre parcours vers la liberté
                </h4>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; vertical-align: middle; width: 40px;">
                      <span style="display: inline-block; width: 32px; height: 32px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px; font-weight: 700; color: #ffffff;">1</span>
                    </td>
                    <td style="padding: 12px 0; color: #E2E8F0; font-size: 15px;">
                      <strong>Connecter GitHub</strong> <span style="color: #64748B;">— Votre coffre-fort de code</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; vertical-align: middle;">
                      <span style="display: inline-block; width: 32px; height: 32px; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px; font-weight: 700; color: #ffffff;">2</span>
                    </td>
                    <td style="padding: 12px 0; color: #E2E8F0; font-size: 15px;">
                      <strong>Configurer le VPS</strong> <span style="color: #64748B;">— Votre serveur personnel</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; vertical-align: middle;">
                      <span style="display: inline-block; width: 32px; height: 32px; background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); border-radius: 50%; text-align: center; line-height: 32px; font-size: 14px; font-weight: 700; color: #ffffff;">3</span>
                    </td>
                    <td style="padding: 12px 0; color: #E2E8F0; font-size: 15px;">
                      <strong>Lancer la libération</strong> <span style="color: #64748B;">— Reprenez les clés</span>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #0F172A; padding: 30px 40px; text-align: center; border-top: 1px solid rgba(148, 163, 184, 0.1);">
              <p style="color: #64748B; font-size: 13px; margin: 0 0 12px; font-weight: 500;">
                Inovaq Canada Inc. – Protéger votre propriété intellectuelle.
              </p>
              <p style="color: #475569; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Inovaq Canada Inc. (Québec) • 
                <a href="https://getinopay.com/privacy" style="color: #3B82F6; text-decoration: none;">Confidentialité</a> • 
                <a href="https://getinopay.com/terms" style="color: #3B82F6; text-decoration: none;">Conditions</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Configuration email manquante");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { userId, email, name } = await req.json();
    
    if (!email) {
      throw new Error("Email requis");
    }

    console.log("Sending welcome email to:", email);

    // Generate HTML template
    const htmlContent = getWelcomeEmailTemplate(name || "", email);

    // Send via Resend
    const resend = new Resend(resendApiKey);
    const result = await resend.emails.send({
      from: "Inopay <contact@getinopay.com>",
      to: [email],
      subject: "🚀 Bienvenue chez Inopay – Préparez-vous à la souveraineté",
      html: htmlContent,
    });

    console.log("Welcome email sent:", result);

    // Log email in database
    if (userId) {
      await supabase.from("email_logs").insert({
        user_id: userId,
        user_email: email,
        subject: "Bienvenue chez Inopay - Devenez Souverain",
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error sending welcome email:", message);
    
    return new Response(
      JSON.stringify({ error: message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
