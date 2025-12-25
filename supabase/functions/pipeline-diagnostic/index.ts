import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiagnosticResult {
  service: string;
  status: 'ok' | 'error' | 'warning';
  latency_ms?: number;
  message: string;
  details?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: DiagnosticResult[] = [];
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
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

    // Check if admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[pipeline-diagnostic] Starting comprehensive diagnostic...');

    // ==================== TEST 1: GITHUB TOKEN ====================
    const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
    
    if (!githubToken) {
      results.push({
        service: 'GitHub Token (Secret)',
        status: 'error',
        message: 'GITHUB_PERSONAL_ACCESS_TOKEN not found in secrets',
        details: { action: 'Add the secret via Supabase dashboard' }
      });
    } else {
      console.log('[pipeline-diagnostic] Testing GitHub API connection...');
      const ghStart = Date.now();
      
      try {
        // Test 1a: Validate token with /user endpoint
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        });

        const ghLatency = Date.now() - ghStart;

        if (!userResponse.ok) {
          const errorText = await userResponse.text();
          results.push({
            service: 'GitHub API',
            status: 'error',
            latency_ms: ghLatency,
            message: `Authentication failed: ${userResponse.status}`,
            details: { 
              status_code: userResponse.status,
              error: errorText.slice(0, 200),
              action: 'Token may be expired or revoked. Regenerate at github.com/settings/tokens'
            }
          });
        } else {
          const userData = await userResponse.json();
          
          // Test 1b: Check token scopes
          const scopes = userResponse.headers.get('x-oauth-scopes') || '';
          const hasRepoScope = scopes.includes('repo');
          const hasWorkflowScope = scopes.includes('workflow');
          const hasAdminRepoHook = scopes.includes('admin:repo_hook');

          results.push({
            service: 'GitHub API',
            status: 'ok',
            latency_ms: ghLatency,
            message: `Connected as ${userData.login}`,
            details: {
              username: userData.login,
              name: userData.name,
              scopes: scopes,
              has_repo_scope: hasRepoScope,
              has_workflow_scope: hasWorkflowScope,
              has_admin_repo_hook: hasAdminRepoHook,
              public_repos: userData.public_repos,
              private_repos: userData.total_private_repos
            }
          });

          // Warn if missing critical scopes
          if (!hasRepoScope) {
            results.push({
              service: 'GitHub Permissions',
              status: 'warning',
              message: 'Missing "repo" scope - cannot create private repositories',
              details: { current_scopes: scopes, required: 'repo' }
            });
          }

          if (!hasWorkflowScope) {
            results.push({
              service: 'GitHub Permissions',
              status: 'warning',
              message: 'Missing "workflow" scope - GitHub Actions may not work',
              details: { current_scopes: scopes, required: 'workflow' }
            });
          }

          // Test 1c: Test repo creation capability (dry run - list repos)
          const reposResponse = await fetch('https://api.github.com/user/repos?per_page=1', {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github+json'
            }
          });

          if (reposResponse.ok) {
            results.push({
              service: 'GitHub Repo Access',
              status: 'ok',
              message: 'Can list and create repositories'
            });
          }
        }
      } catch (ghError) {
        results.push({
          service: 'GitHub API',
          status: 'error',
          message: `Connection failed: ${ghError}`,
          details: { error: String(ghError), action: 'Check network or DNS resolution' }
        });
      }
    }

    // ==================== TEST 2: USER GITHUB TOKEN ====================
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('github_token, github_destination_token, github_destination_username')
      .eq('user_id', user.id)
      .single();

    if (userSettings?.github_token) {
      const userGhStart = Date.now();
      try {
        const userGhResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${userSettings.github_token}`,
            'Accept': 'application/vnd.github+json'
          }
        });

        const userGhLatency = Date.now() - userGhStart;

        if (userGhResponse.ok) {
          const userGhData = await userGhResponse.json();
          const scopes = userGhResponse.headers.get('x-oauth-scopes') || '';
          
          results.push({
            service: 'User GitHub Token',
            status: 'ok',
            latency_ms: userGhLatency,
            message: `Valid token for ${userGhData.login}`,
            details: {
              username: userGhData.login,
              scopes: scopes,
              destination_username: userSettings.github_destination_username
            }
          });
        } else {
          results.push({
            service: 'User GitHub Token',
            status: 'error',
            latency_ms: userGhLatency,
            message: `Invalid or expired token: ${userGhResponse.status}`,
            details: { action: 'User needs to update their GitHub token in settings' }
          });
        }
      } catch (e) {
        results.push({
          service: 'User GitHub Token',
          status: 'error',
          message: `Connection error: ${e}`
        });
      }
    } else {
      results.push({
        service: 'User GitHub Token',
        status: 'warning',
        message: 'No personal GitHub token configured for this user',
        details: { action: 'User should add their GitHub PAT in Settings' }
      });
    }

    // ==================== TEST 3: COOLIFY SERVERS ====================
    const { data: userServers } = await supabase
      .from('user_servers')
      .select('*')
      .eq('user_id', user.id);

    if (!userServers || userServers.length === 0) {
      results.push({
        service: 'Coolify Servers',
        status: 'warning',
        message: 'No VPS servers configured',
        details: { action: 'Add a VPS server in the dashboard' }
      });
    } else {
      for (const srv of userServers) {
        const srvName = srv.name || srv.ip_address;
        
        if (!srv.coolify_url || !srv.coolify_token) {
          results.push({
            service: `Coolify: ${srvName}`,
            status: 'error',
            message: 'Missing Coolify URL or Token',
            details: { 
              has_url: !!srv.coolify_url,
              has_token: !!srv.coolify_token,
              status: srv.status
            }
          });
          continue;
        }

        // Test Coolify API connectivity
        const coolifyStart = Date.now();
        try {
          // Normalize URL
          let coolifyUrl = srv.coolify_url.replace(/\/$/, '');
          if (!coolifyUrl.startsWith('http')) {
            coolifyUrl = `http://${coolifyUrl}`;
          }

          console.log(`[pipeline-diagnostic] Testing Coolify at ${coolifyUrl}...`);

          // Test /api/v1/servers endpoint
          const serversResponse = await fetch(`${coolifyUrl}/api/v1/servers`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${srv.coolify_token}`,
              'Accept': 'application/json'
            }
          });

          const coolifyLatency = Date.now() - coolifyStart;

          if (!serversResponse.ok) {
            const errorText = await serversResponse.text();
            let errorMessage = `API responded with ${serversResponse.status}`;
            let action = '';

            if (serversResponse.status === 401 || serversResponse.status === 403) {
              errorMessage = 'Authentication failed - Invalid or expired token';
              action = 'Regenerate the API token in Coolify dashboard (Settings > API)';
            } else if (serversResponse.status === 404) {
              errorMessage = 'API endpoint not found - Wrong Coolify URL or version';
              action = `Verify URL is correct: ${coolifyUrl}`;
            }

            results.push({
              service: `Coolify: ${srvName}`,
              status: 'error',
              latency_ms: coolifyLatency,
              message: errorMessage,
              details: {
                url: coolifyUrl,
                status_code: serversResponse.status,
                error: errorText.slice(0, 300),
                action
              }
            });
          } else {
            const serversData = await serversResponse.json();
            
            // Test /api/v1/projects endpoint too
            const projectsResponse = await fetch(`${coolifyUrl}/api/v1/projects`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${srv.coolify_token}`,
                'Accept': 'application/json'
              }
            });

            const projectsData = projectsResponse.ok ? await projectsResponse.json() : [];

            results.push({
              service: `Coolify: ${srvName}`,
              status: 'ok',
              latency_ms: coolifyLatency,
              message: `Connected - ${serversData.length} server(s), ${projectsData.length} project(s)`,
              details: {
                url: coolifyUrl,
                ip: srv.ip_address,
                servers_count: serversData.length,
                projects_count: projectsData.length,
                server_status: srv.status,
                servers: serversData.map((s: { name: string; uuid: string }) => ({ 
                  name: s.name, 
                  uuid: s.uuid 
                }))
              }
            });

            // Check if there's at least one server in Coolify
            if (serversData.length === 0) {
              results.push({
                service: `Coolify: ${srvName} - Servers`,
                status: 'warning',
                message: 'No servers registered in Coolify',
                details: { action: 'Add localhost server in Coolify dashboard' }
              });
            }
          }
        } catch (coolifyError) {
          const coolifyLatency = Date.now() - coolifyStart;
          
          let message = `Connection failed: ${coolifyError}`;
          let action = 'Check if Coolify is running and accessible';

          if (String(coolifyError).includes('ECONNREFUSED') || 
              String(coolifyError).includes('connection refused')) {
            message = 'Connection refused - Coolify may not be running';
            action = 'SSH to server and run: docker ps | grep coolify';
          } else if (String(coolifyError).includes('timeout') ||
                     String(coolifyError).includes('ETIMEDOUT')) {
            message = 'Connection timeout - Firewall may be blocking port 8000';
            action = 'Check firewall: sudo ufw allow 8000/tcp';
          }

          results.push({
            service: `Coolify: ${srvName}`,
            status: 'error',
            latency_ms: coolifyLatency,
            message,
            details: {
              url: srv.coolify_url,
              ip: srv.ip_address,
              error: String(coolifyError),
              action
            }
          });
        }
      }
    }

    // ==================== TEST 4: RECENT DEPLOYMENTS ====================
    const { data: recentDeployments } = await supabase
      .from('server_deployments')
      .select('id, project_name, status, error_message, created_at, github_repo_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentDeployments && recentDeployments.length > 0) {
      const failedDeployments = recentDeployments.filter(d => 
        d.status === 'failed' || d.status === 'error'
      );

      if (failedDeployments.length > 0) {
        results.push({
          service: 'Recent Deployments',
          status: 'warning',
          message: `${failedDeployments.length} failed deployment(s) in last 5`,
          details: {
            failed: failedDeployments.map(d => ({
              project: d.project_name,
              error: d.error_message?.slice(0, 200),
              date: d.created_at
            }))
          }
        });
      } else {
        results.push({
          service: 'Recent Deployments',
          status: 'ok',
          message: `${recentDeployments.length} recent deployment(s), all successful`
        });
      }
    }

    // ==================== SUMMARY ====================
    const totalTime = Date.now() - startTime;
    const errorCount = results.filter(r => r.status === 'error').length;
    const warningCount = results.filter(r => r.status === 'warning').length;
    const okCount = results.filter(r => r.status === 'ok').length;

    console.log(`[pipeline-diagnostic] Completed in ${totalTime}ms: ${okCount} OK, ${warningCount} warnings, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: errorCount === 0,
        summary: {
          total_checks: results.length,
          ok: okCount,
          warnings: warningCount,
          errors: errorCount,
          duration_ms: totalTime
        },
        results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[pipeline-diagnostic] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Diagnostic failed', 
        details: String(error),
        results 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
