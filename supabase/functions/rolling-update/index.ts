import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { deployment_id, sync_config_id, history_id } = await req.json();

    console.log(`[rolling-update] Starting deployment for ${deployment_id}`);

    // Fetch deployment details
    const { data: deployment, error: deploymentError } = await supabaseAdmin
      .from('server_deployments')
      .select('*, user_servers(*)')
      .eq('id', deployment_id)
      .single();

    if (deploymentError || !deployment) {
      throw new Error('Deployment not found');
    }

    const server = deployment.user_servers;
    if (!server?.coolify_url || !server?.coolify_token) {
      throw new Error('Server not configured with Coolify');
    }

    const coolifyUrl = server.coolify_url.replace(/\/$/, '');
    const coolifyToken = server.coolify_token;

    // Check if we have a Coolify app UUID
    if (!deployment.coolify_app_uuid) {
      console.log('[rolling-update] No Coolify app UUID, skipping deployment');
      
      if (history_id) {
        await supabaseAdmin
          .from('sync_history')
          .update({
            status: 'completed',
            error_message: 'No Coolify application linked',
            completed_at: new Date().toISOString(),
          })
          .eq('id', history_id);
      }

      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No Coolify application linked' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get current application status
    const statusResponse = await fetch(
      `${coolifyUrl}/api/v1/applications/${deployment.coolify_app_uuid}`,
      {
        headers: {
          'Authorization': `Bearer ${coolifyToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!statusResponse.ok) {
      throw new Error(`Failed to get app status: ${statusResponse.status}`);
    }

    const appStatus = await statusResponse.json();
    console.log(`[rolling-update] Current app status: ${appStatus.status}`);

    // Trigger deployment via Coolify API
    const deployResponse = await fetch(
      `${coolifyUrl}/api/v1/applications/${deployment.coolify_app_uuid}/restart`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${coolifyToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('[rolling-update] Coolify deploy error:', errorText);
      
      // Update history with error
      if (history_id) {
        await supabaseAdmin
          .from('sync_history')
          .update({
            status: 'failed',
            error_message: `Coolify deployment failed: ${errorText}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', history_id);
      }

      // Update sync config
      await supabaseAdmin
        .from('sync_configurations')
        .update({
          last_sync_status: 'failed',
          last_sync_error: `Deployment failed: ${errorText}`,
        })
        .eq('id', sync_config_id);

      throw new Error(`Coolify deployment failed: ${errorText}`);
    }

    console.log('[rolling-update] Deployment triggered successfully');

    // Wait a bit then check health
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Health check
    let healthOk = false;
    let retries = 0;
    const maxRetries = 6; // 30 seconds max

    while (!healthOk && retries < maxRetries) {
      try {
        const healthResponse = await fetch(
          `${coolifyUrl}/api/v1/applications/${deployment.coolify_app_uuid}`,
          {
            headers: {
              'Authorization': `Bearer ${coolifyToken}`,
              'Accept': 'application/json',
            },
          }
        );

        if (healthResponse.ok) {
          const status = await healthResponse.json();
          if (status.status === 'running') {
            healthOk = true;
            console.log('[rolling-update] Application is healthy');
          }
        }
      } catch (e) {
        console.log(`[rolling-update] Health check attempt ${retries + 1} failed`);
      }

      if (!healthOk) {
        retries++;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Update records
    const finalStatus = healthOk ? 'completed' : 'deployed';
    
    if (history_id) {
      await supabaseAdmin
        .from('sync_history')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
        })
        .eq('id', history_id);
    }

    await supabaseAdmin
      .from('sync_configurations')
      .update({
        last_sync_status: finalStatus,
        last_sync_error: null,
      })
      .eq('id', sync_config_id);

    // Update deployment status
    await supabaseAdmin
      .from('server_deployments')
      .update({
        status: 'deployed',
        health_status: healthOk ? 'healthy' : 'unknown',
        last_health_check: new Date().toISOString(),
      })
      .eq('id', deployment_id);

    // Log activity
    await supabaseAdmin
      .from('admin_activity_logs')
      .insert({
        action_type: 'sync_deployment',
        title: 'Synchronisation automatique',
        description: `Déploiement rolling update pour ${deployment.project_name}`,
        status: healthOk ? 'success' : 'info',
        deployment_id: deployment_id,
        server_id: server.id,
        user_id: deployment.user_id,
        metadata: {
          sync_config_id,
          history_id,
          health_check_passed: healthOk,
        },
      });

    return new Response(JSON.stringify({ 
      success: true, 
      status: finalStatus,
      health_check_passed: healthOk,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[rolling-update] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
