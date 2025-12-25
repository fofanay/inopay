import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DockerfileComparison {
  github_content: string | null;
  coolify_content: string | null;
  is_synced: boolean;
  differences: string[];
  github_analysis: {
    copy_package_line?: number;
    npm_install_line?: number;
    is_valid: boolean;
  };
  coolify_analysis: {
    copy_package_line?: number;
    npm_install_line?: number;
    is_valid: boolean;
  };
}

function analyzeDockerfile(content: string): { 
  copyPackageLine?: number; 
  npmInstallLine?: number; 
  isValid: boolean;
} {
  const lines = content.split('\n');
  let copyPackageLine: number | undefined;
  let npmInstallLine: number | undefined;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmedLine = line.trim().toUpperCase();
    
    if (trimmedLine.startsWith('COPY') && 
        (line.toLowerCase().includes('package.json') || line.toLowerCase().includes('package*.json'))) {
      if (!copyPackageLine) {
        copyPackageLine = lineNum;
      }
    }

    if (trimmedLine.startsWith('RUN') && 
        (line.toLowerCase().includes('npm install') || line.toLowerCase().includes('npm ci'))) {
      if (!npmInstallLine) {
        npmInstallLine = lineNum;
      }
    }
  });

  const isValid = copyPackageLine !== undefined && 
    (npmInstallLine === undefined || copyPackageLine < npmInstallLine);

  return { copyPackageLine, npmInstallLine, isValid };
}

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

    const { server_id, github_repo_url, coolify_app_uuid } = await req.json();

    if (!server_id || !github_repo_url) {
      return new Response(
        JSON.stringify({ error: 'server_id and github_repo_url required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[compare-dockerfile] Comparing for ${github_repo_url}`);

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

    const result: DockerfileComparison = {
      github_content: null,
      coolify_content: null,
      is_synced: false,
      differences: [],
      github_analysis: { is_valid: false },
      coolify_analysis: { is_valid: false }
    };

    // 1. Fetch Dockerfile from GitHub
    const urlMatch = github_repo_url.match(/github\.com[/:]([^/]+)\/([^/.#?\s]+)/i);
    if (urlMatch) {
      const [, owner, repo] = urlMatch;
      const repoClean = repo.replace(/\.git$/, '');
      const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
      
      const githubHeaders: Record<string, string> = {
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'Inopay-Deployer'
      };
      if (githubToken) {
        githubHeaders['Authorization'] = `Bearer ${githubToken}`;
      }

      try {
        // Get default branch
        const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repoClean}`, {
          headers: { ...githubHeaders, 'Accept': 'application/vnd.github.v3+json' }
        });
        let branch = 'main';
        if (repoRes.ok) {
          const repoData = await repoRes.json();
          branch = repoData.default_branch || 'main';
        }

        const dockerfileRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoClean}/contents/Dockerfile?ref=${branch}`,
          { headers: githubHeaders }
        );
        
        if (dockerfileRes.ok) {
          result.github_content = await dockerfileRes.text();
          const analysis = analyzeDockerfile(result.github_content);
          result.github_analysis = {
            copy_package_line: analysis.copyPackageLine,
            npm_install_line: analysis.npmInstallLine,
            is_valid: analysis.isValid
          };
        }
      } catch (e) {
        console.error('[compare-dockerfile] GitHub fetch error:', e);
        result.differences.push('Impossible de récupérer le Dockerfile depuis GitHub');
      }
    }

    // 2. Fetch Dockerfile from Coolify app (if uuid provided)
    if (coolify_app_uuid && server.coolify_url && server.coolify_token) {
      const coolifyUrl = normalizeCoolifyUrl(server.coolify_url);
      
      try {
        // Get app configuration which might contain dockerfile content
        const appRes = await fetch(`${coolifyUrl}/api/v1/applications/${coolify_app_uuid}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${server.coolify_token}`,
            'Accept': 'application/json'
          }
        });

        if (appRes.ok) {
          const appData = await appRes.json();
          
          // Check various fields where Dockerfile might be stored
          const dockerfileContent = appData.dockerfile || 
                                   appData.dockerfile_content || 
                                   appData.custom_dockerfile || null;
          
          if (dockerfileContent) {
            result.coolify_content = dockerfileContent;
            const analysis = analyzeDockerfile(dockerfileContent);
            result.coolify_analysis = {
              copy_package_line: analysis.copyPackageLine,
              npm_install_line: analysis.npmInstallLine,
              is_valid: analysis.isValid
            };
          } else {
            // Coolify uses the Dockerfile from the repo directly
            result.coolify_content = '[Utilise le Dockerfile du repo GitHub]';
            result.coolify_analysis = result.github_analysis;
          }
          
          // Add app config info
          result.differences.push(`Coolify config: build_pack=${appData.build_pack}, base_directory=${appData.base_directory || '/'}`);
        }
      } catch (e) {
        console.error('[compare-dockerfile] Coolify fetch error:', e);
        result.differences.push('Impossible de récupérer la config depuis Coolify');
      }
    } else {
      result.differences.push('Aucune app Coolify spécifiée - comparaison GitHub uniquement');
    }

    // 3. Compare
    if (result.github_content && result.coolify_content) {
      if (result.coolify_content === '[Utilise le Dockerfile du repo GitHub]') {
        result.is_synced = true;
        result.differences.push('Coolify utilise directement le Dockerfile GitHub ✓');
      } else {
        // Normalize for comparison
        const normalizeContent = (c: string) => c.replace(/\r\n/g, '\n').replace(/\s+$/gm, '').trim();
        const ghNorm = normalizeContent(result.github_content);
        const coolifyNorm = normalizeContent(result.coolify_content);
        
        if (ghNorm === coolifyNorm) {
          result.is_synced = true;
          result.differences.push('Les Dockerfiles sont identiques ✓');
        } else {
          result.is_synced = false;
          result.differences.push('⚠️ DÉSYNCHRONISATION DÉTECTÉE');
          
          // Find specific differences
          const ghLines = ghNorm.split('\n');
          const coolifyLines = coolifyNorm.split('\n');
          
          if (ghLines.length !== coolifyLines.length) {
            result.differences.push(`Nombre de lignes différent: GitHub=${ghLines.length}, Coolify=${coolifyLines.length}`);
          }
          
          // Check for key differences
          if (result.github_analysis.is_valid && !result.coolify_analysis.is_valid) {
            result.differences.push('❌ GitHub valide mais Coolify invalide - le cache Coolify est probablement corrompu');
          }
        }
      }
    }

    // Validation status
    if (!result.github_analysis.is_valid) {
      result.differences.push('❌ Dockerfile GitHub invalide: npm install avant COPY package.json');
    }
    if (!result.coolify_analysis.is_valid && result.coolify_content && 
        result.coolify_content !== '[Utilise le Dockerfile du repo GitHub]') {
      result.differences.push('❌ Dockerfile Coolify invalide: npm install avant COPY package.json');
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[compare-dockerfile] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
