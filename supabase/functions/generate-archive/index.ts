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

    const { projectId, projectName, cleanedFiles } = await req.json();

    if (!projectId || !cleanedFiles || Object.keys(cleanedFiles).length === 0) {
      return new Response(JSON.stringify({ error: 'Données de projet invalides' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Generating archive for project ${projectId} with ${Object.keys(cleanedFiles).length} files`);

    // Create ZIP archive
    const zip = new JSZip();

    // Add cleaned files
    for (const [filePath, content] of Object.entries(cleanedFiles)) {
      zip.file(filePath, content as string);
    }

    // Add Dockerfile
    zip.file('Dockerfile', DOCKERFILE_CONTENT);

    // Add nginx.conf
    zip.file('nginx.conf', NGINX_CONF);

    // Add README
    zip.file('README_FREEDOM.md', README_CONTENT);

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
      path: storagePath
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
