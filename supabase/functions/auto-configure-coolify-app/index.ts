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
      git_branch, // Optional: if not provided, will fetch from GitHub 
      git_commit_sha, // Optional: specific commit to deploy
      domain,
      env_vars,
      auto_deploy = true,
      force_rebuild = true, // Force clean rebuild by default
      force_no_cache = true, // Force Docker no-cache by default
      skip_pre_check = false // Skip pre-deploy checks if already done
    } = await req.json();

    if (!server_id || !project_name || !github_repo_url) {
      return new Response(
        JSON.stringify({ error: 'server_id, project_name, and github_repo_url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the correct branch and commit from GitHub if not provided
    let gitBranchToUse = git_branch;
    let gitCommitShaToUse = git_commit_sha;
    
    const urlMatch = github_repo_url.match(/github\.com[/:]([^/]+)\/([^/.#?]+)/i);
    if (urlMatch && (!gitBranchToUse || !gitCommitShaToUse)) {
      const [, ghOwner, ghRepo] = urlMatch;
      const repoClean = ghRepo.replace(/\.git$/, '');
      const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
      const ghHeaders: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Inopay-Deployer'
      };
      if (githubToken) {
        ghHeaders['Authorization'] = `token ${githubToken}`;
      }
      
      try {
        const repoRes = await fetch(`https://api.github.com/repos/${ghOwner}/${repoClean}`, { headers: ghHeaders });
        if (repoRes.ok) {
          const repoData = await repoRes.json();
          gitBranchToUse = gitBranchToUse || repoData.default_branch || 'main';
          console.log(`[auto-configure-coolify] Detected default branch: ${gitBranchToUse}`);
        }
        
        // Get latest commit SHA if not provided
        if (!gitCommitShaToUse && gitBranchToUse) {
          const refRes = await fetch(`https://api.github.com/repos/${ghOwner}/${repoClean}/git/ref/heads/${gitBranchToUse}`, { headers: ghHeaders });
          if (refRes.ok) {
            const refData = await refRes.json();
            gitCommitShaToUse = refData.object.sha;
            console.log(`[auto-configure-coolify] Detected commit SHA: ${gitCommitShaToUse}`);
          }
        }
      } catch (e) {
        console.warn('[auto-configure-coolify] Could not fetch GitHub info:', e);
      }
    }
    gitBranchToUse = gitBranchToUse || 'main';
    console.log(`[auto-configure-coolify] Using git_branch: ${gitBranchToUse}, commit: ${gitCommitShaToUse || 'latest'}`);

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

    // Helper function to safely parse JSON response
    async function safeJsonParse(response: Response): Promise<{ data: unknown; error: string | null }> {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return { data, error: null };
      } catch {
        // Not JSON - might be HTML or plain text
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          return { data: null, error: `HTML response received (status ${response.status}). Is Coolify URL correct?` };
        }
        return { data: null, error: `Invalid response: ${text.slice(0, 100)}` };
      }
    }

    // Step 1: Test Coolify connection
    console.log('[auto-configure-coolify] Step 1: Testing Coolify connection...');
    try {
      const versionRes = await fetch(`${coolifyUrl}/api/v1/version`, {
        method: 'GET',
        headers: coolifyHeaders
      });
      
      if (!versionRes.ok) {
        const errorText = await versionRes.text().catch(() => 'Unknown error');
        throw new Error(`Coolify API error ${versionRes.status}: ${errorText.slice(0, 100)}`);
      }
      
      // Version endpoint returns plain text (e.g., "4.0.0-beta.458"), not JSON
      const versionText = await versionRes.text();
      const version = versionText.trim();
      
      // Validate it looks like a version string
      if (!version || version.includes('<!DOCTYPE') || version.includes('<html')) {
        throw new Error(`Invalid version response: ${version.slice(0, 100)}`);
      }
      
      console.log(`[auto-configure-coolify] Connected to Coolify v${version}`);
      steps.push({ step: 'connection', status: 'success', message: `Coolify v${version}` });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      steps.push({ step: 'connection', status: 'error', message: `Coolify inaccessible: ${errorMessage}` });
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
        const errText = await serversRes.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch servers (${serversRes.status}): ${errText.slice(0, 100)}`);
      }
      
      const { data: servers, error: parseError } = await safeJsonParse(serversRes);
      if (parseError) {
        throw new Error(parseError);
      }
      
      const serverList = servers as Array<{ uuid: string; name?: string }>;
      if (!serverList || serverList.length === 0) {
        throw new Error('No servers found in Coolify');
      }
      
      coolifyServerUuid = serverList[0].uuid;
      steps.push({ step: 'servers', status: 'success', message: `Server: ${serverList[0].name || coolifyServerUuid}` });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      steps.push({ step: 'servers', status: 'error', message: errorMessage });
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
      
      let existingProjects: Array<{ name: string; uuid: string }> = [];
      if (projectsRes.ok) {
        const { data, error } = await safeJsonParse(projectsRes);
        if (!error && Array.isArray(data)) {
          existingProjects = data;
        }
      }
      
      const existingProject = existingProjects.find((p) => p.name === project_name);
      
      if (existingProject) {
        projectUuid = existingProject.uuid;
        steps.push({ step: 'project', status: 'success', message: `Projet existant: ${project_name}` });
      } else {
        // Create new project
        const createProjectRes = await fetch(`${coolifyUrl}/api/v1/projects`, {
          method: 'POST',
          headers: coolifyHeaders,
          body: JSON.stringify({ name: project_name, description: 'Deployed via Inopay' })
        });
        
        if (!createProjectRes.ok) {
          const errText = await createProjectRes.text().catch(() => 'Unknown error');
          throw new Error(`Failed to create project: ${errText.slice(0, 100)}`);
        }
        
        const { data: newProject, error: parseError } = await safeJsonParse(createProjectRes);
        if (parseError || !newProject) {
          throw new Error(parseError || 'Invalid project response');
        }
        projectUuid = (newProject as { uuid: string }).uuid;
        steps.push({ step: 'project', status: 'success', message: `Projet créé: ${project_name}` });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      steps.push({ step: 'project', status: 'error', message: errorMessage });
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
      
      console.log(`[auto-configure-coolify] Creating app with git_branch: ${gitBranchToUse}`);
      const createAppRes = await fetch(`${coolifyUrl}/api/v1/applications/public`, {
        method: 'POST',
        headers: coolifyHeaders,
        body: JSON.stringify({
          project_uuid: projectUuid,
          server_uuid: coolifyServerUuid,
          environment_name: environmentName,
          git_repository: gitRepoUrlToUse,
          git_branch: gitBranchToUse, // Use detected/provided branch instead of hardcoded 'main'
          build_pack: 'dockerfile',
          name: project_name,
          description: `Application ${project_name}`,
          ports_exposes: '80',
          is_static: false,
          instant_deploy: false // We'll configure first, then deploy
        })
      });

      if (!createAppRes.ok) {
        const errText = await createAppRes.text().catch(() => 'Unknown error');
        throw new Error(`Failed to create application: ${errText.slice(0, 150)}`);
      }

      const { data: newApp, error: parseError } = await safeJsonParse(createAppRes);
      if (parseError || !newApp) {
        throw new Error(parseError || 'Invalid application response');
      }
      appUuid = (newApp as { uuid: string }).uuid;
      steps.push({ step: 'application', status: 'success', message: `Application créée: ${appUuid.slice(0, 8)}...` });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      steps.push({ step: 'application', status: 'error', message: errorMessage });
      return new Response(
        JSON.stringify({ error: 'Failed to create application', steps }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Configure application with correct build settings INCLUDING git_commit_sha
    // Split into multiple calls to handle rejected parameters
    console.log('[auto-configure-coolify] Step 5: Configuring application...');
    try {
      // First PATCH: Core build settings with git_commit_sha (CRUCIAL for deploying correct commit)
      const corePatchBody: Record<string, unknown> = {
        build_pack: 'dockerfile',
        ports_exposes: '80',
        git_branch: gitBranchToUse
      };
      
      // Add commit SHA if we have it (ensures Coolify builds the right commit)
      if (gitCommitShaToUse) {
        corePatchBody.git_commit_sha = gitCommitShaToUse;
        console.log(`[auto-configure-coolify] Setting git_commit_sha: ${gitCommitShaToUse}`);
      }

      const corePatchRes = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
        method: 'PATCH',
        headers: coolifyHeaders,
        body: JSON.stringify(corePatchBody)
      });

      if (corePatchRes.ok) {
        console.log('[auto-configure-coolify] Core settings + git_commit_sha applied');
      } else {
        const errText = await corePatchRes.text();
        console.warn('[auto-configure-coolify] Core PATCH warning:', errText);
        
        // Try without git_commit_sha if it fails (some Coolify versions may not support it)
        const fallbackPatch = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
          method: 'PATCH',
          headers: coolifyHeaders,
          body: JSON.stringify({
            build_pack: 'dockerfile',
            ports_exposes: '80',
            git_branch: gitBranchToUse
          })
        });
        if (fallbackPatch.ok) {
          console.log('[auto-configure-coolify] Fallback PATCH (without commit SHA) succeeded');
        }
      }

      // Second PATCH: Try base_directory and dockerfile_location
      try {
        const dirPatchRes = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
          method: 'PATCH',
          headers: coolifyHeaders,
          body: JSON.stringify({ 
            base_directory: '/',
            dockerfile_location: '/Dockerfile'
          })
        });
        if (!dirPatchRes.ok) {
          const errText = await dirPatchRes.text();
          console.log('[auto-configure-coolify] base_directory/dockerfile_location not accepted:', errText.slice(0, 100));
        } else {
          console.log('[auto-configure-coolify] base_directory and dockerfile_location configured');
        }
      } catch (e) {
        console.log('[auto-configure-coolify] Directory patch failed (non-critical)');
      }

      // Third PATCH: Try domain if provided (fqdn is often rejected via PATCH)
      if (domain) {
        try {
          const fqdnValue = domain.startsWith('http') ? domain : `https://${domain}`;
          const domainPatchRes = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
            method: 'PATCH',
            headers: coolifyHeaders,
            body: JSON.stringify({ fqdn: fqdnValue })
          });
          if (!domainPatchRes.ok) {
            const errText = await domainPatchRes.text();
            console.log('[auto-configure-coolify] fqdn not accepted (configure manually):', errText.slice(0, 100));
          } else {
            console.log('[auto-configure-coolify] Domain configured:', fqdnValue);
          }
        } catch (e) {
          console.log('[auto-configure-coolify] fqdn patch failed (configure manually in Coolify)');
        }
      }

      steps.push({ step: 'configuration', status: 'success', message: `Build pack: dockerfile, branch: ${gitBranchToUse}${gitCommitShaToUse ? `, commit: ${gitCommitShaToUse.slice(0,7)}` : ''}` });
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

    // Step 7: Verify configuration before deployment
    console.log('[auto-configure-coolify] Step 7: Verifying app configuration...');
    let appConfig: Record<string, unknown> | null = null;
    try {
      const verifyRes = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
        method: 'GET',
        headers: coolifyHeaders
      });

      if (verifyRes.ok) {
        const { data } = await safeJsonParse(verifyRes);
        appConfig = data as Record<string, unknown>;
        console.log('[auto-configure-coolify] Current app config:', JSON.stringify({
          uuid: appConfig?.uuid,
          build_pack: appConfig?.build_pack,
          base_directory: appConfig?.base_directory,
          dockerfile_location: appConfig?.dockerfile_location,
          git_repository: appConfig?.git_repository ? '***configured***' : 'missing',
          git_branch: appConfig?.git_branch
        }));
        
        steps.push({ 
          step: 'verify', 
          status: 'success', 
          message: `Config: build_pack=${appConfig?.build_pack}, base_dir=${appConfig?.base_directory || '/'}`
        });
      } else {
        console.warn('[auto-configure-coolify] Could not verify app config');
        steps.push({ step: 'verify', status: 'error', message: 'Impossible de vérifier la config' });
      }
    } catch (e) {
      console.warn('[auto-configure-coolify] Verification failed:', e);
    }

    // Step 8: Deploy if requested with force rebuild option
    let deploymentUuid: string | null = null;
    if (auto_deploy) {
      console.log(`[auto-configure-coolify] Step 8: Triggering deployment (force_rebuild=${force_rebuild}, force_no_cache=${force_no_cache})...`);
      try {
        // Use force=true to bypass Docker cache and do a clean rebuild
        // Additional no_cache flag for complete Docker cache invalidation
        let deployUrl = `${coolifyUrl}/api/v1/deploy?uuid=${appUuid}&force=${force_rebuild}`;
        if (force_no_cache) {
          deployUrl += '&no_cache=true';
        }
        console.log('[auto-configure-coolify] Deploy URL:', deployUrl.replace(server.coolify_token!, '***'));
        
        const deployRes = await fetch(deployUrl, {
          method: 'GET',
          headers: coolifyHeaders
        });

        if (!deployRes.ok) {
          const errText = await deployRes.text();
          throw new Error(`Deploy trigger failed (${deployRes.status}): ${errText.slice(0, 150)}`);
        }

        const deployData = await deployRes.json();
        deploymentUuid = deployData.deployment_uuid || deployData.uuid || null;
        
        console.log('[auto-configure-coolify] Deployment triggered:', JSON.stringify(deployData));
        
        steps.push({ 
          step: 'deploy', 
          status: 'success', 
          message: `Déploiement lancé${force_rebuild ? ' (rebuild forcé)' : ''}${deploymentUuid ? `: ${deploymentUuid.slice(0, 8)}...` : ''}` 
        });
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('[auto-configure-coolify] Deploy failed:', errorMessage);
        steps.push({ step: 'deploy', status: 'error', message: errorMessage });
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
        git_branch: gitBranchToUse, // Return the branch used
        app_config: appConfig ? {
          build_pack: appConfig.build_pack,
          base_directory: appConfig.base_directory,
          dockerfile_location: appConfig.dockerfile_location,
          git_branch: appConfig.git_branch,
          ports_exposes: appConfig.ports_exposes
        } : null,
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
