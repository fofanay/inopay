import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Patterns propriétaires à supprimer
const PROPRIETARY_PATTERNS = {
  imports: [
    /@lovable\//g,
    /@gptengineer\//g,
    /from ['"]lovable/g,
    /from ['"]gptengineer/g,
    /lovable-tagger/g,
    /componentTagger/g,
  ],
  files: [
    '.bolt',
    '.lovable',
    '.gptengineer',
  ],
  content: [
    /import\s*{\s*componentTagger\s*}\s*from\s*['"]lovable-tagger['"]\s*;?\n?/g,
    /mode\s*===\s*['"]development['"]\s*&&\s*componentTagger\(\)\s*,?\n?/g,
    /\/\/\s*@lovable.*\n?/g,
    /\/\*\s*@lovable[\s\S]*?\*\//g,
  ],
  telemetry: [
    /lovable\.app/g,
    /gptengineer\.app/g,
    /events\.lovable/g,
    /telemetry\.lovable/g,
    /analytics\.lovable/g,
  ],
};

// Remplacements de hooks standards
const HOOK_REPLACEMENTS: Record<string, { standard: string; import: string }> = {
  'use-mobile': {
    standard: `import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}`,
    import: "import { useIsMobile } from '@/hooks/use-mobile';",
  },
};

interface ProcessRequest {
  files: { path: string; content: string }[];
  projectName: string;
  userId: string;
  projectId?: string;
}

interface CleaningResult {
  path: string;
  originalContent: string;
  cleanedContent: string;
  changes: string[];
  removed: boolean;
}

function cleanFileContent(filePath: string, content: string): CleaningResult {
  const changes: string[] = [];
  let cleanedContent = content;
  let removed = false;

  // Check if file should be removed
  for (const pattern of PROPRIETARY_PATTERNS.files) {
    if (filePath.includes(pattern)) {
      removed = true;
      changes.push(`Fichier propriétaire supprimé: ${filePath}`);
      return { path: filePath, originalContent: content, cleanedContent: '', changes, removed };
    }
  }

  // Remove proprietary imports
  for (const pattern of PROPRIETARY_PATTERNS.imports) {
    if (pattern.test(cleanedContent)) {
      cleanedContent = cleanedContent.replace(pattern, '');
      changes.push(`Import propriétaire supprimé: ${pattern.source}`);
    }
  }

  // Remove proprietary content patterns
  for (const pattern of PROPRIETARY_PATTERNS.content) {
    if (pattern.test(cleanedContent)) {
      cleanedContent = cleanedContent.replace(pattern, '');
      changes.push(`Contenu propriétaire supprimé: ${pattern.source}`);
    }
  }

  // Remove telemetry patterns
  for (const pattern of PROPRIETARY_PATTERNS.telemetry) {
    if (pattern.test(cleanedContent)) {
      cleanedContent = cleanedContent.replace(pattern, '');
      changes.push(`Télémétrie supprimée: ${pattern.source}`);
    }
  }

  // Clean package.json
  if (filePath === 'package.json') {
    try {
      const pkg = JSON.parse(cleanedContent);
      const depsToRemove = ['lovable-tagger', '@lovable/core', '@gptengineer/core'];
      
      for (const dep of depsToRemove) {
        if (pkg.dependencies?.[dep]) {
          delete pkg.dependencies[dep];
          changes.push(`Dépendance supprimée: ${dep}`);
        }
        if (pkg.devDependencies?.[dep]) {
          delete pkg.devDependencies[dep];
          changes.push(`DevDépendance supprimée: ${dep}`);
        }
      }
      
      cleanedContent = JSON.stringify(pkg, null, 2);
    } catch (e) {
      console.error('Error parsing package.json:', e);
    }
  }

  // Clean vite.config.ts
  if (filePath === 'vite.config.ts') {
    // Remove componentTagger import and usage
    cleanedContent = cleanedContent.replace(
      /import\s*{\s*componentTagger\s*}\s*from\s*['"]lovable-tagger['"]\s*;?\n?/g,
      ''
    );
    cleanedContent = cleanedContent.replace(
      /mode\s*===\s*['"]development['"]\s*&&\s*componentTagger\(\)\s*,?\n?/g,
      ''
    );
    
    if (cleanedContent !== content) {
      changes.push('vite.config.ts nettoyé des plugins propriétaires');
    }
  }

  // Clean up empty lines left behind
  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');

  return { path: filePath, originalContent: content, cleanedContent, changes, removed };
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
      // We need to create via the Coolify dashboard for now
      // Just trigger a rebuild if app exists
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

    // Get user settings for GitHub token
    const { data: settings } = await supabase
      .from('user_settings')
      .select('github_token')
      .eq('user_id', user.id)
      .single();

    const githubToken = settings?.github_token;

    // Phase 1: Clean files
    console.log(`[Liberation] Starting cleaning for ${projectName}`);
    
    const cleaningResults: CleaningResult[] = [];
    const cleanedFiles: { path: string; content: string }[] = [];
    let totalChanges = 0;

    for (const file of files) {
      const result = cleanFileContent(file.path, file.content);
      cleaningResults.push(result);
      
      if (!result.removed && result.cleanedContent) {
        cleanedFiles.push({ path: result.path, content: result.cleanedContent });
      }
      
      totalChanges += result.changes.length;
    }

    console.log(`[Liberation] Cleaned ${cleanedFiles.length} files, ${totalChanges} changes made`);

    // If only cleaning requested, return here
    if (action === 'clean-only') {
      return new Response(JSON.stringify({
        success: true,
        phase: 'cleaning',
        cleaningResults,
        cleanedFiles: cleanedFiles.length,
        totalChanges,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Phase 2: Push to GitHub
    console.log(`[Liberation] Cleaned ${cleanedFiles.length} files, ${totalChanges} changes made`);

    // If only cleaning requested, return here
    if (action === 'clean-only') {
      return new Response(JSON.stringify({
        success: true,
        phase: 'cleaning',
        cleaningResults,
        cleanedFiles: cleanedFiles.length,
        totalChanges,
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
