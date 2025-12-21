import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RestartRequest {
  deployment_id: string;
  server_id: string;
}

const RESTART_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes entre chaque restart
const POST_RESTART_WAIT_MS = 60 * 1000; // Attendre 60s après restart pour vérifier

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { deployment_id, server_id }: RestartRequest = await req.json();

    console.log(`[auto-restart] Starting restart for deployment ${deployment_id}`);

    // Récupérer le serveur avec les credentials Coolify
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('*, user_id')
      .eq('id', server_id)
      .single();

    if (serverError || !server) {
      throw new Error(`Server not found: ${serverError?.message}`);
    }

    // Récupérer le déploiement
    const { data: deployment, error: deployError } = await supabase
      .from('server_deployments')
      .select('*')
      .eq('id', deployment_id)
      .single();

    if (deployError || !deployment) {
      throw new Error(`Deployment not found: ${deployError?.message}`);
    }

    // Vérifier le cooldown
    if (deployment.last_restart_at) {
      const lastRestart = new Date(deployment.last_restart_at).getTime();
      const now = Date.now();
      
      if (now - lastRestart < RESTART_COOLDOWN_MS) {
        const remainingMs = RESTART_COOLDOWN_MS - (now - lastRestart);
        console.log(`[auto-restart] Cooldown active, ${Math.round(remainingMs / 1000)}s remaining`);
        
        return new Response(JSON.stringify({
          success: false,
          reason: 'cooldown_active',
          remaining_seconds: Math.round(remainingMs / 1000),
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Vérifier qu'on a les credentials Coolify
    if (!server.coolify_url || !server.coolify_token || !deployment.coolify_app_uuid) {
      throw new Error('Missing Coolify credentials or app UUID');
    }

    console.log(`[auto-restart] Sending restart command to Coolify for app ${deployment.coolify_app_uuid}`);

    // Appeler l'API Coolify pour redémarrer
    const restartResponse = await fetch(
      `${server.coolify_url}/api/v1/applications/${deployment.coolify_app_uuid}/restart`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${server.coolify_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!restartResponse.ok) {
      const errorText = await restartResponse.text();
      throw new Error(`Coolify restart failed: ${restartResponse.status} - ${errorText}`);
    }

    console.log(`[auto-restart] Restart command sent successfully`);

    // Mettre à jour le déploiement
    const { error: updateError } = await supabase
      .from('server_deployments')
      .update({
        health_status: 'recovering',
        last_restart_at: new Date().toISOString(),
        auto_restart_count: (deployment.auto_restart_count || 0) + 1,
        consecutive_failures: 0,
      })
      .eq('id', deployment_id);

    if (updateError) {
      console.warn(`[auto-restart] Failed to update deployment: ${updateError.message}`);
    }

    // Logger dans l'audit
    await supabase
      .from('security_audit_logs')
      .insert({
        user_id: server.user_id,
        server_id: server_id,
        deployment_id: deployment_id,
        action: 'auto_restart_triggered',
        details: {
          restart_count: (deployment.auto_restart_count || 0) + 1,
          consecutive_failures: deployment.consecutive_failures,
          deployed_url: deployment.deployed_url,
        },
      });

    // Attendre et vérifier la santé après redémarrage
    console.log(`[auto-restart] Waiting ${POST_RESTART_WAIT_MS / 1000}s before health check`);
    await new Promise(resolve => setTimeout(resolve, POST_RESTART_WAIT_MS));

    // Vérifier la santé
    let healthCheckPassed = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const healthResponse = await fetch(deployment.deployed_url, {
        method: 'GET',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      healthCheckPassed = healthResponse.ok;
      
      console.log(`[auto-restart] Post-restart health check: ${healthCheckPassed ? 'PASSED' : 'FAILED'}`);
    } catch (healthError: unknown) {
      const msg = healthError instanceof Error ? healthError.message : 'Unknown error';
      console.warn(`[auto-restart] Post-restart health check error: ${msg}`);
    }

    // Mettre à jour le status final
    await supabase
      .from('server_deployments')
      .update({
        health_status: healthCheckPassed ? 'healthy' : 'unhealthy',
        last_health_check: new Date().toISOString(),
      })
      .eq('id', deployment_id);

    // Si toujours down après restart, envoyer un email de notification
    if (!healthCheckPassed && resendApiKey) {
      console.log(`[auto-restart] Site still down after restart, sending notification email`);
      
      // Récupérer l'email de l'utilisateur
      const { data: userData } = await supabase.auth.admin.getUserById(server.user_id);
      
      if (userData?.user?.email) {
        try {
          const resend = new Resend(resendApiKey);
          
          await resend.emails.send({
            from: 'Inopay <notifications@resend.dev>',
            to: [userData.user.email],
            subject: `⚠️ Alerte: ${deployment.project_name} toujours hors ligne`,
            html: `
              <h2>Votre application nécessite votre attention</h2>
              <p>Le projet <strong>${deployment.project_name}</strong> est toujours hors ligne après un redémarrage automatique.</p>
              <p><strong>URL:</strong> ${deployment.deployed_url}</p>
              <p><strong>Nombre de redémarrages:</strong> ${(deployment.auto_restart_count || 0) + 1}</p>
              <p>Veuillez vérifier les logs de votre serveur pour identifier le problème.</p>
              <p>---<br>Inopay Health Monitor</p>
            `,
          });
          
          console.log(`[auto-restart] Notification email sent to ${userData.user.email}`);
        } catch (emailError: unknown) {
          const msg = emailError instanceof Error ? emailError.message : 'Unknown error';
          console.warn(`[auto-restart] Failed to send notification email: ${msg}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      restart_successful: true,
      health_check_passed: healthCheckPassed,
      restart_count: (deployment.auto_restart_count || 0) + 1,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[auto-restart] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
