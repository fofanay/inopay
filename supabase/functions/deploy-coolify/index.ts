import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to fetch Coolify logs with full details
async function fetchCoolifyDeploymentLogs(
  coolifyUrl: string, 
  coolifyHeaders: Record<string, string>, 
  appUuid: string
): Promise<{ logs: string; deploymentUuid: string | null }> {
  try {
    console.log('[deploy-coolify] Fetching deployment logs for app:', appUuid);
    
    // Get deployments list to find the latest deployment UUID
    const deploymentsListResponse = await fetch(
      `${coolifyUrl}/api/v1/applications/${appUuid}/deployments`,
      { method: 'GET', headers: coolifyHeaders }
    );
    
    if (!deploymentsListResponse.ok) {
      console.warn('[deploy-coolify] Failed to fetch deployments list:', await deploymentsListResponse.text());
      return { logs: '', deploymentUuid: null };
    }
    
    const deploymentsList = await deploymentsListResponse.json();
    console.log('[deploy-coolify] Deployments list response:', JSON.stringify(deploymentsList).slice(0, 500));
    
    if (!deploymentsList || deploymentsList.length === 0) {
      return { logs: 'No deployments found', deploymentUuid: null };
    }
    
    const latestDeployment = deploymentsList[0];
    const deploymentUuid = latestDeployment.deployment_uuid || latestDeployment.uuid;
    console.log('[deploy-coolify] Latest deployment UUID:', deploymentUuid);
    console.log('[deploy-coolify] Latest deployment status:', latestDeployment.status);
    
    // Fetch detailed logs for this deployment
    const logsResponse = await fetch(
      `${coolifyUrl}/api/v1/deployments/${deploymentUuid}`,
      { method: 'GET', headers: coolifyHeaders }
    );
    
    if (!logsResponse.ok) {
      console.warn('[deploy-coolify] Failed to fetch deployment details:', await logsResponse.text());
      return { logs: `Deployment status: ${latestDeployment.status}`, deploymentUuid };
    }
    
    const logsData = await logsResponse.json();
    console.log('[deploy-coolify] Deployment details keys:', Object.keys(logsData));
    
    // Extract logs from various possible fields
    let logs = '';
    if (logsData.logs) logs = logsData.logs;
    else if (logsData.deployment_log) logs = logsData.deployment_log;
    else if (logsData.log) logs = logsData.log;
    else logs = JSON.stringify(logsData, null, 2);
    
    console.log(`[deploy-coolify] Retrieved ${logs.length} chars of logs`);
    return { logs, deploymentUuid };
  } catch (error) {
    console.error('[deploy-coolify] Error fetching logs:', error);
    return { logs: `Error fetching logs: ${error}`, deploymentUuid: null };
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
        
        // Use Dockerfile mode (port 80) since the repo has Dockerfile + nginx.conf
        const appPayload = {
          project_uuid: projectData.uuid,
          server_uuid: coolifyServerUuid,
          environment_name: 'production',
          git_repository: github_repo_url,
          git_branch: 'main',
          build_pack: 'dockerfile',  // Use Dockerfile instead of nixpacks
          dockerfile_location: '/Dockerfile',
          ports_exposes: '80',  // Nginx uses port 80
          health_check_enabled: true,
          health_check_path: '/',
          health_check_interval: 30,
          health_check_timeout: 10,
          health_check_retries: 3,
          health_check_start_period: 60  // Give more time for initial startup
        };
        
        console.log('[deploy-coolify] Application payload:', JSON.stringify(appPayload));
        
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
              git_repository: github_repo_url,
              git_branch: 'main',
              build_pack: 'nixpacks',
              ports_exposes: '3000',
              start_command: 'npm run preview -- --host 0.0.0.0 --port 3000'
            };
            
            console.log('[deploy-coolify] Fallback payload:', JSON.stringify(fallbackPayload));
            
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

      // Step 3: Trigger deployment
      console.log('[deploy-coolify] Triggering deployment...');
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
      console.log('[deploy-coolify] Deployment triggered:', deployData);

      // Step 4: Wait and check build status (poll for up to 3 minutes)
      console.log('[deploy-coolify] Waiting for build to complete...');
      let buildStatus = 'building';
      let attempts = 0;
      const maxAttempts = 36; // 36 * 5s = 3 minutes
      let lastAppStatus: Record<string, unknown> | null = null;
      
      while (attempts < maxAttempts && buildStatus !== 'running' && !buildStatus.includes('failed') && !buildStatus.includes('exited')) {
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
            console.log(`[deploy-coolify] Build status check ${attempts}/${maxAttempts}: ${buildStatus}`);
          }
        } catch (statusError) {
          console.warn(`[deploy-coolify] Status check ${attempts} failed:`, statusError);
        }
      }
      
      // Determine final status - treat exited:unhealthy as failed
      const isHealthy = buildStatus === 'running';
      const isFailed = buildStatus.includes('unhealthy') || buildStatus.includes('failed') || buildStatus === 'exited';
      const finalStatus = isHealthy ? 'deployed' : (isFailed ? 'failed' : 'deploying');
      console.log(`[deploy-coolify] Final status after ${attempts} checks: ${finalStatus} (build: ${buildStatus})`);

      // Fetch comprehensive logs
      let errorSummary = '';
      if (isFailed) {
        console.log('[deploy-coolify] Build failed, fetching comprehensive logs...');
        
        const { logs: buildLogs, deploymentUuid } = await fetchCoolifyDeploymentLogs(
          server.coolify_url,
          coolifyHeaders,
          appData.uuid
        );
        
        // Build comprehensive error message
        const errorParts: string[] = [];
        errorParts.push(`🔴 Build failed with status: ${buildStatus}`);
        errorParts.push(`📦 App UUID: ${appData.uuid}`);
        if (deploymentUuid) errorParts.push(`🔧 Deployment UUID: ${deploymentUuid}`);
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
        
        // Add troubleshooting hints based on error type
        errorParts.push('');
        errorParts.push('💡 Suggestions de dépannage:');
        if (buildStatus === 'exited:unhealthy') {
          errorParts.push('  - Le container démarre mais échoue au healthcheck');
          errorParts.push('  - Vérifiez que le Dockerfile expose le bon port (80 pour nginx)');
          errorParts.push('  - Vérifiez que nginx.conf est configuré correctement');
          errorParts.push('  - Vérifiez les variables d\'environnement VITE_*');
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
