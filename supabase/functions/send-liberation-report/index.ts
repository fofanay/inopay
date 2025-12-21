import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LiberationReportEmailData {
  deploymentId: string;
  userEmail: string;
  userName?: string;
  projectName: string;
  deployedUrl?: string;
  hostingProvider: string;
  hostingType: string;
  serverIp?: string;
  coolifyUrl?: string;
  totalSavings: number;
  annualSavings: number;
  servicesReplaced?: Array<{ from: string; to: string; savings: number }>;
  portabilityScoreAfter: number;
}

const generateEmailHtml = (data: LiberationReportEmailData): string => {
  const {
    projectName,
    deployedUrl,
    hostingProvider,
    hostingType,
    serverIp,
    coolifyUrl,
    totalSavings,
    annualSavings,
    servicesReplaced = [],
    portabilityScoreAfter,
    userName,
    deploymentId
  } = data;

  const hostingTypeLabels: Record<string, string> = {
    vps: 'VPS avec Coolify',
    ftp: 'Hébergement Classique (FTP)',
    github: 'GitHub Pages / Vercel'
  };

  const servicesHtml = servicesReplaced.length > 0 
    ? servicesReplaced.map(s => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-decoration: line-through; color: #dc2626;">${s.from}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">→</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #22c55e; font-weight: 600;">${s.to}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; color: #22c55e;">${s.savings > 0 ? `-${s.savings}$/mois` : '-'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" style="padding: 8px; color: #666;">Code déjà optimisé</td></tr>';

  const reportUrl = `https://getinopay.com/rapport-liberation/${deploymentId}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rapport de Libération - ${projectName}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2ECC71 0%, #1B3A5F 100%); padding: 40px 30px; text-align: center;">
          <img src="https://getinopay.com/inopay-logo-email.png" alt="Inopay" style="height: 40px; margin-bottom: 20px;" />
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">
            🎉 Rapport de Libération
          </h1>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px 30px;">
          
          <!-- Success Banner -->
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; background-color: #dcfce7; border-radius: 50%; padding: 15px; margin-bottom: 15px;">
              <span style="font-size: 40px;">✅</span>
            </div>
            <h2 style="color: #1B3A5F; margin: 0 0 10px 0; font-size: 22px;">
              ${userName ? `Félicitations ${userName} !` : 'Félicitations !'}
            </h2>
            <p style="color: #64748b; margin: 0; font-size: 16px;">
              Votre projet <strong style="color: #2ECC71;">"${projectName}"</strong> est maintenant LIBRE !
            </p>
          </div>

          <!-- Deployment Info Card -->
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #15803d; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center;">
              🌐 Statut du Déploiement
            </h3>
            ${deployedUrl ? `
              <p style="margin: 0 0 10px 0;">
                <strong>URL :</strong> 
                <a href="${deployedUrl}" style="color: #2ECC71; text-decoration: none;">${deployedUrl}</a>
              </p>
            ` : ''}
            <p style="margin: 0 0 10px 0;"><strong>Hébergeur :</strong> ${hostingProvider}</p>
            <p style="margin: 0;"><strong>Type :</strong> ${hostingTypeLabels[hostingType] || hostingType}</p>
            ${serverIp ? `<p style="margin: 10px 0 0 0;"><strong>IP :</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${serverIp}</code></p>` : ''}
            ${coolifyUrl ? `<p style="margin: 10px 0 0 0;"><strong>Dashboard Coolify :</strong> <a href="${coolifyUrl}" style="color: #2ECC71;">${coolifyUrl}</a></p>` : ''}
          </div>

          <!-- Savings Card -->
          <div style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
            <h3 style="color: #7c3aed; margin: 0 0 15px 0; font-size: 16px;">
              💰 Économies Réalisées
            </h3>
            <div style="display: flex; justify-content: space-around; text-align: center; margin-bottom: 20px;">
              <div>
                <p style="margin: 0; color: #64748b; font-size: 12px;">Mensuel</p>
                <p style="margin: 5px 0 0 0; color: #22c55e; font-size: 28px; font-weight: 700;">${totalSavings}$</p>
              </div>
              <div style="border-left: 1px solid #e9d5ff; padding-left: 20px;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">Annuel</p>
                <p style="margin: 5px 0 0 0; color: #2ECC71; font-size: 28px; font-weight: 700;">${annualSavings}$</p>
              </div>
            </div>
            
            ${servicesReplaced.length > 0 ? `
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #64748b;">Services remplacés :</p>
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                ${servicesHtml}
              </table>
            ` : ''}
          </div>

          <!-- Portability Score -->
          <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 20px; margin-bottom: 25px; text-align: center;">
            <h3 style="color: #0369a1; margin: 0 0 15px 0; font-size: 16px;">
              🛡️ Score de Portabilité
            </h3>
            <div style="display: inline-block; position: relative; width: 80px; height: 80px;">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="35" stroke="#e2e8f0" stroke-width="6" fill="none"/>
                <circle cx="40" cy="40" r="35" stroke="#22c55e" stroke-width="6" fill="none" 
                  stroke-dasharray="${portabilityScoreAfter * 2.2} 220" 
                  transform="rotate(-90 40 40)"/>
              </svg>
              <span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 18px; font-weight: 700; color: #22c55e;">
                ${portabilityScoreAfter}%
              </span>
            </div>
            <p style="margin: 15px 0 0 0; color: #22c55e; font-weight: 600;">
              ✅ Code 100% Libre
            </p>
          </div>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${reportUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #2ECC71 0%, #27AE60 100%); 
                      color: white; text-decoration: none; padding: 15px 30px; border-radius: 8px; 
                      font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(46, 204, 113, 0.3);">
              📄 Voir le Rapport Complet
            </a>
          </div>

          <!-- Tips -->
          <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px;">
            <h3 style="color: #b45309; margin: 0 0 15px 0; font-size: 16px;">
              💡 Conseils Post-Déploiement
            </h3>
            <ul style="margin: 0; padding-left: 20px; color: #64748b; font-size: 14px; line-height: 1.8;">
              <li>Configurez votre nom de domaine pour pointer vers votre serveur</li>
              <li>Planifiez des sauvegardes régulières de votre application</li>
              <li>Gardez vos dépendances à jour pour la sécurité</li>
              <li>Consultez la documentation de votre hébergeur</li>
            </ul>
          </div>

        </div>

        <!-- Footer -->
        <div style="background-color: #1B3A5F; padding: 30px; text-align: center;">
          <p style="color: #94a3b8; margin: 0 0 10px 0; font-size: 14px;">
            Libérez votre code, maîtrisez votre avenir.
          </p>
          <p style="color: #64748b; margin: 0; font-size: 12px;">
            © 2025 Inopay - Tous droits réservés
          </p>
          <div style="margin-top: 15px;">
            <a href="https://getinopay.com" style="color: #2ECC71; text-decoration: none; font-size: 12px;">
              getinopay.com
            </a>
          </div>
        </div>

      </div>
    </body>
    </html>
  `;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("send-liberation-report: Starting...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse request body
    const body = await req.json();
    const { deploymentId } = body;

    if (!deploymentId) {
      console.error("Missing deploymentId");
      throw new Error("deploymentId est requis");
    }

    console.log("Fetching deployment:", deploymentId);

    // Fetch deployment data
    const { data: deployment, error: deploymentError } = await supabase
      .from("deployment_history")
      .select("*")
      .eq("id", deploymentId)
      .single();

    if (deploymentError || !deployment) {
      console.error("Deployment not found:", deploymentError?.message);
      throw new Error("Déploiement introuvable");
    }

    // Get user email from auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
      deployment.user_id
    );

    if (userError || !userData?.user?.email) {
      console.error("User not found:", userError?.message);
      throw new Error("Utilisateur introuvable");
    }

    const userEmail = userData.user.email;
    const userName = userData.user.user_metadata?.full_name || 
                     userData.user.user_metadata?.name || 
                     userEmail.split('@')[0];

    console.log("Sending report to:", userEmail);

    // Parse cost analysis
    const costAnalysis = deployment.cost_analysis as Record<string, number> | null;
    const totalSavings = costAnalysis?.totalSavings || 140;
    const annualSavings = totalSavings * 12;

    // Parse services replaced
    const servicesReplaced = (deployment.services_replaced as Array<{ from: string; to: string; savings: number }>) || [];

    // Generate email data
    const emailData: LiberationReportEmailData = {
      deploymentId,
      userEmail,
      userName,
      projectName: deployment.project_name,
      deployedUrl: deployment.deployed_url || undefined,
      hostingProvider: deployment.provider || "Auto-hébergé",
      hostingType: deployment.hosting_type || "vps",
      serverIp: deployment.server_ip || undefined,
      coolifyUrl: deployment.coolify_url || undefined,
      totalSavings,
      annualSavings,
      servicesReplaced,
      portabilityScoreAfter: deployment.portability_score_after || 100
    };

    // Generate HTML
    const html = generateEmailHtml(emailData);

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Configuration Resend manquante");
    }

    const resend = new Resend(resendApiKey);
    const result = await resend.emails.send({
      from: "Inopay <contact@getinopay.com>",
      to: [userEmail],
      subject: `🎉 Rapport de Libération - ${deployment.project_name} est maintenant LIBRE !`,
      html,
    });

    console.log("Email sent successfully:", result);

    // Log the email send
    await supabase.from("email_logs").insert({
      user_id: deployment.user_id,
      user_email: userEmail,
      subject: `Rapport de Libération - ${deployment.project_name}`,
      status: "sent",
      sent_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error in send-liberation-report function:", message);
    
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});