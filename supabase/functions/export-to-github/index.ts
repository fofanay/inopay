import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
    if (!githubToken) {
      return new Response(JSON.stringify({ 
        error: 'Token GitHub non configuré. Veuillez ajouter GITHUB_PERSONAL_ACCESS_TOKEN dans les secrets du projet.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Utilisateur non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { repoName, description, files, isPrivate = true } = await req.json();

    if (!repoName || !files || Object.keys(files).length === 0) {
      return new Response(JSON.stringify({ error: 'Nom du repo et fichiers requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean package.json to fix known dependency conflicts
    const cleanPackageJson = (filesObj: Record<string, string>): Record<string, string> => {
      if (!filesObj['package.json']) return filesObj;
      
      try {
        const pkg = JSON.parse(filesObj['package.json']);
        
        // Known dependency fixes for React 18 compatibility
        const dependencyFixes: Record<string, string> = {
          'react-leaflet': '^4.2.1',
          '@react-leaflet/core': '^2.1.0',
          'react-markdown': '^8.0.7',
          '@mdx-js/react': '^2.3.0',
        };
        
        // Apply fixes to dependencies
        let modified = false;
        for (const [dep, version] of Object.entries(dependencyFixes)) {
          if (pkg.dependencies?.[dep]) {
            const currentVersion = pkg.dependencies[dep];
            // Only fix if it's a major version that's incompatible
            if (currentVersion.includes('5.') || currentVersion.includes('6.') || currentVersion.includes('^5') || currentVersion.includes('^6')) {
              pkg.dependencies[dep] = version;
              modified = true;
              console.log(`Fixed dependency: ${dep} ${currentVersion} -> ${version}`);
            }
          }
        }
        
        // Add overrides for npm 8.3+ to force compatible versions
        if (pkg.dependencies?.['react-leaflet'] || pkg.dependencies?.['@react-leaflet/core']) {
          pkg.overrides = pkg.overrides || {};
          pkg.overrides['react-leaflet'] = {
            'react': '$react',
            'react-dom': '$react-dom'
          };
          modified = true;
        }
        
        // Ensure engines field for Node.js version
        if (!pkg.engines) {
          pkg.engines = { node: '>=18.0.0' };
          modified = true;
        }
        
        if (modified) {
          filesObj['package.json'] = JSON.stringify(pkg, null, 2);
          console.log('package.json cleaned successfully');
        }
      } catch (e) {
        console.error('Error cleaning package.json:', e);
      }
      
      return filesObj;
    };

    // Detect environment variables in files and generate .env.example
    const detectEnvVariables = (filesObj: Record<string, string>): Set<string> => {
      const envVars = new Set<string>();
      const patterns = [
        /import\.meta\.env\.(\w+)/g,
        /process\.env\.(\w+)/g,
        /Deno\.env\.get\(['"](\w+)['"]\)/g,
      ];

      for (const content of Object.values(filesObj)) {
        for (const pattern of patterns) {
          let match;
          const regex = new RegExp(pattern.source, pattern.flags);
          while ((match = regex.exec(content as string)) !== null) {
            if (match[1] && !match[1].startsWith('NODE_')) {
              envVars.add(match[1]);
            }
          }
        }
      }
      return envVars;
    };

    const generateEnvExample = (envVars: Set<string>): string => {
      const lines = [
        '# ============================================',
        '# Variables d\'environnement du projet',
        '# ============================================',
        '# Copiez ce fichier vers .env et remplissez les valeurs',
        '# cp .env.example .env',
        '',
      ];

      const varDescriptions: Record<string, string> = {
        'VITE_SUPABASE_URL': 'URL de votre projet Supabase',
        'VITE_SUPABASE_ANON_KEY': 'Clé anonyme Supabase',
        'VITE_SUPABASE_PUBLISHABLE_KEY': 'Clé publique Supabase',
        'VITE_API_URL': 'URL de votre API backend',
        'VITE_STRIPE_PUBLISHABLE_KEY': 'Clé publique Stripe',
        'STRIPE_SECRET_KEY': 'Clé secrète Stripe',
        'DATABASE_URL': 'URL de connexion à la base de données',
      };

      for (const envVar of Array.from(envVars).sort()) {
        const description = varDescriptions[envVar] || 'À configurer';
        lines.push(`# ${description}`);
        lines.push(`${envVar}=`);
        lines.push('');
      }

      return lines.join('\n');
    };

    // Generate .npmrc content to handle peer dependency conflicts
    const NPMRC_CONTENT = `# Configuration npm pour gérer les conflits de dépendances
legacy-peer-deps=true
engine-strict=false
`;

    // Clean package.json first
    const cleanedFilesObj = cleanPackageJson({ ...files } as Record<string, string>);
    
    const detectedEnvVars = detectEnvVariables(cleanedFilesObj);
    const envExampleContent = generateEnvExample(detectedEnvVars);
    
    // Add .env.example and .npmrc to files
    const filesWithEnv = { 
      ...cleanedFilesObj, 
      '.env.example': envExampleContent,
      '.npmrc': NPMRC_CONTENT
    };

    console.log(`Creating GitHub repo: ${repoName}`);

    // Step 1: Create the repository
    const createRepoResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'InoPay-Cleaner'
      },
      body: JSON.stringify({
        name: repoName,
        description: description || 'Projet exporté depuis InoPay Cleaner - 100% autonome',
        private: isPrivate,
        auto_init: true // Creates initial commit with README
      })
    });

    if (!createRepoResponse.ok) {
      const errorData = await createRepoResponse.json();
      console.error('GitHub create repo error:', errorData);
      
      if (createRepoResponse.status === 422 && errorData.errors?.[0]?.message?.includes('already exists')) {
        return new Response(JSON.stringify({ 
          error: `Le dépôt "${repoName}" existe déjà. Veuillez choisir un autre nom.` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ 
        error: `Erreur GitHub: ${errorData.message || 'Impossible de créer le dépôt'}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const repoData = await createRepoResponse.json();
    const owner = repoData.owner.login;
    const repoFullName = repoData.full_name;
    
    console.log(`Repo created: ${repoFullName}`);

    // Wait a moment for the repo to be fully initialized
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Get the default branch SHA
    const refResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/ref/heads/main`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'InoPay-Cleaner'
        }
      }
    );

    if (!refResponse.ok) {
      console.error('Failed to get ref');
      return new Response(JSON.stringify({ 
        error: 'Impossible de récupérer la référence du dépôt',
        repoUrl: repoData.html_url
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const refData = await refResponse.json();
    const baseSha = refData.object.sha;

    // Step 3: Create blobs for each file (including .env.example)
    const fileBlobs: { path: string; sha: string; mode: string; type: string }[] = [];

    for (const [filePath, content] of Object.entries(filesWithEnv)) {
      const blobResponse = await fetch(
        `https://api.github.com/repos/${repoFullName}/git/blobs`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'InoPay-Cleaner'
          },
          body: JSON.stringify({
            content: content as string,
            encoding: 'utf-8'
          })
        }
      );

      if (blobResponse.ok) {
        const blobData = await blobResponse.json();
        fileBlobs.push({
          path: filePath,
          sha: blobData.sha,
          mode: '100644',
          type: 'blob'
        });
      }
    }

    console.log(`Created ${fileBlobs.length} blobs`);

    // Step 4: Create a tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/trees`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'InoPay-Cleaner'
        },
        body: JSON.stringify({
          base_tree: baseSha,
          tree: fileBlobs
        })
      }
    );

    if (!treeResponse.ok) {
      console.error('Failed to create tree');
      return new Response(JSON.stringify({ 
        error: 'Erreur lors de la création de l\'arborescence',
        repoUrl: repoData.html_url
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const treeData = await treeResponse.json();

    // Step 5: Create a commit
    const commitResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/commits`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'InoPay-Cleaner'
        },
        body: JSON.stringify({
          message: '🚀 Initial commit - Projet autonome exporté depuis InoPay Cleaner',
          tree: treeData.sha,
          parents: [baseSha]
        })
      }
    );

    if (!commitResponse.ok) {
      console.error('Failed to create commit');
      return new Response(JSON.stringify({ 
        error: 'Erreur lors de la création du commit',
        repoUrl: repoData.html_url
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const commitData = await commitResponse.json();

    // Step 6: Update the reference
    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${repoFullName}/git/refs/heads/main`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'InoPay-Cleaner'
        },
        body: JSON.stringify({
          sha: commitData.sha,
          force: true
        })
      }
    );

    if (!updateRefResponse.ok) {
      console.error('Failed to update ref');
    }

    console.log(`Successfully pushed ${fileBlobs.length} files to ${repoFullName}`);

    return new Response(JSON.stringify({ 
      success: true,
      repoUrl: repoData.html_url,
      repoFullName,
      filesCount: fileBlobs.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in export-to-github function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
