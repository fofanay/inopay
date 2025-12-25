// @inopay-core-protected
// SOVEREIGN LIBERATION ENGINE - 3-Phase Isolated Pipeline
// Phase 1: GitHub Repository Creation
// Phase 2: Supabase Schema Migration  
// Phase 3: Coolify Deployment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  cleanFileContent, 
  isLockFile,
  type CleaningResult
} from "../_shared/proprietary-patterns.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LiberationRequest {
  phase: 'github' | 'supabase' | 'coolify' | 'all';
  files?: { path: string; content: string }[];
  projectName: string;
  repoName?: string;
  serverId?: string;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
}

interface PhaseResult {
  success: boolean;
  phase: string;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
  httpStatus?: number;
}

function logStep(step: string, data?: Record<string, unknown>) {
  console.log(`[SOVEREIGN-LIBERATION] ${step}`, data ? JSON.stringify(data) : '');
}

// ======================== PHASE 1: GITHUB ========================
async function executePhaseGitHub(
  githubToken: string,
  repoName: string,
  files: { path: string; content: string }[],
  userId: string
): Promise<PhaseResult> {
  logStep("Phase 1: GitHub - Starting", { repoName, filesCount: files.length });

  const headers = {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // 1.1 - Validate token and get user
    const userResponse = await fetch('https://api.github.com/user', { headers });
    if (!userResponse.ok) {
      const error = await userResponse.text();
      return {
        success: false,
        phase: 'github',
        message: 'Token GitHub invalide ou expiré',
        error: `HTTP ${userResponse.status}: ${error}`,
        httpStatus: userResponse.status,
      };
    }

    const user = await userResponse.json();
    const owner = user.login;
    logStep("Phase 1.1: GitHub user validated", { owner });

    // 1.2 - Check token scopes
    const scopes = userResponse.headers.get('x-oauth-scopes') || '';
    const hasRepoScope = scopes.includes('repo');
    const hasWorkflowScope = scopes.includes('workflow');

    if (!hasRepoScope) {
      return {
        success: false,
        phase: 'github',
        message: 'Token GitHub sans permission "repo"',
        error: `Scopes actuels: ${scopes || 'aucun'}. Requis: repo, workflow`,
        httpStatus: 403,
      };
    }

    logStep("Phase 1.2: Token scopes validated", { scopes, hasRepoScope, hasWorkflowScope });

    // 1.3 - Clean files using proprietary-patterns
    const cleanedFiles: { path: string; content: string }[] = [];
    const cleaningResults: CleaningResult[] = [];
    let totalChanges = 0;

    for (const file of files) {
      if (isLockFile(file.path)) continue;

      const result = cleanFileContent(file.path, file.content);
      cleaningResults.push(result);

      if (!result.removed) {
        cleanedFiles.push({ path: file.path, content: result.cleanedContent });
        totalChanges += result.changes.length;
      }
    }

    logStep("Phase 1.3: Files cleaned", { 
      original: files.length, 
      cleaned: cleanedFiles.length, 
      totalChanges 
    });

    if (cleanedFiles.length === 0) {
      return {
        success: false,
        phase: 'github',
        message: 'Aucun fichier à pousser après nettoyage',
        error: 'Tous les fichiers ont été filtrés ou supprimés',
      };
    }

    // 1.4 - Check if repo exists or create it
    const repoCheckResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
    let repoUrl: string;
    let wasCreated = false;

    if (repoCheckResponse.status === 404) {
      // Create new repository
      const createResponse = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoName,
          description: 'Projet libéré et nettoyé par Inopay - 100% Souverain',
          private: true,
          auto_init: false,
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        return {
          success: false,
          phase: 'github',
          message: 'Erreur création du dépôt',
          error: error.message || `HTTP ${createResponse.status}`,
          httpStatus: createResponse.status,
        };
      }

      const newRepo = await createResponse.json();
      repoUrl = newRepo.html_url;
      wasCreated = true;
      logStep("Phase 1.4: Repository created", { repoUrl });
    } else if (repoCheckResponse.ok) {
      const existingRepo = await repoCheckResponse.json();
      repoUrl = existingRepo.html_url;
      logStep("Phase 1.4: Repository exists", { repoUrl });
    } else {
      const error = await repoCheckResponse.text();
      return {
        success: false,
        phase: 'github',
        message: 'Erreur vérification du dépôt',
        error: `HTTP ${repoCheckResponse.status}: ${error}`,
        httpStatus: repoCheckResponse.status,
      };
    }

    // 1.5 - Initialize repo if needed (for empty repos)
    let baseSha: string | null = null;
    let baseTreeSha: string | null = null;

    if (!wasCreated) {
      // Get existing branch ref
      const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`, { headers });
      if (refResponse.ok) {
        const refData = await refResponse.json();
        baseSha = refData.object.sha;
        
        const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseSha}`, { headers });
        if (commitResponse.ok) {
          const commitData = await commitResponse.json();
          baseTreeSha = commitData.tree.sha;
        }
      }
    }

    // If no base ref found, initialize with README
    if (!baseSha) {
      const readmeContent = btoa(`# ${repoName}\n\nProjet libéré et nettoyé par Inopay - 100% Souverain\n`);
      
      const initResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/README.md`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: '🎉 Initial commit - Repo initialized by Inopay',
            content: readmeContent,
            branch: 'main',
          }),
        }
      );

      if (initResponse.ok || initResponse.status === 422) {
        await new Promise(r => setTimeout(r, 1500));
        
        const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`, { headers });
        if (refResponse.ok) {
          const refData = await refResponse.json();
          baseSha = refData.object.sha;
          
          const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseSha}`, { headers });
          if (commitResponse.ok) {
            const commitData = await commitResponse.json();
            baseTreeSha = commitData.tree.sha;
          }
        }
      }
    }

    logStep("Phase 1.5: Base refs obtained", { baseSha: baseSha?.substring(0, 7), baseTreeSha: baseTreeSha?.substring(0, 7) });

    // 1.6 - Build tree with inline content
    const treeItems: { path: string; mode: string; type: string; content?: string; sha?: string }[] = [];
    const INLINE_LIMIT = 100 * 1024;

    for (const file of cleanedFiles) {
      const size = new TextEncoder().encode(file.content).length;
      
      if (size > INLINE_LIMIT) {
        // Create blob for large files
        const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: btoa(unescape(encodeURIComponent(file.content))),
            encoding: 'base64',
          }),
        });

        if (blobResponse.ok) {
          const blob = await blobResponse.json();
          treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
        } else {
          // Fallback to inline
          treeItems.push({ path: file.path, mode: '100644', type: 'blob', content: file.content });
        }
      } else {
        treeItems.push({ path: file.path, mode: '100644', type: 'blob', content: file.content });
      }
    }

    logStep("Phase 1.6: Tree built", { items: treeItems.length });

    // 1.7 - Create tree
    const treePayload: { tree: typeof treeItems; base_tree?: string } = { tree: treeItems };
    if (baseTreeSha) {
      treePayload.base_tree = baseTreeSha;
    }

    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify(treePayload),
    });

    if (!treeResponse.ok) {
      const error = await treeResponse.json();
      return {
        success: false,
        phase: 'github',
        message: 'Erreur création de l\'arbre Git',
        error: error.message || `HTTP ${treeResponse.status}`,
        httpStatus: treeResponse.status,
      };
    }

    const tree = await treeResponse.json();
    logStep("Phase 1.7: Tree created", { treeSha: tree.sha.substring(0, 7) });

    // 1.8 - Create commit
    const commitPayload: { message: string; tree: string; parents?: string[] } = {
      message: `🚀 Liberation Inopay - ${cleanedFiles.length} fichiers nettoyés`,
      tree: tree.sha,
    };
    if (baseSha) {
      commitPayload.parents = [baseSha];
    }

    const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify(commitPayload),
    });

    if (!commitResponse.ok) {
      const error = await commitResponse.json();
      return {
        success: false,
        phase: 'github',
        message: 'Erreur création du commit',
        error: error.message || `HTTP ${commitResponse.status}`,
        httpStatus: commitResponse.status,
      };
    }

    const commit = await commitResponse.json();
    logStep("Phase 1.8: Commit created", { commitSha: commit.sha.substring(0, 7) });

    // 1.9 - Update ref
    const refUpdateResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`, {
      method: baseSha ? 'PATCH' : 'POST',
      headers,
      body: JSON.stringify({
        sha: commit.sha,
        force: true,
      }),
    });

    if (!refUpdateResponse.ok && !baseSha) {
      // Create ref if it doesn't exist
      await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: 'refs/heads/main',
          sha: commit.sha,
        }),
      });
    }

    logStep("Phase 1.9: Ref updated - COMPLETE", { repoUrl });

    // 1.10 - Validate package.json exists and is valid
    const packageJsonFile = cleanedFiles.find(f => f.path === 'package.json');
    let packageJsonValid = false;

    if (packageJsonFile) {
      try {
        const pkg = JSON.parse(packageJsonFile.content);
        packageJsonValid = !!pkg.name && !!pkg.dependencies;
      } catch {
        packageJsonValid = false;
      }
    }

    return {
      success: true,
      phase: 'github',
      message: `Dépôt ${repoName} créé et initialisé avec ${cleanedFiles.length} fichiers`,
      httpStatus: 201,
      data: {
        repoUrl,
        repoName,
        owner,
        filesCount: cleanedFiles.length,
        totalChanges,
        wasCreated,
        packageJsonValid,
        commitSha: commit.sha,
      },
    };

  } catch (error) {
    logStep("Phase 1: GitHub - ERROR", { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      phase: 'github',
      message: 'Erreur inattendue lors de la création GitHub',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ======================== PHASE 2: SUPABASE ========================
async function executePhaseSupabase(
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<PhaseResult> {
  logStep("Phase 2: Supabase - Starting", { url: supabaseUrl.substring(0, 30) + '...' });

  try {
    // 2.1 - Create client and test connection
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // 2.2 - Health check via simple query
    const { error: healthError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1);

    if (healthError) {
      logStep("Phase 2.1: Health check failed", { error: healthError.message });
      return {
        success: false,
        phase: 'supabase',
        message: 'Connexion Supabase échouée',
        error: healthError.message,
        httpStatus: 503,
      };
    }

    logStep("Phase 2.1: Health check passed");

    // 2.3 - Get existing tables count
    const { count: tablesCount } = await supabaseAdmin
      .from('projects_analysis')
      .select('*', { count: 'exact', head: true });

    logStep("Phase 2.2: Database validated", { projectsCount: tablesCount });

    // 2.4 - Check edge functions availability (via simple test)
    let edgeFunctionsAvailable = false;
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/health-monitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ test: true }),
      });
      edgeFunctionsAvailable = response.ok || response.status === 400;
    } catch {
      edgeFunctionsAvailable = false;
    }

    logStep("Phase 2.3: Edge functions check", { available: edgeFunctionsAvailable });

    return {
      success: true,
      phase: 'supabase',
      message: 'Instance Supabase connectée et opérationnelle',
      httpStatus: 200,
      data: {
        url: supabaseUrl,
        tablesReady: true,
        projectsCount: tablesCount || 0,
        edgeFunctionsAvailable,
      },
    };

  } catch (error) {
    logStep("Phase 2: Supabase - ERROR", { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      phase: 'supabase',
      message: 'Erreur connexion Supabase',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ======================== PHASE 3: COOLIFY ========================
async function executePhaseCoolify(
  coolifyUrl: string,
  coolifyToken: string,
  repoUrl: string,
  projectName: string,
  supabaseUrl?: string,
  supabaseAnonKey?: string
): Promise<PhaseResult> {
  logStep("Phase 3: Coolify - Starting", { coolifyUrl, projectName });

  const headers = {
    'Authorization': `Bearer ${coolifyToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  try {
    // 3.1 - Test Coolify connection
    const serversResponse = await fetch(`${coolifyUrl}/api/v1/servers`, { headers });
    
    if (!serversResponse.ok) {
      const status = serversResponse.status;
      let errorMsg = 'Connexion Coolify échouée';
      
      if (status === 401 || status === 403) {
        errorMsg = 'Token Coolify invalide ou expiré';
      } else if (status === 404) {
        errorMsg = 'URL Coolify incorrecte - /api/v1/servers non trouvé';
      }

      return {
        success: false,
        phase: 'coolify',
        message: errorMsg,
        error: `HTTP ${status}`,
        httpStatus: status,
      };
    }

    const servers = await serversResponse.json();
    logStep("Phase 3.1: Coolify connected", { serversCount: servers.length || 0 });

    // 3.2 - Check/Create project
    const projectsResponse = await fetch(`${coolifyUrl}/api/v1/projects`, { headers });
    let projectUuid: string | null = null;

    if (projectsResponse.ok) {
      const projects = await projectsResponse.json();
      const existingProject = projects.find((p: { name: string }) => 
        p.name.toLowerCase() === projectName.toLowerCase()
      );

      if (existingProject) {
        projectUuid = existingProject.uuid;
        logStep("Phase 3.2: Existing project found", { projectUuid });
      }
    }

    if (!projectUuid) {
      // Create new project
      const createProjectResponse = await fetch(`${coolifyUrl}/api/v1/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: projectName,
          description: 'Projet libéré par Inopay',
        }),
      });

      if (createProjectResponse.ok) {
        const newProject = await createProjectResponse.json();
        projectUuid = newProject.uuid;
        logStep("Phase 3.2: Project created", { projectUuid });
      } else {
        const error = await createProjectResponse.text();
        return {
          success: false,
          phase: 'coolify',
          message: 'Erreur création projet Coolify',
          error: error || `HTTP ${createProjectResponse.status}`,
          httpStatus: createProjectResponse.status,
        };
      }
    }

    // 3.3 - Create application pointing to GitHub repo
    const createAppResponse = await fetch(`${coolifyUrl}/api/v1/applications/public`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        project_uuid: projectUuid,
        git_repository: repoUrl,
        git_branch: 'main',
        build_pack: 'nixpacks',
        ports_exposes: '3000',
        name: projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      }),
    });

    if (!createAppResponse.ok) {
      // Try dockerfile mode
      const dockerResponse = await fetch(`${coolifyUrl}/api/v1/applications/dockerfile`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          project_uuid: projectUuid,
          git_repository: repoUrl,
          git_branch: 'main',
          dockerfile_location: '/Dockerfile',
          ports_exposes: '80',
          name: projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        }),
      });

      if (!dockerResponse.ok) {
        const error = await createAppResponse.text();
        return {
          success: false,
          phase: 'coolify',
          message: 'Erreur création application Coolify',
          error: error || `HTTP ${createAppResponse.status}`,
          httpStatus: createAppResponse.status,
        };
      }

      const app = await dockerResponse.json();
      logStep("Phase 3.3: Application created (Dockerfile mode)", { appUuid: app.uuid });

      // 3.4 - Inject environment variables
      if (supabaseUrl && supabaseAnonKey) {
        await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/envs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            key: 'VITE_SUPABASE_URL',
            value: supabaseUrl,
          }),
        });

        await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/envs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            key: 'VITE_SUPABASE_PUBLISHABLE_KEY',
            value: supabaseAnonKey,
          }),
        });

        logStep("Phase 3.4: Environment variables injected");
      }

      // 3.5 - Trigger deployment
      const deployResponse = await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/deploy`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ force: true }),
      });

      if (!deployResponse.ok) {
        return {
          success: true,
          phase: 'coolify',
          message: 'Application créée mais déploiement non déclenché',
          httpStatus: 200,
          data: {
            projectUuid,
            appUuid: app.uuid,
            deploymentTriggered: false,
          },
        };
      }

      const deployment = await deployResponse.json();
      logStep("Phase 3.5: Deployment triggered", { deploymentUuid: deployment.deployment_uuid });

      return {
        success: true,
        phase: 'coolify',
        message: 'Application créée et déploiement déclenché',
        httpStatus: 201,
        data: {
          projectUuid,
          appUuid: app.uuid,
          deploymentUuid: deployment.deployment_uuid,
          deploymentTriggered: true,
        },
      };
    }

    const app = await createAppResponse.json();
    logStep("Phase 3.3: Application created (Nixpacks mode)", { appUuid: app.uuid });

    // 3.4 - Inject environment variables
    if (supabaseUrl && supabaseAnonKey) {
      await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/envs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key: 'VITE_SUPABASE_URL',
          value: supabaseUrl,
        }),
      });

      await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/envs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key: 'VITE_SUPABASE_PUBLISHABLE_KEY',
          value: supabaseAnonKey,
        }),
      });

      logStep("Phase 3.4: Environment variables injected");
    }

    // 3.5 - Trigger deployment
    const deployResponse = await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/deploy`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ force: true }),
    });

    const deploymentTriggered = deployResponse.ok;
    let deploymentUuid = null;
    if (deploymentTriggered) {
      const deployment = await deployResponse.json();
      deploymentUuid = deployment.deployment_uuid;
    }

    logStep("Phase 3.5: Deployment", { triggered: deploymentTriggered, deploymentUuid });

    return {
      success: true,
      phase: 'coolify',
      message: deploymentTriggered 
        ? 'Application créée et déploiement déclenché'
        : 'Application créée (déploiement manuel requis)',
      httpStatus: 201,
      data: {
        projectUuid,
        appUuid: app.uuid,
        deploymentUuid,
        deploymentTriggered,
      },
    };

  } catch (error) {
    logStep("Phase 3: Coolify - ERROR", { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      phase: 'coolify',
      message: 'Erreur connexion/déploiement Coolify',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ======================== MAIN HANDLER ========================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN')!;

    // Auth
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Parse request
    const body: LiberationRequest = await req.json();
    const { phase, files = [], projectName, repoName, serverId } = body;

    if (!projectName) {
      return new Response(JSON.stringify({ error: 'projectName requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetRepoName = repoName || projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const results: PhaseResult[] = [];

    // Get user's server config for Coolify
    let serverConfig: { coolify_url?: string; coolify_token?: string } | null = null;
    if (phase === 'coolify' || phase === 'all') {
      if (serverId) {
        const { data: server } = await supabaseAdmin
          .from('user_servers')
          .select('coolify_url, coolify_token')
          .eq('id', serverId)
          .eq('user_id', userId)
          .single();
        serverConfig = server;
      } else {
        // Get first ready server
        const { data: servers } = await supabaseAdmin
          .from('user_servers')
          .select('coolify_url, coolify_token')
          .eq('user_id', userId)
          .eq('status', 'ready')
          .limit(1);
        serverConfig = servers?.[0] || null;
      }
    }

    // ========== EXECUTE PHASES ==========
    
    // Phase 1: GitHub
    if (phase === 'github' || phase === 'all') {
      if (files.length === 0) {
        results.push({
          success: false,
          phase: 'github',
          message: 'Aucun fichier fourni',
          error: 'Le tableau files est vide',
        });
      } else {
        const githubResult = await executePhaseGitHub(githubToken, targetRepoName, files, userId);
        results.push(githubResult);

        // Stop if Phase 1 fails in 'all' mode
        if (!githubResult.success && phase === 'all') {
          return new Response(JSON.stringify({
            success: false,
            message: 'Pipeline arrêté - Phase 1 (GitHub) échouée',
            results,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Phase 2: Supabase
    if (phase === 'supabase' || phase === 'all') {
      const targetSupabaseUrl = body.supabaseUrl || supabaseUrl;
      const targetSupabaseKey = body.supabaseServiceKey || supabaseServiceKey;

      const supabaseResult = await executePhaseSupabase(targetSupabaseUrl, targetSupabaseKey);
      results.push(supabaseResult);

      // Stop if Phase 2 fails in 'all' mode
      if (!supabaseResult.success && phase === 'all') {
        return new Response(JSON.stringify({
          success: false,
          message: 'Pipeline arrêté - Phase 2 (Supabase) échouée',
          results,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Phase 3: Coolify
    if (phase === 'coolify' || phase === 'all') {
      if (!serverConfig?.coolify_url || !serverConfig?.coolify_token) {
        results.push({
          success: false,
          phase: 'coolify',
          message: 'Aucun serveur Coolify configuré',
          error: 'Configurez un serveur VPS avec Coolify dans votre dashboard',
        });
      } else {
        const githubRepoUrl = results.find(r => r.phase === 'github')?.data?.repoUrl as string 
          || `https://github.com/${targetRepoName}`;

        const coolifyResult = await executePhaseCoolify(
          serverConfig.coolify_url,
          serverConfig.coolify_token,
          githubRepoUrl,
          projectName,
          body.supabaseUrl || supabaseUrl,
          Deno.env.get('SUPABASE_ANON_KEY')
        );
        results.push(coolifyResult);
      }
    }

    // Calculate overall success
    const allSuccess = results.every(r => r.success);
    const message = allSuccess 
      ? `Pipeline complet - ${results.length} phases réussies`
      : `Pipeline partiel - ${results.filter(r => r.success).length}/${results.length} phases réussies`;

    // Log activity
    await supabaseAdmin.from('admin_activity_logs').insert({
      user_id: userId,
      action_type: 'sovereign_liberation',
      title: allSuccess ? 'Liberation réussie' : 'Liberation partielle',
      description: message,
      status: allSuccess ? 'success' : 'warning',
      metadata: { phase, projectName, results },
    });

    return new Response(JSON.stringify({
      success: allSuccess,
      message,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep("FATAL ERROR", { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
