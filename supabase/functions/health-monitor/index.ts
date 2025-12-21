import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CONSECUTIVE_FAILURES = 3;
const HEALTH_CHECK_TIMEOUT_MS = 15000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[health-monitor] Starting health check cycle');

    // Récupérer tous les déploiements actifs
    const { data: deployments, error: fetchError } = await supabase
      .from('server_deployments')
      .select(`
        id,
        user_id,
        server_id,
        project_name,
        deployed_url,
        status,
        health_status,
        consecutive_failures,
        auto_restart_count
      `)
      .eq('status', 'deployed')
      .not('deployed_url', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch deployments: ${fetchError.message}`);
    }

    if (!deployments || deployments.length === 0) {
      console.log('[health-monitor] No active deployments to check');
      return new Response(JSON.stringify({
        success: true,
        message: 'No active deployments',
        checked: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[health-monitor] Checking ${deployments.length} deployments`);

    const results = [];

    for (const deployment of deployments) {
      const startTime = Date.now();
      let status = 'unknown';
      let httpStatus: number | null = null;
      let errorMessage: string | null = null;
      let responseTimeMs: number | null = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

        const response = await fetch(deployment.deployed_url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'Inopay-Health-Monitor/1.0',
          },
        });

        clearTimeout(timeoutId);
        responseTimeMs = Date.now() - startTime;
        httpStatus = response.status;

        if (response.ok || response.status < 500) {
          status = 'healthy';
        } else {
          status = 'unhealthy';
          errorMessage = `HTTP ${response.status}`;
        }

      } catch (error: unknown) {
        responseTimeMs = Date.now() - startTime;
        status = 'unhealthy';
        
        if (error instanceof Error && error.name === 'AbortError') {
          errorMessage = 'Timeout';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        } else {
          errorMessage = 'Unknown error';
        }
      }

      // Calculer les nouveaux compteurs
      const newConsecutiveFailures = status === 'healthy' 
        ? 0 
        : (deployment.consecutive_failures || 0) + 1;

      const needsRestart = newConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES;

      // Mettre à jour le déploiement
      const updateData: Record<string, unknown> = {
        health_status: status,
        last_health_check: new Date().toISOString(),
        consecutive_failures: newConsecutiveFailures,
      };

      if (needsRestart) {
        console.log(`[health-monitor] Deployment ${deployment.id} needs restart (${newConsecutiveFailures} failures)`);
        updateData.health_status = 'recovering';
      }

      await supabase
        .from('server_deployments')
        .update(updateData)
        .eq('id', deployment.id);

      // Logger le health check
      await supabase
        .from('health_check_logs')
        .insert({
          deployment_id: deployment.id,
          status,
          response_time_ms: responseTimeMs,
          http_status: httpStatus,
          error_message: errorMessage,
        });

      // Déclencher le redémarrage si nécessaire
      if (needsRestart) {
        console.log(`[health-monitor] Triggering auto-restart for deployment ${deployment.id}`);
        
        try {
          await supabase.functions.invoke('auto-restart-container', {
            body: {
              deployment_id: deployment.id,
              server_id: deployment.server_id,
            },
          });
        } catch (restartError: unknown) {
          const msg = restartError instanceof Error ? restartError.message : 'Unknown error';
          console.error(`[health-monitor] Failed to trigger restart: ${msg}`);
        }
      }

      results.push({
        deployment_id: deployment.id,
        project_name: deployment.project_name,
        url: deployment.deployed_url,
        status,
        response_time_ms: responseTimeMs,
        http_status: httpStatus,
        consecutive_failures: newConsecutiveFailures,
        restart_triggered: needsRestart,
      });

      console.log(`[health-monitor] ${deployment.project_name}: ${status} (${responseTimeMs}ms)`);
    }

    console.log(`[health-monitor] Completed checking ${results.length} deployments`);

    return new Response(JSON.stringify({
      success: true,
      checked: results.length,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[health-monitor] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
