import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PreDeployCheckResult {
  ready: boolean;
  actions_taken: string[];
  commit_sha: string;
  branch: string;
  warnings: string[];
  blocking_errors: string[];
  env_vars_needed: { key: string; suggested_value?: string; is_build_time: boolean }[];
  dockerfile_status: 'exists_valid' | 'exists_fixed' | 'generated' | 'missing' | 'invalid' | 'github_fetch_failed';
  dockerfile_proof?: {
    raw_content?: string;
    copy_package_line?: number;
    npm_install_line?: number;
    is_valid: boolean;
  };
  github_info?: {
    owner: string;
    repo: string;
    has_write_permission: boolean;
    permission_level?: string;
    dockerfile_fetched: boolean;
    dockerfile_raw?: string;
  };
  checks: {
    coolify_connection: boolean;
    github_access: boolean;
    github_write_permission: boolean;
    package_json: boolean;
    dockerfile: boolean;
    dockerfile_verified: boolean;
    env_vars: boolean;
  };
}

// Corrected Dockerfile template - CRITICAL: COPY package.json MUST come BEFORE npm install
// Includes ARG/ENV for Vite build-time variables
const CORRECTED_DOCKERFILE = `# ============================================
# Auto-generated Dockerfile by Inopay
# Optimized for Vite/React projects with Supabase
# ============================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# CRITICAL: Copy package files FIRST (before any npm commands)
COPY package.json ./
COPY package-lock.json* bun.lockb* ./

# Install dependencies (uses npm install for compatibility)
RUN npm install --legacy-peer-deps

# Copy all source files AFTER dependencies are installed
COPY . .

# Build arguments for Vite (passed from Coolify as build-time env vars)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_SUPABASE_ANON_KEY

# Set environment variables for the build process
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine AS production

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
`;

const NGINX_CONFIG = `server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;

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

// Line-by-line Dockerfile analysis - returns true if COPY package.json comes BEFORE npm install
function analyzeDockerfile(content: string): { 
  isValid: boolean; 
  copyPackageLine?: number; 
  npmInstallLine?: number; 
  details: string;
} {
  const lines = content.split('\n');
  let copyPackageLine: number | undefined;
  let npmInstallLine: number | undefined;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmedLine = line.trim().toUpperCase();
    
    // Find COPY package.json (first occurrence)
    if (trimmedLine.startsWith('COPY') && 
        (line.toLowerCase().includes('package.json') || line.toLowerCase().includes('package*.json'))) {
      if (!copyPackageLine) {
        copyPackageLine = lineNum;
      }
    }

    // Find RUN npm install or npm ci (first occurrence)
    if (trimmedLine.startsWith('RUN') && 
        (line.toLowerCase().includes('npm install') || line.toLowerCase().includes('npm ci'))) {
      if (!npmInstallLine) {
        npmInstallLine = lineNum;
      }
    }
  });

  // Valid = COPY package.json exists AND comes BEFORE npm install
  if (!copyPackageLine) {
    return { 
      isValid: false, 
      copyPackageLine, 
      npmInstallLine, 
      details: 'COPY package.json not found in Dockerfile' 
    };
  }

  if (!npmInstallLine) {
    return { 
      isValid: true, 
      copyPackageLine, 
      npmInstallLine, 
      details: 'No npm install found (might use different build method)' 
    };
  }

  if (copyPackageLine < npmInstallLine) {
    return { 
      isValid: true, 
      copyPackageLine, 
      npmInstallLine, 
      details: `Valid: COPY package.json (line ${copyPackageLine}) before npm install (line ${npmInstallLine})` 
    };
  }

  return { 
    isValid: false, 
    copyPackageLine, 
    npmInstallLine, 
    details: `BROKEN: npm install (line ${npmInstallLine}) comes BEFORE COPY package.json (line ${copyPackageLine})` 
  };
}

// Fetch raw Dockerfile content from GitHub
async function fetchDockerfileRaw(
  owner: string, 
  repo: string, 
  branch: string, 
  headers: Record<string, string>
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/Dockerfile?ref=${branch}`,
      { headers: { ...headers, 'Accept': 'application/vnd.github.v3.raw' } }
    );
    if (res.ok) {
      return await res.text();
    }
    return null;
  } catch {
    return null;
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
      github_repo_url, 
      project_name, 
      auto_fix = true,
      skip_dockerfile_fix = false 
    } = await req.json();

    if (!server_id || !github_repo_url) {
      return new Response(
        JSON.stringify({ error: 'server_id and github_repo_url are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[pre-deploy-check] Starting for ${github_repo_url}`);

    const result: PreDeployCheckResult = {
      ready: false,
      actions_taken: [],
      commit_sha: '',
      branch: 'main',
      warnings: [],
      blocking_errors: [],
      env_vars_needed: [],
      dockerfile_status: 'missing',
      checks: {
        coolify_connection: false,
        github_access: false,
        github_write_permission: false,
        package_json: false,
        dockerfile: false,
        dockerfile_verified: false,
        env_vars: false
      }
    };

    // Get server info
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('*')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server) {
      result.blocking_errors.push('Serveur non trouvé');
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // CHECK 1: Coolify connection
    console.log('[pre-deploy-check] Check 1: Coolify connection');
    if (server.coolify_url && server.coolify_token) {
      try {
        const coolifyUrl = normalizeCoolifyUrl(server.coolify_url);
        const versionRes = await fetch(`${coolifyUrl}/api/v1/version`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${server.coolify_token}`,
            'Accept': 'application/json'
          }
        });
        
        if (versionRes.ok) {
          result.checks.coolify_connection = true;
          console.log('[pre-deploy-check] Coolify connection OK');
        } else {
          result.blocking_errors.push('Connexion Coolify échouée - vérifiez le token');
        }
      } catch (e) {
        result.blocking_errors.push(`Coolify inaccessible: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      result.blocking_errors.push('Coolify non configuré sur ce serveur');
    }

    // CHECK 2: GitHub access
    console.log('[pre-deploy-check] Check 2: GitHub access');
    const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
    const urlMatch = github_repo_url.match(/github\.com[/:]([^/]+)\/([^/.#?\s]+)/i);
    
    if (!urlMatch) {
      result.blocking_errors.push('URL GitHub invalide');
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const [, owner, repo] = urlMatch;
    const repoClean = repo.replace(/\.git$/, '');

    const githubHeaders: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Inopay-Deployer'
    };
    if (githubToken) {
      githubHeaders['Authorization'] = `Bearer ${githubToken}`;
    }

    let defaultBranch = 'main';
    let currentCommitSha = '';

    let hasWritePermission = false;
    let permissionLevel = 'none';
    
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}`, { headers: githubHeaders });
      if (repoRes.ok) {
        const repoData = await repoRes.json();
        defaultBranch = repoData.default_branch || 'main';
        result.branch = defaultBranch;
        result.checks.github_access = true;
        
        // Check permissions from repo data
        if (repoData.permissions) {
          hasWritePermission = repoData.permissions.push === true || repoData.permissions.admin === true;
          permissionLevel = repoData.permissions.admin ? 'admin' : 
                           repoData.permissions.push ? 'write' : 
                           repoData.permissions.pull ? 'read' : 'none';
        }
        
        result.checks.github_write_permission = hasWritePermission;
        
        // Store GitHub info for UI
        result.github_info = {
          owner,
          repo: repoClean,
          has_write_permission: hasWritePermission,
          permission_level: permissionLevel,
          dockerfile_fetched: false
        };
        
        console.log(`[pre-deploy-check] GitHub access OK, branch: ${defaultBranch}, permission: ${permissionLevel}, write: ${hasWritePermission}`);
      } else {
        const errorText = await repoRes.text();
        console.error(`[pre-deploy-check] GitHub repo access failed: ${repoRes.status} - ${errorText}`);
        result.github_info = {
          owner,
          repo: repoClean,
          has_write_permission: false,
          permission_level: 'error',
          dockerfile_fetched: false
        };
        result.blocking_errors.push(`Dépôt GitHub inaccessible (${repoRes.status}). Vérifiez que le repo "${owner}/${repoClean}" existe et que le token a les droits d'accès.`);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      result.blocking_errors.push(`Erreur accès GitHub: ${e instanceof Error ? e.message : String(e)}`);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get current commit SHA
    try {
      const refRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}/git/ref/heads/${defaultBranch}`, { headers: githubHeaders });
      if (refRes.ok) {
        const refData = await refRes.json();
        currentCommitSha = refData.object.sha;
        result.commit_sha = currentCommitSha;
      }
    } catch (e) {
      console.warn('[pre-deploy-check] Could not get commit SHA');
    }

    // CHECK 3: package.json
    console.log('[pre-deploy-check] Check 3: package.json');
    let files: string[] = [];
    try {
      const contentsRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}/contents/?ref=${defaultBranch}`, { headers: githubHeaders });
      if (contentsRes.ok) {
        const contents = await contentsRes.json();
        files = contents.map((f: { name: string }) => f.name);
        
        if (files.includes('package.json')) {
          result.checks.package_json = true;
          console.log('[pre-deploy-check] package.json found');
        } else {
          result.blocking_errors.push('package.json manquant à la racine du dépôt');
        }

        // Check for package-lock.json
        if (!files.includes('package-lock.json') && !files.includes('bun.lockb')) {
          result.warnings.push('package-lock.json manquant - npm install sera utilisé à la place de npm ci');
        }
      }
    } catch (e) {
      result.blocking_errors.push(`Erreur lecture dépôt: ${e instanceof Error ? e.message : String(e)}`);
    }

    // CHECK 4: Dockerfile - ROBUST LINE-BY-LINE ANALYSIS
    console.log('[pre-deploy-check] Check 4: Dockerfile analysis');
    
    let dockerfileContent = await fetchDockerfileRaw(owner, repoClean, defaultBranch, githubHeaders);
    
    // Log raw content for debugging
    if (dockerfileContent) {
      console.log(`[pre-deploy-check] Dockerfile fetched (${dockerfileContent.length} bytes)`);
      console.log(`[pre-deploy-check] Dockerfile first 200 chars: ${dockerfileContent.slice(0, 200).replace(/\n/g, '\\n')}`);
      
      if (result.github_info) {
        result.github_info.dockerfile_fetched = true;
        result.github_info.dockerfile_raw = dockerfileContent.slice(0, 1000); // Store first 1000 chars for UI
      }
      
      // Analyze the current Dockerfile
      const analysis = analyzeDockerfile(dockerfileContent);
      console.log(`[pre-deploy-check] Dockerfile analysis: ${analysis.details}`);
      
      result.dockerfile_proof = {
        raw_content: dockerfileContent.slice(0, 500),
        copy_package_line: analysis.copyPackageLine,
        npm_install_line: analysis.npmInstallLine,
        is_valid: analysis.isValid
      };

      if (!analysis.isValid) {
        result.dockerfile_status = 'invalid';
        result.warnings.push(`Dockerfile cassé: ${analysis.details}`);
        
        // Check if we should attempt auto-fix
        if (skip_dockerfile_fix) {
          console.log('[pre-deploy-check] Auto-fix skipped by user request');
          result.warnings.push('Auto-correction du Dockerfile désactivée par l\'utilisateur');
        } else if (!githubToken) {
          console.log('[pre-deploy-check] No GitHub token available for auto-fix');
          result.blocking_errors.push('Token GitHub non configuré - impossible de corriger automatiquement');
        } else if (!hasWritePermission) {
          console.log('[pre-deploy-check] No write permission on GitHub repo');
          result.blocking_errors.push(`Token GitHub sans droits d'écriture (niveau: ${permissionLevel}). Veuillez utiliser un token avec les droits "Contents: write" ou corriger le Dockerfile manuellement.`);
        } else if (auto_fix) {
          console.log('[pre-deploy-check] Auto-fixing Dockerfile...');
          
          try {
            const commitTreeSha = await getTreeSha(owner, repoClean, currentCommitSha, githubHeaders);
            const dockerBlob = await createBlob(owner, repoClean, CORRECTED_DOCKERFILE, githubHeaders);
            const nginxBlob = await createBlob(owner, repoClean, NGINX_CONFIG, githubHeaders);
            
            const newTree = await createTree(owner, repoClean, commitTreeSha, [
              { path: 'Dockerfile', mode: '100644', type: 'blob', sha: dockerBlob },
              { path: 'nginx.conf', mode: '100644', type: 'blob', sha: nginxBlob }
            ], githubHeaders);
            
            const newCommit = await createCommit(
              owner, repoClean, 
              '🔧 Pre-deploy fix: Corrected Dockerfile (COPY package.json before npm install)', 
              newTree, 
              currentCommitSha, 
              githubHeaders
            );
            
            const updateSuccess = await updateRef(owner, repoClean, defaultBranch, newCommit, githubHeaders);
            
            if (updateSuccess) {
              console.log(`[pre-deploy-check] Fix pushed successfully: ${newCommit}`);
              result.commit_sha = newCommit;
              result.actions_taken.push('Dockerfile corrigé automatiquement');
              
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              const verifiedContent = await fetchDockerfileRaw(owner, repoClean, defaultBranch, githubHeaders);
              if (verifiedContent) {
                const verifyAnalysis = analyzeDockerfile(verifiedContent);
                console.log(`[pre-deploy-check] Verification: ${verifyAnalysis.details}`);
                
                result.dockerfile_proof = {
                  raw_content: verifiedContent.slice(0, 500),
                  copy_package_line: verifyAnalysis.copyPackageLine,
                  npm_install_line: verifyAnalysis.npmInstallLine,
                  is_valid: verifyAnalysis.isValid
                };
                
                if (verifyAnalysis.isValid) {
                  result.dockerfile_status = 'exists_fixed';
                  result.checks.dockerfile = true;
                  result.checks.dockerfile_verified = true;
                  console.log('[pre-deploy-check] Dockerfile verified as FIXED');
                } else {
                  result.blocking_errors.push(`Fix non appliqué: ${verifyAnalysis.details}`);
                  result.dockerfile_status = 'invalid';
                }
              } else {
                result.blocking_errors.push('Impossible de vérifier le Dockerfile après correction');
              }
            } else {
              result.blocking_errors.push('Échec de mise à jour de la branche - branche protégée?');
            }
          } catch (fixError) {
            console.error('[pre-deploy-check] Fix error:', fixError);
            result.blocking_errors.push(`Erreur correction: ${fixError instanceof Error ? fixError.message : String(fixError)}`);
          }
        } else {
          result.blocking_errors.push('Dockerfile invalide et auto-fix désactivé');
        }
      }
    } else {
      // Dockerfile could not be fetched from GitHub
      console.log(`[pre-deploy-check] Dockerfile fetch failed for ${owner}/${repoClean}`);
      result.dockerfile_status = 'github_fetch_failed';
      
      if (result.github_info) {
        result.github_info.dockerfile_fetched = false;
      }
      
      if (files.includes('Dockerfile')) {
        // Dockerfile exists in file list but couldn't be read via raw API
        result.warnings.push('Dockerfile existe mais impossible à lire via l\'API GitHub - vérifiez les permissions');
        result.blocking_errors.push(`Impossible de lire le Dockerfile depuis ${owner}/${repoClean}. Vérifiez que le repo est correct et accessible.`);
      } else if (!skip_dockerfile_fix && auto_fix && githubToken && hasWritePermission) {
        // No Dockerfile - generate one
        console.log('[pre-deploy-check] Generating Dockerfile...');
        
        try {
          const commitTreeSha = await getTreeSha(owner, repoClean, currentCommitSha, githubHeaders);
          
          const dockerBlob = await createBlob(owner, repoClean, CORRECTED_DOCKERFILE, githubHeaders);
          const nginxBlob = await createBlob(owner, repoClean, NGINX_CONFIG, githubHeaders);
          
          const newTree = await createTree(owner, repoClean, commitTreeSha, [
            { path: 'Dockerfile', mode: '100644', type: 'blob', sha: dockerBlob },
            { path: 'nginx.conf', mode: '100644', type: 'blob', sha: nginxBlob }
          ], githubHeaders);
          
          const newCommit = await createCommit(
            owner, repoClean,
            '🔧 Pre-deploy: Generated Dockerfile for deployment',
            newTree,
            currentCommitSha,
            githubHeaders
          );
          
          const updateSuccess = await updateRef(owner, repoClean, defaultBranch, newCommit, githubHeaders);
          
          if (updateSuccess) {
            result.commit_sha = newCommit;
            result.dockerfile_status = 'generated';
            result.actions_taken.push('Dockerfile généré automatiquement');
            result.checks.dockerfile = true;
            
            // Verify generation
            await new Promise(resolve => setTimeout(resolve, 2000));
            const verifiedContent = await fetchDockerfileRaw(owner, repoClean, defaultBranch, githubHeaders);
            if (verifiedContent) {
              const verifyAnalysis = analyzeDockerfile(verifiedContent);
              result.checks.dockerfile_verified = verifyAnalysis.isValid;
              result.dockerfile_proof = {
                raw_content: verifiedContent.slice(0, 500),
                copy_package_line: verifyAnalysis.copyPackageLine,
                npm_install_line: verifyAnalysis.npmInstallLine,
                is_valid: verifyAnalysis.isValid
              };
            }
          } else {
            result.blocking_errors.push('Échec de création du Dockerfile - branche protégée ou token insuffisant');
          }
        } catch (genError) {
          console.error('[pre-deploy-check] Generate error:', genError);
          result.blocking_errors.push(`Erreur génération Dockerfile: ${genError instanceof Error ? genError.message : String(genError)}`);
        }
      } else if (!hasWritePermission && !skip_dockerfile_fix) {
        result.blocking_errors.push(`Dockerfile manquant et token GitHub sans droits d'écriture (niveau: ${permissionLevel})`);
      } else if (skip_dockerfile_fix) {
        result.blocking_errors.push('Dockerfile manquant et auto-correction désactivée');
      } else {
        result.blocking_errors.push('Dockerfile manquant et auto-fix désactivé');
      }
    }

    // CHECK 5: Environment variables
    console.log('[pre-deploy-check] Check 5: Environment variables');
    const supabaseEnvUrl = Deno.env.get('SUPABASE_URL');
    const supabaseEnvKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    result.env_vars_needed = [
      { key: 'VITE_SUPABASE_URL', suggested_value: supabaseEnvUrl, is_build_time: true },
      { key: 'VITE_SUPABASE_PUBLISHABLE_KEY', suggested_value: supabaseEnvKey, is_build_time: true },
      { key: 'VITE_SUPABASE_ANON_KEY', suggested_value: supabaseEnvKey, is_build_time: true },
      { key: 'NODE_ENV', suggested_value: 'production', is_build_time: true }
    ];
    result.checks.env_vars = true;

    // Final readiness check - MUST have verified dockerfile
    result.ready = result.blocking_errors.length === 0 && 
      result.checks.coolify_connection && 
      result.checks.github_access && 
      result.checks.package_json && 
      result.checks.dockerfile &&
      result.checks.dockerfile_verified;

    console.log(`[pre-deploy-check] Completed. Ready: ${result.ready}, Actions: ${result.actions_taken.length}, Errors: ${result.blocking_errors.length}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[pre-deploy-check] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        ready: false,
        blocking_errors: [error instanceof Error ? error.message : 'Unknown error']
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper functions for GitHub API
async function getTreeSha(owner: string, repo: string, commitSha: string, headers: Record<string, string>): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${commitSha}`, { headers });
  const data = await res.json();
  return data.tree.sha;
}

async function createBlob(owner: string, repo: string, content: string, headers: Record<string, string>): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, encoding: 'utf-8' })
  });
  const data = await res.json();
  if (!data.sha) {
    throw new Error(`Failed to create blob: ${JSON.stringify(data)}`);
  }
  return data.sha;
}

async function createTree(
  owner: string, 
  repo: string, 
  baseTree: string, 
  entries: Array<{ path: string; mode: string; type: string; sha: string }>,
  headers: Record<string, string>
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTree, tree: entries })
  });
  const data = await res.json();
  if (!data.sha) {
    throw new Error(`Failed to create tree: ${JSON.stringify(data)}`);
  }
  return data.sha;
}

async function createCommit(
  owner: string, 
  repo: string, 
  message: string, 
  tree: string, 
  parent: string,
  headers: Record<string, string>
): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree, parents: [parent] })
  });
  const data = await res.json();
  if (!data.sha) {
    throw new Error(`Failed to create commit: ${JSON.stringify(data)}`);
  }
  return data.sha;
}

async function updateRef(
  owner: string, 
  repo: string, 
  branch: string, 
  sha: string,
  headers: Record<string, string>
): Promise<boolean> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha, force: true }) // Use force: true to ensure push
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[pre-deploy-check] updateRef failed: ${res.status} - ${errorText}`);
    return false;
  }
  
  // Verify the ref was updated
  const verifyRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
  if (verifyRes.ok) {
    const verifyData = await verifyRes.json();
    return verifyData.object.sha === sha;
  }
  
  return false;
}
