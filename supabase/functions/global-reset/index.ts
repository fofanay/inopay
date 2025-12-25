import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetOptions {
  reset_coolify: boolean;
  reset_database: boolean;
  reset_github: boolean;
  dry_run?: boolean;
}

interface ResetResult {
  success: boolean;
  dry_run: boolean;
  coolify: {
    apps_deleted: number;
    projects_deleted: number;
    servers_processed: number;
    errors: string[];
  };
  database: {
    server_deployments: number;
    sync_configurations: number;
    sync_history: number;
    deployment_history: number;
    projects_analysis: number;
    cleaning_cache: number;
    cleaning_estimates: number;
    health_check_logs: number;
    errors: string[];
  };
  github: {
    repos_deleted: number;
    errors: string[];
  };
  audit_log_id: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth - Admin only
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

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      console.log(`[global-reset] Unauthorized: user ${user.id} is not admin`);
      return new Response(
        JSON.stringify({ error: 'Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const options: ResetOptions = await req.json();
    const { reset_coolify, reset_database, reset_github, dry_run = false } = options;

    console.log(`[global-reset] Starting reset - dry_run: ${dry_run}, options:`, options);

    const result: ResetResult = {
      success: true,
      dry_run,
      coolify: { apps_deleted: 0, projects_deleted: 0, servers_processed: 0, errors: [] },
      database: {
        server_deployments: 0,
        sync_configurations: 0,
        sync_history: 0,
        deployment_history: 0,
        projects_analysis: 0,
        cleaning_cache: 0,
        cleaning_estimates: 0,
        health_check_logs: 0,
        errors: []
      },
      github: { repos_deleted: 0, errors: [] },
      audit_log_id: null
    };

    // 1. Reset Coolify (delete all apps and projects from all servers)
    if (reset_coolify) {
      console.log('[global-reset] Starting Coolify reset...');
      
      const { data: servers } = await supabase
        .from('user_servers')
        .select('id, coolify_url, coolify_token, name');

      if (servers && servers.length > 0) {
        for (const server of servers) {
          if (!server.coolify_url || !server.coolify_token) continue;
          result.coolify.servers_processed++;

          const coolifyHeaders = {
            'Authorization': `Bearer ${server.coolify_token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          };

          try {
            // Get all applications
            const appsResponse = await fetch(`${server.coolify_url}/api/v1/applications`, {
              headers: coolifyHeaders
            });

            if (appsResponse.ok) {
              const apps = await appsResponse.json();
              console.log(`[global-reset] Found ${apps.length} apps on server ${server.name}`);
              
              for (const app of apps) {
                if (!dry_run) {
                  try {
                    await fetch(`${server.coolify_url}/api/v1/applications/${app.uuid}`, {
                      method: 'DELETE',
                      headers: coolifyHeaders
                    });
                    result.coolify.apps_deleted++;
                    console.log(`[global-reset] Deleted app: ${app.name || app.uuid}`);
                  } catch (e) {
                    result.coolify.errors.push(`Failed to delete app ${app.uuid}: ${e}`);
                  }
                } else {
                  result.coolify.apps_deleted++;
                }
              }
            }

            // Get all projects
            const projectsResponse = await fetch(`${server.coolify_url}/api/v1/projects`, {
              headers: coolifyHeaders
            });

            if (projectsResponse.ok) {
              const projects = await projectsResponse.json();
              console.log(`[global-reset] Found ${projects.length} projects on server ${server.name}`);
              
              for (const project of projects) {
                if (!dry_run) {
                  try {
                    await fetch(`${server.coolify_url}/api/v1/projects/${project.uuid}`, {
                      method: 'DELETE',
                      headers: coolifyHeaders
                    });
                    result.coolify.projects_deleted++;
                    console.log(`[global-reset] Deleted project: ${project.name}`);
                  } catch (e) {
                    result.coolify.errors.push(`Failed to delete project ${project.uuid}: ${e}`);
                  }
                } else {
                  result.coolify.projects_deleted++;
                }
              }
            }
          } catch (e) {
            result.coolify.errors.push(`Error processing server ${server.name}: ${e}`);
          }
        }
      }
    }

    // 2. Reset Database tables
    if (reset_database) {
      console.log('[global-reset] Starting database reset...');

      const tablesToReset = [
        'health_check_logs',
        'sync_history',
        'sync_configurations',
        'server_deployments',
        'deployment_history',
        'projects_analysis',
        'cleaning_cache',
        'cleaning_estimates'
      ];

      for (const table of tablesToReset) {
        try {
          if (dry_run) {
            const { count } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true });
            (result.database as Record<string, number | string[]>)[table] = count || 0;
          } else {
            // Delete all records from the table
            const { count, error } = await supabase
              .from(table)
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (dummy condition)
            
            if (error) {
              result.database.errors.push(`Error deleting from ${table}: ${error.message}`);
              console.error(`[global-reset] Error deleting from ${table}:`, error);
            } else {
              (result.database as Record<string, number | string[]>)[table] = count || 0;
              console.log(`[global-reset] Deleted ${count} records from ${table}`);
            }
          }
        } catch (e) {
          result.database.errors.push(`Exception on ${table}: ${e}`);
        }
      }
    }

    // 3. Reset GitHub repos (optional - only if explicitly requested)
    if (reset_github) {
      console.log('[global-reset] GitHub reset requested - requires admin GitHub token');
      
      const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
      if (!githubToken) {
        result.github.errors.push('GITHUB_PERSONAL_ACCESS_TOKEN not configured');
      } else {
        // Get the GitHub user info
        try {
          const userResponse = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Inopay-Admin'
            }
          });

          if (userResponse.ok) {
            const githubUser = await userResponse.json();
            const username = githubUser.login;

            // List all repos matching pattern
            const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, {
              headers: {
                'Authorization': `token ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Inopay-Admin'
              }
            });

            if (reposResponse.ok) {
              const repos = await reposResponse.json();
              // Only delete repos that match sovereign pattern
              const sovereignRepos = repos.filter((r: { name: string }) => 
                r.name.includes('-sovereign-') || r.name.startsWith('inopay-')
              );

              console.log(`[global-reset] Found ${sovereignRepos.length} repos to delete`);

              for (const repo of sovereignRepos) {
                if (!dry_run) {
                  try {
                    const deleteResp = await fetch(`https://api.github.com/repos/${username}/${repo.name}`, {
                      method: 'DELETE',
                      headers: {
                        'Authorization': `token ${githubToken}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'User-Agent': 'Inopay-Admin'
                      }
                    });
                    if (deleteResp.ok || deleteResp.status === 204) {
                      result.github.repos_deleted++;
                      console.log(`[global-reset] Deleted repo: ${repo.name}`);
                    } else {
                      result.github.errors.push(`Failed to delete ${repo.name}: ${deleteResp.status}`);
                    }
                  } catch (e) {
                    result.github.errors.push(`Error deleting ${repo.name}: ${e}`);
                  }
                } else {
                  result.github.repos_deleted++;
                }
              }
            }
          }
        } catch (e) {
          result.github.errors.push(`GitHub API error: ${e}`);
        }
      }
    }

    // Create audit log entry
    if (!dry_run) {
      const { data: auditLog, error: auditError } = await supabase
        .from('security_audit_logs')
        .insert({
          user_id: user.id,
          action: 'global_reset',
          details: {
            options,
            result: {
              coolify: result.coolify,
              database: result.database,
              github: result.github
            }
          }
        })
        .select('id')
        .single();

      if (!auditError && auditLog) {
        result.audit_log_id = auditLog.id;
      }

      // Also log in admin activity
      await supabase.from('admin_activity_logs').insert({
        user_id: user.id,
        action_type: 'global_reset',
        title: 'Global System Reset',
        description: `Reset performed: Coolify=${reset_coolify}, Database=${reset_database}, GitHub=${reset_github}`,
        status: 'success',
        metadata: result
      });
    }

    console.log('[global-reset] Reset completed:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[global-reset] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
