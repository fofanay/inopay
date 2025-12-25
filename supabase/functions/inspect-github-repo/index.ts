import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DockerfileAnalysis {
  exists: boolean;
  content?: string;
  has_broken_pattern: boolean;
  broken_pattern_details?: string;
  has_copy_package_before_install: boolean;
  line_numbers?: {
    copy_package?: number;
    npm_install?: number;
  };
}

interface InspectionResult {
  valid: boolean;
  owner: string;
  repo: string;
  default_branch: string;
  root_files: string[];
  has_package_json: boolean;
  has_dockerfile: boolean;
  has_package_lock: boolean;
  has_bun_lockb: boolean;
  dockerfile_analysis: DockerfileAnalysis;
  warnings: string[];
  errors: string[];
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

    const { github_repo_url, branch } = await req.json();

    if (!github_repo_url) {
      return new Response(
        JSON.stringify({ error: 'github_repo_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[inspect-github-repo] Inspecting ${github_repo_url}`);

    // Get GitHub token
    const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
    if (!githubToken) {
      return new Response(
        JSON.stringify({ error: 'GitHub token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse GitHub URL - handle multiple formats
    let owner = '';
    let repo = '';
    
    const cleanUrl = github_repo_url.trim();
    
    // Format: owner/repo or /owner/repo
    const shortMatch = cleanUrl.match(/^\/?([^/]+)\/([^/\s.#?]+)$/);
    if (shortMatch) {
      owner = shortMatch[1];
      repo = shortMatch[2];
    } else {
      // Format: full GitHub URL
      const urlMatch = cleanUrl.match(/github\.com[/:]([^/]+)\/([^/.#?\s]+)/i);
      if (urlMatch) {
        owner = urlMatch[1];
        repo = urlMatch[2];
      }
    }

    if (!owner || !repo) {
      return new Response(
        JSON.stringify({ error: 'Invalid GitHub URL format', valid: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    repo = repo.replace(/\.git$/, '');
    console.log(`[inspect-github-repo] Parsed: ${owner}/${repo}`);

    const githubHeaders = {
      'Authorization': `Bearer ${githubToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    const result: InspectionResult = {
      valid: false,
      owner,
      repo,
      default_branch: '',
      root_files: [],
      has_package_json: false,
      has_dockerfile: false,
      has_package_lock: false,
      has_bun_lockb: false,
      dockerfile_analysis: {
        exists: false,
        has_broken_pattern: false,
        has_copy_package_before_install: false
      },
      warnings: [],
      errors: []
    };

    // Step 1: Get repository info to find default branch
    const repoInfoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubHeaders
    });

    if (!repoInfoRes.ok) {
      if (repoInfoRes.status === 404) {
        result.errors.push('Dépôt introuvable ou inaccessible');
      } else {
        result.errors.push(`Erreur GitHub: ${repoInfoRes.status}`);
      }
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const repoInfo = await repoInfoRes.json();
    result.default_branch = branch || repoInfo.default_branch || 'main';
    console.log(`[inspect-github-repo] Default branch: ${result.default_branch}`);

    // Step 2: List files at root of the branch
    const contentsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents?ref=${result.default_branch}`,
      { headers: githubHeaders }
    );

    if (contentsRes.ok) {
      const contents = await contentsRes.json();
      if (Array.isArray(contents)) {
        result.root_files = contents.map((f: { name: string }) => f.name);
        result.has_package_json = result.root_files.includes('package.json');
        result.has_dockerfile = result.root_files.includes('Dockerfile');
        result.has_package_lock = result.root_files.includes('package-lock.json');
        result.has_bun_lockb = result.root_files.includes('bun.lockb');
      }
    }

    // Validate package.json
    if (!result.has_package_json) {
      result.errors.push('package.json manquant à la racine');
    }

    // Step 3: Download and analyze Dockerfile
    if (result.has_dockerfile) {
      const dockerfileRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/Dockerfile?ref=${result.default_branch}`,
        { headers: { ...githubHeaders, 'Accept': 'application/vnd.github.v3.raw' } }
      );

      if (dockerfileRes.ok) {
        const dockerfileContent = await dockerfileRes.text();
        result.dockerfile_analysis.exists = true;
        result.dockerfile_analysis.content = dockerfileContent;

        // Analyze Dockerfile for broken patterns
        const lines = dockerfileContent.split('\n');
        let copyPackageLine: number | undefined;
        let npmInstallLine: number | undefined;

        lines.forEach((line, idx) => {
          const lineNum = idx + 1;
          const trimmedLine = line.trim().toUpperCase();
          
          // Find COPY package.json
          if (trimmedLine.startsWith('COPY') && 
              (line.toLowerCase().includes('package.json') || line.toLowerCase().includes('package*.json'))) {
            if (!copyPackageLine) {
              copyPackageLine = lineNum;
            }
          }

          // Find RUN npm install or npm ci
          if (trimmedLine.startsWith('RUN') && 
              (line.toLowerCase().includes('npm install') || line.toLowerCase().includes('npm ci'))) {
            if (!npmInstallLine) {
              npmInstallLine = lineNum;
            }
          }
        });

        result.dockerfile_analysis.line_numbers = {
          copy_package: copyPackageLine,
          npm_install: npmInstallLine
        };

        // Check for broken pattern: npm install/ci BEFORE COPY package.json
        if (npmInstallLine && (!copyPackageLine || npmInstallLine < copyPackageLine)) {
          result.dockerfile_analysis.has_broken_pattern = true;
          result.dockerfile_analysis.broken_pattern_details = 
            `RUN npm install/ci à la ligne ${npmInstallLine} est AVANT COPY package.json${copyPackageLine ? ` (ligne ${copyPackageLine})` : ' (non trouvé)'}`;
          result.errors.push(`Dockerfile cassé: ${result.dockerfile_analysis.broken_pattern_details}`);
        } else if (copyPackageLine && npmInstallLine && copyPackageLine < npmInstallLine) {
          result.dockerfile_analysis.has_copy_package_before_install = true;
        }

        // Check for npm ci without lock file
        if (!result.has_package_lock && dockerfileContent.toLowerCase().includes('npm ci')) {
          result.warnings.push('Dockerfile utilise "npm ci" mais package-lock.json est absent');
        }
      }
    } else {
      result.warnings.push('Dockerfile manquant - Coolify peut en générer un');
    }

    // Check for lock file
    if (!result.has_package_lock && !result.has_bun_lockb) {
      result.warnings.push('Aucun fichier lock (package-lock.json ou bun.lockb) - npm ci ne fonctionnera pas');
    }

    result.valid = result.errors.length === 0;

    console.log(`[inspect-github-repo] Result: valid=${result.valid}, errors=${result.errors.length}, warnings=${result.warnings.length}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[inspect-github-repo] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
