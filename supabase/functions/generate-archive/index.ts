import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DOCKERFILE_CONTENT = `# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
`;

const NGINX_CONF = `server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Handle SPA routing
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

const VERCEL_WORKFLOW = `name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VERCEL_ORG_ID: \${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: \${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install Vercel CLI
        run: npm install --global vercel@latest
      
      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=production --token=\${{ secrets.VERCEL_TOKEN }}
      
      - name: Build Project Artifacts
        run: vercel build --prod --token=\${{ secrets.VERCEL_TOKEN }}
      
      - name: Deploy Project Artifacts to Vercel
        run: vercel deploy --prebuilt --prod --token=\${{ secrets.VERCEL_TOKEN }}
`;

const RAILWAY_WORKFLOW = `name: Deploy to Railway

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --legacy-peer-deps
      
      - name: Build
        run: npm run build
      
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      
      - name: Deploy to Railway
        run: railway up
        env:
          RAILWAY_TOKEN: \${{ secrets.RAILWAY_TOKEN }}
`;

const DOCKER_WORKFLOW = `name: Build and Push Docker Image

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata for Docker
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: \${{ github.event_name != 'pull_request' }}
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
`;

const CI_WORKFLOW = `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --legacy-peer-deps
      
      - name: Type check
        run: npm run build
      
      - name: Lint
        run: npm run lint --if-present
`;

const NPMRC_CONTENT = `# Configuration npm pour gérer les conflits de dépendances
legacy-peer-deps=true
engine-strict=false
`;

const README_CONTENT = `# 🚀 Projet Autonome - Guide d'Installation

Ce projet a été nettoyé et libéré de toute dépendance propriétaire. 
Il peut maintenant être déployé sur n'importe quel environnement.

## 📋 Prérequis

- Node.js 18+ (recommandé: 20 LTS)
- npm ou yarn
- Docker (optionnel, pour le déploiement)

## 🛠️ Installation Locale

### 1. Installer les dépendances

\`\`\`bash
npm install
\`\`\`

### 2. Configurer les variables d'environnement

Créez un fichier \`.env\` à la racine du projet :

\`\`\`env
VITE_API_URL=https://votre-api.com
# Ajoutez vos autres variables ici
\`\`\`

### 3. Lancer en développement

\`\`\`bash
npm run dev
\`\`\`

L'application sera accessible sur \`http://localhost:5173\`

### 4. Build de production

\`\`\`bash
npm run build
\`\`\`

Les fichiers de production seront générés dans le dossier \`dist/\`

## 🐳 Déploiement Docker

### Option 1 : Build et run local

\`\`\`bash
# Construire l'image
docker build -t mon-app .

# Lancer le conteneur
docker run -p 80:80 mon-app
\`\`\`

### Option 2 : Docker Compose

Créez un fichier \`docker-compose.yml\` :

\`\`\`yaml
version: '3.8'
services:
  web:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
\`\`\`

Puis lancez :

\`\`\`bash
docker-compose up -d
\`\`\`

## 🌐 Déploiement sur VPS

### Avec Nginx (sans Docker)

1. Build le projet localement :
\`\`\`bash
npm run build
\`\`\`

2. Copiez le contenu de \`dist/\` vers votre serveur :
\`\`\`bash
scp -r dist/* user@votre-serveur:/var/www/html/
\`\`\`

3. Configurez Nginx sur votre serveur (voir \`nginx.conf\` inclus)

### Avec Docker sur VPS

1. Transférez le projet sur votre VPS
2. Construisez et lancez :
\`\`\`bash
docker build -t mon-app .
docker run -d -p 80:80 --restart unless-stopped mon-app
\`\`\`

## 📦 Structure du projet

\`\`\`
├── src/                  # Code source
│   ├── components/       # Composants React
│   ├── pages/           # Pages de l'application
│   ├── hooks/           # Hooks personnalisés
│   ├── lib/             # Utilitaires
│   └── index.css        # Styles globaux
├── public/              # Assets statiques
├── Dockerfile           # Configuration Docker
├── nginx.conf           # Configuration Nginx
├── vite.config.ts       # Configuration Vite
└── package.json         # Dépendances
\`\`\`

## 🔧 Modifications effectuées

Ce projet a été nettoyé des dépendances suivantes :
- Imports \`@lovable/\` remplacés par des alternatives open-source
- Imports \`@gptengineer/\` supprimés
- Hooks personnalisés remplacés par des implémentations standard
- Configuration adaptée pour un déploiement autonome

## ❓ Besoin d'aide ?

Si vous rencontrez des problèmes lors de l'installation ou du déploiement,
vérifiez que :
1. Votre version de Node.js est 18 ou supérieure
2. Toutes les dépendances sont correctement installées
3. Les variables d'environnement sont configurées

---

**Généré par InoPay Cleaner** - Libérez votre code !
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { projectId, projectName, cleanedFiles, supabaseFiles } = await req.json();

    if (!projectId || !cleanedFiles || Object.keys(cleanedFiles).length === 0) {
      return new Response(JSON.stringify({ error: 'Données de projet invalides' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract supabase files if provided separately, or detect from cleanedFiles
    const supabaseFolderFiles: Record<string, string> = supabaseFiles || {};
    
    // Also detect supabase files from cleanedFiles if not provided separately
    for (const [path, content] of Object.entries(cleanedFiles)) {
      if (path.startsWith('supabase/') && !supabaseFolderFiles[path]) {
        supabaseFolderFiles[path] = content as string;
      }
    }

    console.log(`Generating archive for project ${projectId} with ${Object.keys(cleanedFiles).length} files`);

    // Clean package.json to fix known dependency conflicts
    const cleanPackageJson = (filesObj: Record<string, string>): Record<string, string> => {
      if (!filesObj['package.json']) return filesObj;
      
      try {
        const pkg = JSON.parse(filesObj['package.json']);
        
        // Known dependency fixes for React 18 compatibility
        const dependencyFixes: Record<string, string> = {
          // Map libraries
          'react-leaflet': '^4.2.1',
          '@react-leaflet/core': '^2.1.0',
          'google-map-react': '^2.2.1',
          '@react-google-maps/api': '^2.19.3',
          
          // Markdown/MDX
          'react-markdown': '^8.0.7',
          '@mdx-js/react': '^2.3.0',
          'remark-gfm': '^3.0.1',
          
          // Form libraries
          'react-hook-form': '^7.51.5',
          'formik': '^2.4.6',
          
          // Animation libraries
          'framer-motion': '^10.18.0',
          'react-spring': '^9.7.3',
          'react-transition-group': '^4.4.5',
          
          // UI Component libraries
          'react-select': '^5.8.0',
          'react-datepicker': '^6.9.0',
          'react-dropzone': '^14.2.3',
          'react-modal': '^3.16.1',
          'react-tooltip': '^5.26.4',
          'react-toastify': '^10.0.5',
          
          // Data visualization
          'recharts': '^2.12.7',
          'react-chartjs-2': '^5.2.0',
          'victory': '^36.9.2',
          
          // Table libraries
          'react-table': '^7.8.0',
          '@tanstack/react-table': '^8.17.3',
          
          // State management
          'react-redux': '^8.1.3',
          'zustand': '^4.5.2',
          'jotai': '^2.8.0',
          'recoil': '^0.7.7',
          
          // Router
          'react-router-dom': '^6.23.1',
          
          // Query/Data fetching
          '@tanstack/react-query': '^5.40.1',
          'swr': '^2.2.5',
          
          // DnD libraries
          'react-beautiful-dnd': '^13.1.1',
          '@dnd-kit/core': '^6.1.0',
          'react-dnd': '^16.0.1',
          
          // Virtualization
          'react-virtualized': '^9.22.5',
          'react-window': '^1.8.10',
          
          // PDF
          'react-pdf': '^7.7.3',
          '@react-pdf/renderer': '^3.4.4',
          
          // Rich text editors
          'draft-js': '^0.11.7',
          'slate': '^0.103.0',
          'slate-react': '^0.103.0',
          '@tiptap/react': '^2.4.0',
          
          // Date libraries
          'react-day-picker': '^8.10.1',
          
          // Media
          'react-player': '^2.16.0',
          'react-webcam': '^7.2.0',
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

    // Detect environment variables in files
    const detectEnvVariables = (files: Record<string, string>): Set<string> => {
      const envVars = new Set<string>();
      const patterns = [
        /import\.meta\.env\.(\w+)/g,
        /process\.env\.(\w+)/g,
        /Deno\.env\.get\(['"](\w+)['"]\)/g,
      ];

      for (const content of Object.values(files)) {
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

    // Generate .env.example content
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
        'VITE_SUPABASE_URL': 'URL de votre projet Supabase (ex: https://xxx.supabase.co)',
        'VITE_SUPABASE_ANON_KEY': 'Clé anonyme Supabase (trouvable dans Settings > API)',
        'VITE_SUPABASE_PUBLISHABLE_KEY': 'Clé publique Supabase',
        'VITE_API_URL': 'URL de votre API backend',
        'VITE_STRIPE_PUBLISHABLE_KEY': 'Clé publique Stripe (pk_live_xxx ou pk_test_xxx)',
        'STRIPE_SECRET_KEY': 'Clé secrète Stripe (sk_live_xxx ou sk_test_xxx)',
        'GITHUB_PERSONAL_ACCESS_TOKEN': 'Token GitHub avec permissions repo',
        'DATABASE_URL': 'URL de connexion à la base de données',
        'SUPABASE_URL': 'URL Supabase pour les edge functions',
        'SUPABASE_ANON_KEY': 'Clé anonyme pour les edge functions',
        'SUPABASE_SERVICE_ROLE_KEY': 'Clé service role (backend uniquement)',
      };

      for (const envVar of Array.from(envVars).sort()) {
        const description = varDescriptions[envVar] || 'À configurer';
        lines.push(`# ${description}`);
        lines.push(`${envVar}=`);
        lines.push('');
      }

      lines.push('# ============================================');
      lines.push('# Généré automatiquement par InoPay Cleaner');
      lines.push('# ============================================');

      return lines.join('\n');
    };

    // Clean package.json first
    const cleanedFilesObj = cleanPackageJson({ ...cleanedFiles } as Record<string, string>);

    // Detect env vars and generate .env.example
    const detectedEnvVars = detectEnvVariables(cleanedFilesObj);
    const envExampleContent = generateEnvExample(detectedEnvVars);

    console.log(`Detected ${detectedEnvVars.size} environment variables`);

    // Create ZIP archive
    const zip = new JSZip();

    // Add cleaned files (with fixed package.json)
    for (const [filePath, content] of Object.entries(cleanedFilesObj)) {
      zip.file(filePath, content as string);
    }

    // Add .env.example
    zip.file('.env.example', envExampleContent);

    // Add .npmrc for handling peer dependency conflicts
    zip.file('.npmrc', NPMRC_CONTENT);

    // Add Dockerfile
    zip.file('Dockerfile', DOCKERFILE_CONTENT);

    // Add nginx.conf
    zip.file('nginx.conf', NGINX_CONF);

    // Add README
    zip.file('README_FREEDOM.md', README_CONTENT);

    // Add CI/CD workflows
    zip.file('.github/workflows/ci.yml', CI_WORKFLOW);
    zip.file('.github/workflows/deploy-vercel.yml', VERCEL_WORKFLOW);
    zip.file('.github/workflows/deploy-railway.yml', RAILWAY_WORKFLOW);
    zip.file('.github/workflows/docker-build.yml', DOCKER_WORKFLOW);

    // Add supabase folder if files exist
    const supabaseFileCount = Object.keys(supabaseFolderFiles).length;
    if (supabaseFileCount > 0) {
      console.log(`Including ${supabaseFileCount} supabase files in archive`);
      for (const [filePath, content] of Object.entries(supabaseFolderFiles)) {
        zip.file(filePath, content as string);
      }
      
      // Add supabase README
      const supabaseReadme = `# 📁 Dossier Supabase

Ce dossier contient la configuration complète de votre backend Supabase.

## 📂 Structure

\`\`\`
supabase/
├── config.toml          # Configuration du projet
├── functions/            # Edge Functions Deno
│   └── */index.ts       # Code de chaque fonction
└── migrations/          # Migrations SQL
    └── *.sql            # Scripts de création de tables
\`\`\`

## 🚀 Utilisation avec Supabase CLI

### Installation
\`\`\`bash
npm install -g supabase
\`\`\`

### Déploiement sur un nouveau projet
\`\`\`bash
# Lier à votre projet
supabase link --project-ref YOUR_PROJECT_ID

# Déployer les migrations
supabase db push

# Déployer les fonctions
supabase functions deploy
\`\`\`

## 🔄 Conversion vers Express

Les Edge Functions peuvent être converties en routes Express avec Inopay.
Utilisez le **Migration Wizard** pour une conversion automatique.

---

**Généré par Inopay** - Votre backend souverain
`;
      zip.file('supabase/README.md', supabaseReadme);
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ 
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    // Upload to Supabase Storage
    const fileName = `${projectName || 'project'}_cleaned_${Date.now()}.zip`;
    const storagePath = `${user.id}/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cleaned-archives')
      .upload(storagePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Erreur lors de l\'upload' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('cleaned-archives')
      .createSignedUrl(storagePath, 3600);

    if (signedUrlError) {
      console.error('Signed URL error:', signedUrlError);
      return new Response(JSON.stringify({ error: 'Erreur lors de la génération du lien' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update project status to 'cleaned'
    if (projectId) {
      const { error: updateError } = await supabase
        .from('projects_analysis')
        .update({ status: 'cleaned' })
        .eq('id', projectId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Update error:', updateError);
        // Don't fail the whole operation for this
      }
    }

    console.log(`Archive generated successfully: ${storagePath}`);

    return new Response(JSON.stringify({ 
      success: true,
      downloadUrl: signedUrlData.signedUrl,
      fileName,
      path: storagePath,
      envExampleContent,
      detectedEnvVars: Array.from(detectedEnvVars)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in generate-archive function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
