import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  valid: boolean;
  hasPackageJson: boolean;
  hasDockerfile: boolean;
  hasPackageLock: boolean;
  hasBunLock: boolean;
  branch: string;
  errors: string[];
  warnings: string[];
  suggestions: string[];
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

    const { github_repo_url, branch = 'main' } = await req.json();

    if (!github_repo_url) {
      return new Response(
        JSON.stringify({ error: 'github_repo_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[validate-github-repo] Validating ${github_repo_url} branch ${branch}`);

    // Extract owner/repo from URL
    const urlMatch = github_repo_url.match(/github\.com[/:]([^/]+)\/([^/.#?\s]+)/i);
    if (!urlMatch) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid GitHub URL format',
          valid: false,
          errors: ['URL GitHub invalide. Format attendu: https://github.com/owner/repo']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [, owner, repo] = urlMatch;
    const repoClean = repo.replace(/\.git$/, '');
    
    // Get GitHub token
    const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
    
    const githubHeaders: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Inopay-Validator'
    };
    
    if (githubToken) {
      githubHeaders['Authorization'] = `token ${githubToken}`;
    }

    const result: ValidationResult = {
      valid: true,
      hasPackageJson: false,
      hasDockerfile: false,
      hasPackageLock: false,
      hasBunLock: false,
      branch,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check if repo exists and is accessible
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repoClean}`, {
      headers: githubHeaders
    });

    if (!repoResponse.ok) {
      if (repoResponse.status === 404) {
        result.valid = false;
        result.errors.push('Dépôt introuvable. Vérifiez l\'URL ou les permissions.');
        if (!githubToken) {
          result.suggestions.push('Si le dépôt est privé, configurez un token GitHub dans les paramètres.');
        }
      } else if (repoResponse.status === 403) {
        result.valid = false;
        result.errors.push('Accès refusé (rate limit ou permissions). Réessayez plus tard.');
      } else {
        result.valid = false;
        result.errors.push(`Erreur GitHub API: ${repoResponse.status}`);
      }
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch || 'main';
    result.branch = branch || defaultBranch;

    // Get repository contents at root
    const contentsUrl = `https://api.github.com/repos/${owner}/${repoClean}/contents?ref=${result.branch}`;
    const contentsResponse = await fetch(contentsUrl, { headers: githubHeaders });

    if (!contentsResponse.ok) {
      result.valid = false;
      result.errors.push(`Impossible de lire le contenu du dépôt (branche: ${result.branch})`);
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contents = await contentsResponse.json();
    
    if (!Array.isArray(contents)) {
      result.valid = false;
      result.errors.push('Structure de dépôt inattendue');
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for required files
    for (const item of contents) {
      if (item.type !== 'file') continue;
      
      const name = item.name.toLowerCase();
      
      if (name === 'package.json') {
        result.hasPackageJson = true;
      }
      if (name === 'dockerfile') {
        result.hasDockerfile = true;
      }
      if (name === 'package-lock.json') {
        result.hasPackageLock = true;
      }
      if (name === 'bun.lockb') {
        result.hasBunLock = true;
      }
    }

    // Validate and provide feedback
    if (!result.hasPackageJson) {
      result.valid = false;
      result.errors.push('❌ package.json absent à la racine du dépôt');
      result.suggestions.push('Vérifiez que package.json est bien à la racine du repo, pas dans un sous-dossier.');
    }

    if (!result.hasDockerfile) {
      result.valid = false;
      result.errors.push('❌ Dockerfile absent à la racine du dépôt');
      result.suggestions.push('Créez un Dockerfile à la racine pour permettre le build Coolify.');
    }

    if (!result.hasPackageLock && result.hasPackageJson) {
      result.warnings.push('⚠️ package-lock.json absent - npm install sera utilisé au lieu de npm ci');
      if (result.hasBunLock) {
        result.suggestions.push('Le projet utilise Bun (bun.lockb détecté). Le Dockerfile doit utiliser npm install au lieu de npm ci.');
      } else {
        result.suggestions.push('Exécutez "npm install" localement puis committez package-lock.json pour des builds plus rapides et reproductibles.');
      }
    }

    if (result.valid) {
      result.suggestions.push('✅ Le dépôt est prêt pour le déploiement Coolify!');
    }

    console.log(`[validate-github-repo] Result: valid=${result.valid}, package.json=${result.hasPackageJson}, Dockerfile=${result.hasDockerfile}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[validate-github-repo] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        valid: false,
        errors: ['Erreur lors de la validation du dépôt']
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
