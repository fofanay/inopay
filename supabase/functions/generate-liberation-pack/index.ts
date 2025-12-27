import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TEMPLATES
// ============================================

const FRONTEND_DOCKERFILE = `# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Production avec Caddy
FROM caddy:2-alpine
COPY --from=builder /app/dist /usr/share/caddy
COPY Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
`;

const BACKEND_DOCKERFILE = `FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
`;

const NGINX_CONF = `server {
    listen 80;
    server_name localhost;
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

// ============================================
// SOVEREIGNTY VERIFICATION
// ============================================

interface SovereigntyCheck {
  isClean: boolean;
  score: number;
  criticalIssues: string[];
  warnings: string[];
}

/**
 * SERVER-SIDE DEEP CLEAN - Ensures ALL proprietary patterns are removed
 * This runs BEFORE sovereignty verification to guarantee clean files
 */
function serverSideDeepClean(content: string, filePath: string): { cleaned: string; changes: string[] } {
  const changes: string[] = [];
  let cleaned = content;

  // === PASS 1: Replace ALL @/integrations/supabase imports ===
  const supabaseImportPatterns = [
    { pattern: /from\s*['"]@\/integrations\/supabase\/client['"]/g, replacement: "from '@/lib/supabase-client'" },
    { pattern: /from\s*['"]@\/integrations\/supabase\/types['"]/g, replacement: "from '@/lib/supabase-types'" },
    { pattern: /from\s*['"]@\/integrations\/supabase[^'"]*['"]/g, replacement: "from '@/lib/supabase-client'" },
    { pattern: /from\s*['"]\.\.\/integrations\/supabase[^'"]*['"]/g, replacement: "from '@/lib/supabase-client'" },
    { pattern: /from\s*['"]\.\.\/\.\.\/integrations\/supabase[^'"]*['"]/g, replacement: "from '@/lib/supabase-client'" },
    { pattern: /from\s*['"]\.\.\/\.\.\/\.\.\/integrations\/supabase[^'"]*['"]/g, replacement: "from '@/lib/supabase-client'" },
    { pattern: /from\s*['"]\.+\/integrations\/supabase[^'"]*['"]/g, replacement: "from '@/lib/supabase-client'" },
  ];

  for (const { pattern, replacement } of supabaseImportPatterns) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, replacement);
    if (cleaned !== before) changes.push('Import Supabase remplacé');
  }

  // === PASS 2: Remove proprietary imports ===
  const proprietaryImports = [
    /import\s*{\s*componentTagger\s*}\s*from\s*['"]lovable-tagger['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]@lovable\/[^'"]*['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]@gptengineer\/[^'"]*['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]lovable-[^'"]*['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]@v0\/[^'"]*['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]@bolt\/[^'"]*['"]\s*;?\n?/g,
  ];

  for (const pattern of proprietaryImports) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, '');
    if (cleaned !== before) changes.push('Import propriétaire supprimé');
  }

  // === PASS 3: Remove plugin usage in vite.config ===
  const pluginPatterns = [
    /mode\s*===\s*['"]development['"]\s*&&\s*componentTagger\(\)\s*,?\n?/g,
    /componentTagger\(\)\s*,?\n?/g,
    /lovableTagger\(\)\s*,?\n?/g,
  ];

  for (const pattern of pluginPatterns) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, '');
    if (cleaned !== before) changes.push('Plugin Lovable supprimé');
  }

  // === PASS 4: Replace hardcoded Supabase project IDs ===
  const before1 = cleaned;
  cleaned = cleaned.replace(/[a-z]{20}\.supabase\.co/g, 'your-project.supabase.co');
  if (cleaned !== before1) changes.push('ID Supabase remplacé');

  // === PASS 5: Replace exposed JWT tokens ===
  const before2 = cleaned;
  cleaned = cleaned.replace(/eyJ[A-Za-z0-9_-]{100,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, 'YOUR_SUPABASE_KEY');
  if (cleaned !== before2) changes.push('Token JWT remplacé');

  // === PASS 6: Replace Stripe keys ===
  const stripePatterns = [
    { pattern: /sk_live_[A-Za-z0-9]{20,}/g, replacement: 'sk_live_YOUR_KEY' },
    { pattern: /pk_live_[A-Za-z0-9]{20,}/g, replacement: 'pk_live_YOUR_KEY' },
    { pattern: /sk_test_[A-Za-z0-9]{20,}/g, replacement: 'sk_test_YOUR_KEY' },
    { pattern: /pk_test_[A-Za-z0-9]{20,}/g, replacement: 'pk_test_YOUR_KEY' },
  ];

  for (const { pattern, replacement } of stripePatterns) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, replacement);
    if (cleaned !== before) changes.push('Clé Stripe remplacée');
  }

  // === PASS 7: Remove data attributes ===
  const dataAttrPatterns = [
    /\s*data-lovable[^=]*="[^"]*"/g,
    /\s*data-lov-[^=]*="[^"]*"/g,
    /\s*data-gpt[^=]*="[^"]*"/g,
    /\s*data-bolt[^=]*="[^"]*"/g,
    /\s*data-v0[^=]*="[^"]*"/g,
  ];

  for (const pattern of dataAttrPatterns) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, '');
    if (cleaned !== before) changes.push('Attribut data supprimé');
  }

  // === PASS 8: Remove proprietary comments ===
  const commentPatterns = [
    /\/\/\s*@lovable[^\n]*\n?/gi,
    /\/\/\s*@gptengineer[^\n]*\n?/gi,
    /\/\/\s*Generated by Lovable[^\n]*\n?/gi,
    /\/\/\s*Built with Lovable[^\n]*\n?/gi,
    /\/\*[\s\S]*?lovable[\s\S]*?\*\//gi,
    /<!--[\s\S]*?lovable[\s\S]*?-->/gi,
    /<!--[\s\S]*?gptengineer[\s\S]*?-->/gi,
  ];

  for (const pattern of commentPatterns) {
    const before = cleaned;
    cleaned = cleaned.replace(pattern, '');
    if (cleaned !== before) changes.push('Commentaire propriétaire supprimé');
  }

  // === PASS 9: Remove telemetry domains ===
  const telemetryDomains = [
    'lovable.app', 'lovable.dev', 'gptengineer.app',
    'events.lovable', 'telemetry.lovable', 'analytics.lovable',
    'api.lovable.dev', 'ws.lovable.dev', 'cdn.lovable.dev',
    'bolt.new', 'v0.dev', 'cursor.sh', 'replit.com'
  ];

  for (const domain of telemetryDomains) {
    const escapedDomain = domain.replace(/\./g, '\\.');
    const pattern = new RegExp(`['"\`][^'"\`]*${escapedDomain}[^'"\`]*['"\`]`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(pattern, '""');
    if (cleaned !== before) changes.push(`Télémétrie ${domain} supprimée`);
  }

  // === FINAL: Clean empty imports and excess whitespace ===
  cleaned = cleaned.replace(/import\s*{\s*}\s*from\s*['"][^'"]*['"]\s*;?\n?/g, '');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/,\s*,/g, ',');
  cleaned = cleaned.replace(/\[\s*,/g, '[');
  cleaned = cleaned.replace(/,\s*\]/g, ']');

  return { cleaned, changes: [...new Set(changes)] };
}

function verifySovereignty(files: Record<string, string>): SovereigntyCheck {
  const criticalIssues: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  const criticalPatterns = [
    { pattern: /@\/integrations\/supabase/g, name: 'Import Supabase auto-généré', penalty: 20 },
    { pattern: /lovable\.app|lovable\.dev|gptengineer\.app/gi, name: 'Domaine Lovable', penalty: 20 },
    { pattern: /[a-z]{20}\.supabase\.co/g, name: 'ID projet Supabase hardcodé', penalty: 15 },
    { pattern: /eyJ[A-Za-z0-9_-]{100,}/g, name: 'Token JWT hardcodé', penalty: 20 },
    { pattern: /sk_live_[A-Za-z0-9]+/g, name: 'Clé Stripe live exposée', penalty: 25 },
    { pattern: /componentTagger|lovable-tagger/g, name: 'Plugin Lovable', penalty: 15 },
  ];

  const warningPatterns = [
    { pattern: /data-lov|data-gpt|data-bolt/g, name: 'Data attribute propriétaire', penalty: 5 },
    { pattern: /\/\/.*lovable|\/\*.*lovable/gi, name: 'Commentaire propriétaire', penalty: 3 },
    { pattern: /cdn\.lovable|assets\.lovable/gi, name: 'CDN propriétaire', penalty: 10 },
  ];

  for (const [path, content] of Object.entries(files)) {
    // Skip non-source files
    if (!path.match(/\.(ts|tsx|js|jsx|json|html|css)$/)) continue;

    for (const { pattern, name, penalty } of criticalPatterns) {
      // Create fresh regex to avoid lastIndex issues
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      if (freshPattern.test(content)) {
        criticalIssues.push(`${path}: ${name}`);
        score -= penalty;
      }
    }

    for (const { pattern, name, penalty } of warningPatterns) {
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      if (freshPattern.test(content)) {
        warnings.push(`${path}: ${name}`);
        score -= penalty;
      }
    }
  }

  return {
    isClean: criticalIssues.length === 0,
    score: Math.max(0, Math.min(100, score)),
    criticalIssues,
    warnings,
  };
}

// ============================================
// EDGE FUNCTION TO EXPRESS CONVERTER
// ============================================

interface EdgeFunctionInfo {
  name: string;
  content: string;
  hasAuth: boolean;
  httpMethods: string[];
  envVars: string[];
}

function parseEdgeFunction(name: string, content: string): EdgeFunctionInfo {
  const envVars: string[] = [];
  const httpMethods: string[] = [];

  // Detect env variables
  const envPattern = /Deno\.env\.get\(['"](\w+)['"]\)/g;
  let match;
  while ((match = envPattern.exec(content)) !== null) {
    if (match[1] && !envVars.includes(match[1])) {
      envVars.push(match[1]);
    }
  }

  // Detect HTTP methods
  const methodPatterns = {
    GET: /req\.method\s*===?\s*['"]GET['"]/i,
    POST: /req\.method\s*===?\s*['"]POST['"]/i,
    PUT: /req\.method\s*===?\s*['"]PUT['"]/i,
    DELETE: /req\.method\s*===?\s*['"]DELETE['"]/i,
    PATCH: /req\.method\s*===?\s*['"]PATCH['"]/i,
  };

  for (const [method, pattern] of Object.entries(methodPatterns)) {
    if (pattern.test(content)) {
      httpMethods.push(method);
    }
  }

  if (httpMethods.length === 0) {
    httpMethods.push('POST');
  }

  const hasAuth = content.includes('Authorization') || 
                  content.includes('auth.getUser') ||
                  content.includes('supabase.auth');

  return { name, content, hasAuth, httpMethods, envVars };
}

function convertToExpressRoute(func: EdgeFunctionInfo): string {
  const routeName = func.name.replace(/-/g, '_');
  
  let route = `import { Router, Request, Response } from 'express';
`;

  if (func.content.includes('supabase') || func.content.includes('@supabase')) {
    route += `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.DATABASE_URL ? undefined : process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

`;
  }

  route += `export const ${routeName}Router = Router();

`;

  const method = func.httpMethods.includes('GET') ? 'get' : 'post';
  
  route += `${routeName}Router.${method}('/', async (req: Request, res: Response) => {
  try {
`;

  if (func.hasAuth) {
    route += `    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

`;
  }

  route += `    const body = req.body;
    
    // TODO: Migrate logic from Edge Function
    // Original function: ${func.name}
    // Environment variables needed: ${func.envVars.join(', ') || 'None'}
    // See original code in: supabase/functions/${func.name}/index.ts
    
    res.json({ success: true, message: 'Route migrated from ${func.name}' });
  } catch (error) {
    console.error('Error in ${routeName}:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal error' 
    });
  }
});
`;

  return route;
}

function generateExpressBackend(functions: EdgeFunctionInfo[]): {
  routes: { name: string; content: string }[];
  indexTs: string;
  packageJson: string;
  tsconfigJson: string;
} {
  const routes = functions.map(func => ({
    name: func.name.replace(/-/g, '_'),
    content: convertToExpressRoute(func),
  }));

  const allEnvVars = new Set<string>(['PORT', 'DATABASE_URL', 'JWT_SECRET']);
  functions.forEach(f => f.envVars.forEach(v => allEnvVars.add(v)));

  const indexTs = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

${routes.map(r => `import { ${r.name}Router } from './routes/${r.name}';`).join('\n')}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

${routes.map(r => `app.use('/api/${r.name.replace(/_/g, '-')}', ${r.name}Router);`).join('\n')}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(\`🚀 Backend server running on port \${PORT}\`);
  console.log(\`📍 Health check: http://localhost:\${PORT}/health\`);
});

export default app;
`;

  const packageJson = JSON.stringify({
    name: "backend-api",
    version: "1.0.0",
    description: "Backend API - Converted from Supabase Edge Functions",
    main: "dist/index.js",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js",
      typecheck: "tsc --noEmit"
    },
    dependencies: {
      express: "^4.18.2",
      cors: "^2.8.5",
      helmet: "^7.1.0",
      dotenv: "^16.3.1",
      "@supabase/supabase-js": "^2.39.0",
      jsonwebtoken: "^9.0.2",
      pg: "^8.11.3"
    },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/cors": "^2.8.17",
      "@types/node": "^20.10.0",
      "@types/jsonwebtoken": "^9.0.5",
      "@types/pg": "^8.10.9",
      tsx: "^4.7.0",
      typescript: "^5.3.0"
    },
    engines: { node: ">=18.0.0" }
  }, null, 2);

  const tsconfigJson = JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "commonjs",
      lib: ["ES2022"],
      outDir: "./dist",
      rootDir: "./src",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      sourceMap: true
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"]
  }, null, 2);

  return { routes, indexTs, packageJson, tsconfigJson };
}

// ============================================
// DEPLOY GUIDE HTML GENERATOR
// ============================================

function generateDeployGuide(projectName: string, envVars: string[], hasBackend: boolean, hasDatabase: boolean, sovereigntyScore: number): string {
  const envVarDescriptions: Record<string, { desc: string; required: boolean }> = {
    'PORT': { desc: 'Port du serveur (défaut: 3000)', required: false },
    'DATABASE_URL': { desc: 'URL PostgreSQL', required: true },
    'POSTGRES_USER': { desc: 'Utilisateur PostgreSQL', required: true },
    'POSTGRES_PASSWORD': { desc: 'Mot de passe PostgreSQL', required: true },
    'POSTGRES_DB': { desc: 'Nom de la base', required: false },
    'JWT_SECRET': { desc: 'Clé secrète JWT (32+ chars)', required: true },
    'STRIPE_SECRET_KEY': { desc: 'Clé Stripe', required: false },
    'RESEND_API_KEY': { desc: 'Clé API Resend', required: false },
    'ANTHROPIC_API_KEY': { desc: 'Clé API Anthropic', required: false },
  };

  const scoreColor = sovereigntyScore >= 95 ? '#22c55e' : sovereigntyScore >= 80 ? '#f59e0b' : '#ef4444';
  const scoreEmoji = sovereigntyScore >= 95 ? '✅' : sovereigntyScore >= 80 ? '⚠️' : '❌';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guide de Déploiement - ${projectName}</title>
  <style>
    :root { --primary: #6366f1; --success: #22c55e; --warning: #f59e0b; --bg: #0f172a; --bg-card: #1e293b; --text: #e2e8f0; --border: #334155; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 3rem; padding: 2rem; background: linear-gradient(135deg, var(--primary), #4f46e5); border-radius: 1rem; }
    header h1 { font-size: 2rem; margin-bottom: 0.5rem; }
    .sovereignty-badge { display: inline-block; padding: 0.5rem 1rem; background: ${scoreColor}20; border: 2px solid ${scoreColor}; border-radius: 2rem; font-weight: bold; color: ${scoreColor}; margin-top: 1rem; }
    section { background: var(--bg-card); border-radius: 1rem; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid var(--border); }
    section h2 { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .step-num { background: var(--primary); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.875rem; }
    .code-block { position: relative; background: #0d1117; border-radius: 0.5rem; padding: 1rem; margin: 1rem 0; overflow-x: auto; }
    .code-block code { font-family: monospace; font-size: 0.875rem; white-space: pre-wrap; }
    .copy-btn { position: absolute; top: 0.5rem; right: 0.5rem; background: var(--primary); color: white; border: none; padding: 0.375rem 0.75rem; border-radius: 0.375rem; cursor: pointer; font-size: 0.75rem; }
    .copy-btn:hover { opacity: 0.9; }
    .alert { padding: 1rem; border-radius: 0.5rem; margin: 1rem 0; display: flex; gap: 0.75rem; }
    .alert-success { background: rgba(34, 197, 94, 0.1); border: 1px solid var(--success); }
    .alert-warning { background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid var(--border); }
    th { background: var(--bg); }
    code { background: var(--bg); padding: 0.125rem 0.375rem; border-radius: 0.25rem; }
    .checklist { list-style: none; }
    .checklist li { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem 0; border-bottom: 1px solid var(--border); }
    .checklist input { width: 20px; height: 20px; accent-color: var(--success); cursor: pointer; margin-top: 2px; }
    footer { text-align: center; padding: 2rem; color: #94a3b8; font-size: 0.875rem; }
    footer a { color: var(--primary); text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 ${projectName}</h1>
      <p>Guide de déploiement autonome</p>
      <div class="sovereignty-badge">${scoreEmoji} Score de Souveraineté: ${sovereigntyScore}%</div>
    </header>
    
    <section>
      <h2><span class="step-num">1</span> Prérequis</h2>
      <ul class="checklist">
        <li><input type="checkbox"> <label><strong>Serveur VPS</strong> - Ubuntu 22.04+ avec accès SSH root</label></li>
        <li><input type="checkbox"> <label><strong>Docker</strong> - Sera installé automatiquement si absent</label></li>
        <li><input type="checkbox"> <label><strong>Domaine</strong> (optionnel) - Enregistrement A vers l'IP du serveur</label></li>
      </ul>
    </section>
    
    <section>
      <h2><span class="step-num">2</span> Upload & Extraction</h2>
      <div class="code-block"><code>ssh root@VOTRE_IP
mkdir -p /opt/app && cd /opt/app
# Transférez le ZIP puis:
unzip liberation-pack.zip</code><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)">Copier</button></div>
    </section>
    
    <section>
      <h2><span class="step-num">3</span> Installation Docker</h2>
      <div class="alert alert-warning">⚠️ Ignorez si Docker est déjà installé</div>
      <div class="code-block"><code>curl -fsSL https://get.docker.com | sh
docker --version</code><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)">Copier</button></div>
    </section>
    
    <section>
      <h2><span class="step-num">4</span> Configuration</h2>
      <div class="code-block"><code>cp .env.example .env
nano .env</code><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)">Copier</button></div>
      
      <h3 style="margin: 1.5rem 0 1rem;">Variables à configurer :</h3>
      <table>
        <thead><tr><th>Variable</th><th>Description</th><th>Requis</th></tr></thead>
        <tbody>
          ${envVars.map(v => {
            const info = envVarDescriptions[v] || { desc: 'Variable personnalisée', required: false };
            return `<tr><td><code>${v}</code></td><td>${info.desc}</td><td>${info.required ? '✅' : '❌'}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </section>
    
    <section>
      <h2><span class="step-num">5</span> Déploiement</h2>
      <div class="code-block"><code># Méthode rapide (recommandée)
chmod +x scripts/quick-deploy.sh
./scripts/quick-deploy.sh

# Ou manuellement
docker compose up -d --build</code><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)">Copier</button></div>
    </section>
    
    <section>
      <h2><span class="step-num">6</span> Vérification</h2>
      <div class="code-block"><code>docker compose ps
docker compose logs -f</code><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)">Copier</button></div>
      <div class="alert alert-success">🎉 <strong>Votre app est accessible sur http://VOTRE_IP${hasBackend ? ' | API: /api/*' : ''}</strong></div>
    </section>
    
    <section>
      <h2>🔧 Dépannage</h2>
      <div class="code-block"><code># Voir les logs
docker compose logs --tail=100

# Reconstruire
docker compose down
docker compose build --no-cache
docker compose up -d

# Redémarrer un service
docker compose restart frontend</code><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent)">Copier</button></div>
    </section>
    
    <footer>
      <p>Généré par <strong>InoPay</strong> - Libérez votre code !</p>
      <p><a href="https://inopay.fr">inopay.fr</a></p>
    </footer>
  </div>
</body>
</html>`;
}

// ============================================
// DOCKER COMPOSE GENERATOR
// ============================================

function generateDockerCompose(projectName: string, envVars: string[], hasBackend: boolean, hasDatabase: boolean): string {
  const serviceName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  return `version: '3.8'

# ${projectName} - Stack de Production
# Généré par InoPay Liberation Pack

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: ${serviceName}-frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      - DOMAIN=\${DOMAIN:-localhost}
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3
${hasBackend || hasDatabase ? `    depends_on:
${hasBackend ? '      - backend' : ''}
${hasDatabase ? '      - postgres' : ''}` : ''}

${hasBackend ? `
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ${serviceName}-backend
    restart: unless-stopped
    expose:
      - "3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
${envVars.filter(v => !['DOMAIN'].includes(v)).map(v => `      - ${v}=\${${v}}`).join('\n')}
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
${hasDatabase ? `    depends_on:
      postgres:
        condition: service_healthy` : ''}
` : ''}

${hasDatabase ? `
  postgres:
    image: postgres:15-alpine
    container_name: ${serviceName}-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=\${POSTGRES_USER:-app}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
      - POSTGRES_DB=\${POSTGRES_DB:-app}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d:ro
    ports:
      - "5432:5432"
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-app}"]
      interval: 10s
      timeout: 5s
      retries: 5
` : ''}

networks:
  app-network:
    driver: bridge

volumes:
${hasDatabase ? '  postgres_data:' : '  frontend_cache:'}
`;
}

// ============================================
// QUICK DEPLOY SCRIPT
// ============================================

function generateQuickDeployScript(projectName: string, hasDatabase: boolean): string {
  const dbSetup = hasDatabase ? `  POSTGRES_PASSWORD=$(openssl rand -base64 16)
  sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=\\$POSTGRES_PASSWORD/" .env
  echo -e "\\$YELLOW🔐 PostgreSQL password generated\\$NC"` : '';

  return `#!/bin/bash
set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

echo -e "\\$GREEN🚀 InoPay Liberation Pack - ${projectName}\\$NC"

if [ "\\$EUID" -ne 0 ]; then
  echo -e "\\$RED❌ Exécutez en tant que root (sudo ./quick-deploy.sh)\\$NC"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo -e "\\$YELLOW📦 Installation de Docker...\\$NC"
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker && systemctl start docker
fi

echo -e "\\$GREEN✓ Docker prêt\\$NC"

if [ ! -f .env ]; then
  cp .env.example .env
  JWT_SECRET=$(openssl rand -base64 32)
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=\\$JWT_SECRET/" .env
${dbSetup}
  echo -e "\\$GREEN✓ .env configuré\\$NC"
fi

if command -v ufw &> /dev/null; then
  ufw allow 80/tcp
  ufw allow 443/tcp
fi

echo -e "\\$YELLOW🐳 Démarrage...\\$NC"
docker compose up -d --build

sleep 10
docker compose ps

echo -e "\\$GREEN"
echo "╔════════════════════════════════════════╗"
echo "║     🎉 Déploiement terminé !           ║"
echo "╚════════════════════════════════════════╝"
echo -e "\\$NC"
`;
}

// ============================================
// SOVEREIGNTY REPORT GENERATOR
// ============================================

function generateSovereigntyReport(projectName: string, check: SovereigntyCheck, fileCount: number): string {
  const date = new Date().toISOString();
  
  return `# Rapport de Souveraineté - ${projectName}

**Date de génération:** ${date}
**Score de souveraineté:** ${check.score}%
**Fichiers analysés:** ${fileCount}

## Statut
${check.isClean ? '✅ **CODE 100% SOUVERAIN**' : '⚠️ **ATTENTION: Des éléments propriétaires subsistent**'}

${check.criticalIssues.length > 0 ? `
## Problèmes critiques (${check.criticalIssues.length})
${check.criticalIssues.map(issue => `- ❌ ${issue}`).join('\n')}
` : ''}

${check.warnings.length > 0 ? `
## Avertissements (${check.warnings.length})
${check.warnings.map(warning => `- ⚠️ ${warning}`).join('\n')}
` : ''}

## Ce qui a été nettoyé
- Imports propriétaires (@lovable, @gptengineer, @bolt, @v0, @cursor)
- Références aux domaines de télémétrie
- Identifiants de projet Supabase hardcodés
- Tokens JWT et clés API exposées
- Attributs data-* spécifiques aux plateformes
- Commentaires contenant des références propriétaires
- Scripts et dépendances NPM propriétaires

## Polyfills générés
- use-mobile.ts - Détection viewport mobile
- use-toast.ts - Système de notifications
- use-sidebar.ts - Gestion sidebar
- use-auth.ts - Authentification Supabase
- supabase-client.ts - Client Supabase configurable

## Recommandations
1. Configurez votre propre projet Supabase
2. Régénérez les types avec: \`npx supabase gen types typescript --project-id="votre-id"\`
3. Mettez à jour les variables d'environnement dans .env
4. Testez localement avant de déployer en production

---
*Généré par InoPay Liberation Pack v3.0*
`;
}

// ============================================
// MAIN HANDLER
// ============================================

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

    const { 
      projectId,
      projectName, 
      cleanedFiles, 
      edgeFunctions,
      sqlSchema,
      includeBackend = true,
      includeDatabase = true,
      sovereigntyScore = 0,
    } = await req.json();

    if (!cleanedFiles || Object.keys(cleanedFiles).length === 0) {
      return new Response(JSON.stringify({ error: 'Fichiers du projet requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[generate-liberation-pack] Generating pack for ${projectName} with ${Object.keys(cleanedFiles).length} files`);

    // ==========================================
    // SERVER-SIDE DOUBLE CLEANING
    // ==========================================
    console.log(`[generate-liberation-pack] Starting server-side deep clean...`);
    
    const doubleCleanedFiles: Record<string, string> = {};
    let totalServerChanges = 0;
    
    for (const [path, content] of Object.entries(cleanedFiles)) {
      // Only clean source files
      if (path.match(/\.(ts|tsx|js|jsx|json|html|css|md)$/)) {
        const { cleaned, changes } = serverSideDeepClean(content as string, path);
        doubleCleanedFiles[path] = cleaned;
        if (changes.length > 0) {
          totalServerChanges += changes.length;
          console.log(`[generate-liberation-pack] Server cleaned ${path}: ${changes.length} changes`);
        }
      } else {
        doubleCleanedFiles[path] = content as string;
      }
    }
    
    console.log(`[generate-liberation-pack] Server-side cleaning complete: ${totalServerChanges} total changes`);

    // ==========================================
    // SOVEREIGNTY VERIFICATION (on double-cleaned files)
    // ==========================================
    const sovereigntyCheck = verifySovereignty(doubleCleanedFiles);
    
    console.log(`[generate-liberation-pack] Sovereignty check: score=${sovereigntyCheck.score}, clean=${sovereigntyCheck.isClean}, critical=${sovereigntyCheck.criticalIssues.length}`);
    
    // Warn but don't block if score is low
    if (sovereigntyCheck.score < 50) {
      console.warn(`[generate-liberation-pack] Low sovereignty score: ${sovereigntyCheck.score}%`);
      console.warn(`[generate-liberation-pack] Critical issues: ${sovereigntyCheck.criticalIssues.slice(0, 5).join(', ')}`);
    }

    const zip = new JSZip();
    const safeName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // ==========================================
    // 1. FRONTEND (using double-cleaned files)
    // ==========================================
    const frontendFolder = zip.folder('frontend')!;
    
    for (const [path, content] of Object.entries(doubleCleanedFiles)) {
      // Skip edge functions and supabase config
      if (!path.startsWith('supabase/')) {
        frontendFolder.file(path, content as string);
      }
    }
    
    frontendFolder.file('Dockerfile', FRONTEND_DOCKERFILE);
    frontendFolder.file('nginx.conf', NGINX_CONF);
    
    // Caddyfile for frontend
    const caddyfile = `:80 {
  root * /usr/share/caddy
  try_files {path} /index.html
  file_server
  encode gzip
  
${includeBackend ? `  handle /api/* {
    reverse_proxy backend:3000
  }
  
  handle /health {
    reverse_proxy backend:3000
  }` : ''}
}`;
    frontendFolder.file('Caddyfile', caddyfile);

    // ==========================================
    // 2. BACKEND (from Edge Functions)
    // ==========================================
    let backendRoutes: string[] = [];
    const allEnvVars = new Set<string>(['PORT', 'NODE_ENV', 'JWT_SECRET']);

    if (includeBackend && edgeFunctions && edgeFunctions.length > 0) {
      const backendFolder = zip.folder('backend')!;
      const srcFolder = backendFolder.folder('src')!;
      const routesFolder = srcFolder.folder('routes')!;

      const parsedFunctions = edgeFunctions.map((ef: { name: string; content: string }) => {
        const parsed = parseEdgeFunction(ef.name, ef.content);
        parsed.envVars.forEach(v => allEnvVars.add(v));
        return parsed;
      });

      const backend = generateExpressBackend(parsedFunctions);
      backendRoutes = backend.routes.map(r => r.name);

      for (const route of backend.routes) {
        routesFolder.file(`${route.name}.ts`, route.content);
      }

      srcFolder.file('index.ts', backend.indexTs);
      backendFolder.file('package.json', backend.packageJson);
      backendFolder.file('tsconfig.json', backend.tsconfigJson);
      backendFolder.file('Dockerfile', BACKEND_DOCKERFILE);

      // Keep original edge functions for reference
      const originalFolder = backendFolder.folder('_original-edge-functions')!;
      for (const ef of edgeFunctions) {
        originalFolder.file(`${ef.name}/index.ts`, ef.content);
      }
    }

    // ==========================================
    // 3. DATABASE
    // ==========================================
    if (includeDatabase) {
      const dbFolder = zip.folder('database')!;
      const migrationsFolder = dbFolder.folder('migrations')!;

      if (sqlSchema) {
        migrationsFolder.file('001_schema.sql', sqlSchema);
      }

      // Add seed data script template
      migrationsFolder.file('002_seed.sql', `-- Seed data for ${projectName}
-- Add your initial data here

-- Example:
-- INSERT INTO users (email) VALUES ('admin@example.com');
`);

      allEnvVars.add('POSTGRES_USER');
      allEnvVars.add('POSTGRES_PASSWORD');
      allEnvVars.add('POSTGRES_DB');
      allEnvVars.add('DATABASE_URL');
    }

    // ==========================================
    // 4. ROOT FILES
    // ==========================================
    const envVarsArray = Array.from(allEnvVars);
    
    // docker-compose.yml
    zip.file('docker-compose.yml', generateDockerCompose(
      projectName, 
      envVarsArray, 
      includeBackend && edgeFunctions?.length > 0,
      includeDatabase
    ));

    // .env.example
    const dbEnvSection = includeDatabase ? `# Base de données
POSTGRES_USER=app
POSTGRES_PASSWORD=  # OBLIGATOIRE
POSTGRES_DB=app
DATABASE_URL=postgresql://app:VOTRE_MOT_DE_PASSE@postgres:5432/app

` : '';

    const apiEnvVars = envVarsArray
      .filter(v => !['PORT', 'NODE_ENV', 'DOMAIN', 'DATABASE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].includes(v))
      .map(v => `${v}=`)
      .join('\n');

    const envExample = `# ${projectName} - Configuration
# Copiez vers .env et remplissez les valeurs

# Domaine
DOMAIN=

${dbEnvSection}# Sécurité
JWT_SECRET=  # OBLIGATOIRE (openssl rand -base64 32)

# APIs (si nécessaire)
${apiEnvVars}
`;
    zip.file('.env.example', envExample);

    // Deploy guide HTML with sovereignty score
    zip.file('DEPLOY_GUIDE.html', generateDeployGuide(
      projectName,
      envVarsArray,
      includeBackend && edgeFunctions?.length > 0,
      includeDatabase,
      sovereigntyCheck.score
    ));

    // Quick deploy script
    const scriptsFolder = zip.folder('scripts')!;
    scriptsFolder.file('quick-deploy.sh', generateQuickDeployScript(projectName, includeDatabase));

    // Sovereignty report
    zip.file('SOVEREIGNTY_REPORT.md', generateSovereigntyReport(
      projectName,
      sovereigntyCheck,
      Object.keys(doubleCleanedFiles).length
    ));

    // README
    const readme = `# ${projectName} - Liberation Pack

## 🛡️ Score de Souveraineté: ${sovereigntyCheck.score}%

## 🚀 Déploiement rapide

1. Transférez ce dossier sur votre VPS
2. Exécutez: \`./scripts/quick-deploy.sh\`
3. C'est tout !

## 📖 Guide complet

Ouvrez \`DEPLOY_GUIDE.html\` dans votre navigateur pour un guide interactif étape par étape.

## 📋 Rapport de souveraineté

Consultez \`SOVEREIGNTY_REPORT.md\` pour les détails du nettoyage effectué.

## 📁 Structure

\`\`\`
├── frontend/          # Application React
├── ${includeBackend ? 'backend/           # API Express (converti depuis Edge Functions)\n├── ' : ''}${includeDatabase ? 'database/          # Schéma SQL et migrations\n├── ' : ''}scripts/           # Scripts d'automatisation
├── docker-compose.yml # Stack complète
├── .env.example       # Variables d'environnement
├── DEPLOY_GUIDE.html  # Guide interactif
└── SOVEREIGNTY_REPORT.md # Rapport de nettoyage
\`\`\`

## 🔧 Commandes utiles

\`\`\`bash
docker compose up -d       # Démarrer
docker compose down        # Arrêter
docker compose logs -f     # Logs
docker compose restart     # Redémarrer
\`\`\`

---
Généré par **InoPay** - Libérez votre code !
`;
    zip.file('README.md', readme);

    // ==========================================
    // 5. GENERATE ZIP
    // ==========================================
    const zipBuffer = await zip.generateAsync({ 
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    // Upload to storage
    const fileName = `${safeName}_liberation_pack_${Date.now()}.zip`;
    const filePath = `${user.id}/${fileName}`;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: uploadError } = await supabaseAdmin.storage
      .from('cleaned-archives')
      .upload(filePath, zipBuffer, {
        contentType: 'application/zip',
        upsert: true
      });

    if (uploadError) {
      console.error('[generate-liberation-pack] Upload error:', uploadError);
      throw new Error(`Erreur upload: ${uploadError.message}`);
    }

    const { data: urlData } = await supabaseAdmin.storage
      .from('cleaned-archives')
      .createSignedUrl(filePath, 3600 * 24 * 7); // 7 days

    console.log(`[generate-liberation-pack] Pack generated successfully: ${fileName}`);

    return new Response(JSON.stringify({
      success: true,
      downloadUrl: urlData?.signedUrl,
      fileName,
      filePath,
      summary: {
        frontendFiles: Object.keys(doubleCleanedFiles).filter(p => !p.startsWith('supabase/')).length,
        backendRoutes: backendRoutes.length,
        envVars: envVarsArray.length,
        hasDatabase: includeDatabase,
        hasBackend: includeBackend && edgeFunctions?.length > 0,
        sovereigntyScore: sovereigntyCheck.score,
        isClean: sovereigntyCheck.isClean,
        criticalIssues: sovereigntyCheck.criticalIssues.length,
        warnings: sovereigntyCheck.warnings.length,
        serverSideChanges: totalServerChanges,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[generate-liberation-pack] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erreur interne' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
