import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { deployment_id } = await req.json();

    if (!deployment_id) {
      return new Response(JSON.stringify({ error: 'deployment_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-coolify-status] Syncing deployment ${deployment_id} for user ${user.id}`);

    // Fetch deployment with server info
    const { data: deployment, error: deployError } = await supabase
      .from('server_deployments')
      .select('*, user_servers(*)')
      .eq('id', deployment_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (deployError || !deployment) {
      console.error('[sync-coolify-status] Deployment not found:', deployError);
      return new Response(JSON.stringify({ error: 'Deployment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const server = deployment.user_servers;
    if (!server?.coolify_url || !server?.coolify_token) {
      return new Response(JSON.stringify({ error: 'Server not configured with Coolify' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!deployment.coolify_app_uuid) {
      return new Response(JSON.stringify({ error: 'No Coolify app UUID found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const coolifyUrl = server.coolify_url.replace(/\/$/, '');
    const coolifyHeaders = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Content-Type': 'application/json',
    };

    console.log(`[sync-coolify-status] Fetching app ${deployment.coolify_app_uuid} from Coolify`);

    // Fetch app status from Coolify
    const appResponse = await fetch(`${coolifyUrl}/api/v1/applications/${deployment.coolify_app_uuid}`, {
      headers: coolifyHeaders,
    });

    if (!appResponse.ok) {
      const errorText = await appResponse.text();
      console.error('[sync-coolify-status] Failed to fetch app:', errorText);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch app from Coolify',
        details: errorText 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appData = await appResponse.json();
    console.log('[sync-coolify-status] App data:', JSON.stringify(appData, null, 2));

    // Determine status from Coolify response
    const coolifyStatus = appData.status || 'unknown';
    const fqdn = appData.fqdn || deployment.deployed_url;
    
    let newStatus = deployment.status;
    let newHealthStatus = deployment.health_status;
    let newErrorMessage = deployment.error_message;

    // Map Coolify status to our status
    if (coolifyStatus === 'running' || coolifyStatus === 'healthy' || coolifyStatus.includes('running')) {
      newStatus = 'deployed';
      newHealthStatus = 'healthy';
      newErrorMessage = null;
      console.log('[sync-coolify-status] App is running, updating to deployed/healthy');
    } else if (coolifyStatus === 'exited' || coolifyStatus === 'stopped' || coolifyStatus.includes('exited')) {
      newStatus = 'failed';
      newHealthStatus = 'unhealthy';
      console.log('[sync-coolify-status] App is stopped/exited');
    } else if (coolifyStatus === 'starting' || coolifyStatus === 'restarting') {
      newStatus = 'deploying';
      newHealthStatus = 'unknown';
      console.log('[sync-coolify-status] App is starting/restarting');
    }

    // Also test if the URL responds
    let urlHealthy = false;
    if (fqdn) {
      try {
        const testUrl = fqdn.startsWith('http') ? fqdn : `https://${fqdn}`;
        console.log(`[sync-coolify-status] Testing URL: ${testUrl}`);
        const urlResponse = await fetch(testUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        urlHealthy = urlResponse.ok || urlResponse.status < 500;
        console.log(`[sync-coolify-status] URL test result: ${urlResponse.status} (healthy: ${urlHealthy})`);
        
        if (urlHealthy && newHealthStatus !== 'healthy') {
          newHealthStatus = 'healthy';
          newStatus = 'deployed';
          newErrorMessage = null;
        }
      } catch (urlError) {
        console.log(`[sync-coolify-status] URL test failed: ${urlError}`);
      }
    }

    // Update the deployment
    const updateData: Record<string, unknown> = {
      status: newStatus,
      health_status: newHealthStatus,
      error_message: newErrorMessage,
      last_health_check: new Date().toISOString(),
      consecutive_failures: newHealthStatus === 'healthy' ? 0 : deployment.consecutive_failures,
    };

    if (fqdn && !deployment.deployed_url) {
      updateData.deployed_url = fqdn.startsWith('http') ? fqdn : `https://${fqdn}`;
    }

    const { error: updateError } = await supabase
      .from('server_deployments')
      .update(updateData)
      .eq('id', deployment_id);

    if (updateError) {
      console.error('[sync-coolify-status] Failed to update deployment:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update deployment' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[sync-coolify-status] Updated deployment to status=${newStatus}, health=${newHealthStatus}`);

    return new Response(JSON.stringify({
      success: true,
      coolify_status: coolifyStatus,
      new_status: newStatus,
      new_health_status: newHealthStatus,
      url_healthy: urlHealthy,
      deployed_url: fqdn,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-coolify-status] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
