// @inopay-core-protected
// INOPAY LIBERATION ENGINE - Main Processing Function
// This file MUST NOT be cleaned or removed during self-liberation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  cleanFileContent, 
  validateSyntax,
  isLockFile,
  checkAssetSovereignty,
  generatePolyfills,
  SECURITY_LIMITS,
  getDynamicSecurityLimits,
  type CleaningResult,
  type AssetSovereigntyResult,
  type PolyfillResult
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
  destinationOwner?: string;
}

// Clean GitHub URL/username - extract only the username
function cleanGitHubOwner(input: string | null): string | null {
  if (!input) return null;
  // Remove https://github.com/ or http://github.com/ prefix
  let cleaned = input.replace(/^https?:\/\/github\.com\//i, '');
  // Take only the first segment (username), ignore repo name
  cleaned = cleaned.split('/')[0];
  // Remove any trailing slashes or whitespace
  return cleaned.trim() || null;
}

// Mask sensitive tokens in URLs/strings for safe logging
function maskSensitiveData(input: string): string {
  // Mask x-access-token:TOKEN@ patterns
  let masked = input.replace(/x-access-token:[^@]+@/gi, 'x-access-token:***@');
  // Mask https://TOKEN@github.com patterns
  masked = masked.replace(/https:\/\/[^:@]+:[^@]+@github\.com/gi, 'https://***:***@github.com');
  // Mask Bearer tokens
  masked = masked.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer ***');
  // Mask ghp_ tokens
  masked = masked.replace(/ghp_[A-Za-z0-9_]+/g, 'ghp_***');
  // Mask gho_ tokens
  masked = masked.replace(/gho_[A-Za-z0-9_]+/g, 'gho_***');
  return masked;
}

// Initialize an empty GitHub repo with a first commit
async function initializeEmptyRepo(
  headers: Record<string, string>,
  owner: string,
  repoName: string
): Promise<{ success: boolean; baseSha?: string; baseTreeSha?: string; error?: string }> {
  console.log(`[GitHub] Repo is empty, initializing with first commit...`);
  
  try {
    // Create initial README.md via Contents API (works on empty repos)
    const readmeContent = btoa(`# ${repoName}\n\nProjet libéré et nettoyé par Inopay - 100% Souverain\n`);
    
    const createFileResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/contents/README.md`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: '🎉 Initial commit - Repo initialized',
          content: readmeContent,
          branch: 'main',
        }),
      }
    );

    if (!createFileResponse.ok) {
      // Try with master branch if main doesn't exist
      const masterResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/README.md`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: '🎉 Initial commit - Repo initialized',
            content: readmeContent,
            branch: 'master',
          }),
        }
      );
      
      if (!masterResponse.ok) {
        const error = await masterResponse.json();
        console.error('[GitHub] Failed to initialize repo:', error);
        return { success: false, error: `Impossible d'initialiser le repo: ${error.message}` };
      }
    }
    
    console.log(`[GitHub] Initial commit created, waiting for branch to be ready...`);
    
    // Wait a moment for GitHub to process
    await new Promise(r => setTimeout(r, 1500));
    
    // Now get the base SHA from the newly created commit
    const refResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`,
      { headers }
    );
    
    if (refResponse.ok) {
      const refData = await refResponse.json();
      const baseSha = refData.object.sha;
      
      const commitResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseSha}`,
        { headers }
      );
      
      if (commitResponse.ok) {
        const commitData = await commitResponse.json();
        console.log(`[GitHub] Repo initialized successfully, baseSha: ${baseSha}`);
        return { 
          success: true, 
          baseSha, 
          baseTreeSha: commitData.tree.sha 
        };
      }
    }
    
    // Try master branch
    const masterRefResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/master`,
      { headers }
    );
    
    if (masterRefResponse.ok) {
      const refData = await masterRefResponse.json();
      const baseSha = refData.object.sha;
      
      const commitResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseSha}`,
        { headers }
      );
      
      if (commitResponse.ok) {
        const commitData = await commitResponse.json();
        console.log(`[GitHub] Repo initialized on master, baseSha: ${baseSha}`);
        return { 
          success: true, 
          baseSha, 
          baseTreeSha: commitData.tree.sha 
        };
      }
    }
    
    return { success: false, error: 'Repo initialisé mais impossible de lire la ref' };
  } catch (error) {
    console.error('[GitHub] Init error:', error);
    return { success: false, error: `Erreur initialisation: ${error instanceof Error ? error.message : 'Inconnue'}` };
  }
}

// Check if a repo is empty (no commits)
async function isRepoEmpty(
  headers: Record<string, string>,
  owner: string,
  repoName: string
): Promise<boolean> {
  // Try to get the default branch ref
  const mainRef = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`,
    { headers }
  );
  
  if (mainRef.ok) return false;
  
  // Check if 404 means empty or just no main branch
  if (mainRef.status === 404 || mainRef.status === 409) {
    // Also check master branch
    const masterRef = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/master`,
      { headers }
    );
    
    if (masterRef.ok) return false;
    
    // Check commits count as final confirmation
    const commitsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/commits?per_page=1`,
      { headers }
    );
    
    if (commitsResponse.status === 409) {
      // 409 "Git Repository is empty" confirms it's empty
      return true;
    }
    
    if (commitsResponse.ok) {
      const commits = await commitsResponse.json();
      return commits.length === 0;
    }
    
    // Likely empty if we got here
    return true;
  }
  
  return false;
}

// NEW: Push to GitHub using tree with inline content strategy
// This DRASTICALLY reduces API calls (1 tree call vs N blob calls)
async function pushToGitHubOptimized(
  githubToken: string,
  repoName: string,
  destinationOwner: string | null,
  files: { path: string; content: string }[],
  commitMessage: string
): Promise<{ success: boolean; repoUrl?: string; error?: string }> {
  // Clean the destination owner (extract username from URL if needed)
  const cleanedDestinationOwner = cleanGitHubOwner(destinationOwner);
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
    const owner = cleanedDestinationOwner || user.login;
    
    // Case-insensitive comparison for owner matching
    const isOwnAccount = owner.toLowerCase() === user.login.toLowerCase();
    console.log(`[GitHub] Token user: ${user.login}, destination owner: ${owner}, isOwnAccount: ${isOwnAccount}`);
    console.log(`[GitHub] Pushing to ${owner}/${repoName} (${files.length} files)`);

    // Check if repo exists
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
    
    let repoUrl: string;
    let isNewRepo = false;
    let repoIsEmpty = false;
    
    if (repoResponse.status === 404) {
      // Create new repo - use case-insensitive comparison
      const createUrl = isOwnAccount
        ? 'https://api.github.com/user/repos'
        : `https://api.github.com/orgs/${owner}/repos`;
      
      console.log(`[GitHub] Creating repo via: ${createUrl}`);
      
      const createResponse = await fetch(createUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoName,
          description: 'Projet libéré et nettoyé par Inopay - 100% Souverain',
          private: true,
          auto_init: false, // Don't auto-init - we'll push everything at once
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        const errorMsg = error.message || 'Erreur inconnue';
        
        // Detect common issues
        if (createUrl.includes('/orgs/') && (errorMsg.includes('Not Found') || createResponse.status === 404)) {
          return { 
            success: false, 
            error: `"${owner}" n'est pas une organisation GitHub. Si c'est votre compte personnel, laissez "Destination" vide ou vérifiez que le nom correspond exactement à votre nom d'utilisateur GitHub (casse comprise: ${user.login}).` 
          };
        }
        
        if (errorMsg.includes('name already exists')) {
          return {
            success: false,
            error: `Le dépôt ${owner}/${repoName} existe déjà mais n'est pas accessible avec ce token. Vérifiez les permissions ou supprimez le repo existant.`
          };
        }
        
        return { success: false, error: `Erreur création repo: ${errorMsg} (status: ${createResponse.status})` };
      }

      const newRepo = await createResponse.json();
      repoUrl = newRepo.html_url;
      isNewRepo = true;
      console.log(`[GitHub] Created new repo: ${repoUrl}`);
    } else {
      const existingRepo = await repoResponse.json();
      repoUrl = existingRepo.html_url;
      
      // Check if existing repo is empty
      repoIsEmpty = await isRepoEmpty(headers, owner, repoName);
      if (repoIsEmpty) {
        console.log(`[GitHub] Existing repo ${owner}/${repoName} is EMPTY - will initialize first`);
      }
    }

    // STRATEGY: Use tree with inline content for small files
    // Only create blobs for large files (>100KB)
    const INLINE_SIZE_LIMIT = 100 * 1024; // 100KB
    const treeItems: any[] = [];
    const largeFilesToProcess: { path: string; content: string }[] = [];
    
    // Separate small files (inline) from large files (need blob)
    for (const file of files) {
      const size = new TextEncoder().encode(file.content).length;
      if (size > INLINE_SIZE_LIMIT) {
        largeFilesToProcess.push(file);
      } else {
        // Small files go directly in tree with base64 content
        treeItems.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          content: file.content, // Content directly in tree item
        });
      }
    }
    
    console.log(`[GitHub] ${treeItems.length} inline files, ${largeFilesToProcess.length} large files need blobs`);
    
    // Create blobs only for large files (with retry and rate limit handling)
    const failedBlobs: string[] = [];
    
    for (const file of largeFilesToProcess) {
      let success = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const encodedContent = btoa(unescape(encodeURIComponent(file.content)));
          
          const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              content: encodedContent,
              encoding: 'base64',
            }),
          });

          if (blobResponse.ok) {
            const blob = await blobResponse.json();
            treeItems.push({
              path: file.path,
              mode: '100644',
              type: 'blob',
              sha: blob.sha,
            });
            success = true;
            break;
          }
          
          // Handle rate limiting
          if (blobResponse.status === 403 || blobResponse.status === 429) {
            const retryAfter = blobResponse.headers.get('Retry-After');
            const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000 * attempt;
            console.warn(`[GitHub] Rate limited on blob creation, waiting ${waitTime}ms`);
            await new Promise(r => setTimeout(r, waitTime));
          } else {
            const errorText = await blobResponse.text();
            console.error(`[GitHub] Blob creation failed for ${file.path}: ${blobResponse.status} - ${errorText}`);
            await new Promise(r => setTimeout(r, 1000 * attempt));
          }
        } catch (err) {
          console.error(`[GitHub] Error creating blob for ${file.path}:`, err);
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
      
      if (!success) {
        failedBlobs.push(file.path);
        // Add content directly anyway (might work for some files)
        treeItems.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          content: file.content,
        });
      }
    }
    
    if (failedBlobs.length > 0) {
      console.warn(`[GitHub] ${failedBlobs.length} blob creations failed, using inline content fallback`);
    }
    
    if (treeItems.length === 0) {
      return { success: false, error: 'Aucun fichier à envoyer' };
    }

    // For existing repos, get the base tree SHA
    let baseSha: string | null = null;
    let baseTreeSha: string | null = null;
    
    if (!isNewRepo) {
      // If repo exists but is empty, initialize it first
      if (repoIsEmpty) {
        const initResult = await initializeEmptyRepo(headers, owner, repoName);
        if (!initResult.success) {
          return { success: false, error: initResult.error };
        }
        baseSha = initResult.baseSha || null;
        baseTreeSha = initResult.baseTreeSha || null;
      } else {
        // Normal case: get existing refs
        const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`, { headers });
        if (refResponse.ok) {
          const refData = await refResponse.json();
          baseSha = refData.object.sha;
          const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseSha}`, { headers });
          if (commitResponse.ok) {
            const commitData = await commitResponse.json();
            baseTreeSha = commitData.tree.sha;
          }
        } else {
          // Maybe master branch?
          const masterRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/master`, { headers });
          if (masterRefResponse.ok) {
            const refData = await masterRefResponse.json();
            baseSha = refData.object.sha;
            const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseSha}`, { headers });
            if (commitResponse.ok) {
              const commitData = await commitResponse.json();
              baseTreeSha = commitData.tree.sha;
            }
          }
        }
      }
    }

    // Create tree (single API call for all inline content!)
    console.log(`[GitHub] Creating tree with ${treeItems.length} items...`);
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
      console.error('[GitHub] Tree creation failed:', error);
      
      // Handle "Git Repository is empty" error - retry with init
      if (error.message?.includes('empty') || treeResponse.status === 409) {
        console.log('[GitHub] Got "empty repo" error, attempting auto-init...');
        const initResult = await initializeEmptyRepo(headers, owner, repoName);
        if (initResult.success) {
          baseSha = initResult.baseSha || null;
          baseTreeSha = initResult.baseTreeSha || null;
          
          // Retry tree creation
          const retryTreePayload: any = { tree: treeItems };
          if (baseTreeSha) {
            retryTreePayload.base_tree = baseTreeSha;
          }
          
          const retryTreeResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
            method: 'POST',
            headers,
            body: JSON.stringify(retryTreePayload),
          });
          
          if (!retryTreeResponse.ok) {
            const retryError = await retryTreeResponse.json();
            return { success: false, error: `Erreur création arbre (après init): ${retryError.message}` };
          }
          
          // Continue with the retried tree
          const retryTree = await retryTreeResponse.json();
          console.log(`[GitHub] Tree created after init: ${retryTree.sha}`);
          
          // Create commit with the retry tree
          const retryCommitPayload: any = {
            message: commitMessage,
            tree: retryTree.sha,
          };
          if (baseSha) {
            retryCommitPayload.parents = [baseSha];
          }
          
          const retryCommitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
            method: 'POST',
            headers,
            body: JSON.stringify(retryCommitPayload),
          });
          
          if (!retryCommitResponse.ok) {
            const retryCommitError = await retryCommitResponse.json();
            return { success: false, error: `Erreur création commit (après init): ${retryCommitError.message}` };
          }
          
          const retryCommit = await retryCommitResponse.json();
          
          // Update ref
          const updateRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ sha: retryCommit.sha, force: true }),
          });
          
          if (!updateRefResponse.ok) {
            const refError = await updateRefResponse.json();
            return { success: false, error: `Erreur mise à jour ref (après init): ${refError.message}` };
          }
          
          console.log(`[GitHub] Successfully pushed to ${repoUrl} (after auto-init)`);
          return { success: true, repoUrl };
        }
      }
      
      return { success: false, error: `Erreur création arbre: ${error.message}` };
    }

    const tree = await treeResponse.json();
    console.log(`[GitHub] Tree created: ${tree.sha}`);

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
    console.log(`[GitHub] Commit created: ${newCommit.sha}`);

    // Update or create reference
    if (baseSha) {
      // Update existing ref
      const updateRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sha: newCommit.sha, force: true }),
      });
      
      if (!updateRefResponse.ok) {
        const error = await updateRefResponse.json();
        return { success: false, error: `Erreur mise à jour ref: ${error.message}` };
      }
    } else {
      // Create new ref for new repo
      const createRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ref: 'refs/heads/main', sha: newCommit.sha }),
      });
      
      if (!createRefResponse.ok) {
        const error = await createRefResponse.json();
        return { success: false, error: `Erreur création ref: ${error.message}` };
      }
    }

    console.log(`[GitHub] Successfully pushed to ${repoUrl}`);
    return { success: true, repoUrl };
  } catch (error) {
    console.error('[GitHub] Push error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return { success: false, error: `Erreur réseau: ${errorMessage}` };
  }
}

interface CoolifyAppDetails {
  uuid: string;
  name: string;
  fqdn: string | null;
  git_repository: string | null;
  git_branch: string | null;
  build_pack: string | null;
}

async function triggerCoolifyDeployment(
  coolifyUrl: string,
  coolifyToken: string,
  repoUrl: string,
  projectName: string
): Promise<{ 
  success: boolean; 
  deploymentUrl?: string; 
  error?: string;
  appDetails?: CoolifyAppDetails;
  repoUpdated?: boolean;
}> {
  try {
    console.log(`[Coolify] Connecting to ${coolifyUrl}...`);
    
    const headers = {
      'Authorization': `Bearer ${coolifyToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    
    // List applications to find one
    const appsResponse = await fetch(`${coolifyUrl}/api/v1/applications`, { headers });

    if (!appsResponse.ok) {
      const status = appsResponse.status;
      if (status === 401) {
        return { success: false, error: 'Token Coolify invalide ou expiré' };
      } else if (status === 403) {
        return { success: false, error: 'Token Coolify sans permissions suffisantes' };
      }
      return { success: false, error: `Impossible de se connecter à Coolify (HTTP ${status})` };
    }

    const apps = await appsResponse.json();
    console.log(`[Coolify] Found ${apps.length} applications`);
    
    // Find existing app by name or repo URL
    const existingApp = apps.find((app: any) => 
      app.name === `inopay-${projectName}` || 
      app.name?.toLowerCase().includes('inopay') ||
      app.name?.toLowerCase().includes('getinopay') ||
      app.git_repository?.includes(projectName) ||
      app.git_repository?.includes('inopay')
    );

    if (!existingApp) {
      console.log(`[Coolify] No matching app found for ${projectName}`);
      return { 
        success: false, 
        error: `Application non trouvée sur Coolify. Créez d'abord une application nommée "inopay-${projectName}" dans Coolify.` 
      };
    }

    const appUuid = existingApp.uuid;
    const appDetails: CoolifyAppDetails = {
      uuid: existingApp.uuid,
      name: existingApp.name,
      fqdn: existingApp.fqdn,
      git_repository: existingApp.git_repository,
      git_branch: existingApp.git_branch,
      build_pack: existingApp.build_pack,
    };
    
    console.log(`[Coolify] Found app: ${appDetails.name} (${appUuid})`);
    console.log(`[Coolify] Current git_repository: ${maskSensitiveData(appDetails.git_repository || 'NONE')}`);
    console.log(`[Coolify] Target repo URL: ${maskSensitiveData(repoUrl)}`);
    
    let repoUpdated = false;
    
    // Check if we need to update the git_repository
    const normalizedRepoUrl = repoUrl.replace(/\.git$/, '').toLowerCase();
    const currentRepo = (appDetails.git_repository || '').replace(/\.git$/, '').toLowerCase();
    
    if (!currentRepo || !currentRepo.includes(normalizedRepoUrl.split('/').pop() || '')) {
      // Need to update the git repository configuration
      console.log(`[Coolify] Updating git_repository from "${maskSensitiveData(appDetails.git_repository || '')}" to "${maskSensitiveData(repoUrl)}"`);
      
      // First, get full app details to preserve other settings
      const appDetailsResponse = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}`, { headers });
      
      if (appDetailsResponse.ok) {
        const fullAppDetails = await appDetailsResponse.json();
        
        // Update the application with new git repository
        const updatePayload = {
          git_repository: repoUrl,
          git_branch: 'main',
          // Keep existing build settings
          build_pack: fullAppDetails.build_pack || 'dockerfile',
        };
        
        console.log(`[Coolify] PATCH payload:`, JSON.stringify(updatePayload));
        
        const updateResponse = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updatePayload),
        });
        
        if (updateResponse.ok) {
          console.log(`[Coolify] Successfully updated git_repository to ${repoUrl}`);
          appDetails.git_repository = repoUrl;
          appDetails.git_branch = 'main';
          repoUpdated = true;
        } else {
          const errorText = await updateResponse.text();
          console.error(`[Coolify] Failed to update git_repository: ${updateResponse.status} - ${errorText}`);
          // Continue anyway - we'll try to deploy
        }
      } else {
        console.warn(`[Coolify] Could not fetch app details, will try to deploy anyway`);
      }
    } else {
      console.log(`[Coolify] git_repository already points to the correct repo`);
    }

    // Trigger deployment (not just restart) - this will pull latest from git
    console.log(`[Coolify] Triggering deployment for ${appUuid}...`);
    
    // Try deploy first (preferred - pulls latest git)
    let deploySuccess = false;
    const deployResponse = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}/deploy`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ force: true }),
    });

    if (deployResponse.ok) {
      console.log(`[Coolify] Deploy triggered successfully`);
      deploySuccess = true;
    } else {
      // Fallback to restart if deploy endpoint doesn't exist
      console.log(`[Coolify] Deploy endpoint failed, trying restart...`);
      const restartResponse = await fetch(`${coolifyUrl}/api/v1/applications/${appUuid}/restart`, {
        method: 'POST',
        headers,
      });
      
      if (restartResponse.ok) {
        console.log(`[Coolify] Restart triggered successfully`);
        deploySuccess = true;
      } else {
        const errorText = await restartResponse.text();
        console.error(`[Coolify] Restart failed: ${restartResponse.status} - ${errorText}`);
        return { 
          success: false, 
          error: `Erreur déploiement: ${restartResponse.status}`,
          appDetails,
          repoUpdated,
        };
      }
    }

    console.log(`[Coolify] Deployment triggered successfully`);
    return { 
      success: true, 
      deploymentUrl: appDetails.fqdn || undefined,
      appDetails,
      repoUpdated,
    };
  } catch (error) {
    console.error('[Coolify] Deployment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return { success: false, error: `Erreur Coolify: ${errorMessage}` };
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

    const { files, projectName, projectId, action, pendingPaymentId, selectedPaths, destinationOwner } = await req.json() as ProcessRequest & { 
      action?: string;
      pendingPaymentId?: string;
      selectedPaths?: string[];
    };

    // Fetch dynamic security limits from admin_config
    const dynamicLimits = await getDynamicSecurityLimits(supabase);
    console.log('[Liberation] Dynamic limits:', dynamicLimits);

    // Check Kill Switch - block all liberations if enabled
    if (dynamicLimits.KILL_SWITCH_ENABLED) {
      console.log('[Liberation] KILL SWITCH ACTIVE - Blocking liberation');
      return new Response(JSON.stringify({ 
        error: 'Le service de libération est temporairement suspendu. Veuillez réessayer plus tard.',
        killSwitch: true
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Dynamic limits check - Calculate quote instead of blocking
    let filesToProcess = files;
    const isOverLimit = files.length > dynamicLimits.MAX_FILES_PER_LIBERATION;
    
    if (isOverLimit && !pendingPaymentId && !selectedPaths) {
      // Return quote for large project instead of error
      const totalChars = files.reduce((sum, f) => sum + f.content.length, 0);
      const excessFiles = files.length - dynamicLimits.MAX_FILES_PER_LIBERATION;
      
      // Cost calculation
      const COST_PER_TOKEN_CENTS = 0.003;
      const CHARS_PER_TOKEN = 4;
      const TOKENS_OVERHEAD_PER_FILE = 150;
      const INOPAY_MARGIN = 2.5;
      
      const avgCharsPerFile = totalChars / files.length;
      const excessChars = excessFiles * avgCharsPerFile;
      const excessTokens = (excessChars / CHARS_PER_TOKEN) + (excessFiles * TOKENS_OVERHEAD_PER_FILE);
      const baseTokenCost = Math.ceil(excessTokens * COST_PER_TOKEN_CENTS);
      const supplementAmount = Math.max(500, Math.ceil(baseTokenCost * INOPAY_MARGIN));
      
      return new Response(JSON.stringify({ 
        requiresPayment: true,
        quote: {
          totalFiles: files.length,
          maxFilesAllowed: dynamicLimits.MAX_FILES_PER_LIBERATION,
          excessFiles,
          baseTokenCostCents: baseTokenCost,
          supplementAmountCents: supplementAmount,
          supplementFormatted: `$${(supplementAmount / 100).toFixed(2)} CAD`,
        },
        message: 'Projet de grande envergure détecté. Paiement requis ou nettoyage partiel disponible.',
      }), {
        status: 402, // Payment Required
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle partial cleaning (user selected specific folders)
    if (selectedPaths && selectedPaths.length > 0) {
      filesToProcess = files.filter(f => 
        selectedPaths.some(path => f.path.startsWith(path + '/') || f.path === path || f.path.startsWith(path))
      );
      console.log(`[Liberation] Partial cleaning: ${filesToProcess.length}/${files.length} files from paths: ${selectedPaths.join(', ')}`);
    }

    // Handle paid liberation - verify payment and mark as processed
    if (pendingPaymentId) {
      const { data: pendingPayment, error: paymentError } = await supabase
        .from('pending_liberation_payments')
        .select('*')
        .eq('id', pendingPaymentId)
        .eq('user_id', user.id)
        .single();

      if (paymentError || !pendingPayment) {
        return new Response(JSON.stringify({ error: 'Paiement non trouvé' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Type assertion for the pending payment
      const payment = pendingPayment as { status: string; id: string };

      if (payment.status !== 'paid') {
        return new Response(JSON.stringify({ 
          error: 'Paiement en attente',
          status: payment.status,
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Mark as processed
      await supabase
        .from('pending_liberation_payments')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', pendingPaymentId);

      console.log(`[Liberation] Paid liberation unlocked for payment ${pendingPaymentId}`);
    }

    // Get user settings for GitHub token
    const { data: settings } = await supabase
      .from('user_settings')
      .select('github_token, github_destination_username')
      .eq('user_id', user.id)
      .single();

    const githubToken = settings?.github_token;
    const storedDestinationOwner = settings?.github_destination_username;

    // Log admin notification - Liberation started
    try {
      const userEmail = user.email || 'Unknown';
      await supabase.from('admin_activity_logs').insert({
        action_type: 'liberation',
        title: `Libération démarrée: ${projectName}`,
        description: `Utilisateur ${userEmail} a lancé une libération de ${filesToProcess.length} fichiers`,
        status: 'processing',
        user_id: user.id,
        metadata: {
          project_name: projectName,
          project_id: projectId,
          total_files: filesToProcess.length,
          original_files: files.length,
          has_payment: !!pendingPaymentId,
          partial_paths: selectedPaths || null,
          destination_owner: destinationOwner || storedDestinationOwner || null
        }
      });
      console.log('[Liberation] Admin notified of liberation start');
    } catch (notifyError) {
      console.warn('[Liberation] Failed to notify admin:', notifyError);
    }

    // Phase 1: Clean files
    console.log(`[Liberation] Starting cleaning for ${projectName}, ${filesToProcess.length} files (original: ${files.length})`);
    
    const cleaningResults: CleaningResult[] = [];
    const cleanedFiles: { path: string; content: string }[] = [];
    const validationErrors: { path: string; error: string }[] = [];
    const assetAlerts: AssetSovereigntyResult['externalUrls'] = [];
    let totalChanges = 0;

    for (const file of filesToProcess) {
      // Skip lock files (Lock-file Purge)
      if (isLockFile(file.path)) {
        console.log(`[Liberation] Excluding lock file: ${file.path}`);
        continue;
      }

      // Skip files that are too large
      if (file.content.length > dynamicLimits.MAX_FILE_SIZE_CHARS) {
        console.log(`[Liberation] Skipping large file: ${file.path} (${file.content.length} chars)`);
        continue;
      }

      // Asset Sovereignty check
      const assetCheck = checkAssetSovereignty(file.path, file.content, true);
      if (assetCheck.hasExternalAssets) {
        assetAlerts.push(...assetCheck.externalUrls);
        console.log(`[Liberation] External assets detected in ${file.path}: ${assetCheck.externalUrls.length} URLs`);
      }

      // Use cleaned content if assets were replaced
      const contentToClean = assetCheck.cleanedContent || file.content;
      const result = cleanFileContent(file.path, contentToClean);
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

    // Auto-Polyfill: Generate compatibility layer for removed hooks
    const polyfillResult: PolyfillResult = generatePolyfills(files, cleanedFiles);
    
    if (polyfillResult.generated.length > 0) {
      console.log(`[Liberation] Generated ${polyfillResult.generated.length} polyfill files`);
      for (const polyfill of polyfillResult.generated) {
        cleanedFiles.push(polyfill);
      }
      totalChanges += polyfillResult.generated.length;
    }

    console.log(`[Liberation] Cleaned ${cleanedFiles.length} files, ${totalChanges} changes made, ${validationErrors.length} validation errors, ${assetAlerts.length} external assets`);

    // If only cleaning requested, return here
    if (action === 'clean-only') {
      return new Response(JSON.stringify({
        success: true,
        phase: 'cleaning',
        cleaningResults,
        cleanedFiles: cleanedFiles.length,
        files: cleanedFiles,
        totalChanges,
        validationErrors,
        assetAlerts,
        polyfillsGenerated: polyfillResult.generated.map(p => p.path),
        summary: {
          totalChanges,
          removedPatterns: cleaningResults.flatMap(r => r.changes.map((c: any) => c.type))
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Phase 2: Push to GitHub using optimized strategy
    let githubResult: { success: boolean; repoUrl: string | undefined; error: string } = { 
      success: false, 
      repoUrl: undefined, 
      error: 'Token GitHub non configuré' 
    };
    
    if (githubToken) {
      const repoName = `inopay-${projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
      const effectiveOwner = destinationOwner || storedDestinationOwner || null;
      
      console.log(`[Liberation] Pushing to GitHub: ${effectiveOwner || 'user'}/${repoName}`);
      
      const pushResult = await pushToGitHubOptimized(
        githubToken,
        repoName,
        effectiveOwner,
        cleanedFiles,
        `🚀 Libération Inopay - ${new Date().toLocaleDateString('fr-CA')}\n\n${totalChanges} modifications de nettoyage appliquées`
      );
      githubResult = {
        success: pushResult.success,
        repoUrl: pushResult.repoUrl,
        error: pushResult.error || '',
      };
    }

    // Phase 3: Trigger Coolify deployment (even if GitHub failed partially)
    let coolifyResult: { success: boolean; deploymentUrl: string | undefined; error: string } = { 
      success: false, 
      deploymentUrl: undefined, 
      error: 'Non configuré' 
    };

    // Get server with Coolify config
    const { data: servers } = await supabase
      .from('user_servers')
      .select('coolify_url, coolify_token')
      .eq('user_id', user.id)
      .not('coolify_token', 'is', null)
      .limit(1);

    if (servers && servers.length > 0 && servers[0].coolify_url && servers[0].coolify_token) {
      // Try Coolify deployment
      const repoUrlToUse = githubResult.repoUrl || `https://github.com/fofanay/inopay`;
      
      console.log(`[Liberation] Triggering Coolify deployment with repo: ${repoUrlToUse}`);
      
      const deployResult = await triggerCoolifyDeployment(
        servers[0].coolify_url,
        servers[0].coolify_token,
        repoUrlToUse,
        projectName
      );
      coolifyResult = {
        success: deployResult.success,
        deploymentUrl: deployResult.deploymentUrl,
        error: deployResult.error || '',
      };
      
      // If Coolify succeeded but GitHub failed, note this
      if (coolifyResult.success && !githubResult.success) {
        console.log(`[Liberation] Coolify deployed successfully despite GitHub failure`);
        coolifyResult.error = 'Déployé avec le dépôt source (GitHub push a échoué)';
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
          lockFilesExcluded: files.filter(f => isLockFile(f.path)).map(f => f.path),
          assetAlerts: assetAlerts.length > 0 ? {
            count: assetAlerts.length,
            message: 'Ressources externes détectées - URLs remplacées par des placeholders',
            details: assetAlerts,
          } : null,
          polyfills: polyfillResult.generated.length > 0 ? {
            count: polyfillResult.generated.length,
            files: polyfillResult.generated.map(p => p.path),
            importUpdates: polyfillResult.importUpdates,
          } : null,
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
