import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-LIBERATION-SUCCESS] ${step}${detailsStr}`);
};

// Template HTML - Onboarding Email #3: Libération réussie
const getSuccessEmailTemplate = (userName: string, projectName: string, vpsIp: string, githubUrl: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mission accomplie !</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0F172A;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #1A202C; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <!-- Header avec confettis -->
          <tr>
            <td style="background: linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%); padding: 48px 30px; text-align: center;">
              <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; line-height: 1.2;">
                Mission accomplie !
              </h1>
              <p style="margin: 12px 0 0; color: rgba(255,255,255,0.9); font-size: 18px;">
                Votre code est désormais souverain
              </p>
            </td>
          </tr>
          
          <!-- Badge de succès -->
          <tr>
            <td style="padding: 30px 30px 0; text-align: center;">
              <div style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 16px 32px; border-radius: 12px; box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);">
                <span style="color: #ffffff; font-size: 16px; font-weight: 600;">
                  ✅ Projet "${projectName}" libéré avec succès
                </span>
              </div>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 40px;">
              <p style="color: #E2E8F0; font-size: 18px; line-height: 1.6; margin: 0 0 24px;">
                Félicitations${userName ? ` <strong style="color: #ffffff;">${userName}</strong>` : ''} ! 🚀
              </p>
              
              <p style="color: #94A3B8; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">
                Votre projet <strong style="color: #10B981;">${projectName}</strong> est maintenant :
              </p>
              
              <!-- Résumé de la libération -->
              <div style="background-color: #0F172A; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
                      <span style="color: #64748B; font-size: 13px; text-transform: uppercase;">GitHub Personnel</span>
                      <p style="color: #E2E8F0; font-size: 15px; margin: 4px 0 0;">
                        <a href="${githubUrl}" style="color: #3B82F6; text-decoration: none;">${githubUrl || 'Votre repository'}</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
                      <span style="color: #64748B; font-size: 13px; text-transform: uppercase;">Serveur VPS</span>
                      <p style="color: #E2E8F0; font-size: 15px; margin: 4px 0 0;">
                        ${vpsIp || 'Votre infrastructure personnelle'}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <span style="color: #64748B; font-size: 13px; text-transform: uppercase;">Statut Sécurité</span>
                      <p style="color: #10B981; font-size: 15px; margin: 4px 0 0; font-weight: 600;">
                        ✓ Aucune "Shadow Door" détectée
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Certificat Card -->
              <div style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                <h3 style="color: #E2E8F0; font-size: 16px; margin: 0 0 12px;">
                  🏆 Certificat de Souveraineté
                </h3>
                <p style="color: #94A3B8; font-size: 14px; margin: 0 0 16px;">
                  Téléchargez votre certificat attestant que votre code a été nettoyé et est 100% indépendant.
                </p>
                <a href="https://getinopay.com/dashboard/certificate/${projectName}" 
                   style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px;">
                  Télécharger mon Certificat de Souveraineté
                </a>
              </div>
              
              <!-- What's next -->
              <div style="background-color: #0F172A; border-radius: 12px; padding: 20px; margin-top: 24px;">
                <h4 style="color: #E2E8F0; font-size: 14px; margin: 0 0 12px;">
                  Et maintenant ?
                </h4>
                <ul style="color: #94A3B8; font-size: 14px; margin: 0; padding-left: 20px; line-height: 1.8;">
                  <li>Invitez des collaborateurs sur votre repository GitHub</li>
                  <li>Configurez un domaine personnalisé pour votre application</li>
                  <li>Libérez d'autres projets depuis votre dashboard</li>
                </ul>
              </div>
            </td>
          </tr>
          
          <!-- CTA Dashboard -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <a href="https://getinopay.com/dashboard" 
                 style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 16px 40px; border-radius: 8px; box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);">
                Accéder à mon Dashboard →
              </a>
            </td>
          </tr>
          
          <!-- Slogan -->
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <p style="color: #64748B; font-size: 16px; font-style: italic; margin: 0;">
                "Gardez le Vibe. Reprenez le Code."
              </p>
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
    logStep("Function started");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");

    const resend = new Resend(resendKey);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { userId, projectName, vpsIp, githubUrl } = await req.json();

    if (!userId || !projectName) {
      throw new Error("userId and projectName are required");
    }

    // Get user info
    const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(userId);
    
    if (userError || !userData.user?.email) {
      throw new Error("User not found");
    }

    const userName = userData.user.user_metadata?.full_name || userData.user.email.split('@')[0];
    const userEmail = userData.user.email;

    logStep("Sending success email", { to: userEmail, project: projectName });

    const htmlContent = getSuccessEmailTemplate(userName, projectName, vpsIp || '', githubUrl || '');

    const result = await resend.emails.send({
      from: "Inopay <contact@getinopay.com>",
      to: [userEmail],
      subject: `✅ Mission accomplie : ${projectName} est désormais souverain !`,
      html: htmlContent,
    });

    // Log the email
    await supabaseClient.from("email_logs").insert({
      user_id: userId,
      user_email: userEmail,
      subject: `✅ Mission accomplie : ${projectName} est désormais souverain !`,
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    logStep("Success email sent", { result });

    return new Response(JSON.stringify({ success: true, data: result }), {
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
