import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "2025-12-22-v3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`[sync-coolify-status] version=${VERSION} starting`);

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

    const coolifyUrl = server.coolify_url.replace(/\/$/, '');
    const coolifyHeaders = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Content-Type': 'application/json',
    };

    let appData = null;
    let coolifyStatus = 'unknown';
    let appNotFoundInCoolify = false;
    let foundAppUuid = deployment.coolify_app_uuid;

    console.log(`[sync-coolify-status] Checking app UUID: ${deployment.coolify_app_uuid}`);

    // Try to fetch app from Coolify using stored UUID
    if (deployment.coolify_app_uuid) {
      const appResponse = await fetch(`${coolifyUrl}/api/v1/applications/${deployment.coolify_app_uuid}`, {
        headers: coolifyHeaders,
      });

      if (appResponse.status === 401 || appResponse.status === 403) {
        console.error('[sync-coolify-status] Coolify auth error:', appResponse.status);
        return new Response(JSON.stringify({ 
          error: 'Token Coolify invalide ou expiré',
          details: `HTTP ${appResponse.status}` 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!appResponse.ok) {
        const errorText = await appResponse.text();
        console.log('[sync-coolify-status] App not found by UUID, will search by repo:', errorText);
        appNotFoundInCoolify = true;
      } else {
        appData = await appResponse.json();
        console.log('[sync-coolify-status] App found by UUID, status:', appData.status);
        coolifyStatus = appData.status || 'unknown';
      }
    } else {
      appNotFoundInCoolify = true;
    }

    // If app not found by UUID, try to find it by searching all applications
    if (appNotFoundInCoolify && deployment.github_repo_url) {
      console.log('[sync-coolify-status] Searching apps by repo:', deployment.github_repo_url);
      
      try {
        const appsResponse = await fetch(`${coolifyUrl}/api/v1/applications`, {
          headers: coolifyHeaders,
        });

        if (appsResponse.ok) {
          const allApps = await appsResponse.json();
          console.log(`[sync-coolify-status] Found ${allApps.length} apps in Coolify`);

          // Search for matching app by git_repository or name
          const matchingApp = allApps.find((app: { git_repository?: string; name?: string; uuid?: string }) => {
            const repoMatch = app.git_repository && 
              deployment.github_repo_url?.includes(app.git_repository.replace('.git', ''));
            const nameMatch = app.name && 
              app.name.toLowerCase().includes(deployment.project_name.toLowerCase());
            return repoMatch || nameMatch;
          });

          if (matchingApp) {
            console.log(`[sync-coolify-status] Found matching app: ${matchingApp.uuid} (${matchingApp.name})`);
            foundAppUuid = matchingApp.uuid;
            appNotFoundInCoolify = false;
            
            // Fetch full app details
            const fullAppResponse = await fetch(`${coolifyUrl}/api/v1/applications/${matchingApp.uuid}`, {
              headers: coolifyHeaders,
            });
            
            if (fullAppResponse.ok) {
              appData = await fullAppResponse.json();
              coolifyStatus = appData.status || 'unknown';
              
              // Update the stored UUID in database
              await supabase
                .from('server_deployments')
                .update({ coolify_app_uuid: matchingApp.uuid })
                .eq('id', deployment_id);
              
              console.log(`[sync-coolify-status] Updated coolify_app_uuid to ${matchingApp.uuid}`);
            }
          } else {
            console.log('[sync-coolify-status] No matching app found in Coolify');
          }
        }
      } catch (searchError) {
        console.log('[sync-coolify-status] Error searching apps:', searchError);
      }
    }

    // Determine status from Coolify response
    const fqdn = appData?.fqdn || deployment.deployed_url;
    
    let newStatus = deployment.status;
    let newHealthStatus = deployment.health_status;
    let newErrorMessage = deployment.error_message;

    // If app not found in Coolify, we'll rely on URL testing
    if (appNotFoundInCoolify) {
      console.log('[sync-coolify-status] App not in Coolify, will determine status from URL test');
      newErrorMessage = 'Application introuvable dans Coolify - vérification URL uniquement';
    } else {
      // Map Coolify status to our status
      if (coolifyStatus === 'running' || coolifyStatus === 'healthy' || coolifyStatus.includes('running')) {
        newStatus = 'deployed';
        newHealthStatus = 'healthy';
        newErrorMessage = null;
        console.log('[sync-coolify-status] App is running, updating to deployed/healthy');
      } else if (coolifyStatus === 'exited' || coolifyStatus === 'stopped' || coolifyStatus.includes('exited')) {
        newStatus = 'failed';
        newHealthStatus = 'unhealthy';
        newErrorMessage = `Coolify status: ${coolifyStatus}`;
        console.log('[sync-coolify-status] App is stopped/exited');
      } else if (coolifyStatus === 'starting' || coolifyStatus === 'restarting') {
        newStatus = 'deploying';
        newHealthStatus = 'unknown';
        console.log('[sync-coolify-status] App is starting/restarting');
      }
    }

    // Also test if the URL responds
    let urlHealthy = false;
    let urlHttpStatus: number | null = null;
    
    if (fqdn) {
      try {
        const testUrl = fqdn.startsWith('http') ? fqdn : `https://${fqdn}`;
        console.log(`[sync-coolify-status] Testing URL: ${testUrl}`);
        const urlResponse = await fetch(testUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(10000),
        });
        urlHttpStatus = urlResponse.status;
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

    // Update coolify_app_uuid if we found a new one
    if (foundAppUuid && foundAppUuid !== deployment.coolify_app_uuid) {
      updateData.coolify_app_uuid = foundAppUuid;
    }

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
      version: VERSION,
      coolify_status: coolifyStatus,
      app_not_found: appNotFoundInCoolify,
      new_status: newStatus,
      new_health_status: newHealthStatus,
      url_healthy: urlHealthy,
      url_http_status: urlHttpStatus,
      deployed_url: fqdn,
      coolify_app_uuid: foundAppUuid,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[sync-coolify-status] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      version: VERSION
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
