import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Template HTML professionnel aux couleurs Inopay
const getWelcomeEmailTemplate = (userName: string, userEmail: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue chez Inopay</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1A202C 0%, #2D3748 100%); padding: 40px 30px; text-align: center;">
              <img src="https://getinopay.com/inopay-logo-email.png" alt="Inopay" style="height: 50px; margin-bottom: 20px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                Bienvenue chez Inopay
              </h1>
              <p style="margin: 10px 0 0; color: #A0AEC0; font-size: 16px;">
                Une division d'Inovaq Canada Inc.
              </p>
            </td>
          </tr>
          
          <!-- Sovereignty Badge -->
          <tr>
            <td style="padding: 30px; text-align: center; background: linear-gradient(180deg, #1A202C 0%, #ffffff 50%);">
              <div style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); padding: 16px 32px; border-radius: 50px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                <span style="color: #ffffff; font-size: 18px; font-weight: 600;">
                  🎉 Vous êtes maintenant Souverain
                </span>
              </div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <p style="color: #1A202C; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Bonjour${userName ? ` <strong>${userName}</strong>` : ''},
              </p>
              <p style="color: #4A5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Félicitations pour votre inscription sur <strong style="color: #3B82F6;">Inopay</strong> ! 
                Vous avez fait le premier pas vers la <strong>souveraineté numérique totale</strong>.
              </p>
              
              <!-- What is Sovereignty -->
              <div style="background-color: #F7FAFC; border-left: 4px solid #3B82F6; padding: 20px; border-radius: 0 8px 8px 0; margin: 24px 0;">
                <h3 style="color: #1A202C; font-size: 18px; margin: 0 0 12px;">
                  Que signifie être Souverain ?
                </h3>
                <ul style="color: #4A5568; font-size: 15px; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li><strong>Votre code</strong> est sur votre GitHub personnel</li>
                  <li><strong>Vos données</strong> sont sur votre Supabase</li>
                  <li><strong>Votre application</strong> tourne sur votre VPS</li>
                  <li><strong>Zéro dépendance</strong> aux plateformes tierces</li>
                </ul>
              </div>
              
              <p style="color: #4A5568; font-size: 16px; line-height: 1.6; margin: 20px 0;">
                Pour activer votre souveraineté complète, il vous suffit de connecter vos propres outils 
                (GitHub, Supabase, VPS) dans votre tableau de bord.
              </p>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <a href="https://getinopay.com/dashboard?tab=sovereign" 
                 style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 40px; border-radius: 8px; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                Compléter ma configuration souveraine →
              </a>
            </td>
          </tr>
          
          <!-- Steps Preview -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background-color: #1A202C; border-radius: 12px; padding: 24px; color: #ffffff;">
                <h4 style="margin: 0 0 16px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #A0AEC0;">
                  Les 3 étapes vers la liberté
                </h4>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top; width: 30px;">
                      <span style="display: inline-block; width: 24px; height: 24px; background-color: #3B82F6; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">1</span>
                    </td>
                    <td style="padding: 8px 0; color: #E2E8F0; font-size: 14px;">
                      <strong>Connecter GitHub</strong> - Votre coffre-fort de code
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="display: inline-block; width: 24px; height: 24px; background-color: #3B82F6; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">2</span>
                    </td>
                    <td style="padding: 8px 0; color: #E2E8F0; font-size: 14px;">
                      <strong>Connecter Supabase</strong> - Votre mémoire souveraine
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; vertical-align: top;">
                      <span style="display: inline-block; width: 24px; height: 24px; background-color: #3B82F6; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">3</span>
                    </td>
                    <td style="padding: 8px 0; color: #E2E8F0; font-size: 14px;">
                      <strong>Configurer le VPS</strong> - Votre infrastructure personnelle
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          
          <!-- Support -->
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <p style="color: #718096; font-size: 14px; margin: 0;">
                Des questions ? Répondez simplement à cet email ou contactez-nous à 
                <a href="mailto:support@getinopay.com" style="color: #3B82F6; text-decoration: none;">support@getinopay.com</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1A202C; padding: 30px 40px; text-align: center;">
              <p style="color: #A0AEC0; font-size: 14px; margin: 0 0 10px;">
                <strong style="color: #ffffff;">Inopay</strong> - Libérez votre code
              </p>
              <p style="color: #718096; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} Inovaq Canada Inc. Tous droits réservés.
              </p>
              <p style="color: #718096; font-size: 12px; margin: 10px 0 0;">
                <a href="https://getinopay.com" style="color: #3B82F6; text-decoration: none;">Site web</a>
                &nbsp;•&nbsp;
                <a href="https://getinopay.com/privacy" style="color: #3B82F6; text-decoration: none;">Confidentialité</a>
                &nbsp;•&nbsp;
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
      from: "Inopay <welcome@getinopay.com>",
      to: [email],
      subject: "🎉 Bienvenue chez Inopay - Devenez Souverain de votre code",
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
