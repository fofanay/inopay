import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeploymentStatus {
  status: 'queued' | 'in_progress' | 'building' | 'finished' | 'failed' | 'unknown';
  logs: string;
  deployed_url: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

function normalizeCoolifyUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `http://${normalized}`;
  }
  normalized = normalized.replace(/\/+$/, '');
  if (!normalized.includes(':8000') && !normalized.includes(':443')) {
    const urlObj = new URL(normalized);
    if (urlObj.protocol === 'http:') {
      urlObj.port = '8000';
    }
    normalized = urlObj.toString().replace(/\/+$/, '');
  }
  return normalized;
}

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
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { server_id, deployment_uuid, app_uuid } = await req.json();

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: 'server_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get server info
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('coolify_url, coolify_token')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server?.coolify_url || !server?.coolify_token) {
      return new Response(
        JSON.stringify({ error: 'Server not found or Coolify not configured' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const coolifyUrl = normalizeCoolifyUrl(server.coolify_url);
    const coolifyHeaders = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Accept': 'application/json'
    };

    const result: DeploymentStatus = {
      status: 'unknown',
      logs: '',
      deployed_url: null,
      duration_seconds: null,
      started_at: null,
      finished_at: null,
      error_message: null
    };

    // If we have a deployment_uuid, get its status directly
    if (deployment_uuid) {
      console.log(`[check-deployment-status] Checking deployment ${deployment_uuid}`);
      
      try {
        const deployRes = await fetch(`${coolifyUrl}/api/v1/deployments/${deployment_uuid}`, {
          method: 'GET',
          headers: coolifyHeaders
        });

        if (deployRes.ok) {
          const deployData = await deployRes.json();
          
          result.status = mapCoolifyStatus(deployData.status);
          result.started_at = deployData.started_at || deployData.created_at;
          result.finished_at = deployData.finished_at;
          
          if (result.started_at && result.finished_at) {
            result.duration_seconds = Math.round(
              (new Date(result.finished_at).getTime() - new Date(result.started_at).getTime()) / 1000
            );
          }

          // Get logs
          const logsRes = await fetch(`${coolifyUrl}/api/v1/deployments/${deployment_uuid}/logs`, {
            method: 'GET',
            headers: coolifyHeaders
          });

          if (logsRes.ok) {
            const logsData = await logsRes.json();
            result.logs = typeof logsData === 'string' ? logsData : 
              (logsData.logs || logsData.output || JSON.stringify(logsData));
          }

          // If finished, try to get the deployed URL from the app
          if (result.status === 'finished' && app_uuid) {
            try {
              const appRes = await fetch(`${coolifyUrl}/api/v1/applications/${app_uuid}`, {
                method: 'GET',
                headers: coolifyHeaders
              });
              
              if (appRes.ok) {
                const appData = await appRes.json();
                result.deployed_url = appData.fqdn || appData.preview_url || null;
              }
            } catch (e) {
              console.warn('[check-deployment-status] Could not get app URL:', e);
            }
          }

          // If failed, extract error from logs
          if (result.status === 'failed') {
            const errorMatch = result.logs.match(/error:?\s*(.+)/i) || 
                              result.logs.match(/failed:?\s*(.+)/i);
            result.error_message = errorMatch ? errorMatch[1].slice(0, 200) : 'Deployment failed';
          }
        }
      } catch (e) {
        console.error('[check-deployment-status] Error checking deployment:', e);
        result.error_message = e instanceof Error ? e.message : String(e);
      }
    } 
    // If we only have app_uuid, get the latest deployment
    else if (app_uuid) {
      console.log(`[check-deployment-status] Getting latest deployment for app ${app_uuid}`);
      
      try {
        // First try to get deployments for the app
        const deploymentsRes = await fetch(`${coolifyUrl}/api/v1/applications/${app_uuid}/deployments`, {
          method: 'GET',
          headers: coolifyHeaders
        });

        if (deploymentsRes.ok) {
          const deployments = await deploymentsRes.json();
          const latestDeployment = Array.isArray(deployments) ? deployments[0] : deployments.data?.[0];
          
          if (latestDeployment) {
            result.status = mapCoolifyStatus(latestDeployment.status);
            result.started_at = latestDeployment.started_at || latestDeployment.created_at;
            result.finished_at = latestDeployment.finished_at;

            // Get logs for this deployment
            if (latestDeployment.uuid) {
              const logsRes = await fetch(`${coolifyUrl}/api/v1/deployments/${latestDeployment.uuid}/logs`, {
                method: 'GET',
                headers: coolifyHeaders
              });

              if (logsRes.ok) {
                const logsData = await logsRes.json();
                result.logs = typeof logsData === 'string' ? logsData : 
                  (logsData.logs || logsData.output || JSON.stringify(logsData));
              }
            }
          }
        }

        // Also get app info for URL
        const appRes = await fetch(`${coolifyUrl}/api/v1/applications/${app_uuid}`, {
          method: 'GET',
          headers: coolifyHeaders
        });
        
        if (appRes.ok) {
          const appData = await appRes.json();
          result.deployed_url = appData.fqdn || appData.preview_url || null;
        }
      } catch (e) {
        console.error('[check-deployment-status] Error checking app:', e);
        result.error_message = e instanceof Error ? e.message : String(e);
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'deployment_uuid or app_uuid required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[check-deployment-status] Status: ${result.status}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-deployment-status] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function mapCoolifyStatus(status: string): DeploymentStatus['status'] {
  const statusLower = (status || '').toLowerCase();
  
  if (statusLower.includes('queue') || statusLower === 'pending') return 'queued';
  if (statusLower.includes('progress') || statusLower === 'running' || statusLower === 'deploying') return 'in_progress';
  if (statusLower.includes('build')) return 'building';
  if (statusLower.includes('success') || statusLower === 'finished' || statusLower === 'completed') return 'finished';
  if (statusLower.includes('fail') || statusLower.includes('error') || statusLower === 'cancelled') return 'failed';
  
  return 'unknown';
}
