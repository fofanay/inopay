import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      .select('id')
      .eq('user_id', user.id)
      .eq('server_id', server_id)
      .in('status', ['deployed', 'success']);

    const creditType = (existingDeployments && existingDeployments.length > 0) ? 'redeploy' : 'deploy';
    console.log(`[deploy-coolify] Credit type needed: ${creditType}`);

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

      // Step 2: Create application from GitHub
      if (!projectData) {
        throw new Error('No project data available');
      }
      
      console.log('[deploy-coolify] Creating Coolify application...');
      const appPayload: Record<string, unknown> = {
        project_uuid: projectData.uuid,
        server_uuid: coolifyServerUuid,
        environment_name: 'production',
        git_repository: github_repo_url,
        git_branch: 'main',
        build_pack: 'nixpacks',
        ports_exposes: '3000'
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

      const appData = await appResponse.json();
      console.log('[deploy-coolify] Coolify application created:', appData);

      // Step 2.3: Add environment variables for Supabase
      console.log('[deploy-coolify] Adding environment variables...');
      const envVars = [
        { key: 'VITE_SUPABASE_URL', value: supabaseUrl, is_build_time: true },
        { key: 'VITE_SUPABASE_PUBLISHABLE_KEY', value: Deno.env.get('SUPABASE_ANON_KEY') || '', is_build_time: true }
      ];

      for (const envVar of envVars) {
        try {
          const envResponse = await fetch(`${server.coolify_url}/api/v1/applications/${appData.uuid}/envs`, {
            method: 'POST',
            headers: coolifyHeaders,
            body: JSON.stringify(envVar)
          });
          
          if (envResponse.ok) {
            console.log(`[deploy-coolify] Added env var: ${envVar.key}`);
          } else {
            const envError = await envResponse.text();
            console.warn(`[deploy-coolify] Failed to add env var ${envVar.key}:`, envError);
          }
        } catch (envErr) {
          console.warn(`[deploy-coolify] Error adding env var ${envVar.key}:`, envErr);
        }
      }

      // Step 2.5: Update application with custom domain if provided
      if (domain) {
        console.log('Setting custom domain:', domain);
        const domainResponse = await fetch(`${server.coolify_url}/api/v1/applications/${appData.uuid}`, {
          method: 'PATCH',
          headers: coolifyHeaders,
          body: JSON.stringify({
            fqdn: `https://${domain}`
          })
        });
        
        if (!domainResponse.ok) {
          const errorText = await domainResponse.text();
          console.warn('Domain configuration failed (non-blocking):', errorText);
        } else {
          console.log('Custom domain configured');
        }
      }

      // Step 3: Trigger deployment
      console.log('[deploy-coolify] Triggering deployment...');
      const deployResponse = await fetch(`${server.coolify_url}/api/v1/deploy?uuid=${appData.uuid}`, {
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

      // Step 4: Wait and check build status (poll for up to 2 minutes)
      console.log('[deploy-coolify] Waiting for build to complete...');
      let buildStatus = 'building';
      let attempts = 0;
      const maxAttempts = 24; // 24 * 5s = 2 minutes
      
      while (attempts < maxAttempts && buildStatus !== 'running' && buildStatus !== 'failed') {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s
        attempts++;
        
        try {
          const statusResponse = await fetch(
            `${server.coolify_url}/api/v1/applications/${appData.uuid}`,
            { method: 'GET', headers: coolifyHeaders }
          );
          
          if (statusResponse.ok) {
            const appStatus = await statusResponse.json();
            buildStatus = appStatus.status || 'unknown';
            console.log(`[deploy-coolify] Build status check ${attempts}/${maxAttempts}: ${buildStatus}`);
            
            // Log additional details
            if (appStatus.deployment_uuid) {
              console.log(`[deploy-coolify] Deployment UUID: ${appStatus.deployment_uuid}`);
            }
          }
        } catch (statusError) {
          console.warn(`[deploy-coolify] Status check ${attempts} failed:`, statusError);
        }
      }
      
      // Determine final status - treat exited:unhealthy as failed
      const isHealthy = buildStatus === 'running';
      const isFailed = buildStatus === 'exited:unhealthy' || buildStatus === 'failed' || buildStatus === 'exited';
      const finalStatus = isHealthy ? 'deployed' : (isFailed ? 'failed' : 'deploying');
      console.log(`[deploy-coolify] Final status after ${attempts} checks: ${finalStatus} (build: ${buildStatus})`);

      // If build failed, try to get logs from Coolify
      let buildLogs = '';
      if (isFailed) {
        console.log('[deploy-coolify] Build failed, fetching logs...');
        try {
          // Get deployments list to find the latest deployment UUID
          const deploymentsListResponse = await fetch(
            `${server.coolify_url}/api/v1/applications/${appData.uuid}/deployments`,
            { method: 'GET', headers: coolifyHeaders }
          );
          
          if (deploymentsListResponse.ok) {
            const deploymentsList = await deploymentsListResponse.json();
            if (deploymentsList && deploymentsList.length > 0) {
              const latestDeploymentUuid = deploymentsList[0].deployment_uuid;
              console.log(`[deploy-coolify] Fetching logs for deployment: ${latestDeploymentUuid}`);
              
              const logsResponse = await fetch(
                `${server.coolify_url}/api/v1/deployments/${latestDeploymentUuid}`,
                { method: 'GET', headers: coolifyHeaders }
              );
              
              if (logsResponse.ok) {
                const logsData = await logsResponse.json();
                buildLogs = logsData.logs || logsData.deployment_log || '';
                console.log(`[deploy-coolify] Retrieved ${buildLogs.length} chars of build logs`);
              }
            }
          }
        } catch (logsError) {
          console.warn('[deploy-coolify] Failed to fetch build logs:', logsError);
        }
      }

      // Update deployment record
      const deployedUrl = domain 
        ? `https://${domain}` 
        : appData.domains || `http://${server.ip_address}:3000`;

      const updatePayload: Record<string, unknown> = {
        status: finalStatus,
        coolify_app_uuid: appData.uuid,
        deployed_url: deployedUrl,
        health_status: isHealthy ? 'healthy' : (isFailed ? 'unhealthy' : 'unknown')
      };

      // Add error message with build logs if failed
      if (isFailed) {
        const errorSummary = buildLogs 
          ? `Build failed (${buildStatus}). Logs:\n${buildLogs.slice(-2000)}` 
          : `Build failed with status: ${buildStatus}`;
        updatePayload.error_message = errorSummary;
      }

      await supabase
        .from('server_deployments')
        .update(updatePayload)
        .eq('id', deployment.id);

      // Schedule automatic secrets cleanup after deployment
      // Use background task pattern
      const cleanupTask = async () => {
        // Wait 60 seconds for the deployment to stabilize
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

      // Start cleanup in background using globalThis.EdgeRuntime if available
      if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
        (globalThis as any).EdgeRuntime.waitUntil(cleanupTask());
      } else {
        // Fallback: just start the task without waiting
        cleanupTask().catch(console.error);
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
            application: appData,
            build_status: buildStatus
          },
          auto_cleanup_scheduled: true,
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
      
      // Update deployment as failed
      await supabase
        .from('server_deployments')
        .update({
          status: 'failed',
          error_message: errorMessage
        })
        .eq('id', deployment.id);

      return new Response(
        JSON.stringify({ 
          error: 'Coolify deployment failed', 
          details: errorMessage,
          rolled_back: projectCreatedThisSession
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
