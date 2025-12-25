import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoolifyAppConfig {
  base_directory: string;
  dockerfile_location: string;
  ports_exposes: string;
  ports_mappings: string[];
  build_pack: string;
}

const DEFAULT_APP_CONFIG: CoolifyAppConfig = {
  base_directory: '/',
  dockerfile_location: '/Dockerfile',
  ports_exposes: '80',
  ports_mappings: ['80:80'],
  build_pack: 'dockerfile'
};

// Normalize Coolify URL to ensure proper format
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

    const { 
      server_id, 
      project_name, 
      github_repo_url, 
      domain,
      env_vars,
      auto_deploy = true 
    } = await req.json();

    if (!server_id || !project_name || !github_repo_url) {
      return new Response(
        JSON.stringify({ error: 'server_id, project_name, and github_repo_url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-configure-coolify] Starting for ${project_name}`);

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

    if (!server.coolify_url || !server.coolify_token) {
      return new Response(
        JSON.stringify({ error: 'Coolify not configured on this server' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const coolifyUrl = normalizeCoolifyUrl(server.coolify_url);
    const coolifyHeaders = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const steps: { step: string; status: 'success' | 'error' | 'pending'; message: string }[] = [];

    // Step 1: Test Coolify connection
    console.log('[auto-configure-coolify] Step 1: Testing Coolify connection...');
    try {
      const versionRes = await fetch(`${coolifyUrl}/api/v1/version`, {
        method: 'GET',
        headers: coolifyHeaders
      });
      
      if (!versionRes.ok) {
        throw new Error(`Coolify API error: ${versionRes.status}`);
      }
      
      const versionData = await versionRes.json();
      steps.push({ step: 'connection', status: 'success', message: `Coolify v${versionData.version || 'unknown'}` });
    } catch (e) {
      steps.push({ step: 'connection', status: 'error', message: `Coolify inaccessible: ${e}` });
      return new Response(
        JSON.stringify({ error: 'Coolify connection failed', steps }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Get available servers
    console.log('[auto-configure-coolify] Step 2: Fetching Coolify servers...');
    let coolifyServerUuid: string;
    try {
      const serversRes = await fetch(`${coolifyUrl}/api/v1/servers`, {
        method: 'GET',
        headers: coolifyHeaders
      });
      
      if (!serversRes.ok) {
        throw new Error(`Failed to fetch servers: ${serversRes.status}`);
      }
      
      const servers = await serversRes.json();
      if (!servers || servers.length === 0) {
        throw new Error('No servers found in Coolify');
      }
      
      coolifyServerUuid = servers[0].uuid;
      steps.push({ step: 'servers', status: 'success', message: `Server: ${servers[0].name || coolifyServerUuid}` });
    } catch (e) {
      steps.push({ step: 'servers', status: 'error', message: String(e) });
      return new Response(
        JSON.stringify({ error: 'No Coolify servers available', steps }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Create or find project
    console.log('[auto-configure-coolify] Step 3: Creating/finding project...');
    let projectUuid: string;
    let environmentName = 'production';
    try {
      // Check existing projects
      const projectsRes = await fetch(`${coolifyUrl}/api/v1/projects`, {
        method: 'GET',
        headers: coolifyHeaders
      });
      
      const existingProjects = projectsRes.ok ? await projectsRes.json() : [];
      const existingProject = existingProjects.find((p: { name: string }) => p.name === project_name);
      
      if (existingProject) {
        projectUuid = existingProject.uuid;
        steps.push({ step: 'project', status: 'success', message: `Projet existant: ${project_name}` });
      } else {
        // Create new project
        const createProjectRes = await fetch(`${coolifyUrl}/api/v1/projects`, {
          method: 'POST',
          headers: coolifyHeaders,
          body: JSON.stringify({ name: project_name, description: 'Déployé via Inopay' })
        });
        
        if (!createProjectRes.ok) {
          const errText = await createProjectRes.text();
          throw new Error(`Failed to create project: ${errText}`);
        }
        
        const newProject = await createProjectRes.json();
        projectUuid = newProject.uuid;
        steps.push({ step: 'project', status: 'success', message: `Projet créé: ${project_name}` });
      }
    } catch (e) {
      steps.push({ step: 'project', status: 'error', message: String(e) });
      return new Response(
        JSON.stringify({ error: 'Failed to create/find project', steps }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Create application
    console.log('[auto-configure-coolify] Step 4: Creating application...');
    let appUuid: string;
    try {
      // Use GitHub token if available
      const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
      let gitRepoUrlToUse = github_repo_url;
      
      if (githubToken) {
        const urlMatch = github_repo_url.match(/github\.com[/:]([^/]+)\/([^/.#?]+)/i);
        if (urlMatch) {
          const [, owner, repo] = urlMatch;
          gitRepoUrlToUse = `https://x-access-token:${githubToken}@github.com/${owner}/${repo}.git`;
        }
      }
      
      const createAppRes = await fetch(`${coolifyUrl}/api/v1/applications/public`, {
        method: 'POST',
        headers: coolifyHeaders,
        body: JSON.stringify({
          project_uuid: projectUuid,
          server_uuid: coolifyServerUuid,
          environment_name: environmentName,
          git_repository: gitRepoUrlToUse,
          git_branch: 'main',
          build_pack: 'dockerfile',
          name: project_name,
          description: `Application ${project_name}`,
          ports_exposes: '80',
          is_static: false,
          instant_deploy: false // We'll configure first, then deploy
        })
      });

      if (!createAppRes.ok) {
        const errText = await createAppRes.text();
        throw new Error(`Failed to create application: ${errText}`);
      }

      const newApp = await createAppRes.json();
      appUuid = newApp.uuid;
      steps.push({ step: 'application', status: 'success', message: `Application créée: ${appUuid.slice(0, 8)}...` });
    } catch (e) {
      steps.push({ step: 'application', status: 'error', message: String(e) });
      return new Response(
        JSON.stringify({ error: 'Failed to create application', steps }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Configure application with correct build settings
    console.log('[auto-configure-coolify] Step 5: Configuring application...');
    try {
      const patchBody: Record<string, unknown> = {
        base_directory: DEFAULT_APP_CONFIG.base_directory,
        dockerfile_location: DEFAULT_APP_CONFIG.dockerfile_location,
        ports_exposes: DEFAULT_APP_CONFIG.ports_exposes,
        build_pack: DEFAULT_APP_CONFIG.build_pack
      };

      // Add domain if provided
      if (domain) {
        patchBody.fqdn = domain.startsWith('http') ? domain : `http://${domain}`;
      }

      const patchRes = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
        method: 'PATCH',
        headers: coolifyHeaders,
        body: JSON.stringify(patchBody)
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        console.warn('[auto-configure-coolify] PATCH warning:', errText);
        // Don't fail, continue
      }

      steps.push({ step: 'configuration', status: 'success', message: 'Dockerfile mode, port 80, base_directory: /' });
    } catch (e) {
      steps.push({ step: 'configuration', status: 'error', message: String(e) });
      // Continue anyway
    }

    // Step 6: Add environment variables if provided
    if (env_vars && Object.keys(env_vars).length > 0) {
      console.log('[auto-configure-coolify] Step 6: Adding environment variables...');
      try {
        for (const [key, value] of Object.entries(env_vars)) {
          await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}/envs`, {
            method: 'POST',
            headers: coolifyHeaders,
            body: JSON.stringify({
              key,
              value: String(value),
              is_build_time: key.startsWith('VITE_'),
              is_preview: false
            })
          });
        }
        steps.push({ step: 'env_vars', status: 'success', message: `${Object.keys(env_vars).length} variables configurées` });
      } catch (e) {
        steps.push({ step: 'env_vars', status: 'error', message: String(e) });
      }
    }

    // Step 7: Deploy if requested
    let deploymentUuid: string | null = null;
    if (auto_deploy) {
      console.log('[auto-configure-coolify] Step 7: Triggering deployment...');
      try {
        const deployRes = await fetch(`${coolifyUrl}/api/v1/deploy?uuid=${appUuid}&force=true`, {
          method: 'GET',
          headers: coolifyHeaders
        });

        if (!deployRes.ok) {
          const errText = await deployRes.text();
          throw new Error(`Deploy trigger failed: ${errText}`);
        }

        const deployData = await deployRes.json();
        deploymentUuid = deployData.deployment_uuid || deployData.uuid || null;
        steps.push({ step: 'deploy', status: 'success', message: `Déploiement lancé${deploymentUuid ? `: ${deploymentUuid.slice(0, 8)}...` : ''}` });
      } catch (e) {
        steps.push({ step: 'deploy', status: 'error', message: String(e) });
      }
    } else {
      steps.push({ step: 'deploy', status: 'pending', message: 'Déploiement manuel requis' });
    }

    // Save deployment record
    const { data: deployment } = await supabase
      .from('server_deployments')
      .insert({
        user_id: user.id,
        server_id: server.id,
        project_name,
        github_repo_url,
        domain: domain || null,
        coolify_app_uuid: appUuid,
        status: auto_deploy ? 'deploying' : 'configured'
      })
      .select()
      .single();

    console.log('[auto-configure-coolify] Completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        app_uuid: appUuid,
        project_uuid: projectUuid,
        deployment_uuid: deploymentUuid,
        deployment_id: deployment?.id,
        steps,
        message: 'Application configurée avec succès'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[auto-configure-coolify] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
