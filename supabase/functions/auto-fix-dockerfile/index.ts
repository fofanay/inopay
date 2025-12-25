import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Corrected Dockerfile template that uses npm install instead of npm ci
const CORRECTED_DOCKERFILE = `# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb* ./

# Install dependencies - using npm install for compatibility
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration if exists
COPY nginx.conf /etc/nginx/conf.d/default.conf 2>/dev/null || echo "Using default nginx config"

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;

// Nginx config for SPA routing
const NGINX_CONFIG = `server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # SPA routing - all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
`;

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

    const { github_repo_url, fix_type = 'npm_install' } = await req.json();

    if (!github_repo_url) {
      return new Response(
        JSON.stringify({ error: 'github_repo_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[auto-fix-dockerfile] Starting fix for ${github_repo_url}, type: ${fix_type}`);

    // Get GitHub token
    const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: 'GitHub token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse GitHub URL
    const urlMatch = github_repo_url.match(/github\.com[/:]([^/]+)\/([^/.#?\s]+)/i);
    if (!urlMatch) {
      return new Response(
        JSON.stringify({ error: 'Invalid GitHub URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [, owner, repo] = urlMatch;
    const repoClean = repo.replace(/\.git$/, '');
    
    console.log(`[auto-fix-dockerfile] Repo: ${owner}/${repoClean}`);

    const githubHeaders = {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    // Step 1: Get the default branch
    const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}`, {
      headers: githubHeaders
    });

    if (!repoInfoRes.ok) {
      const errText = await repoInfoRes.text();
      console.error('[auto-fix-dockerfile] Repo info error:', errText);
      return new Response(
        JSON.stringify({ error: `Cannot access repository: ${repoInfoRes.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const repoInfo = await repoInfoRes.json();
    const defaultBranch = repoInfo.default_branch || 'main';
    console.log(`[auto-fix-dockerfile] Default branch: ${defaultBranch}`);

    // Step 2: Get the current commit SHA of the branch
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}/git/ref/heads/${defaultBranch}`, {
      headers: githubHeaders
    });

    if (!refRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Cannot get branch reference' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const refData = await refRes.json();
    const currentCommitSha = refData.object.sha;
    console.log(`[auto-fix-dockerfile] Current commit SHA: ${currentCommitSha}`);

    // Step 3: Get the current tree
    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}/git/commits/${currentCommitSha}`, {
      headers: githubHeaders
    });

    if (!commitRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Cannot get commit details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const commitData = await commitRes.json();
    const currentTreeSha = commitData.tree.sha;

    // Step 4: Create blobs for the new files
    const filesToAdd: Array<{ path: string; content: string }> = [];
    
    if (fix_type === 'npm_install' || fix_type === 'patch_dockerfile_npm_install') {
      filesToAdd.push({ path: 'Dockerfile', content: CORRECTED_DOCKERFILE });
      filesToAdd.push({ path: 'nginx.conf', content: NGINX_CONFIG });
    }

    const blobPromises = filesToAdd.map(async (file) => {
      const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}/git/blobs`, {
        method: 'POST',
        headers: githubHeaders,
        body: JSON.stringify({
          content: file.content,
          encoding: 'utf-8'
        })
      });
      
      if (!blobRes.ok) {
        throw new Error(`Failed to create blob for ${file.path}`);
      }
      
      const blobData = await blobRes.json();
      return {
        path: file.path,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      };
    });

    const treeEntries = await Promise.all(blobPromises);
    console.log(`[auto-fix-dockerfile] Created ${treeEntries.length} blobs`);

    // Step 5: Create a new tree
    const newTreeRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}/git/trees`, {
      method: 'POST',
      headers: githubHeaders,
      body: JSON.stringify({
        base_tree: currentTreeSha,
        tree: treeEntries
      })
    });

    if (!newTreeRes.ok) {
      const errText = await newTreeRes.text();
      console.error('[auto-fix-dockerfile] Tree creation error:', errText);
      return new Response(
        JSON.stringify({ error: 'Failed to create tree' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newTreeData = await newTreeRes.json();
    const newTreeSha = newTreeData.sha;

    // Step 6: Create a new commit
    const commitMessage = fix_type === 'npm_install' || fix_type === 'patch_dockerfile_npm_install'
      ? '🔧 Auto-fix: Replace npm ci with npm install in Dockerfile\n\nThis fix resolves the npm ci error when package-lock.json is missing.\nGenerated by Inopay Deployment Assistant.'
      : '🔧 Auto-fix: Update Dockerfile\n\nGenerated by Inopay Deployment Assistant.';

    const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}/git/commits`, {
      method: 'POST',
      headers: githubHeaders,
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeSha,
        parents: [currentCommitSha]
      })
    });

    if (!newCommitRes.ok) {
      const errText = await newCommitRes.text();
      console.error('[auto-fix-dockerfile] Commit creation error:', errText);
      return new Response(
        JSON.stringify({ error: 'Failed to create commit' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData.sha;
    console.log(`[auto-fix-dockerfile] New commit SHA: ${newCommitSha}`);

    // Step 7: Update the branch reference
    const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}/git/refs/heads/${defaultBranch}`, {
      method: 'PATCH',
      headers: githubHeaders,
      body: JSON.stringify({
        sha: newCommitSha,
        force: false
      })
    });

    if (!updateRefRes.ok) {
      const errText = await updateRefRes.text();
      console.error('[auto-fix-dockerfile] Ref update error:', errText);
      return new Response(
        JSON.stringify({ error: 'Failed to update branch reference' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[auto-fix-dockerfile] Successfully pushed fix');

    // Log activity
    await supabase.from('admin_activity_logs').insert({
      user_id: user.id,
      action_type: 'auto_fix_dockerfile',
      title: 'Auto-fix Dockerfile',
      description: `Fixed Dockerfile in ${owner}/${repoClean} (${fix_type})`,
      status: 'success',
      metadata: {
        github_repo: `${owner}/${repoClean}`,
        fix_type,
        commit_sha: newCommitSha,
        branch: defaultBranch
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Dockerfile corrigé et commité avec succès',
        commit_sha: newCommitSha,
        branch: defaultBranch,
        files_modified: filesToAdd.map(f => f.path),
        commit_url: `https://github.com/${owner}/${repoClean}/commit/${newCommitSha}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[auto-fix-dockerfile] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
