import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map (in-memory, resets on function restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // 60 requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(token: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(token);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(token, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const widgetToken = url.searchParams.get('token');

    if (!widgetToken) {
      return new Response(
        JSON.stringify({ error: 'Widget token required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    if (!checkRateLimit(widgetToken)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Max 60 requests per minute.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find sync configuration by widget token (check not revoked)
    const { data: syncConfig, error: syncError } = await supabase
      .from('sync_configurations')
      .select(`
        *,
        server_deployments:deployment_id (
          id,
          project_name,
          deployed_url,
          status,
          health_status,
          last_health_check,
          coolify_app_uuid,
          server_id,
          user_servers:server_id (
            ip_address,
            coolify_url,
            status
          )
        )
      `)
      .eq('widget_token', widgetToken)
      .eq('widget_token_revoked', false)
      .single();

    if (syncError || !syncConfig) {
      console.error('Widget token not found or revoked:', syncError);
      return new Response(
        JSON.stringify({ error: 'Invalid or revoked widget token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP for tracking
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    // Update token usage tracking
    await supabase
      .from('sync_configurations')
      .update({
        widget_token_used_at: new Date().toISOString(),
        widget_token_last_ip: clientIp,
      })
      .eq('id', syncConfig.id);

    // Get recent sync history
    const { data: syncHistory } = await supabase
      .from('sync_history')
      .select('*')
      .eq('sync_config_id', syncConfig.id)
      .order('started_at', { ascending: false })
      .limit(10);

    // Get recent activity logs
    const { data: activityLogs } = await supabase
      .from('admin_activity_logs')
      .select('*')
      .eq('deployment_id', syncConfig.deployment_id)
      .order('created_at', { ascending: false })
      .limit(5);

    // Calculate time saved (15 min per sync average)
    const timeSavedMinutes = (syncConfig.sync_count || 0) * 15;

    // Determine current status
    let currentStatus = 'synced';
    if (syncHistory && syncHistory.length > 0) {
      const latestSync = syncHistory[0];
      if (latestSync.status === 'in_progress') {
        currentStatus = 'cleaning';
      } else if (latestSync.status === 'deploying') {
        currentStatus = 'deploying';
      } else if (latestSync.status === 'failed') {
        currentStatus = 'error';
      }
    }

    // Check server health
    const deployment = syncConfig.server_deployments;
    if (deployment?.health_status === 'unhealthy' || deployment?.status === 'failed') {
      currentStatus = 'error';
    }

    // Log access for audit
    await supabase.from('admin_activity_logs').insert({
      action_type: 'widget_access',
      title: 'Widget Access',
      description: `Widget accessed for ${deployment?.project_name || 'Unknown project'}`,
      status: 'info',
      deployment_id: syncConfig.deployment_id,
      user_id: syncConfig.user_id,
      metadata: {
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent'),
      }
    });

    return new Response(
      JSON.stringify({
        status: currentStatus,
        sync_enabled: syncConfig.sync_enabled,
        zen_mode: syncConfig.zen_mode,
        last_sync_at: syncConfig.last_sync_at,
        last_sync_status: syncConfig.last_sync_status,
        sync_count: syncConfig.sync_count || 0,
        time_saved_minutes: timeSavedMinutes,
        deployment: deployment ? {
          project_name: deployment.project_name,
          deployed_url: deployment.deployed_url,
          status: deployment.status,
          health_status: deployment.health_status,
          last_health_check: deployment.last_health_check,
          server_ip: deployment.user_servers?.ip_address,
          coolify_url: deployment.user_servers?.coolify_url,
        } : null,
        recent_activity: activityLogs?.map(log => ({
          id: log.id,
          title: log.title,
          description: log.description,
          status: log.status,
          created_at: log.created_at,
        })) || [],
        sync_history: syncHistory?.map(h => ({
          id: h.id,
          commit_sha: h.commit_sha?.substring(0, 7),
          commit_message: h.commit_message,
          status: h.status,
          started_at: h.started_at,
          completed_at: h.completed_at,
          files_changed: h.files_changed?.length || 0,
        })) || [],
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Widget auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
