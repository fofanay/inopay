import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse Coolify JSON logs array into readable text
function parseJsonLogs(logsInput: string): string {
  try {
    const parsed = JSON.parse(logsInput);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry: { output?: string }) => entry.output)
        .map((entry: { output?: string; command?: string }) =>
          entry.command ? `$ ${entry.command}\n${entry.output}` : entry.output
        )
        .join('\n');
    }
    return logsInput;
  } catch {
    return logsInput;
  }
}

function redactSecrets(input: string): string {
  return input
    .replace(/x-access-token:[^@\s]+@github\.com/gi, 'x-access-token:[REDACTED]@github.com')
    .replace(/ghp_[A-Za-z0-9]+/g, 'ghp_[REDACTED]')
    .replace(/github_pat_[A-Za-z0-9_]+/g, 'github_pat_[REDACTED]');
}

function buildAuthenticatedGithubUrl(repoUrl: string, token: string | null): string | null {
  if (!token) return null;
  if (!repoUrl || !repoUrl.includes('github.com')) return null;

  const urlMatch = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.#?]+)/i);
  if (!urlMatch) return null;

  const [, owner, repo] = urlMatch;
  return `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
}

function looksLikeGitAuthError(text: string): boolean {
  const s = (text || '').toLowerCase();
  return (
    s.includes('authentication failed') ||
    s.includes('fatal: could not read username') ||
    s.includes('permission denied') ||
    s.includes('repository not found') ||
    (s.includes('403') && s.includes('github')) ||
    (s.includes('access denied') && s.includes('github'))
  );
}

async function fetchCoolifyApplicationLogs(
  coolifyUrl: string,
  coolifyHeaders: Record<string, string>,
  appUuid: string,
): Promise<string> {
  const candidates = [
    `${coolifyUrl}/api/v1/applications/${appUuid}/logs`,
    `${coolifyUrl}/api/v1/applications/${appUuid}/logs?take=200`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: 'GET', headers: coolifyHeaders });
      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        const maybe = (json?.logs ?? json?.log ?? json?.data ?? json) as unknown;
        if (typeof maybe === 'string') return maybe;
        return JSON.stringify(maybe, null, 2);
      }

      return await res.text();
    } catch {
      // continue
    }
  }

  return '';
}


// Helper function to fetch Coolify logs via the CORRECT API endpoints
async function fetchCoolifyDeploymentLogs(
  coolifyUrl: string,
  coolifyHeaders: Record<string, string>,
  appUuid: string,
  preferredDeploymentUuid?: string | null,
): Promise<{ logs: string; deploymentUuid: string | null; status: string | null }> {
  try {
    console.log('[deploy-coolify] Fetching deployment logs for app:', appUuid);

    // If we already have a deployment UUID (returned by /deploy), fetch it directly first.
    if (preferredDeploymentUuid) {
      try {
        const directDetailResponse = await fetch(
          `${coolifyUrl}/api/v1/deployments/${preferredDeploymentUuid}`,
          { method: 'GET', headers: coolifyHeaders },
        );

        if (directDetailResponse.ok) {
          const directDetail = await directDetailResponse.json();
          const directLogs =
            directDetail?.logs ?? directDetail?.deployment_log ?? directDetail?.log ?? '';

          if (typeof directLogs === 'string' && directLogs.trim().length > 0) {
            console.log('[deploy-coolify] Retrieved logs via deployment UUID');
            return { logs: directLogs, deploymentUuid: preferredDeploymentUuid, status: null };
          }
        }
      } catch (e) {
        console.warn('[deploy-coolify] Direct deployment log fetch failed (will fallback):', e);
      }
    }

    // CORRECT ENDPOINT: GET /api/v1/deployments/applications/{uuid}
    // (NOT /api/v1/applications/{uuid}/deployments which returns app info, not deployments)
    const deploymentsListResponse = await fetch(
      `${coolifyUrl}/api/v1/deployments/applications/${appUuid}?take=5`,
      { method: 'GET', headers: coolifyHeaders }
    );
    
    if (!deploymentsListResponse.ok) {
      const errorText = await deploymentsListResponse.text();
      console.warn('[deploy-coolify] Failed to fetch deployments list:', errorText);
      
      // Fallback: try old endpoint format
      const fallbackResponse = await fetch(
        `${coolifyUrl}/api/v1/applications/${appUuid}/deployments`,
        { method: 'GET', headers: coolifyHeaders }
      );
      
      if (!fallbackResponse.ok) {
        return { logs: `Could not fetch deployments: ${errorText}`, deploymentUuid: null, status: null };
      }
      
      const fallbackData = await fallbackResponse.json();
      console.log('[deploy-coolify] Fallback deployments response:', JSON.stringify(fallbackData).slice(0, 500));
      return { logs: JSON.stringify(fallbackData, null, 2).slice(0, 3000), deploymentUuid: null, status: null };
    }
    
    const deploymentsListRaw = await deploymentsListResponse.json();
    
    // Coolify API may return an array OR an object { count, deployments: [...] }
    let deploymentsArray: Array<{ deployment_uuid?: string; uuid?: string; status?: string; logs?: string }> = [];
    if (Array.isArray(deploymentsListRaw)) {
      deploymentsArray = deploymentsListRaw;
    } else if (deploymentsListRaw && Array.isArray(deploymentsListRaw.deployments)) {
      deploymentsArray = deploymentsListRaw.deployments;
    }
    
    console.log('[deploy-coolify] Deployments list count:', deploymentsArray.length);
    console.log('[deploy-coolify] Deployments list sample:', JSON.stringify(deploymentsListRaw).slice(0, 800));
    
    if (deploymentsArray.length === 0) {
      return { logs: 'No deployments found in list', deploymentUuid: null, status: null };
    }
    
    // Get the most recent deployment
    const latestDeployment = deploymentsArray[0];
    const deploymentUuid = latestDeployment.deployment_uuid || latestDeployment.uuid;
    const deploymentStatus = latestDeployment.status || null;
    
    // IMPORTANT: If the deployment already has logs embedded (common in list response), use them first!
    if (latestDeployment.logs && typeof latestDeployment.logs === 'string' && latestDeployment.logs.length > 10) {
      console.log('[deploy-coolify] Using embedded logs from list response');
      const parsedLogs = parseJsonLogs(latestDeployment.logs);
      return { logs: parsedLogs, deploymentUuid: deploymentUuid || null, status: deploymentStatus };
    }
    
    console.log('[deploy-coolify] Latest deployment UUID:', deploymentUuid, 'status:', deploymentStatus);
    
    // Fetch detailed deployment info including logs
    const deploymentDetailResponse = await fetch(
      `${coolifyUrl}/api/v1/deployments/${deploymentUuid}`,
      { method: 'GET', headers: coolifyHeaders }
    );
    
    if (!deploymentDetailResponse.ok) {
      const errorText = await deploymentDetailResponse.text();
      console.warn('[deploy-coolify] Failed to fetch deployment details:', errorText);
      return { 
        logs: `Deployment ${deploymentUuid} status: ${deploymentStatus}\nCould not fetch details: ${errorText}`, 
        deploymentUuid: deploymentUuid || null, 
        status: deploymentStatus 
      };
    }
    
    const deploymentDetail = await deploymentDetailResponse.json();
    console.log('[deploy-coolify] Deployment detail keys:', Object.keys(deploymentDetail));
    
    // Extract logs from response - Coolify uses 'logs' or 'deployment_log' field
    let logs = '';
    if (deploymentDetail.logs) {
      logs = deploymentDetail.logs;
    } else if (deploymentDetail.deployment_log) {
      logs = deploymentDetail.deployment_log;
    } else if (deploymentDetail.log) {
      logs = deploymentDetail.log;
    } else {
      // Include full response for debugging
      logs = `Deployment details:\n${JSON.stringify(deploymentDetail, null, 2)}`;
    }
    
    console.log(`[deploy-coolify] Retrieved ${logs.length} chars of logs`);
    return { logs, deploymentUuid: deploymentUuid || null, status: deploymentStatus };
  } catch (error) {
    console.error('[deploy-coolify] Error fetching logs:', error);
    return { logs: `Error fetching logs: ${error}`, deploymentUuid: null, status: null };
  }
}

// Check if an existing app can be reused for this repo
async function findExistingAppForRepo(
  coolifyUrl: string,
  coolifyHeaders: Record<string, string>,
  projectUuid: string,
  githubRepoUrl: string
): Promise<{ uuid: string; status: string; domains?: string } | null> {
  try {
    // Get project details which includes applications
    const projectResponse = await fetch(
      `${coolifyUrl}/api/v1/projects/${projectUuid}`,
      { method: 'GET', headers: coolifyHeaders }
    );
    
    if (!projectResponse.ok) {
      return null;
    }
    
    const projectData = await projectResponse.json();
    console.log('[deploy-coolify] Project data:', JSON.stringify(projectData).slice(0, 500));
    
    // Check environments and applications
    if (projectData.environments) {
      for (const env of projectData.environments) {
        if (env.applications) {
          for (const app of env.applications) {
            if (app.git_repository === githubRepoUrl) {
              console.log('[deploy-coolify] Found existing app for repo:', app.uuid);
              return { uuid: app.uuid, status: app.status, domains: app.fqdn };
            }
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('[deploy-coolify] Error finding existing app:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
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

    const { server_id, project_name, github_repo_url, domain, retry_count, is_retry } = await req.json();

    if (!server_id || !project_name || !github_repo_url) {
      return new Response(
        JSON.stringify({ error: 'server_id, project_name, and github_repo_url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`[deploy-coolify] Starting deployment for ${project_name}, is_retry: ${is_retry}, retry_count: ${retry_count}`);

    // Get server info
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('*')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server) {
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (server.status !== 'ready') {
      return new Response(
        JSON.stringify({ error: 'Server is not ready for deployment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!server.coolify_url || !server.coolify_token) {
      return new Response(
        JSON.stringify({ error: 'Server Coolify configuration is incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing deployments to determine deploy vs redeploy
    const { data: existingDeployments } = await supabase
      .from('server_deployments')
      .select('id, coolify_app_uuid')
      .eq('user_id', user.id)
      .eq('server_id', server_id)
      .eq('github_repo_url', github_repo_url)
      .in('status', ['deployed', 'success', 'failed'])
      .order('created_at', { ascending: false })
      .limit(1);

    const existingDeployment = existingDeployments?.[0];
    const existingAppUuid = existingDeployment?.coolify_app_uuid;
    const creditType = existingDeployment ? 'redeploy' : 'deploy';
    
    console.log(`[deploy-coolify] Credit type: ${creditType}, existing app UUID: ${existingAppUuid || 'none'}`);

    // Consume credit before proceeding
    const creditResponse = await fetch(`${supabaseUrl}/functions/v1/use-credit`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ credit_type: creditType })
    });

    if (!creditResponse.ok) {
      const creditError = await creditResponse.json();
      console.log('[deploy-coolify] Credit check failed:', creditError);
      return new Response(
        JSON.stringify({
          error: 'Crédit insuffisant',
          credit_type: creditType,
          details: creditError.message || `Un crédit "${creditType}" est requis`,
          redirect_to_pricing: true
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creditData = await creditResponse.json();
    console.log(`[deploy-coolify] Credit consumed:`, creditData);

    // Create deployment record with retry info
    const { data: deployment, error: deployError } = await supabase
      .from('server_deployments')
      .insert({
        user_id: user.id,
        server_id: server.id,
        project_name,
        github_repo_url,
        domain: domain || null,
        status: 'deploying',
        retry_count: retry_count || 0,
        last_retry_at: is_retry ? new Date().toISOString() : null
      })
      .select()
      .single();

    // Link the credit to this deployment
    if (!deployError && deployment && creditData.purchase_id) {
      await supabase
        .from('user_purchases')
        .update({ deployment_id: deployment.id })
        .eq('id', creditData.purchase_id);
    }

    if (deployError) {
      console.error('Deploy insert error:', deployError);
      return new Response(
        JSON.stringify({ error: 'Failed to create deployment record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Coolify API to create application
    const coolifyHeaders = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Track if we created a new project (for rollback on failure)
    let projectCreatedThisSession = false;
    let projectData: { uuid: string; name: string } | null = null;

    try {
      // Step 0: Get available servers from Coolify
      console.log('[deploy-coolify] Fetching Coolify servers...');
      const serversResponse = await fetch(`${server.coolify_url}/api/v1/servers`, {
        method: 'GET',
        headers: coolifyHeaders
      });

      if (!serversResponse.ok) {
        const errorText = await serversResponse.text();
        console.error('[deploy-coolify] Failed to fetch Coolify servers:', errorText);
        throw new Error(`Failed to fetch Coolify servers: ${errorText}`);
      }

      const servers = await serversResponse.json();
      console.log('[deploy-coolify] Available Coolify servers:', JSON.stringify(servers));

      if (!servers || servers.length === 0) {
        throw new Error('No servers found in Coolify. Please add a server in Coolify first.');
      }

      // Use the first available server (usually localhost)
      const coolifyServerUuid = servers[0].uuid;
      console.log('[deploy-coolify] Using Coolify server UUID:', coolifyServerUuid);

      // Step 1: Check for existing project in Coolify (to avoid duplicates)
      console.log('[deploy-coolify] Checking for existing Coolify project...');
      const existingProjectsResponse = await fetch(`${server.coolify_url}/api/v1/projects`, {
        method: 'GET',
        headers: coolifyHeaders
      });

      if (!existingProjectsResponse.ok) {
        const errorText = await existingProjectsResponse.text();
        console.error('[deploy-coolify] Failed to fetch existing projects:', errorText);
        throw new Error(`Failed to fetch existing Coolify projects: ${errorText}`);
      }

      const existingProjects = await existingProjectsResponse.json();
      console.log('[deploy-coolify] Existing projects:', existingProjects.length);

      // Find existing project by name
      const existingProject = existingProjects.find(
        (p: { name: string }) => p.name === project_name
      );

      if (existingProject) {
        console.log('[deploy-coolify] Found existing project:', existingProject.uuid);
        projectData = existingProject;
        projectCreatedThisSession = false;
      } else {
        // Create new project only if doesn't exist
        console.log('[deploy-coolify] Creating new Coolify project...');
        const projectResponse = await fetch(`${server.coolify_url}/api/v1/projects`, {
          method: 'POST',
          headers: coolifyHeaders,
          body: JSON.stringify({
            name: project_name,
            description: `Deployed via Inopay`
          })
        });

        if (!projectResponse.ok) {
          const errorText = await projectResponse.text();
          console.error('[deploy-coolify] Coolify project creation failed:', errorText);
          throw new Error(`Failed to create Coolify project: ${errorText}`);
        }

        projectData = await projectResponse.json();
        projectCreatedThisSession = true;
        console.log('[deploy-coolify] Coolify project created:', projectData);
      }

      if (!projectData) {
        throw new Error('No project data available');
      }

      // Git URL strategy: try public first, fallback to authenticated URL ONLY if we detect a Git auth error.
      const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN') || null;
      const authenticatedGitRepoUrl = buildAuthenticatedGithubUrl(github_repo_url, githubToken);
      let repoAuthMode: 'public' | 'authenticated' = 'public';
      let repoAttemptedAuthFallback = false;

      const getGitRepoUrlForCoolify = () =>
        repoAuthMode === 'authenticated' && authenticatedGitRepoUrl
          ? authenticatedGitRepoUrl
          : github_repo_url;

      // Step 2: Check for existing app to REDEPLOY instead of recreating
      let appData: { uuid: string; domains?: string; fqdn?: string } | null = null;
      let isRedeploy = false;
      
      // First, try to use known app UUID from previous deployment
      if (existingAppUuid) {
        console.log('[deploy-coolify] Checking if existing app UUID is still valid:', existingAppUuid);
        try {
          const appCheckResponse = await fetch(
            `${server.coolify_url}/api/v1/applications/${existingAppUuid}`,
            { method: 'GET', headers: coolifyHeaders }
          );
          
          if (appCheckResponse.ok) {
            appData = await appCheckResponse.json();
            isRedeploy = true;
            console.log('[deploy-coolify] Reusing existing app:', appData?.uuid);
          } else {
            console.log('[deploy-coolify] Previous app not found, will create new');
          }
        } catch (e) {
          console.warn('[deploy-coolify] Error checking existing app:', e);
        }
      }
      
      // If no existing app, check if there's one for this repo in the project
      if (!appData) {
        const existingApp = await findExistingAppForRepo(
          server.coolify_url, 
          coolifyHeaders, 
          projectData.uuid, 
          github_repo_url
        );
        
        if (existingApp) {
          appData = existingApp;
          isRedeploy = true;
          console.log('[deploy-coolify] Found existing app by repo URL:', appData.uuid);
        }
      }

      // Step 2b: Create NEW application if none exists
      if (!appData) {
        console.log('[deploy-coolify] Creating new Coolify application with DOCKERFILE mode...');
        
        const gitRepoForCoolify = getGitRepoUrlForCoolify();
        // At app creation time, we always start with public URL
        const isPrivateRepo = false;
        
        // Use Dockerfile mode (port 80) since the repo has Dockerfile + nginx.conf
        // IMPORTANT: Don't use dockerfile_location in /applications/public endpoint - it's not allowed
        const appPayload = {
          project_uuid: projectData.uuid,
          server_uuid: coolifyServerUuid,
          environment_name: 'production',
          git_repository: gitRepoForCoolify,
          git_branch: 'main',
          build_pack: 'dockerfile',
          ports_exposes: '80',
          health_check_enabled: true,
          health_check_path: '/health',  // Use nginx health endpoint
          health_check_port: '80',
          health_check_interval: 30,
          health_check_timeout: 10,
          health_check_retries: 5,
          health_check_start_period: 120  // 2 minutes for initial startup
        };
        
        console.log('[deploy-coolify] Application payload (repo auth:', isPrivateRepo ? 'private' : 'public', '):', 
          JSON.stringify({ ...appPayload, git_repository: isPrivateRepo ? '[AUTHENTICATED_URL]' : appPayload.git_repository }));
        
        const appResponse = await fetch(`${server.coolify_url}/api/v1/applications/public`, {
          method: 'POST',
          headers: coolifyHeaders,
          body: JSON.stringify(appPayload)
        });

        if (!appResponse.ok) {
          const errorText = await appResponse.text();
          console.error('[deploy-coolify] Coolify app creation failed:', errorText);
          
          // If Dockerfile mode fails, try with nixpacks as fallback
          if (errorText.includes('dockerfile') || errorText.includes('build_pack')) {
            console.log('[deploy-coolify] Dockerfile mode failed, trying nixpacks fallback...');
            
            const fallbackPayload = {
              project_uuid: projectData.uuid,
              server_uuid: coolifyServerUuid,
              environment_name: 'production',
              git_repository: gitRepoForCoolify, // Use authenticated URL for private repos
              git_branch: 'main',
              build_pack: 'nixpacks',
              ports_exposes: '3000',
              start_command: 'npm run build && npm run preview -- --host 0.0.0.0 --port 3000',
              health_check_enabled: true,
              health_check_path: '/',
              health_check_port: '3000',
              health_check_start_period: 120
            };
            
            console.log('[deploy-coolify] Fallback payload (repo auth:', isPrivateRepo ? 'private' : 'public', '):', 
              JSON.stringify({ ...fallbackPayload, git_repository: isPrivateRepo ? '[AUTHENTICATED_URL]' : fallbackPayload.git_repository }));
            
            const fallbackResponse = await fetch(`${server.coolify_url}/api/v1/applications/public`, {
              method: 'POST',
              headers: coolifyHeaders,
              body: JSON.stringify(fallbackPayload)
            });
            
            if (!fallbackResponse.ok) {
              const fallbackError = await fallbackResponse.text();
              console.error('[deploy-coolify] Fallback also failed:', fallbackError);
              
              // Rollback: Delete project if we created it in this session
              if (projectCreatedThisSession && projectData?.uuid) {
                console.log('[deploy-coolify] Rolling back: deleting orphan project...');
                try {
                  await fetch(`${server.coolify_url}/api/v1/projects/${projectData.uuid}`, {
                    method: 'DELETE',
                    headers: coolifyHeaders
                  });
                  console.log('[deploy-coolify] Orphan project deleted successfully');
                } catch (deleteError) {
                  console.error('[deploy-coolify] Failed to delete orphan project:', deleteError);
                }
              }
              
              throw new Error(`Failed to create Coolify application: ${errorText}\nFallback error: ${fallbackError}`);
            }
            
            appData = await fallbackResponse.json();
          } else {
            // Rollback: Delete project if we created it in this session
            if (projectCreatedThisSession && projectData?.uuid) {
              console.log('[deploy-coolify] Rolling back: deleting orphan project...');
              try {
                await fetch(`${server.coolify_url}/api/v1/projects/${projectData.uuid}`, {
                  method: 'DELETE',
                  headers: coolifyHeaders
                });
                console.log('[deploy-coolify] Orphan project deleted successfully');
              } catch (deleteError) {
                console.error('[deploy-coolify] Failed to delete orphan project:', deleteError);
              }
            }
            
            throw new Error(`Failed to create Coolify application: ${errorText}`);
          }
        } else {
          appData = await appResponse.json();
        }
        
        console.log('[deploy-coolify] Coolify application created:', appData);
      }

      if (!appData?.uuid) {
        throw new Error('No application UUID available after creation');
      }

      // Step 2.3: Add/Update environment variables for Supabase (CRITICAL for app to work)
      console.log('[deploy-coolify] Configuring environment variables...');
      const envVars = [
        { key: 'VITE_SUPABASE_URL', value: supabaseUrl, is_preview: false },
        { key: 'VITE_SUPABASE_PUBLISHABLE_KEY', value: Deno.env.get('SUPABASE_ANON_KEY') || '', is_preview: false }
      ];

      for (const envVar of envVars) {
        // For redeploys, we need to update or create the env var
        if (isRedeploy) {
          // First try to get existing envs
          try {
            const envsResponse = await fetch(
              `${server.coolify_url}/api/v1/applications/${appData.uuid}/envs`,
              { method: 'GET', headers: coolifyHeaders }
            );
            
            if (envsResponse.ok) {
              const existingEnvs = await envsResponse.json();
              const existingEnv = existingEnvs.find((e: { key: string }) => e.key === envVar.key);
              
              if (existingEnv) {
                // Update existing env
                const updateResponse = await fetch(
                  `${server.coolify_url}/api/v1/applications/${appData.uuid}/envs/${envVar.key}`,
                  { 
                    method: 'PATCH', 
                    headers: coolifyHeaders,
                    body: JSON.stringify({ value: envVar.value })
                  }
                );
                
                if (updateResponse.ok) {
                  console.log(`[deploy-coolify] Updated env var: ${envVar.key}`);
                  continue;
                }
              }
            }
          } catch (e) {
            console.warn(`[deploy-coolify] Error checking existing env ${envVar.key}:`, e);
          }
        }
        
        // Create new env var
        const envResponse = await fetch(`${server.coolify_url}/api/v1/applications/${appData.uuid}/envs`, {
          method: 'POST',
          headers: coolifyHeaders,
          body: JSON.stringify(envVar)
        });
        
        if (!envResponse.ok) {
          const envError = await envResponse.text();
          // Don't fail on env errors if it's a redeploy (might already exist)
          if (!isRedeploy) {
            console.error(`[deploy-coolify] CRITICAL: Failed to add env var ${envVar.key}:`, envError);
            throw new Error(`Failed to add required environment variable ${envVar.key}: ${envError}`);
          } else {
            console.warn(`[deploy-coolify] Could not update env var ${envVar.key} (may already exist): ${envError}`);
          }
        } else {
          console.log(`[deploy-coolify] Added env var: ${envVar.key}`);
        }
      }
      
      console.log(`[deploy-coolify] Environment variables configured`);

      // Step 2.5: Update application with custom domain if provided
      if (domain) {
        console.log('[deploy-coolify] Setting custom domain:', domain);
        const domainResponse = await fetch(`${server.coolify_url}/api/v1/applications/${appData.uuid}`, {
          method: 'PATCH',
          headers: coolifyHeaders,
          body: JSON.stringify({
            fqdn: `https://${domain}`
          })
        });
        
        if (!domainResponse.ok) {
          const errorText = await domainResponse.text();
          console.warn('[deploy-coolify] Domain configuration failed (non-blocking):', errorText);
        } else {
          console.log('[deploy-coolify] Custom domain configured');
        }
      }

      const triggerDeployAndPoll = async (label: string) => {
        // Step 3: Trigger deployment
        console.log(`[deploy-coolify] Triggering deployment (${label})...`);
        const deployResponse = await fetch(`${server.coolify_url}/api/v1/deploy?uuid=${appData.uuid}&force=true`, {
          method: 'GET',
          headers: coolifyHeaders
        });

        if (!deployResponse.ok) {
          const errorText = await deployResponse.text();
          console.error('[deploy-coolify] Coolify deploy failed:', errorText);
          throw new Error(`Failed to trigger deployment: ${errorText}`);
        }

        const deployData = await deployResponse.json();
        console.log('[deploy-coolify] Deployment triggered:', redactSecrets(JSON.stringify(deployData)));

        // Extract deployment_uuid from /deploy response for precise log fetching later
        let triggeredDeploymentUuid: string | null = null;
        if (deployData?.deployments && Array.isArray(deployData.deployments) && deployData.deployments.length > 0) {
          triggeredDeploymentUuid = deployData.deployments[0].deployment_uuid || null;
          console.log('[deploy-coolify] Captured deployment_uuid:', triggeredDeploymentUuid);
        }

        // Step 4: Wait and check build status (poll for up to 8 minutes)
        console.log('[deploy-coolify] Waiting for build to complete...');
        let buildStatus = 'building';
        let attempts = 0;
        const maxAttempts = 96; // 96 * 5s = 8 minutes (longer timeout for slower builds)
        let lastAppStatus: Record<string, unknown> | null = null;

        let exitedStreak = 0;
        const maxExitedStreak = 4; // avoid concluding after a single exited:unhealthy

        while (
          attempts < maxAttempts &&
          buildStatus !== 'running' &&
          !buildStatus.includes('failed') &&
          !(buildStatus.startsWith('exited') && exitedStreak >= maxExitedStreak)
        ) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
          attempts++;

          try {
            const statusResponse = await fetch(
              `${server.coolify_url}/api/v1/applications/${appData.uuid}`,
              { method: 'GET', headers: coolifyHeaders }
            );

            if (statusResponse.ok) {
              lastAppStatus = await statusResponse.json();
              buildStatus = (lastAppStatus as { status?: string }).status || 'unknown';

              if (buildStatus.startsWith('exited')) exitedStreak++;
              else exitedStreak = 0;

              console.log(`[deploy-coolify] Build status check ${attempts}/${maxAttempts}: ${buildStatus}`);
            }
          } catch (statusError) {
            console.warn(`[deploy-coolify] Status check ${attempts} failed:`, statusError);
          }
        }

        return { buildStatus, attempts, lastAppStatus, triggeredDeploymentUuid };
      };

      // First attempt: public URL
      let buildStatus = 'building';
      let attempts = 0;
      let lastAppStatus: Record<string, unknown> | null = null;
      let triggeredDeploymentUuid: string | null = null;
      let buildLogsForSummary = '';
      let usedDeploymentUuid: string | null = null;

      ({ buildStatus, attempts, lastAppStatus, triggeredDeploymentUuid } = await triggerDeployAndPoll('public'));

      // If it looks like a Git auth failure, retry once with authenticated URL (if available)
      if (buildStatus !== 'running') {
        const { logs: firstAttemptLogs, deploymentUuid: fetchedDeploymentUuid } = await fetchCoolifyDeploymentLogs(
          server.coolify_url,
          coolifyHeaders,
          appData.uuid,
          triggeredDeploymentUuid
        );

        usedDeploymentUuid = fetchedDeploymentUuid || triggeredDeploymentUuid;
        buildLogsForSummary = redactSecrets(parseJsonLogs(firstAttemptLogs || ''));

        if (repoAuthMode === 'public' && authenticatedGitRepoUrl && looksLikeGitAuthError(buildLogsForSummary)) {
          repoAttemptedAuthFallback = true;
          repoAuthMode = 'authenticated';
          console.log('[deploy-coolify] Git auth error detected; retrying with authenticated Git URL...');

          try {
            const patchRes = await fetch(`${server.coolify_url}/api/v1/applications/${appData.uuid}`, {
              method: 'PATCH',
              headers: coolifyHeaders,
              body: JSON.stringify({ git_repository: authenticatedGitRepoUrl })
            });

            if (!patchRes.ok) {
              const patchErr = await patchRes.text();
              console.warn('[deploy-coolify] Could not update git repository (non-blocking):', redactSecrets(patchErr));
            }
          } catch (e) {
            console.warn('[deploy-coolify] Error updating git repository (non-blocking):', e);
          }

          ({ buildStatus, attempts, lastAppStatus, triggeredDeploymentUuid } = await triggerDeployAndPoll('authenticated'));

          if (buildStatus !== 'running') {
            const { logs: secondAttemptLogs, deploymentUuid: fetchedDeploymentUuid2 } = await fetchCoolifyDeploymentLogs(
              server.coolify_url,
              coolifyHeaders,
              appData.uuid,
              triggeredDeploymentUuid
            );

            usedDeploymentUuid = fetchedDeploymentUuid2 || triggeredDeploymentUuid;
            buildLogsForSummary = redactSecrets(parseJsonLogs(secondAttemptLogs || ''));
          } else {
            // succeeded; clear logs (not needed)
            buildLogsForSummary = '';
          }
        }
      }

      // Determine final status
      const isHealthy = buildStatus === 'running';
      const isFailed = buildStatus.includes('failed') || buildStatus.includes('unhealthy') || buildStatus.startsWith('exited');
      const finalStatus = isHealthy ? 'deployed' : (isFailed ? 'failed' : 'deploying');
      console.log(`[deploy-coolify] Final status after ${attempts} checks: ${finalStatus} (build: ${buildStatus})`);

      // Fetch comprehensive logs
      let errorSummary = '';
      if (finalStatus === 'failed') {
        console.log('[deploy-coolify] Build failed, fetching comprehensive logs...');

        // Ensure we have build logs (may already be filled from the auth-fallback detection)
        let buildLogs = buildLogsForSummary;

        if (!buildLogs) {
          const { logs: fetchedLogs, deploymentUuid: fetchedDeploymentUuid } = await fetchCoolifyDeploymentLogs(
            server.coolify_url,
            coolifyHeaders,
            appData.uuid,
            triggeredDeploymentUuid
          );
          usedDeploymentUuid = fetchedDeploymentUuid || triggeredDeploymentUuid;
          buildLogs = redactSecrets(parseJsonLogs(fetchedLogs || ''));
        }

        // Fetch runtime logs (helps for exited:unhealthy)
        const runtimeLogsRaw = await fetchCoolifyApplicationLogs(
          server.coolify_url,
          coolifyHeaders,
          appData.uuid
        );
        const runtimeLogs = runtimeLogsRaw ? redactSecrets(parseJsonLogs(runtimeLogsRaw)) : '';

        // Build comprehensive error message
        const errorParts: string[] = [];
        errorParts.push(`🔴 Build failed with status: ${buildStatus}`);
        errorParts.push(`📦 App UUID: ${appData.uuid}`);
        if (usedDeploymentUuid) errorParts.push(`🔧 Deployment UUID: ${usedDeploymentUuid}`);
        errorParts.push(`🔐 Repo auth: ${repoAuthMode}${repoAttemptedAuthFallback ? ' (auto-fallback attempted)' : ''}`);
        errorParts.push(`⏱️ Checks performed: ${attempts}`);
        errorParts.push(`🔄 Is redeploy: ${isRedeploy}`);
        errorParts.push('');

        // Add app status info
        if (lastAppStatus) {
          errorParts.push('📊 App status details:');
          const statusInfo = lastAppStatus as Record<string, unknown>;
          if (statusInfo.build_pack) errorParts.push(`  - Build pack: ${statusInfo.build_pack}`);
          if (statusInfo.ports_exposes) errorParts.push(`  - Exposed ports: ${statusInfo.ports_exposes}`);
          if (statusInfo.fqdn) errorParts.push(`  - Domain: ${statusInfo.fqdn}`);
          errorParts.push('');
        }

        // Add logs
        if (buildLogs && buildLogs.length > 0) {
          errorParts.push('📝 Build logs (last 3000 chars):');
          errorParts.push(buildLogs.slice(-3000));
        } else {
          errorParts.push('⚠️ No build logs available');
        }

        if (runtimeLogs && runtimeLogs.trim().length > 0) {
          errorParts.push('');
          errorParts.push('📟 Application runtime logs (last 3000 chars):');
          errorParts.push(runtimeLogs.slice(-3000));
        }

        // Add troubleshooting hints based on error type
        errorParts.push('');
        errorParts.push('💡 Suggestions de dépannage:');

        const combinedLower = `${buildLogs}\n${runtimeLogs}`.toLowerCase();

        if (looksLikeGitAuthError(combinedLower)) {
          errorParts.push('  ⚠️ ERREUR GIT AUTH DÉTECTÉE');
          errorParts.push('  - Le dépôt est privé ou les permissions GitHub sont insuffisantes');
          errorParts.push('  - Si le dépôt est public: attendez 1-2 minutes et relancez (cache Git)');
          errorParts.push('  - Sinon: vérifiez votre token GitHub (lecture repo)');
        } else if (
          combinedLower.includes('cannot connect to the docker daemon') ||
          combinedLower.includes('is the docker daemon running') ||
          combinedLower.includes('/var/run/docker.sock')
        ) {
          errorParts.push('  ⚠️ ERREUR DOCKER DAEMON DÉTECTÉE');
          errorParts.push('  - Le daemon Docker du serveur n\'est pas accessible');
          errorParts.push('  - SSH sur le serveur et exécutez: sudo systemctl restart docker');
          errorParts.push('  - Vérifiez l\'espace disque: df -h');
        } else if (combinedLower.includes('no such container')) {
          errorParts.push('  ℹ️ CONTAINER INTROUVABLE (pas un souci Docker daemon)');
          errorParts.push('  - Le conteneur a été supprimé/arrêté avant la commande');
          errorParts.push('  - Concentrez-vous sur les logs de build et les logs runtime ci-dessus');
        } else if (buildStatus.includes('unhealthy') || buildStatus.startsWith('exited')) {
          errorParts.push('  - Le container démarre mais échoue au healthcheck');
          errorParts.push('  - Vérifiez que /health répond bien en HTTP 200');
          errorParts.push('  - Vérifiez que le Dockerfile expose le bon port (80 pour nginx)');
          errorParts.push('  - Vérifiez la configuration nginx.conf');
        } else if (buildStatus.includes('failed')) {
          errorParts.push('  - Le build a échoué avant le démarrage du container');
          errorParts.push('  - Vérifiez le Dockerfile et les dépendances npm');
        }

        errorSummary = errorParts.join('\n');
      }

      // Update deployment record
      const deployedUrl = domain 
        ? `https://${domain}` 
        : (lastAppStatus as { fqdn?: string })?.fqdn || appData.fqdn || `http://${appData.uuid}.${server.ip_address}.sslip.io`;

      const updatePayload: Record<string, unknown> = {
        status: finalStatus,
        coolify_app_uuid: appData.uuid,
        deployed_url: deployedUrl,
        health_status: isHealthy ? 'healthy' : (isFailed ? 'unhealthy' : 'unknown')
      };

      if (errorSummary) {
        updatePayload.error_message = errorSummary;
      }

      await supabase
        .from('server_deployments')
        .update(updatePayload)
        .eq('id', deployment.id);

      // Schedule automatic secrets cleanup after successful deployment
      if (isHealthy) {
        const cleanupTask = async () => {
          console.log('[deploy-coolify] Scheduling automatic secrets cleanup in 60s...');
          await new Promise(resolve => setTimeout(resolve, 60000));
          
          try {
            console.log('[deploy-coolify] Starting automatic secrets cleanup...');
            const cleanupResponse = await fetch(`${supabaseUrl}/functions/v1/cleanup-secrets`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({
                server_id: server_id,
                deployment_id: deployment.id,
                verify_health: true,
                force: false
              })
            });
            
            const cleanupResult = await cleanupResponse.json();
            console.log('[deploy-coolify] Automatic cleanup result:', cleanupResult);
          } catch (cleanupError) {
            console.error('[deploy-coolify] Automatic cleanup error:', cleanupError);
          }
        };

        if (typeof (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<void>) => void } }).EdgeRuntime !== 'undefined') {
          (globalThis as unknown as { EdgeRuntime: { waitUntil: (p: Promise<void>) => void } }).EdgeRuntime.waitUntil(cleanupTask());
        } else {
          cleanupTask().catch(console.error);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          deployment: {
            ...deployment,
            status: finalStatus,
            coolify_app_uuid: appData.uuid,
            deployed_url: deployedUrl
          },
          coolify: {
            project: projectData,
            application: { uuid: appData.uuid },
            build_status: buildStatus,
            is_redeploy: isRedeploy
          },
          auto_cleanup_scheduled: isHealthy,
          build_checks_performed: attempts
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (coolifyError: unknown) {
      console.error('[deploy-coolify] Coolify API error:', coolifyError);
      const errorMessage = coolifyError instanceof Error ? coolifyError.message : 'Unknown error';
      
      // Rollback: Delete project if we created it in this session and app creation failed
      if (projectCreatedThisSession && projectData?.uuid) {
        console.log('[deploy-coolify] Rolling back: deleting orphan project from catch block...');
        try {
          await fetch(`${server.coolify_url}/api/v1/projects/${projectData.uuid}`, {
            method: 'DELETE',
            headers: coolifyHeaders
          });
          console.log('[deploy-coolify] Orphan project deleted successfully');
        } catch (deleteError) {
          console.error('[deploy-coolify] Failed to delete orphan project:', deleteError);
        }
      }
      
      // Determine if this is a configuration error that shouldn't be retried
      const isConfigError = errorMessage.includes('build_pack') || 
                           errorMessage.includes('dockerfile') ||
                           errorMessage.includes('port') ||
                           errorMessage.includes('command');
      
      // Update deployment as failed with detailed info
      await supabase
        .from('server_deployments')
        .update({
          status: isConfigError ? 'failed' : 'failed',
          error_message: `❌ Deployment error:\n${errorMessage}\n\n${isConfigError ? '⚠️ This appears to be a configuration error. Please check your repository settings.' : ''}`,
          health_status: 'unhealthy'
        })
        .eq('id', deployment.id);

      return new Response(
        JSON.stringify({ 
          error: 'Coolify deployment failed', 
          details: errorMessage,
          rolled_back: projectCreatedThisSession,
          is_config_error: isConfigError
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Error in deploy-coolify:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
