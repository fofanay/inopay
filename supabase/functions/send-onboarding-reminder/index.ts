import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-ONBOARDING-REMINDER] ${step}${detailsStr}`);
};

// Template HTML - Onboarding Email #2: Relance 24h
const getReminderEmailTemplate = (userName: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Plus qu'une étape...</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0F172A;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #1A202C; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1A202C 0%, #2D3748 100%); padding: 40px 30px; text-align: center; border-bottom: 1px solid rgba(251, 191, 36, 0.2);">
              <img src="https://getinopay.com/inopay-logo-email.png" alt="Inopay" style="height: 50px; margin-bottom: 24px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; line-height: 1.2;">
                ⏳ Plus qu'une étape pour libérer votre premier projet...
              </h1>
            </td>
          </tr>
          
          <!-- Urgence Badge -->
          <tr>
            <td style="padding: 24px 30px; text-align: center;">
              <div style="display: inline-block; background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); padding: 12px 24px; border-radius: 8px;">
                <span style="color: #FBBF24; font-size: 14px; font-weight: 600;">
                  ⚡ Configuration en 2 minutes chrono
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
              
              <p style="color: #94A3B8; font-size: 16px; line-height: 1.7; margin: 0 0 20px;">
                Nous avons remarqué que vous n'avez pas encore terminé la connexion à votre GitHub et VPS. 
                <strong style="color: #E2E8F0;">Il ne reste que quelques clics</strong> pour reprendre le contrôle de votre code !
              </p>
              
              <!-- Économies Card -->
              <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h3 style="color: #10B981; font-size: 16px; margin: 0 0 16px; font-weight: 600;">
                  💰 Ce que vous économiserez en quittant les plateformes propriétaires :
                </h3>
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; color: #E2E8F0; font-size: 15px;">
                      <span style="color: #EF4444; text-decoration: line-through;">100€/mois</span> → <strong style="color: #10B981;">15€/mois</strong> d'hébergement
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #94A3B8; font-size: 14px;">
                      ✓ Code 100% propre, sans trackers
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #94A3B8; font-size: 14px;">
                      ✓ Déploiement automatique sur votre infrastructure
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="color: #94A3B8; font-size: 15px; line-height: 1.7; margin: 20px 0;">
                La connexion à GitHub et à votre VPS ne prend que <strong style="color: #FBBF24;">2 minutes</strong>. 
                Après ça, vous êtes libre.
              </p>
            </td>
          </tr>
          
          <!-- CTA Principal -->
          <tr>
            <td style="padding: 0 40px 32px; text-align: center;">
              <a href="https://getinopay.com/dashboard?tab=sovereign" 
                 style="display: inline-block; background: linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%); color: #0F172A; text-decoration: none; font-size: 16px; font-weight: 700; padding: 18px 48px; border-radius: 8px; box-shadow: 0 8px 24px rgba(251, 191, 36, 0.4);">
                Terminer ma configuration →
              </a>
            </td>
          </tr>
          
          <!-- Besoin d'aide -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background-color: #0F172A; border-radius: 12px; padding: 20px; text-align: center;">
                <p style="color: #94A3B8; font-size: 14px; margin: 0;">
                  Besoin d'aide ? Notre guide de configuration est disponible 
                  <a href="https://getinopay.com/docs/setup" style="color: #3B82F6; text-decoration: none; font-weight: 500;">ici</a>, 
                  ou répondez simplement à cet email.
                </p>
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
                <a href="https://getinopay.com/unsubscribe" style="color: #3B82F6; text-decoration: none;">Se désinscrire</a>
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

    // Get users who signed up 24h ago and haven't completed setup
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const twentyFiveHoursAgo = new Date();
    twentyFiveHoursAgo.setHours(twentyFiveHoursAgo.getHours() - 25);

    // Get users without any servers configured (wizard not completed)
    const { data: userServers } = await supabaseClient
      .from("user_servers")
      .select("user_id");
    
    const usersWithServers = new Set(userServers?.map(s => s.user_id) || []);

    // Get users without GitHub token configured
    const { data: userSettings } = await supabaseClient
      .from("user_settings")
      .select("user_id, github_token");
    
    const usersWithGithub = new Set(
      userSettings?.filter(s => s.github_token)?.map(s => s.user_id) || []
    );

    // List all users and filter those who need reminder
    const { data: authData } = await supabaseClient.auth.admin.listUsers();
    
    if (!authData?.users) {
      logStep("No users found");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const user of authData.users) {
      const createdAt = new Date(user.created_at);
      
      // Check if user was created between 24-25 hours ago
      if (createdAt < twentyFiveHoursAgo || createdAt > twentyFourHoursAgo) {
        continue;
      }

      // Check if wizard incomplete (no server OR no github)
      const hasServer = usersWithServers.has(user.id);
      const hasGithub = usersWithGithub.has(user.id);
      
      if (hasServer && hasGithub) {
        logStep("User already configured", { userId: user.id });
        continue;
      }

      // Check if we already sent this reminder
      const { data: existingLog } = await supabaseClient
        .from("email_logs")
        .select("id")
        .eq("user_id", user.id)
        .eq("subject", "⏳ Plus qu'une étape pour libérer votre premier projet...")
        .single();

      if (existingLog) {
        logStep("Reminder already sent", { userId: user.id });
        continue;
      }

      const userName = user.user_metadata?.full_name || user.email?.split('@')[0];
      const htmlContent = getReminderEmailTemplate(userName);

      try {
        await resend.emails.send({
          from: "Inopay <contact@getinopay.com>",
          to: [user.email!],
          subject: "⏳ Plus qu'une étape pour libérer votre premier projet...",
          html: htmlContent,
        });

        await supabaseClient.from("email_logs").insert({
          user_id: user.id,
          user_email: user.email!,
          subject: "⏳ Plus qu'une étape pour libérer votre premier projet...",
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        totalSent++;
        logStep("Reminder sent", { to: user.email });
      } catch (emailError) {
        logStep("Failed to send", { to: user.email, error: emailError });
      }
    }

    logStep("Completed", { totalSent });

    return new Response(JSON.stringify({ success: true, sent: totalSent }), {
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
