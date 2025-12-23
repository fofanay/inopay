import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  cleanFileContent, 
  validateSyntax,
  SECURITY_LIMITS,
  type CleaningResult 
} from "../_shared/proprietary-patterns.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessRequest {
  files: { path: string; content: string }[];
  projectName: string;
  userId: string;
  projectId?: string;
}

async function pushToGitHub(
  githubToken: string,
  repoName: string,
  files: { path: string; content: string }[],
  commitMessage: string
): Promise<{ success: boolean; repoUrl?: string; error?: string }> {
  const headers = {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // Get authenticated user
    const userResponse = await fetch('https://api.github.com/user', { headers });
    if (!userResponse.ok) {
      return { success: false, error: 'Token GitHub invalide ou expiré' };
    }
    const user = await userResponse.json();
    const owner = user.login;

    // Check if repo exists
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
    
    let repoUrl: string;
    
    if (repoResponse.status === 404) {
      // Create new repo
      const createResponse = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoName,
          description: 'Projet libéré et nettoyé par Inopay - 100% Souverain',
          private: true,
          auto_init: true,
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        return { success: false, error: `Erreur création repo: ${error.message}` };
      }

      const newRepo = await createResponse.json();
      repoUrl = newRepo.html_url;

      // Wait for repo initialization
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      const existingRepo = await repoResponse.json();
      repoUrl = existingRepo.html_url;
    }

    // Get current commit SHA
    const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`, { headers });
    
    let baseSha: string;
    let baseTreeSha: string;

    if (refResponse.ok) {
      const refData = await refResponse.json();
      baseSha = refData.object.sha;

      // Get base tree
      const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseSha}`, { headers });
      const commitData = await commitResponse.json();
      baseTreeSha = commitData.tree.sha;
    } else {
      // Empty repo, need to create initial commit
      baseSha = '';
      baseTreeSha = '';
    }

    // Create blobs for all files
    const treeItems = [];
    for (const file of files) {
      const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: btoa(unescape(encodeURIComponent(file.content))),
          encoding: 'base64',
        }),
      });

      if (!blobResponse.ok) {
        console.error(`Failed to create blob for ${file.path}`);
        continue;
      }

      const blob = await blobResponse.json();
      treeItems.push({
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blob.sha,
      });
    }

    // Create tree
    const treePayload: any = { tree: treeItems };
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
      return { success: false, error: `Erreur création arbre: ${error.message}` };
    }

    const tree = await treeResponse.json();

    // Create commit
    const commitPayload: any = {
      message: commitMessage,
      tree: tree.sha,
    };
    if (baseSha) {
      commitPayload.parents = [baseSha];
    }

    const newCommitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify(commitPayload),
    });

    if (!newCommitResponse.ok) {
      const error = await newCommitResponse.json();
      return { success: false, error: `Erreur création commit: ${error.message}` };
    }

    const newCommit = await newCommitResponse.json();

    // Update reference
    const updateRefMethod = baseSha ? 'PATCH' : 'POST';
    const refUrl = baseSha 
      ? `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`
      : `https://api.github.com/repos/${owner}/${repoName}/git/refs`;

    const refPayload = baseSha 
      ? { sha: newCommit.sha, force: true }
      : { ref: 'refs/heads/main', sha: newCommit.sha };

    const updateRefResponse = await fetch(refUrl, {
      method: updateRefMethod,
      headers,
      body: JSON.stringify(refPayload),
    });

    if (!updateRefResponse.ok) {
      const error = await updateRefResponse.json();
      return { success: false, error: `Erreur mise à jour ref: ${error.message}` };
    }

    return { success: true, repoUrl };
  } catch (error) {
    console.error('GitHub push error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return { success: false, repoUrl: undefined, error: `Erreur réseau: ${errorMessage}` };
  }
}

async function triggerCoolifyDeployment(
  coolifyUrl: string,
  coolifyToken: string,
  repoUrl: string,
  projectName: string
): Promise<{ success: boolean; deploymentUrl?: string; error?: string }> {
  try {
    // List applications to find or create one
    const appsResponse = await fetch(`${coolifyUrl}/api/v1/applications`, {
      headers: {
        'Authorization': `Bearer ${coolifyToken}`,
        'Accept': 'application/json',
      },
    });

    if (!appsResponse.ok) {
      return { success: false, error: 'Impossible de se connecter à Coolify' };
    }

    const apps = await appsResponse.json();
    let appUuid: string | null = null;
    let deploymentUrl: string | null = null;

    // Find existing app or create new one
    const existingApp = apps.find((app: any) => 
      app.name === `inopay-${projectName}` || 
      app.git_repository?.includes(projectName)
    );

    if (existingApp) {
      appUuid = existingApp.uuid;
      deploymentUrl = existingApp.fqdn;
    } else {
      return { 
        success: false, 
        error: 'Application non trouvée sur Coolify. Créez-la d\'abord depuis le dashboard Coolify.' 
      };
    }

    // Trigger deployment
    const deployResponse = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}/restart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${coolifyToken}`,
        'Accept': 'application/json',
      },
    });

    if (!deployResponse.ok) {
      const error = await deployResponse.json();
      return { success: false, error: `Erreur déploiement: ${error.message || 'Inconnu'}` };
    }

    return { success: true, deploymentUrl: deploymentUrl || undefined };
  } catch (error) {
    console.error('Coolify deployment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return { success: false, deploymentUrl: undefined, error: `Erreur Coolify: ${errorMessage}` };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { files, projectName, projectId, action } = await req.json() as ProcessRequest & { action?: string };

    // Security limits check
    if (files.length > SECURITY_LIMITS.MAX_FILES_PER_LIBERATION) {
      return new Response(JSON.stringify({ 
        error: `Limite de fichiers dépassée: ${files.length} > ${SECURITY_LIMITS.MAX_FILES_PER_LIBERATION}` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user settings for GitHub token
    const { data: settings } = await supabase
      .from('user_settings')
      .select('github_token')
      .eq('user_id', user.id)
      .single();

    const githubToken = settings?.github_token;

    // Phase 1: Clean files
    console.log(`[Liberation] Starting cleaning for ${projectName}, ${files.length} files`);
    
    const cleaningResults: CleaningResult[] = [];
    const cleanedFiles: { path: string; content: string }[] = [];
    const validationErrors: { path: string; error: string }[] = [];
    let totalChanges = 0;

    for (const file of files) {
      // Skip files that are too large
      if (file.content.length > SECURITY_LIMITS.MAX_FILE_SIZE_CHARS) {
        console.log(`[Liberation] Skipping large file: ${file.path} (${file.content.length} chars)`);
        continue;
      }

      const result = cleanFileContent(file.path, file.content);
      cleaningResults.push(result);
      
      if (!result.removed && result.cleanedContent) {
        // Validate syntax before adding
        const validation = validateSyntax(result.cleanedContent, result.path);
        if (validation.valid) {
          cleanedFiles.push({ path: result.path, content: result.cleanedContent });
        } else {
          validationErrors.push({ path: result.path, error: validation.error || 'Syntax error' });
          console.warn(`[Liberation] Syntax error in ${result.path}: ${validation.error}`);
          // Fall back to original content
          cleanedFiles.push({ path: file.path, content: file.content });
        }
      }
      
      totalChanges += result.changes.length;
    }

    console.log(`[Liberation] Cleaned ${cleanedFiles.length} files, ${totalChanges} changes made, ${validationErrors.length} validation errors`);

    // If only cleaning requested, return here
    if (action === 'clean-only') {
      return new Response(JSON.stringify({
        success: true,
        phase: 'cleaning',
        cleaningResults,
        cleanedFiles: cleanedFiles.length,
        totalChanges,
        validationErrors,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Phase 2: Push to GitHub
    let githubResult: { success: boolean; repoUrl: string | undefined; error: string } = { 
      success: false, 
      repoUrl: undefined, 
      error: 'Token GitHub non configuré' 
    };
    
    if (githubToken) {
      const repoName = `inopay-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
      console.log(`[Liberation] Pushing to GitHub repo: ${repoName}`);
      
      const pushResult = await pushToGitHub(
        githubToken,
        repoName,
        cleanedFiles,
        `🚀 Libération Inopay - ${new Date().toLocaleDateString('fr-CA')}\n\n${totalChanges} modifications de nettoyage appliquées`
      );
      githubResult = {
        success: pushResult.success,
        repoUrl: pushResult.repoUrl,
        error: pushResult.error || '',
      };
    }

    // Phase 3: Trigger Coolify deployment (if GitHub succeeded and Coolify is configured)
    let coolifyResult: { success: boolean; deploymentUrl: string | undefined; error: string } = { 
      success: false, 
      deploymentUrl: undefined, 
      error: 'Non configuré' 
    };

    if (githubResult.success && githubResult.repoUrl) {
      // Get server with Coolify config
      const { data: servers } = await supabase
        .from('user_servers')
        .select('coolify_url, coolify_token')
        .eq('user_id', user.id)
        .not('coolify_token', 'is', null)
        .limit(1);

      if (servers && servers.length > 0 && servers[0].coolify_url && servers[0].coolify_token) {
        console.log(`[Liberation] Triggering Coolify deployment`);
        const deployResult = await triggerCoolifyDeployment(
          servers[0].coolify_url,
          servers[0].coolify_token,
          githubResult.repoUrl,
          projectName
        );
        coolifyResult = {
          success: deployResult.success,
          deploymentUrl: deployResult.deploymentUrl,
          error: deployResult.error || '',
        };
      }
    }

    // Log activity
    await supabase.from('admin_activity_logs').insert({
      user_id: user.id,
      action_type: 'project_liberation',
      title: `Libération: ${projectName}`,
      description: `${cleanedFiles.length} fichiers nettoyés, ${totalChanges} modifications`,
      status: githubResult.success ? 'success' : 'warning',
      metadata: {
        projectName,
        projectId,
        cleanedFiles: cleanedFiles.length,
        totalChanges,
        validationErrors: validationErrors.length,
        githubSuccess: githubResult.success,
        githubRepoUrl: githubResult.repoUrl,
        coolifySuccess: coolifyResult.success,
        deploymentUrl: coolifyResult.deploymentUrl,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      phases: {
        cleaning: {
          success: true,
          filesProcessed: files.length,
          filesCleaned: cleanedFiles.length,
          totalChanges,
          validationErrors,
          results: cleaningResults.filter(r => r.changes.length > 0),
        },
        github: {
          success: githubResult.success,
          repoUrl: githubResult.repoUrl,
          error: githubResult.error,
        },
        coolify: {
          success: coolifyResult.success,
          deploymentUrl: coolifyResult.deploymentUrl,
          error: coolifyResult.error,
        },
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Liberation] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
