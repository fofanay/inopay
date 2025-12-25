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
  dockerfile_status: 'exists_valid' | 'exists_fixed' | 'generated' | 'missing';
  checks: {
    coolify_connection: boolean;
    github_access: boolean;
    package_json: boolean;
    dockerfile: boolean;
    env_vars: boolean;
  };
}

// Corrected Dockerfile template
const CORRECTED_DOCKERFILE = `# Auto-generated Dockerfile by Inopay
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json ./
COPY package-lock.json* bun.lockb* ./
RUN npm install --legacy-peer-deps
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
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

    const { server_id, github_repo_url, project_name, auto_fix = true } = await req.json();

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
        package_json: false,
        dockerfile: false,
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

    try {
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}`, { headers: githubHeaders });
      if (repoRes.ok) {
        const repoData = await repoRes.json();
        defaultBranch = repoData.default_branch || 'main';
        result.branch = defaultBranch;
        result.checks.github_access = true;
        console.log(`[pre-deploy-check] GitHub access OK, branch: ${defaultBranch}`);
      } else {
        result.blocking_errors.push(`Dépôt GitHub inaccessible (${repoRes.status})`);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch (e) {
      result.blocking_errors.push('Erreur accès GitHub');
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
    try {
      const contentsRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}/contents/?ref=${defaultBranch}`, { headers: githubHeaders });
      if (contentsRes.ok) {
        const contents = await contentsRes.json();
        const files = contents.map((f: { name: string }) => f.name);
        
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

        // CHECK 4: Dockerfile
        console.log('[pre-deploy-check] Check 4: Dockerfile');
        if (files.includes('Dockerfile')) {
          // Check Dockerfile content for broken patterns
          const dockerfileRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}/contents/Dockerfile?ref=${defaultBranch}`, { headers: githubHeaders });
          if (dockerfileRes.ok) {
            const dockerfileData = await dockerfileRes.json();
            const dockerfileContent = atob(dockerfileData.content.replace(/\n/g, ''));
            
            // Check for broken pattern: RUN npm install before COPY package.json
            const hasBrokenPattern = /RUN\s+(npm\s+(install|ci)|yarn\s+install)/.test(dockerfileContent) &&
              !(/COPY\s+package\.json/.test(dockerfileContent.split(/RUN\s+(npm\s+(install|ci)|yarn\s+install)/)[0]));
            
            const usesNpmCi = /npm\s+ci/.test(dockerfileContent);
            
            if (hasBrokenPattern || usesNpmCi) {
              result.warnings.push('Dockerfile avec pattern problématique détecté');
              
              if (auto_fix && githubToken) {
                // Fix the Dockerfile
                console.log('[pre-deploy-check] Fixing Dockerfile...');
                
                const commitTreeSha = await getTreeSha(owner, repoClean, currentCommitSha, githubHeaders);
                
                // Create blobs
                const dockerBlob = await createBlob(owner, repoClean, CORRECTED_DOCKERFILE, githubHeaders);
                const nginxBlob = await createBlob(owner, repoClean, NGINX_CONFIG, githubHeaders);
                
                // Create tree
                const newTree = await createTree(owner, repoClean, commitTreeSha, [
                  { path: 'Dockerfile', mode: '100644', type: 'blob', sha: dockerBlob },
                  { path: 'nginx.conf', mode: '100644', type: 'blob', sha: nginxBlob }
                ], githubHeaders);
                
                // Create commit
                const newCommit = await createCommit(
                  owner, repoClean, 
                  '🔧 Pre-deploy fix: Corrected Dockerfile for deployment', 
                  newTree, 
                  currentCommitSha, 
                  githubHeaders
                );
                
                // Update ref
                await updateRef(owner, repoClean, defaultBranch, newCommit, githubHeaders);
                
                result.commit_sha = newCommit;
                result.dockerfile_status = 'exists_fixed';
                result.actions_taken.push('Dockerfile corrigé automatiquement');
                result.checks.dockerfile = true;
              } else {
                result.dockerfile_status = 'missing';
              }
            } else {
              result.dockerfile_status = 'exists_valid';
              result.checks.dockerfile = true;
            }
          }
        } else if (auto_fix && githubToken) {
          // Generate Dockerfile
          console.log('[pre-deploy-check] Generating Dockerfile...');
          
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
          
          await updateRef(owner, repoClean, defaultBranch, newCommit, githubHeaders);
          
          result.commit_sha = newCommit;
          result.dockerfile_status = 'generated';
          result.actions_taken.push('Dockerfile généré automatiquement');
          result.checks.dockerfile = true;
        } else {
          result.blocking_errors.push('Dockerfile manquant et auto-fix désactivé');
        }
      }
    } catch (e) {
      result.blocking_errors.push(`Erreur lecture dépôt: ${e instanceof Error ? e.message : String(e)}`);
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

    // Final readiness check
    result.ready = result.blocking_errors.length === 0 && 
      result.checks.coolify_connection && 
      result.checks.github_access && 
      result.checks.package_json && 
      result.checks.dockerfile;

    console.log(`[pre-deploy-check] Completed. Ready: ${result.ready}, Actions: ${result.actions_taken.length}`);

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
  return data.sha;
}

async function updateRef(
  owner: string, 
  repo: string, 
  branch: string, 
  sha: string,
  headers: Record<string, string>
): Promise<void> {
  await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha, force: false })
  });
}
