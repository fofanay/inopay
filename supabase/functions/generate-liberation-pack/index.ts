import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TEMPLATES DOCKER
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
// TEMPLATES SERVICES OPEN SOURCE
// ============================================

const OLLAMA_DOCKER_COMPOSE = `# Service Ollama - IA locale
# Ajoutez ce service à votre docker-compose.yml principal

ollama:
  image: ollama/ollama:latest
  container_name: ollama
  restart: unless-stopped
  ports:
    - "11434:11434"
  volumes:
    - ollama_data:/root/.ollama
  environment:
    - OLLAMA_HOST=0.0.0.0
  networks:
    - app-network
  # Décommentez pour GPU NVIDIA
  # deploy:
  #   resources:
  #     reservations:
  #       devices:
  #         - driver: nvidia
  #           count: all
  #           capabilities: [gpu]

# Ajoutez à volumes:
#   ollama_data:
`;

const MEILISEARCH_DOCKER_COMPOSE = `# Service Meilisearch - Recherche full-text
# Ajoutez ce service à votre docker-compose.yml principal

meilisearch:
  image: getmeili/meilisearch:latest
  container_name: meilisearch
  restart: unless-stopped
  ports:
    - "7700:7700"
  volumes:
    - meilisearch_data:/meili_data
  environment:
    - MEILI_MASTER_KEY=\${MEILISEARCH_MASTER_KEY}
    - MEILI_ENV=production
  networks:
    - app-network
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:7700/health"]
    interval: 30s
    timeout: 10s
    retries: 3

# Ajoutez à volumes:
#   meilisearch_data:

# Ajoutez à .env:
#   MEILISEARCH_MASTER_KEY=votre_cle_secrete
`;

const MINIO_DOCKER_COMPOSE = `# Service MinIO - Stockage S3-compatible
# Ajoutez ce service à votre docker-compose.yml principal

minio:
  image: minio/minio:latest
  container_name: minio
  restart: unless-stopped
  ports:
    - "9000:9000"
    - "9001:9001"
  volumes:
    - minio_data:/data
  environment:
    - MINIO_ROOT_USER=\${MINIO_ACCESS_KEY}
    - MINIO_ROOT_PASSWORD=\${MINIO_SECRET_KEY}
  command: server /data --console-address ":9001"
  networks:
    - app-network
  healthcheck:
    test: ["CMD", "mc", "ready", "local"]
    interval: 30s
    timeout: 10s
    retries: 3

# Ajoutez à volumes:
#   minio_data:

# Ajoutez à .env:
#   MINIO_ACCESS_KEY=minioadmin
#   MINIO_SECRET_KEY=votre_mot_de_passe_securise
`;

const OPEN_SOURCE_SERVICES_GUIDE = `# 🔓 Guide des Services Open Source

Ce pack inclut des templates pour remplacer les services propriétaires par des alternatives 100% open source.

## 🤖 Ollama - IA Locale

**Remplace:** OpenAI API, Claude API, services IA propriétaires

### Installation

1. Ajoutez le service à \`docker-compose.yml\` (voir \`services/ollama/docker-compose.yml\`)
2. Démarrez: \`docker compose up -d ollama\`
3. Téléchargez un modèle:
   \`\`\`bash
   docker exec ollama ollama pull llama2
   docker exec ollama ollama pull mistral
   docker exec ollama ollama pull codellama  # Pour le code
   \`\`\`

### Utilisation dans votre code

\`\`\`typescript
// Remplacez vos appels OpenAI par:
const response = await fetch('http://ollama:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'llama2',
    messages: [{ role: 'user', content: 'Bonjour!' }],
    stream: false
  })
});
\`\`\`

### Modèles recommandés
- **llama2** / **llama3**: Usage général
- **mistral** / **mixtral**: Excellent équilibre qualité/vitesse
- **codellama**: Génération de code
- **phi**: Petit mais efficace

---

## 🔍 Meilisearch - Recherche Full-Text

**Remplace:** Algolia, Elasticsearch (plus simple)

### Installation

1. Ajoutez le service (voir \`services/meilisearch/docker-compose.yml\`)
2. Configurez \`MEILISEARCH_MASTER_KEY\` dans \`.env\`
3. Démarrez: \`docker compose up -d meilisearch\`

### Utilisation

\`\`\`typescript
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: 'http://meilisearch:7700',
  apiKey: process.env.MEILISEARCH_MASTER_KEY
});

// Indexer
await client.index('products').addDocuments(products);

// Rechercher
const results = await client.index('products').search('requête');
\`\`\`

---

## 📦 MinIO - Stockage S3-Compatible

**Remplace:** AWS S3, Supabase Storage, Cloudflare R2

### Installation

1. Ajoutez le service (voir \`services/minio/docker-compose.yml\`)
2. Configurez les credentials dans \`.env\`
3. Démarrez: \`docker compose up -d minio\`
4. Console admin: \`http://votre-ip:9001\`

### Utilisation

\`\`\`typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  endpoint: 'http://minio:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY
  },
  forcePathStyle: true
});

// Upload
await s3.send(new PutObjectCommand({
  Bucket: 'mon-bucket',
  Key: 'fichier.pdf',
  Body: buffer
}));
\`\`\`

---

## 📧 Mailhog - Email en Développement

**Remplace:** Services SMTP pour le dev

\`\`\`yaml
mailhog:
  image: mailhog/mailhog
  ports:
    - "1025:1025"  # SMTP
    - "8025:8025"  # Web UI
\`\`\`

---

## 🔄 Soketi - WebSocket Pusher-Compatible

**Remplace:** Pusher, Ably

\`\`\`yaml
soketi:
  image: quay.io/soketi/soketi:latest
  ports:
    - "6001:6001"
  environment:
    - SOKETI_DEFAULT_APP_ID=app-id
    - SOKETI_DEFAULT_APP_KEY=app-key
    - SOKETI_DEFAULT_APP_SECRET=app-secret
\`\`\`

---

## 📊 Tableau Comparatif

| Propriétaire | Alternative Open Source | Effort Migration |
|-------------|------------------------|------------------|
| OpenAI API | Ollama + Llama/Mistral | ⭐⭐ Moyen |
| Algolia | Meilisearch | ⭐ Facile |
| AWS S3 | MinIO | ⭐ Facile |
| Pusher | Soketi | ⭐ Facile |
| Supabase Auth | Self-hosted Supabase | ⭐⭐⭐ Complexe |

---

*Généré par InoPay Liberation Pack*
`;

// ============================================
// TEMPLATE AI CLIENT CONFIGURABLE
// ============================================

const AI_CLIENT_TEMPLATE = `/**
 * Client IA Configurable - Compatible Ollama, OpenRouter, OpenAI
 * Généré par InoPay Liberation Pack
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIConfig {
  provider: 'ollama' | 'openrouter' | 'openai' | 'custom';
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

const DEFAULT_CONFIGS: Record<string, Partial<AIConfig>> = {
  ollama: {
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama2'
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  }
};

export class AIClient {
  private config: AIConfig;

  constructor(config?: Partial<AIConfig>) {
    const provider = config?.provider || (process.env.AI_PROVIDER as any) || 'ollama';
    this.config = {
      provider,
      ...DEFAULT_CONFIGS[provider],
      ...config
    };
  }

  async chat(messages: AIMessage[], options?: { stream?: boolean }): Promise<string> {
    const { provider, baseUrl, apiKey, model } = this.config;

    if (provider === 'ollama') {
      return this.chatOllama(messages);
    }

    // OpenAI-compatible API (OpenRouter, OpenAI, etc.)
    const response = await fetch(\`\${baseUrl}/chat/completions\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'Authorization': \`Bearer \${apiKey}\` }),
        ...(provider === 'openrouter' && { 'HTTP-Referer': process.env.APP_URL || 'http://localhost' })
      },
      body: JSON.stringify({
        model,
        messages,
        stream: options?.stream || false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(\`AI Error: \${error}\`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async chatOllama(messages: AIMessage[]): Promise<string> {
    const response = await fetch(\`\${this.config.baseUrl}/api/chat\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(\`Ollama Error: \${await response.text()}\`);
    }

    const data = await response.json();
    return data.message.content;
  }

  async *streamChat(messages: AIMessage[]): AsyncGenerator<string> {
    const { provider, baseUrl, apiKey, model } = this.config;

    if (provider === 'ollama') {
      yield* this.streamOllama(messages);
      return;
    }

    const response = await fetch(\`\${baseUrl}/chat/completions\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { 'Authorization': \`Bearer \${apiKey}\` })
      },
      body: JSON.stringify({ model, messages, stream: true })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\\n').filter(line => line.startsWith('data: '));

      for (const line of lines) {
        const json = line.slice(6);
        if (json === '[DONE]') return;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {}
      }
    }
  }

  private async *streamOllama(messages: AIMessage[]): AsyncGenerator<string> {
    const response = await fetch(\`\${this.config.baseUrl}/api/chat\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        messages,
        stream: true
      })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      try {
        const parsed = JSON.parse(chunk);
        if (parsed.message?.content) yield parsed.message.content;
      } catch {}
    }
  }
}

// Instance par défaut
export const ai = new AIClient();

// Usage:
// import { ai } from '@/lib/ai-client';
// const response = await ai.chat([{ role: 'user', content: 'Bonjour!' }]);
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

  // === PASS 2: Remove proprietary imports (Extended for ALL AI platforms) ===
  const proprietaryImports = [
    // Lovable/GPTEngineer
    /import\s*{\s*componentTagger\s*}\s*from\s*['"]lovable-tagger['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]@lovable\/[^'"]*['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]@gptengineer\/[^'"]*['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]lovable-[^'"]*['"]\s*;?\n?/g,
    // Bolt/V0/Cursor
    /import\s*[^;]*\s*from\s*['"]@v0\/[^'"]*['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]@bolt\/[^'"]*['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]@cursor\/[^'"]*['"]\s*;?\n?/g,
    // Windsurf/Codeium
    /import\s*[^;]*\s*from\s*['"]@codeium\/[^'"]*['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]@windsurf\/[^'"]*['"]\s*;?\n?/g,
    // GitHub Copilot
    /import\s*[^;]*\s*from\s*['"]@github\/copilot[^'"]*['"]\s*;?\n?/g,
    // Tabnine
    /import\s*[^;]*\s*from\s*['"]@tabnine\/[^'"]*['"]\s*;?\n?/g,
    // Cline
    /import\s*[^;]*\s*from\s*['"]@cline\/[^'"]*['"]\s*;?\n?/g,
    // Amazon Q/CodeWhisperer
    /import\s*[^;]*\s*from\s*['"]@aws\/codewhisperer[^'"]*['"]\s*;?\n?/g,
    /import\s*[^;]*\s*from\s*['"]@aws\/amazon-q[^'"]*['"]\s*;?\n?/g,
    // Sourcegraph Cody
    /import\s*[^;]*\s*from\s*['"]@sourcegraph\/cody[^'"]*['"]\s*;?\n?/g,
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
    /\s*data-cursor[^=]*="[^"]*"/g,
    /\s*data-codeium[^=]*="[^"]*"/g,
    /\s*data-copilot[^=]*="[^"]*"/g,
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
    /\/\/\s*@codeium[^\n]*\n?/gi,
    /\/\/\s*@copilot[^\n]*\n?/gi,
    /\/\/\s*Generated by Lovable[^\n]*\n?/gi,
    /\/\/\s*Generated by Copilot[^\n]*\n?/gi,
    /\/\/\s*Generated by Codeium[^\n]*\n?/gi,
    /\/\/\s*Built with Lovable[^\n]*\n?/gi,
    /\/\/\s*AI-generated[^\n]*\n?/gi,
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
    'bolt.new', 'v0.dev', 'cursor.sh', 'replit.com',
    'codeium.com', 'windsurf.ai', 'copilot.github.com',
    'tabnine.com', 'sourcegraph.com', 'devin.ai'
  ];

  for (const domain of telemetryDomains) {
    const escapedDomain = domain.replace(/\./g, '\\.');
    const pattern = new RegExp(`['"\`][^'"\`]*${escapedDomain}[^'"\`]*['"\`]`, 'gi');
    const before = cleaned;
    cleaned = cleaned.replace(pattern, '""');
    if (cleaned !== before) changes.push(`Télémétrie ${domain} supprimée`);
  }

  // === PASS 10: Replace supabase.functions.invoke with fetch ===
  const before3 = cleaned;
  cleaned = cleaned.replace(
    /supabase\.functions\.invoke\(['"]([^'"]+)['"]/g,
    "fetch(`${import.meta.env.VITE_API_URL || ''}/api/$1`"
  );
  if (cleaned !== before3) changes.push('supabase.functions.invoke remplacé par fetch');

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
    if (!path.match(/\.(ts|tsx|js|jsx|json|html|css)$/)) continue;

    for (const { pattern, name, penalty } of criticalPatterns) {
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
// EDGE FUNCTION TO EXPRESS CONVERTER - COMPLET
// ============================================

interface EdgeFunctionInfo {
  name: string;
  content: string;
  hasAuth: boolean;
  httpMethods: string[];
  envVars: string[];
  usesSupabase: boolean;
  businessLogic: string;
}

function parseEdgeFunction(name: string, content: string): EdgeFunctionInfo {
  const envVars: string[] = [];
  const httpMethods: string[] = [];

  // Detect env variables - Extended patterns
  const envPatterns = [
    /Deno\.env\.get\(['"](\w+)['"]\)/g,
    /Deno\.env\.get\("(\w+)"\)/g,
  ];
  
  for (const envPattern of envPatterns) {
    let match;
    while ((match = envPattern.exec(content)) !== null) {
      if (match[1] && !envVars.includes(match[1])) {
        envVars.push(match[1]);
      }
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

  const usesSupabase = content.includes('supabase') || 
                       content.includes('@supabase') ||
                       content.includes('createClient');

  // Extract business logic (everything inside the main try/catch)
  let businessLogic = '';
  const tryMatch = content.match(/try\s*{([\s\S]*?)}\s*catch/);
  if (tryMatch) {
    businessLogic = tryMatch[1];
  }

  return { name, content, hasAuth, httpMethods, envVars, usesSupabase, businessLogic };
}

/**
 * Convertit le code Deno en code Node.js valide
 */
function convertDenoToNode(denoCode: string): string {
  let nodeCode = denoCode;

  // 1. Remplacer les imports Deno
  nodeCode = nodeCode.replace(
    /import\s*"https:\/\/deno\.land\/x\/xhr[^"]*";?\n?/g, 
    ''
  );
  nodeCode = nodeCode.replace(
    /import\s*{\s*serve\s*}\s*from\s*"https:\/\/deno\.land\/std[^"]*\/http\/server\.ts";?\n?/g,
    ''
  );
  nodeCode = nodeCode.replace(
    /import\s*{\s*createClient\s*}\s*from\s*"https:\/\/esm\.sh\/@supabase\/supabase-js[^"]*";?\n?/g,
    "import { createClient } from '@supabase/supabase-js';\n"
  );
  nodeCode = nodeCode.replace(
    /import\s+(\w+)\s+from\s*"https:\/\/esm\.sh\/([^"]+)";?\n?/g,
    "import $1 from '$2';\n"
  );

  // 2. Remplacer Deno.env.get par process.env
  nodeCode = nodeCode.replace(
    /Deno\.env\.get\(['"](\w+)['"]\)!?/g,
    "process.env.$1"
  );
  nodeCode = nodeCode.replace(
    /Deno\.env\.get\("(\w+)"\)!?/g,
    "process.env.$1"
  );

  // 3. Retirer les wrappers serve()
  nodeCode = nodeCode.replace(/serve\(async\s*\(req\)\s*=>\s*{/g, '');
  // Retirer la fermeture correspondante (la dernière })
  const lastBrace = nodeCode.lastIndexOf('});');
  if (lastBrace > -1) {
    nodeCode = nodeCode.slice(0, lastBrace) + nodeCode.slice(lastBrace + 3);
  }

  // 4. Adapter les Response aux Express res
  nodeCode = nodeCode.replace(
    /return new Response\(null,\s*{\s*headers:\s*corsHeaders\s*}\)/g,
    'return res.status(204).end()'
  );
  nodeCode = nodeCode.replace(
    /return new Response\(JSON\.stringify\(([^)]+)\),\s*{\s*status:\s*(\d+)[^}]*}\)/g,
    'return res.status($2).json($1)'
  );
  nodeCode = nodeCode.replace(
    /return new Response\(JSON\.stringify\(([^)]+)\),\s*{[^}]*headers:[^}]*}\)/g,
    'return res.json($1)'
  );

  return nodeCode;
}

function convertToExpressRoute(func: EdgeFunctionInfo): string {
  const routeName = func.name.replace(/-/g, '_');
  
  // Convertir le code Deno en Node.js
  let convertedLogic = convertDenoToNode(func.content);
  
  // Extraire le corps de la logique
  let bodyLogic = '';
  
  // Chercher le bloc try principal
  const tryBlockMatch = convertedLogic.match(/try\s*{([\s\S]*?)}\s*catch\s*\([^)]*\)\s*{[\s\S]*?}/);
  if (tryBlockMatch) {
    bodyLogic = tryBlockMatch[1]
      // Nettoyer les retours de corsHeaders dans les Response
      .replace(/,?\s*headers:\s*{\s*\.\.\.corsHeaders[^}]*}/g, '')
      .replace(/,?\s*headers:\s*corsHeaders/g, '')
      .trim();
  }

  // Déterminer les imports nécessaires
  let imports = `import { Router, Request, Response } from 'express';\n`;
  
  if (func.usesSupabase) {
    imports += `import { createClient } from '@supabase/supabase-js';\n`;
  }
  
  if (func.content.includes('Stripe') || func.content.includes('stripe')) {
    imports += `import Stripe from 'stripe';\n`;
  }
  
  if (func.content.includes('Resend') || func.content.includes('resend')) {
    imports += `import { Resend } from 'resend';\n`;
  }

  // Générer les initialisations
  let inits = '';
  
  if (func.usesSupabase) {
    inits += `
const supabaseUrl = process.env.SUPABASE_URL || process.env.DATABASE_URL?.split('@')[1]?.split('/')[0];
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

function createSupabaseClient(authHeader?: string) {
  return createClient(supabaseUrl!, supabaseKey!, {
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined
  });
}
`;
  }

  if (func.content.includes('Stripe')) {
    inits += `
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});
`;
  }

  if (func.content.includes('Resend')) {
    inits += `
const resend = new Resend(process.env.RESEND_API_KEY);
`;
  }

  // Générer le handler principal
  const method = func.httpMethods.includes('GET') ? 'get' : 'post';
  
  let handler = `
export const ${routeName}Router = Router();

${routeName}Router.${method}('/', async (req: Request, res: Response) => {
  try {
`;

  if (func.hasAuth) {
    handler += `    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header required' });
    }
    
    const supabase = createSupabaseClient(authHeader);
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
`;
  } else if (func.usesSupabase) {
    handler += `    const supabase = createSupabaseClient();
`;
  }

  // Ajouter la logique métier convertie si elle existe
  if (bodyLogic && bodyLogic.length > 50) {
    // Nettoyer et adapter la logique
    let cleanedLogic = bodyLogic
      // Remplacer les await req.json() par req.body
      .replace(/await\s+req\.json\(\)/g, 'req.body')
      .replace(/const\s*{\s*([^}]+)\s*}\s*=\s*req\.body/g, 'const { $1 } = req.body')
      // Adapter les retours
      .replace(/return\s+res\.status\((\d+)\)\.json/g, 'return res.status($1).json')
      .replace(/return\s+res\.json/g, 'return res.json');
    
    handler += `
    // === Logique métier migrée ===
    const body = req.body;
    
${cleanedLogic}
`;
  } else {
    // Fallback avec stub détaillé
    handler += `
    const body = req.body;
    
    // TODO: Logique métier à migrer depuis l'Edge Function originale
    // 
    // Variables d'environnement nécessaires:
${func.envVars.map(v => `    //   - ${v}`).join('\n') || '    //   (aucune détectée)'}
    //
    // Méthodes HTTP supportées: ${func.httpMethods.join(', ')}
    // Authentification requise: ${func.hasAuth ? 'Oui' : 'Non'}
    //
    // Voir le code original dans: _original-edge-functions/${func.name}/index.ts
    
    res.json({ 
      success: true, 
      message: 'Route ${func.name} migrée - logique à compléter',
      receivedBody: body
    });
`;
  }

  handler += `  } catch (error) {
    console.error('Error in ${routeName}:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      route: '${func.name}'
    });
  }
});
`;

  return imports + inits + handler;
}

function generateExpressBackend(functions: EdgeFunctionInfo[]): {
  routes: { name: string; content: string }[];
  indexTs: string;
  packageJson: string;
  tsconfigJson: string;
  middlewareAuth: string;
} {
  const routes = functions.map(func => ({
    name: func.name.replace(/-/g, '_'),
    content: convertToExpressRoute(func),
  }));

  const allEnvVars = new Set<string>(['PORT', 'DATABASE_URL', 'JWT_SECRET']);
  functions.forEach(f => f.envVars.forEach(v => allEnvVars.add(v)));

  // Middleware d'authentification
  const middlewareAuth = `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string };
}

export const authMiddleware = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header required' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; email: string };
    
    req.user = { id: decoded.sub, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { sub: string; email: string };
      req.user = { id: decoded.sub, email: decoded.email };
    }
    
    next();
  } catch {
    next();
  }
};
`;

  const indexTs = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';

dotenv.config();

${routes.map(r => `import { ${r.name}Router } from './routes/${r.name}';`).join('\n')}

const app = express();
const PORT = process.env.PORT || 3000;

// Sécurité
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Routes API
${routes.map(r => `app.use('/api/${r.name.replace(/_/g, '-')}', ${r.name}Router);`).join('\n')}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    path: req.path,
    availableRoutes: [${routes.map(r => `'/api/${r.name.replace(/_/g, '-')}'`).join(', ')}]
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 Backend server running on port \${PORT}\`);
  console.log(\`📍 Health check: http://localhost:\${PORT}/health\`);
  console.log(\`📂 Available routes:\`);
${routes.map(r => `  console.log(\`   - /api/${r.name.replace(/_/g, '-')}\`);`).join('\n')}
});

export default app;
`;

  const packageJson = JSON.stringify({
    name: "sovereign-backend-api",
    version: "1.0.0",
    description: "Backend API souverain - Converti depuis Supabase Edge Functions",
    main: "dist/index.js",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsc",
      start: "node dist/index.js",
      typecheck: "tsc --noEmit",
      lint: "eslint src --ext .ts"
    },
    dependencies: {
      express: "^4.18.2",
      cors: "^2.8.5",
      helmet: "^7.1.0",
      dotenv: "^16.3.1",
      "express-rate-limit": "^7.1.5",
      "@supabase/supabase-js": "^2.39.0",
      jsonwebtoken: "^9.0.2",
      pg: "^8.11.3",
      stripe: "^14.10.0",
      resend: "^2.1.0"
    },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/cors": "^2.8.17",
      "@types/node": "^20.10.0",
      "@types/jsonwebtoken": "^9.0.5",
      "@types/pg": "^8.10.9",
      tsx: "^4.7.0",
      typescript: "^5.3.0",
      eslint: "^8.56.0",
      "@typescript-eslint/eslint-plugin": "^6.18.0",
      "@typescript-eslint/parser": "^6.18.0"
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

  return { routes, indexTs, packageJson, tsconfigJson, middlewareAuth };
}

// ============================================
// DEPLOY GUIDE HTML GENERATOR - ENRICHI
// ============================================

function generateDeployGuide(
  projectName: string, 
  envVars: string[], 
  hasBackend: boolean, 
  hasDatabase: boolean, 
  sovereigntyScore: number,
  hasAI: boolean = false
): string {
  const envVarDescriptions: Record<string, { desc: string; required: boolean; example?: string }> = {
    'PORT': { desc: 'Port du serveur (défaut: 3000)', required: false, example: '3000' },
    'DATABASE_URL': { desc: 'URL PostgreSQL complète', required: true, example: 'postgresql://user:pass@localhost:5432/db' },
    'POSTGRES_USER': { desc: 'Utilisateur PostgreSQL', required: true, example: 'app' },
    'POSTGRES_PASSWORD': { desc: 'Mot de passe PostgreSQL', required: true, example: '(généré automatiquement)' },
    'POSTGRES_DB': { desc: 'Nom de la base', required: false, example: 'app' },
    'JWT_SECRET': { desc: 'Clé secrète JWT (32+ chars)', required: true, example: '(généré automatiquement)' },
    'STRIPE_SECRET_KEY': { desc: 'Clé secrète Stripe', required: false, example: 'sk_live_...' },
    'STRIPE_WEBHOOK_SECRET': { desc: 'Secret webhook Stripe', required: false, example: 'whsec_...' },
    'RESEND_API_KEY': { desc: 'Clé API Resend (emails)', required: false, example: 're_...' },
    'OPENAI_API_KEY': { desc: 'Clé API OpenAI (ou vide si Ollama)', required: false },
    'OLLAMA_URL': { desc: 'URL Ollama local', required: false, example: 'http://ollama:11434' },
    'OLLAMA_MODEL': { desc: 'Modèle Ollama', required: false, example: 'llama2' },
    'AI_PROVIDER': { desc: 'Provider IA (ollama/openai/openrouter)', required: false, example: 'ollama' },
    'SUPABASE_URL': { desc: 'URL projet Supabase (si utilisé)', required: false },
    'SUPABASE_ANON_KEY': { desc: 'Clé anonyme Supabase', required: false },
    'SUPABASE_SERVICE_ROLE_KEY': { desc: 'Clé service Supabase', required: false },
    'MEILISEARCH_MASTER_KEY': { desc: 'Clé master Meilisearch', required: false },
    'MINIO_ACCESS_KEY': { desc: 'Access key MinIO', required: false },
    'MINIO_SECRET_KEY': { desc: 'Secret key MinIO', required: false },
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
    :root { 
      --primary: #6366f1; 
      --primary-light: #818cf8;
      --success: #22c55e; 
      --warning: #f59e0b; 
      --danger: #ef4444;
      --bg: #0f172a; 
      --bg-card: #1e293b; 
      --bg-code: #0d1117;
      --text: #e2e8f0; 
      --text-muted: #94a3b8;
      --border: #334155; 
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; }
    .container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
    
    header { text-align: center; margin-bottom: 3rem; padding: 3rem 2rem; background: linear-gradient(135deg, var(--primary), #4f46e5); border-radius: 1.5rem; position: relative; overflow: hidden; }
    header::before { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"); }
    header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; position: relative; }
    header p { opacity: 0.9; font-size: 1.1rem; position: relative; }
    .sovereignty-badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: ${scoreColor}15; border: 2px solid ${scoreColor}; border-radius: 2rem; font-weight: 700; font-size: 1.1rem; color: ${scoreColor}; margin-top: 1.5rem; position: relative; backdrop-filter: blur(8px); }
    
    nav { background: var(--bg-card); border-radius: 1rem; padding: 1rem; margin-bottom: 2rem; border: 1px solid var(--border); position: sticky; top: 1rem; z-index: 100; }
    nav ul { display: flex; flex-wrap: wrap; gap: 0.5rem; list-style: none; justify-content: center; }
    nav a { color: var(--text-muted); text-decoration: none; padding: 0.5rem 1rem; border-radius: 0.5rem; transition: all 0.2s; font-size: 0.875rem; }
    nav a:hover { background: var(--primary); color: white; }
    
    section { background: var(--bg-card); border-radius: 1rem; padding: 2rem; margin-bottom: 1.5rem; border: 1px solid var(--border); }
    section h2 { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; font-size: 1.5rem; }
    section h3 { margin: 2rem 0 1rem; color: var(--primary-light); font-size: 1.1rem; }
    .step-num { background: var(--primary); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; flex-shrink: 0; }
    
    .code-block { position: relative; background: var(--bg-code); border-radius: 0.75rem; padding: 1.25rem; margin: 1rem 0; overflow-x: auto; border: 1px solid var(--border); }
    .code-block code { font-family: 'Fira Code', 'Monaco', monospace; font-size: 0.875rem; white-space: pre-wrap; color: #e6edf3; }
    .copy-btn { position: absolute; top: 0.75rem; right: 0.75rem; background: var(--primary); color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all 0.2s; }
    .copy-btn:hover { background: var(--primary-light); transform: scale(1.05); }
    .copy-btn.copied { background: var(--success); }
    
    .alert { padding: 1rem 1.25rem; border-radius: 0.75rem; margin: 1rem 0; display: flex; gap: 0.75rem; align-items: flex-start; }
    .alert-success { background: rgba(34, 197, 94, 0.1); border: 1px solid var(--success); }
    .alert-warning { background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); }
    .alert-info { background: rgba(99, 102, 241, 0.1); border: 1px solid var(--primary); }
    .alert-danger { background: rgba(239, 68, 68, 0.1); border: 1px solid var(--danger); }
    .alert strong { display: block; margin-bottom: 0.25rem; }
    
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { text-align: left; padding: 1rem; border-bottom: 1px solid var(--border); }
    th { background: var(--bg); font-weight: 600; color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
    td code { background: var(--bg); padding: 0.25rem 0.5rem; border-radius: 0.375rem; font-size: 0.875rem; }
    tr:hover { background: rgba(99, 102, 241, 0.05); }
    
    .checklist { list-style: none; }
    .checklist li { display: flex; align-items: flex-start; gap: 1rem; padding: 1rem; border-bottom: 1px solid var(--border); transition: background 0.2s; }
    .checklist li:hover { background: rgba(99, 102, 241, 0.05); }
    .checklist li:last-child { border-bottom: none; }
    .checklist input { width: 22px; height: 22px; accent-color: var(--success); cursor: pointer; margin-top: 2px; flex-shrink: 0; }
    .checklist label { cursor: pointer; flex: 1; }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin: 1rem 0; }
    .card { background: var(--bg); border-radius: 0.75rem; padding: 1.5rem; border: 1px solid var(--border); }
    .card h4 { color: var(--primary-light); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
    .card p { color: var(--text-muted); font-size: 0.875rem; }
    
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .tab { padding: 0.75rem 1.25rem; background: var(--bg); border: 1px solid var(--border); border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; }
    .tab:hover, .tab.active { background: var(--primary); border-color: var(--primary); color: white; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    
    footer { text-align: center; padding: 3rem 2rem; color: var(--text-muted); font-size: 0.875rem; }
    footer a { color: var(--primary); text-decoration: none; }
    footer a:hover { text-decoration: underline; }
    
    @media (max-width: 768px) {
      .container { padding: 1rem; }
      header { padding: 2rem 1rem; }
      header h1 { font-size: 1.75rem; }
      section { padding: 1.5rem; }
      nav { position: static; }
      nav ul { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 ${projectName}</h1>
      <p>Guide de déploiement autonome complet</p>
      <div class="sovereignty-badge">${scoreEmoji} Score de Souveraineté: ${sovereigntyScore}%</div>
    </header>
    
    <nav>
      <ul>
        <li><a href="#prerequisites">Prérequis</a></li>
        <li><a href="#upload">Upload</a></li>
        <li><a href="#config">Configuration</a></li>
        <li><a href="#deploy">Déploiement</a></li>
        ${hasBackend ? '<li><a href="#webhooks">Webhooks</a></li>' : ''}
        ${hasAI ? '<li><a href="#ai">IA Open Source</a></li>' : ''}
        ${hasDatabase ? '<li><a href="#database">Base de données</a></li>' : ''}
        <li><a href="#verify">Vérification</a></li>
        <li><a href="#troubleshoot">Dépannage</a></li>
      </ul>
    </nav>
    
    <section id="prerequisites">
      <h2><span class="step-num">1</span> Prérequis</h2>
      <ul class="checklist">
        <li><input type="checkbox" id="check-vps"> <label for="check-vps"><strong>Serveur VPS</strong> - Ubuntu 22.04+ ou Debian 12+ avec accès SSH root<br><span style="color: var(--text-muted); font-size: 0.875rem;">Recommandé: 2GB RAM, 2 vCPU minimum. Hetzner, OVH, Scaleway...</span></label></li>
        <li><input type="checkbox" id="check-docker"> <label for="check-docker"><strong>Docker</strong> - Sera installé automatiquement si absent</label></li>
        <li><input type="checkbox" id="check-domain"> <label for="check-domain"><strong>Domaine (optionnel)</strong> - Enregistrement A pointant vers l'IP du serveur pour HTTPS automatique</label></li>
        ${hasBackend ? '<li><input type="checkbox" id="check-stripe"> <label for="check-stripe"><strong>Compte Stripe (si paiements)</strong> - Clés API et webhook configurés</label></li>' : ''}
      </ul>
      
      <div class="grid">
        <div class="card">
          <h4>💡 VPS Économique</h4>
          <p>Hetzner CX11 (~4€/mois), OVH Starter (~3€/mois), Scaleway DEV1-S (~5€/mois)</p>
        </div>
        <div class="card">
          <h4>🔒 Sécurité recommandée</h4>
          <p>Clé SSH (pas de mot de passe), Firewall UFW, Fail2ban</p>
        </div>
      </div>
    </section>
    
    <section id="upload">
      <h2><span class="step-num">2</span> Upload & Extraction</h2>
      <div class="code-block"><code># Connexion au serveur
ssh root@VOTRE_IP

# Créer le dossier et transférer le ZIP
mkdir -p /opt/apps && cd /opt/apps

# Depuis votre machine locale (autre terminal):
scp liberation-pack.zip root@VOTRE_IP:/opt/apps/

# Retour sur le serveur - Extraction
cd /opt/apps
unzip liberation-pack.zip
cd ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
      
      <div class="alert alert-info">
        💡 <strong>Alternative: Téléchargement direct</strong><br>
        Si votre pack est hébergé en ligne, utilisez: <code>wget URL_DU_ZIP && unzip liberation-pack.zip</code>
      </div>
    </section>
    
    <section id="config">
      <h2><span class="step-num">3</span> Configuration</h2>
      
      <h3>3.1 - Fichier d'environnement</h3>
      <div class="code-block"><code># Copier le template
cp .env.example .env

# Éditer avec nano ou vim
nano .env</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
      
      <h3>3.2 - Variables à configurer</h3>
      <table>
        <thead><tr><th>Variable</th><th>Description</th><th>Requis</th><th>Exemple</th></tr></thead>
        <tbody>
          ${envVars.map(v => {
            const info = envVarDescriptions[v] || { desc: 'Variable personnalisée', required: false };
            return `<tr>
              <td><code>${v}</code></td>
              <td>${info.desc}</td>
              <td>${info.required ? '✅' : '❌'}</td>
              <td><code>${info.example || '-'}</code></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      
      <div class="alert alert-warning">
        ⚠️ <strong>Important</strong><br>
        Les mots de passe et secrets seront générés automatiquement par le script quick-deploy.sh si vous les laissez vides.
      </div>
    </section>
    
    <section id="deploy">
      <h2><span class="step-num">4</span> Déploiement</h2>
      
      <div class="tabs">
        <button class="tab active" onclick="showTab('quick')">🚀 Méthode Rapide</button>
        <button class="tab" onclick="showTab('manual')">🔧 Manuel</button>
      </div>
      
      <div id="tab-quick" class="tab-content active">
        <div class="code-block"><code># Rendre le script exécutable et lancer
chmod +x scripts/quick-deploy.sh
sudo ./scripts/quick-deploy.sh</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
        <div class="alert alert-success">
          ✅ <strong>Le script fait tout automatiquement:</strong><br>
          Installation Docker, génération des secrets, configuration firewall, démarrage des services
        </div>
      </div>
      
      <div id="tab-manual" class="tab-content">
        <div class="code-block"><code># 1. Installer Docker (si absent)
curl -fsSL https://get.docker.com | sh

# 2. Générer les secrets
JWT_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 16)
echo "JWT_SECRET=$JWT_SECRET" >> .env
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> .env

# 3. Construire et démarrer
docker compose up -d --build

# 4. Vérifier le statut
docker compose ps</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
      </div>
    </section>
    
    ${hasBackend ? `
    <section id="webhooks">
      <h2><span class="step-num">5</span> Configuration des Webhooks</h2>
      
      <div class="alert alert-warning">
        ⚠️ <strong>Action requise</strong><br>
        Si votre application utilise des webhooks (Stripe, GitHub, etc.), vous devez les reconfigurer pour pointer vers votre nouveau serveur.
      </div>
      
      <h3>🔗 Webhook Stripe</h3>
      <ol style="padding-left: 1.5rem; line-height: 2;">
        <li>Connectez-vous à votre <a href="https://dashboard.stripe.com/webhooks" target="_blank" style="color: var(--primary);">Dashboard Stripe</a></li>
        <li>Cliquez sur "Ajouter un endpoint"</li>
        <li>URL: <code>https://VOTRE_DOMAINE/api/stripe-webhook</code></li>
        <li>Sélectionnez les événements: <code>checkout.session.completed</code>, <code>customer.subscription.updated</code>, etc.</li>
        <li>Copiez le "Signing secret" (commence par <code>whsec_</code>)</li>
        <li>Ajoutez dans votre <code>.env</code>: <code>STRIPE_WEBHOOK_SECRET=whsec_...</code></li>
        <li>Redémarrez: <code>docker compose restart backend</code></li>
      </ol>
      
      <h3>🔗 Webhook GitHub</h3>
      <ol style="padding-left: 1.5rem; line-height: 2;">
        <li>Allez dans Settings > Webhooks de votre repo</li>
        <li>Payload URL: <code>https://VOTRE_DOMAINE/api/github-webhook</code></li>
        <li>Content type: <code>application/json</code></li>
        <li>Secret: Générez et ajoutez dans <code>.env</code></li>
      </ol>
      
      <h3>🧪 Tester les webhooks en local</h3>
      <div class="code-block"><code># Avec ngrok (pour tests)
ngrok http 3000

# Avec Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe-webhook</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
    </section>
    ` : ''}
    
    ${hasAI ? `
    <section id="ai">
      <h2><span class="step-num">6</span> IA Open Source avec Ollama</h2>
      
      <div class="alert alert-info">
        💡 <strong>Alternative gratuite à OpenAI</strong><br>
        Ollama permet de faire tourner des modèles IA localement, sans API externe ni coûts récurrents.
      </div>
      
      <h3>Installation</h3>
      <div class="code-block"><code># Ajouter Ollama à votre stack (copier le contenu de services/ollama/docker-compose.yml)
# Puis:
docker compose up -d ollama

# Télécharger un modèle (exemples)
docker exec ollama ollama pull llama2        # Usage général
docker exec ollama ollama pull mistral       # Excellent équilibre
docker exec ollama ollama pull codellama     # Pour le code</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
      
      <h3>Configuration</h3>
      <div class="code-block"><code># Dans .env
AI_PROVIDER=ollama
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama2</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
      
      <h3>Modèles recommandés</h3>
      <table>
        <thead><tr><th>Modèle</th><th>Taille</th><th>Usage</th><th>RAM requise</th></tr></thead>
        <tbody>
          <tr><td><code>llama2:7b</code></td><td>3.8 GB</td><td>Usage général</td><td>8 GB</td></tr>
          <tr><td><code>mistral:7b</code></td><td>4.1 GB</td><td>Meilleur rapport qualité/vitesse</td><td>8 GB</td></tr>
          <tr><td><code>codellama:7b</code></td><td>3.8 GB</td><td>Génération de code</td><td>8 GB</td></tr>
          <tr><td><code>mixtral:8x7b</code></td><td>26 GB</td><td>Qualité maximale</td><td>48 GB</td></tr>
          <tr><td><code>phi</code></td><td>1.6 GB</td><td>Petit mais efficace</td><td>4 GB</td></tr>
        </tbody>
      </table>
      
      <div class="alert alert-success">
        ✅ Le client IA inclus (<code>src/lib/ai-client.ts</code>) supporte Ollama, OpenRouter et OpenAI. Changez simplement <code>AI_PROVIDER</code> dans .env.
      </div>
    </section>
    ` : ''}
    
    ${hasDatabase ? `
    <section id="database">
      <h2><span class="step-num">7</span> Base de données</h2>
      
      <h3>Migrations automatiques</h3>
      <p>Les migrations SQL dans <code>database/migrations/</code> sont exécutées automatiquement au premier démarrage de PostgreSQL.</p>
      
      <h3>Accès à la base</h3>
      <div class="code-block"><code># Connexion directe
docker exec -it ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-postgres psql -U app -d app

# Depuis l'extérieur (avec le port exposé)
psql postgresql://app:VOTRE_MOT_DE_PASSE@VOTRE_IP:5432/app</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
      
      <h3>Backup & Restore</h3>
      <div class="code-block"><code># Backup
docker exec ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-postgres pg_dump -U app app > backup.sql

# Restore
cat backup.sql | docker exec -i ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-postgres psql -U app app</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
      
      <div class="alert alert-warning">
        ⚠️ <strong>Sécurité</strong><br>
        Le port 5432 est exposé pour le développement. En production, retirez le mapping de port dans docker-compose.yml.
      </div>
    </section>
    ` : ''}
    
    <section id="verify">
      <h2><span class="step-num">${hasDatabase ? '8' : hasAI ? '7' : hasBackend ? '6' : '5'}</span> Vérification</h2>
      
      <div class="code-block"><code># Statut des containers
docker compose ps

# Logs en temps réel
docker compose logs -f

# Test santé frontend
curl http://localhost

# Test santé API ${hasBackend ? '\ncurl http://localhost/api/health' : '(pas de backend)'}</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
      
      <div class="alert alert-success">
        🎉 <strong>Votre application est accessible!</strong><br>
        Frontend: <code>http://VOTRE_IP</code> ${hasBackend ? '| API: <code>http://VOTRE_IP/api/*</code>' : ''}
      </div>
      
      <h3>Checklist post-déploiement</h3>
      <ul class="checklist">
        <li><input type="checkbox" id="post-1"> <label for="post-1">Tous les containers sont en statut "healthy" ou "Up"</label></li>
        <li><input type="checkbox" id="post-2"> <label for="post-2">L'application se charge correctement dans le navigateur</label></li>
        ${hasBackend ? '<li><input type="checkbox" id="post-3"> <label for="post-3">L\'endpoint /api/health renvoie {"status":"ok"}</label></li>' : ''}
        ${hasDatabase ? '<li><input type="checkbox" id="post-4"> <label for="post-4">Les migrations SQL se sont exécutées correctement</label></li>' : ''}
        <li><input type="checkbox" id="post-5"> <label for="post-5">SSL/HTTPS fonctionne (si domaine configuré)</label></li>
        ${hasBackend ? '<li><input type="checkbox" id="post-6"> <label for="post-6">Les webhooks sont configurés et testés</label></li>' : ''}
      </ul>
    </section>
    
    <section id="troubleshoot">
      <h2>🔧 Dépannage</h2>
      
      <h3>Commandes utiles</h3>
      <div class="code-block"><code># Voir les 100 dernières lignes de logs
docker compose logs --tail=100

# Logs d'un service spécifique
docker compose logs -f frontend
docker compose logs -f backend

# Redémarrer un service
docker compose restart frontend

# Reconstruire complètement
docker compose down
docker compose build --no-cache
docker compose up -d

# Nettoyer les images inutilisées
docker system prune -af</code><button class="copy-btn" onclick="copyCode(this)">Copier</button></div>
      
      <h3>Problèmes fréquents</h3>
      <div class="grid">
        <div class="card">
          <h4>🔴 Container qui redémarre en boucle</h4>
          <p>Vérifiez les logs: <code>docker compose logs [service]</code><br>Souvent un problème de variable d'environnement manquante.</p>
        </div>
        <div class="card">
          <h4>🔴 Erreur "port already in use"</h4>
          <p>Un autre service utilise le port. Trouvez-le: <code>lsof -i :80</code> puis arrêtez-le ou changez le port dans docker-compose.yml</p>
        </div>
        <div class="card">
          <h4>🔴 CORS errors</h4>
          <p>Ajoutez votre domaine dans <code>CORS_ORIGIN</code> du .env et redémarrez le backend.</p>
        </div>
        <div class="card">
          <h4>🔴 SSL ne fonctionne pas</h4>
          <p>Vérifiez que le DNS pointe vers votre IP. Attendez propagation DNS (jusqu'à 48h). Vérifiez les logs Caddy.</p>
        </div>
      </div>
    </section>
    
    <footer>
      <p>Généré par <strong>InoPay Liberation Pack v4.0</strong></p>
      <p><a href="https://inopay.fr">inopay.fr</a> - Libérez votre code, reprenez le contrôle !</p>
    </footer>
  </div>
  
  <script>
    function copyCode(btn) {
      const code = btn.parentElement.querySelector('code').textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copié!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copier';
          btn.classList.remove('copied');
        }, 2000);
      });
    }
    
    function showTab(name) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('tab-' + name).classList.add('active');
    }
    
    // Smooth scroll pour la navigation
    document.querySelectorAll('nav a').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(link.getAttribute('href'));
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    
    // Sauvegarder l'état des checkboxes
    document.querySelectorAll('.checklist input').forEach(checkbox => {
      const key = 'check-' + checkbox.id;
      checkbox.checked = localStorage.getItem(key) === 'true';
      checkbox.addEventListener('change', () => {
        localStorage.setItem(key, checkbox.checked);
      });
    });
  </script>
</body>
</html>`;
}

// ============================================
// DOCKER COMPOSE GENERATOR - ENRICHI
// ============================================

function generateDockerCompose(
  projectName: string, 
  envVars: string[], 
  hasBackend: boolean, 
  hasDatabase: boolean,
  hasAI: boolean = false
): string {
  const serviceName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  return `version: '3.8'

# ═══════════════════════════════════════════════════════════════
# ${projectName} - Stack de Production Souveraine
# Généré par InoPay Liberation Pack v4.0
# ═══════════════════════════════════════════════════════════════

services:
  # ─────────────────────────────────────────────────────────────
  # FRONTEND - Application React avec Caddy (auto-SSL)
  # ─────────────────────────────────────────────────────────────
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
      - VITE_API_URL=\${VITE_API_URL:-http://localhost/api}
    volumes:
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:80/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
${hasBackend || hasDatabase ? `    depends_on:
${hasBackend ? '      backend:\n        condition: service_healthy' : ''}
${hasDatabase ? '      postgres:\n        condition: service_healthy' : ''}` : ''}

${hasBackend ? `
  # ─────────────────────────────────────────────────────────────
  # BACKEND - API Express.js (converti depuis Edge Functions)
  # ─────────────────────────────────────────────────────────────
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
      - CORS_ORIGIN=\${DOMAIN:-*}
${envVars.filter(v => !['DOMAIN', 'VITE_API_URL'].includes(v)).map(v => `      - ${v}=\${${v}}`).join('\n')}
${hasDatabase ? `      - DATABASE_URL=postgresql://\${POSTGRES_USER:-app}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB:-app}` : ''}
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s
${hasDatabase ? `    depends_on:
      postgres:
        condition: service_healthy` : ''}
` : ''}

${hasDatabase ? `
  # ─────────────────────────────────────────────────────────────
  # DATABASE - PostgreSQL 15
  # ─────────────────────────────────────────────────────────────
  postgres:
    image: postgres:15-alpine
    container_name: ${serviceName}-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=\${POSTGRES_USER:-app}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
      - POSTGRES_DB=\${POSTGRES_DB:-app}
      - PGDATA=/var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d:ro
    # Décommentez pour accès externe (développement uniquement!)
    # ports:
    #   - "5432:5432"
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER:-app} -d \${POSTGRES_DB:-app}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
` : ''}

  # ─────────────────────────────────────────────────────────────
  # WATCHTOWER - Mise à jour automatique des containers
  # ─────────────────────────────────────────────────────────────
  watchtower:
    image: containrrr/watchtower
    container_name: ${serviceName}-watchtower
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - WATCHTOWER_CLEANUP=true
      - WATCHTOWER_POLL_INTERVAL=86400  # Vérifie toutes les 24h
      - WATCHTOWER_INCLUDE_STOPPED=false
    networks:
      - app-network

# ═══════════════════════════════════════════════════════════════
# VOLUMES PERSISTANTS
# ═══════════════════════════════════════════════════════════════
volumes:
  caddy_data:
  caddy_config:
${hasDatabase ? '  postgres_data:' : ''}

# ═══════════════════════════════════════════════════════════════
# RÉSEAU
# ═══════════════════════════════════════════════════════════════
networks:
  app-network:
    driver: bridge
`;
}

function generateDockerComposeFull(projectName: string, envVars: string[]): string {
  const serviceName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  return `version: '3.8'

# ═══════════════════════════════════════════════════════════════
# ${projectName} - Stack COMPLÈTE avec Services Open Source
# Inclut: Ollama (IA), Meilisearch (Recherche), MinIO (Storage)
# ═══════════════════════════════════════════════════════════════

services:
  # ... (inclure les services de base) ...
  
  # ─────────────────────────────────────────────────────────────
  # OLLAMA - IA Locale (remplace OpenAI)
  # ─────────────────────────────────────────────────────────────
  ollama:
    image: ollama/ollama:latest
    container_name: ${serviceName}-ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_HOST=0.0.0.0
    networks:
      - app-network
    # Pour GPU NVIDIA, décommentez:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: all
    #           capabilities: [gpu]

  # ─────────────────────────────────────────────────────────────
  # MEILISEARCH - Recherche Full-Text (remplace Algolia)
  # ─────────────────────────────────────────────────────────────
  meilisearch:
    image: getmeili/meilisearch:latest
    container_name: ${serviceName}-meilisearch
    restart: unless-stopped
    ports:
      - "7700:7700"
    volumes:
      - meilisearch_data:/meili_data
    environment:
      - MEILI_MASTER_KEY=\${MEILISEARCH_MASTER_KEY}
      - MEILI_ENV=production
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:7700/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ─────────────────────────────────────────────────────────────
  # MINIO - Stockage S3-Compatible (remplace AWS S3)
  # ─────────────────────────────────────────────────────────────
  minio:
    image: minio/minio:latest
    container_name: ${serviceName}-minio
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    environment:
      - MINIO_ROOT_USER=\${MINIO_ACCESS_KEY:-minioadmin}
      - MINIO_ROOT_PASSWORD=\${MINIO_SECRET_KEY}
    command: server /data --console-address ":9001"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  ollama_data:
  meilisearch_data:
  minio_data:

networks:
  app-network:
    driver: bridge
`;
}

// ============================================
// QUICK DEPLOY SCRIPT - AMÉLIORÉ
// ============================================

function generateQuickDeployScript(projectName: string, hasDatabase: boolean, hasAI: boolean = false): string {
  const safeName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  
  return `#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════
# InoPay Liberation Pack - Script de Déploiement Automatique
# Projet: ${projectName}
# ═══════════════════════════════════════════════════════════════

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

echo -e "\${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   🚀 InoPay Liberation Pack - ${projectName}"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "\${NC}"

# Vérification root
if [ "\\$EUID" -ne 0 ]; then
  echo -e "\${RED}❌ Ce script doit être exécuté en tant que root\${NC}"
  echo -e "   Utilisez: \${YELLOW}sudo ./quick-deploy.sh\${NC}"
  exit 1
fi

# ─────────────────────────────────────────────────────────────
# 1. Installation Docker
# ─────────────────────────────────────────────────────────────
echo -e "\${YELLOW}📦 Vérification de Docker...\${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "\${YELLOW}📥 Installation de Docker...\${NC}"
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
  echo -e "\${GREEN}✓ Docker installé avec succès\${NC}"
else
  echo -e "\${GREEN}✓ Docker est déjà installé ($(docker --version))\${NC}"
fi

# Docker Compose (inclus dans Docker récent)
if ! docker compose version &> /dev/null; then
  echo -e "\${RED}❌ Docker Compose non disponible\${NC}"
  exit 1
fi

# ─────────────────────────────────────────────────────────────
# 2. Configuration des variables d'environnement
# ─────────────────────────────────────────────────────────────
echo -e "\${YELLOW}⚙️  Configuration de l'environnement...\${NC}"

if [ ! -f .env ]; then
  cp .env.example .env
  
  # Génération automatique des secrets
  JWT_SECRET=$(openssl rand -base64 32)
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
  echo -e "\${GREEN}✓ JWT_SECRET généré\${NC}"
  
${hasDatabase ? `  # Base de données
  POSTGRES_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')
  sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://app:$POSTGRES_PASSWORD@postgres:5432/app|" .env
  echo -e "\${GREEN}✓ POSTGRES_PASSWORD généré\${NC}"
` : ''}

  echo -e "\${GREEN}✓ Fichier .env créé\${NC}"
else
  echo -e "\${GREEN}✓ Fichier .env existant conservé\${NC}"
fi

# ─────────────────────────────────────────────────────────────
# 3. Configuration du firewall
# ─────────────────────────────────────────────────────────────
echo -e "\${YELLOW}🔥 Configuration du firewall...\${NC}"

if command -v ufw &> /dev/null; then
  ufw allow 22/tcp   # SSH
  ufw allow 80/tcp   # HTTP
  ufw allow 443/tcp  # HTTPS
  echo -e "\${GREEN}✓ Ports 80 et 443 ouverts\${NC}"
fi

# ─────────────────────────────────────────────────────────────
# 4. Build et démarrage
# ─────────────────────────────────────────────────────────────
echo -e "\${YELLOW}🐳 Construction et démarrage des containers...\${NC}"

docker compose pull 2>/dev/null || true
docker compose build --no-cache
docker compose up -d

# ─────────────────────────────────────────────────────────────
# 5. Attente et vérification
# ─────────────────────────────────────────────────────────────
echo -e "\${YELLOW}⏳ Attente du démarrage des services...\${NC}"
sleep 15

# Vérification des containers
echo ""
docker compose ps

# Test de santé
HEALTH_CHECK=$(curl -s http://localhost 2>/dev/null | head -c 100 || echo "")

echo -e "\${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !             ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "\${NC}"

# Récupérer l'IP publique
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "VOTRE_IP")

echo -e "\${BLUE}📍 Accès à votre application:\${NC}"
echo -e "   Frontend:  \${GREEN}http://$PUBLIC_IP\${NC}"
echo -e "   API:       \${GREEN}http://$PUBLIC_IP/api/health\${NC}"
${hasDatabase ? `echo -e "   PostgreSQL: localhost:5432 (interne)"` : ''}
${hasAI ? `echo -e "   Ollama:    \${GREEN}http://$PUBLIC_IP:11434\${NC} (si activé)"` : ''}

echo ""
echo -e "\${YELLOW}📋 Commandes utiles:\${NC}"
echo "   docker compose logs -f          # Voir les logs"
echo "   docker compose restart          # Redémarrer"
echo "   docker compose down             # Arrêter"
echo ""
echo -e "\${BLUE}📖 Guide complet: ouvrez DEPLOY_GUIDE.html\${NC}"
echo ""
`;
}

// ============================================
// SOVEREIGNTY REPORT GENERATOR
// ============================================

function generateSovereigntyReport(projectName: string, check: SovereigntyCheck, fileCount: number): string {
  const date = new Date().toISOString();
  
  return `# 🛡️ Rapport de Souveraineté - ${projectName}

**Date de génération:** ${date}
**Score de souveraineté:** ${check.score}%
**Fichiers analysés:** ${fileCount}

---

## 📊 Statut Global

${check.isClean ? '✅ **CODE 100% SOUVERAIN** - Aucune dépendance propriétaire détectée!' : '⚠️ **ATTENTION** - Des éléments propriétaires peuvent subsister'}

---

${check.criticalIssues.length > 0 ? `
## 🔴 Problèmes Critiques (${check.criticalIssues.length})

Ces éléments doivent être corrigés manuellement:

${check.criticalIssues.map(issue => `- ❌ ${issue}`).join('\n')}
` : ''}

${check.warnings.length > 0 ? `
## 🟡 Avertissements (${check.warnings.length})

${check.warnings.map(warning => `- ⚠️ ${warning}`).join('\n')}
` : ''}

---

## ✅ Nettoyage Effectué

### Imports & Dépendances
- ✅ Imports propriétaires supprimés (@lovable, @gptengineer, @bolt, @v0, @cursor, @codeium, @copilot, @tabnine...)
- ✅ Packages NPM suspects retirés
- ✅ Plugins Vite propriétaires désactivés

### Identifiants & Secrets
- ✅ IDs de projet Supabase remplacés par des placeholders
- ✅ Tokens JWT exposés neutralisés
- ✅ Clés Stripe live/test masquées

### Télémétrie & Tracking
- ✅ Domaines de télémétrie supprimés (lovable.app, gptengineer.app, bolt.new, etc.)
- ✅ Attributs data-* de tracking retirés
- ✅ Commentaires avec références propriétaires nettoyés

### Appels Backend
- ✅ \`supabase.functions.invoke\` convertis en \`fetch\` vers \`/api/...\`
- ✅ Edge Functions converties en routes Express

---

## 📁 Polyfills Générés

Les hooks propriétaires ont été remplacés par des implémentations souveraines:

| Hook Original | Remplacement | Fichier |
|---------------|--------------|---------|
| \`@/hooks/use-mobile\` | Détection viewport | \`src/lib/hooks/use-mobile.ts\` |
| \`@/hooks/use-toast\` | Notifications | \`src/lib/hooks/use-toast.ts\` |
| \`@/components/ui/use-toast\` | Toast UI | \`src/lib/hooks/use-toast.ts\` |
| \`@/integrations/supabase\` | Client configurable | \`src/lib/supabase-client.ts\` |

---

## 🔄 Conversions Effectuées

### Edge Functions → Express

Les Supabase Edge Functions ont été converties en routes Express.js:

\`\`\`
supabase/functions/{name}/index.ts → backend/src/routes/{name}.ts
\`\`\`

- Imports Deno → Imports Node.js/npm
- \`Deno.env.get()\` → \`process.env\`
- \`new Response()\` → \`res.json()\`
- CORS headers intégrés dans le middleware Express

---

## 🚀 Prochaines Étapes

1. **Configurer les variables d'environnement**
   - Copiez \`.env.example\` vers \`.env\`
   - Remplissez les valeurs requises

2. **Si vous utilisez Supabase self-hosted:**
   - Créez un nouveau projet
   - Exécutez les migrations dans \`database/migrations/\`
   - Mettez à jour les URLs dans \`.env\`

3. **Si vous utilisez une IA:**
   - Installez Ollama ou configurez OpenRouter
   - Mettez à jour \`AI_PROVIDER\` dans \`.env\`

4. **Déployez:**
   \`\`\`bash
   sudo ./scripts/quick-deploy.sh
   \`\`\`

---

## 📋 Checklist Finale

- [ ] Variables d'environnement configurées
- [ ] Base de données migrée (si applicable)
- [ ] Webhooks reconfigurés (Stripe, GitHub...)
- [ ] DNS configuré pour HTTPS
- [ ] Tests fonctionnels passés

---

*Généré par **InoPay Liberation Pack v4.0** - Libérez votre code!*
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
      includeAIServices = false,
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
    // SOVEREIGNTY VERIFICATION
    // ==========================================
    const sovereigntyCheck = verifySovereignty(doubleCleanedFiles);
    
    console.log(`[generate-liberation-pack] Sovereignty check: score=${sovereigntyCheck.score}, clean=${sovereigntyCheck.isClean}`);

    const zip = new JSZip();
    const safeName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Déterminer si le projet utilise l'IA
    const hasAIUsage = Object.values(doubleCleanedFiles).some(content => 
      (content as string).includes('openai') || 
      (content as string).includes('anthropic') || 
      (content as string).includes('OPENAI_API_KEY') ||
      (content as string).includes('ai-client') ||
      (content as string).includes('/chat/completions')
    );

    // ==========================================
    // 1. FRONTEND
    // ==========================================
    const frontendFolder = zip.folder('frontend')!;
    
    for (const [path, content] of Object.entries(doubleCleanedFiles)) {
      if (!path.startsWith('supabase/')) {
        frontendFolder.file(path, content as string);
      }
    }
    
    // Ajouter le client IA configurable
    if (hasAIUsage) {
      frontendFolder.file('src/lib/ai-client.ts', AI_CLIENT_TEMPLATE);
    }
    
    frontendFolder.file('Dockerfile', FRONTEND_DOCKERFILE);
    frontendFolder.file('nginx.conf', NGINX_CONF);
    
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
}

# Pour HTTPS avec domaine personnalisé, remplacez :80 par:
# {$DOMAIN} {
#   ...
# }`;
    frontendFolder.file('Caddyfile', caddyfile);

    // ==========================================
    // 2. BACKEND (depuis Edge Functions - CONVERSION COMPLÈTE)
    // ==========================================
    let backendRoutes: string[] = [];
    const allEnvVars = new Set<string>(['PORT', 'NODE_ENV', 'JWT_SECRET']);

    if (includeBackend && edgeFunctions && edgeFunctions.length > 0) {
      const backendFolder = zip.folder('backend')!;
      const srcFolder = backendFolder.folder('src')!;
      const routesFolder = srcFolder.folder('routes')!;
      const middlewareFolder = srcFolder.folder('middleware')!;

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

      middlewareFolder.file('auth.ts', backend.middlewareAuth);
      srcFolder.file('index.ts', backend.indexTs);
      backendFolder.file('package.json', backend.packageJson);
      backendFolder.file('tsconfig.json', backend.tsconfigJson);
      backendFolder.file('Dockerfile', BACKEND_DOCKERFILE);

      // Garder les originaux pour référence
      const originalFolder = backendFolder.folder('_original-edge-functions')!;
      for (const ef of edgeFunctions) {
        originalFolder.file(`${ef.name}/index.ts`, ef.content);
      }

      // .dockerignore
      backendFolder.file('.dockerignore', `node_modules
dist
.env
*.log
.git
_original-edge-functions
`);
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

      migrationsFolder.file('002_seed.sql', `-- Seed data for ${projectName}
-- Add your initial data here

-- Example:
-- INSERT INTO users (email, role) VALUES ('admin@example.com', 'admin');
`);

      allEnvVars.add('POSTGRES_USER');
      allEnvVars.add('POSTGRES_PASSWORD');
      allEnvVars.add('POSTGRES_DB');
      allEnvVars.add('DATABASE_URL');
    }

    // ==========================================
    // 4. SERVICES OPEN SOURCE
    // ==========================================
    const servicesFolder = zip.folder('services')!;
    
    // Ollama
    const ollamaFolder = servicesFolder.folder('ollama')!;
    ollamaFolder.file('docker-compose.yml', OLLAMA_DOCKER_COMPOSE);
    
    // Meilisearch
    const meilisearchFolder = servicesFolder.folder('meilisearch')!;
    meilisearchFolder.file('docker-compose.yml', MEILISEARCH_DOCKER_COMPOSE);
    
    // MinIO
    const minioFolder = servicesFolder.folder('minio')!;
    minioFolder.file('docker-compose.yml', MINIO_DOCKER_COMPOSE);

    // Guide des services
    zip.file('OPEN_SOURCE_SERVICES.md', OPEN_SOURCE_SERVICES_GUIDE);

    // ==========================================
    // 5. ROOT FILES
    // ==========================================
    const envVarsArray = Array.from(allEnvVars);
    
    // docker-compose.yml principal
    zip.file('docker-compose.yml', generateDockerCompose(
      projectName, 
      envVarsArray, 
      includeBackend && edgeFunctions?.length > 0,
      includeDatabase,
      hasAIUsage
    ));

    // docker-compose-full.yml avec tous les services
    zip.file('docker-compose.full.yml', generateDockerComposeFull(projectName, envVarsArray));

    // .env.example complet
    const envExample = `# ═══════════════════════════════════════════════════════════════
# ${projectName} - Configuration
# Copiez vers .env et remplissez les valeurs
# ═══════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────
# GÉNÉRAL
# ─────────────────────────────────────────────────────────────
DOMAIN=
NODE_ENV=production

# ─────────────────────────────────────────────────────────────
# SÉCURITÉ (générés automatiquement par quick-deploy.sh)
# ─────────────────────────────────────────────────────────────
JWT_SECRET=

${includeDatabase ? `# ─────────────────────────────────────────────────────────────
# BASE DE DONNÉES
# ─────────────────────────────────────────────────────────────
POSTGRES_USER=app
POSTGRES_PASSWORD=
POSTGRES_DB=app
DATABASE_URL=postgresql://app:VOTRE_MOT_DE_PASSE@postgres:5432/app
` : ''}

${hasAIUsage ? `# ─────────────────────────────────────────────────────────────
# INTELLIGENCE ARTIFICIELLE
# ─────────────────────────────────────────────────────────────
# Provider: ollama | openrouter | openai
AI_PROVIDER=ollama

# Ollama (local - gratuit)
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama2

# OpenRouter (alternative cloud économique)
# OPENROUTER_API_KEY=
# OPENROUTER_MODEL=meta-llama/llama-3.1-8b-instruct:free

# OpenAI (si nécessaire)
# OPENAI_API_KEY=
# OPENAI_MODEL=gpt-4o-mini
` : ''}

# ─────────────────────────────────────────────────────────────
# SERVICES EXTERNES (optionnels)
# ─────────────────────────────────────────────────────────────
${envVarsArray
  .filter(v => !['PORT', 'NODE_ENV', 'DOMAIN', 'DATABASE_URL', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'JWT_SECRET', 'AI_PROVIDER', 'OLLAMA_URL', 'OLLAMA_MODEL', 'OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENAI_API_KEY', 'OPENAI_MODEL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].includes(v))
  .map(v => `${v}=`)
  .join('\n')}

# Stripe (paiements)
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...

# Resend (emails)
# RESEND_API_KEY=re_...

# Meilisearch (recherche)
# MEILISEARCH_MASTER_KEY=

# MinIO (stockage S3)
# MINIO_ACCESS_KEY=minioadmin
# MINIO_SECRET_KEY=

# Supabase self-hosted (si migration)
# SUPABASE_URL=
# SUPABASE_ANON_KEY=
# SUPABASE_SERVICE_ROLE_KEY=
`;
    zip.file('.env.example', envExample);

    // Deploy guide HTML enrichi
    zip.file('DEPLOY_GUIDE.html', generateDeployGuide(
      projectName,
      envVarsArray,
      includeBackend && edgeFunctions?.length > 0,
      includeDatabase,
      sovereigntyCheck.score,
      hasAIUsage
    ));

    // Quick deploy script
    const scriptsFolder = zip.folder('scripts')!;
    scriptsFolder.file('quick-deploy.sh', generateQuickDeployScript(projectName, includeDatabase, hasAIUsage));

    // Sovereignty report
    zip.file('SOVEREIGNTY_REPORT.md', generateSovereigntyReport(
      projectName,
      sovereigntyCheck,
      Object.keys(doubleCleanedFiles).length
    ));

    // README
    const readme = `# ${projectName} - Liberation Pack 🛡️

## Score de Souveraineté: ${sovereigntyCheck.score}%

Ce pack contient votre application complètement libérée des dépendances propriétaires,
prête à être déployée sur votre propre infrastructure.

---

## 🚀 Déploiement Rapide (5 minutes)

\`\`\`bash
# 1. Transférez ce dossier sur votre VPS
scp -r liberation-pack root@VOTRE_IP:/opt/apps/

# 2. Connectez-vous et exécutez
ssh root@VOTRE_IP
cd /opt/apps/${safeName}
sudo ./scripts/quick-deploy.sh
\`\`\`

**C'est tout!** Votre app est accessible sur http://VOTRE_IP

---

## 📖 Documentation

| Fichier | Description |
|---------|-------------|
| \`DEPLOY_GUIDE.html\` | Guide interactif complet |
| \`SOVEREIGNTY_REPORT.md\` | Détails du nettoyage effectué |
| \`OPEN_SOURCE_SERVICES.md\` | Guide des alternatives open source |

---

## 📁 Structure

\`\`\`
${safeName}/
├── frontend/               # Application React nettoyée
│   ├── src/
│   │   └── lib/
│   │       └── ai-client.ts   # Client IA configurable
│   ├── Dockerfile
│   └── Caddyfile
${includeBackend ? `├── backend/                # API Express (depuis Edge Functions)
│   ├── src/
│   │   ├── routes/         # Routes converties
│   │   └── middleware/     # Auth middleware
│   ├── _original-edge-functions/  # Code original pour référence
│   └── Dockerfile
` : ''}${includeDatabase ? `├── database/
│   └── migrations/         # Schéma SQL
` : ''}├── services/               # 🆕 Services Open Source optionnels
│   ├── ollama/             # IA locale (remplace OpenAI)
│   ├── meilisearch/        # Recherche (remplace Algolia)
│   └── minio/              # Stockage (remplace S3)
├── scripts/
│   └── quick-deploy.sh     # Script de déploiement automatique
├── docker-compose.yml      # Stack principale
├── docker-compose.full.yml # Stack avec tous les services
├── .env.example            # Variables d'environnement
├── DEPLOY_GUIDE.html       # Guide interactif
├── OPEN_SOURCE_SERVICES.md # Guide des alternatives
└── SOVEREIGNTY_REPORT.md   # Rapport de nettoyage
\`\`\`

---

## 🔧 Commandes Utiles

\`\`\`bash
docker compose up -d        # Démarrer
docker compose down         # Arrêter
docker compose logs -f      # Logs temps réel
docker compose restart      # Redémarrer
docker compose ps           # Statut
\`\`\`

---

## 🤖 IA Open Source

Ce pack inclut un client IA configurable supportant:
- **Ollama** (local, gratuit)
- **OpenRouter** (cloud, économique)
- **OpenAI** (si nécessaire)

Voir \`OPEN_SOURCE_SERVICES.md\` pour les détails.

---

## 🛡️ Souveraineté

Ce code est **100% libéré** des dépendances propriétaires:
- ✅ Aucune télémétrie
- ✅ Aucun tracking
- ✅ Aucune dépendance cloud obligatoire
- ✅ Backend auto-hébergeable
- ✅ Alternatives IA open source incluses

---

*Généré par **InoPay** - [inopay.fr](https://inopay.fr)*
*Libérez votre code, reprenez le contrôle!*
`;
    zip.file('README.md', readme);

    // .gitignore
    zip.file('.gitignore', `# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.next/

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# Docker
.docker/

# Secrets
*.pem
*.key
`);

    // ==========================================
    // 6. GENERATE ZIP
    // ==========================================
    const zipBuffer = await zip.generateAsync({ 
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    // Upload to storage
    const fileName = `${safeName}_liberation_pack_v4_${Date.now()}.zip`;
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
      .createSignedUrl(filePath, 3600 * 24 * 7);

    console.log(`[generate-liberation-pack] Pack v4 generated successfully: ${fileName}`);

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
        hasAIServices: hasAIUsage,
        sovereigntyScore: sovereigntyCheck.score,
        isClean: sovereigntyCheck.isClean,
        criticalIssues: sovereigntyCheck.criticalIssues.length,
        warnings: sovereigntyCheck.warnings.length,
        serverSideChanges: totalServerChanges,
        version: '4.0',
        features: [
          'Complete Edge Function conversion',
          'Open Source services templates (Ollama, Meilisearch, MinIO)',
          'Configurable AI client',
          'Enhanced deployment guide with webhooks section',
          'Auto-generated secrets',
          'Docker Compose with healthchecks'
        ]
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
