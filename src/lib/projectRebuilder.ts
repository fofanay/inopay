/**
 * Project Rebuilder - Génère une architecture souveraine standard
 * Transforme un projet libéré en structure déployable autonome
 */

import { generateDockerCompose, generateCaddyfile, generateQuickDeployScript, generateEnvExample } from './dockerComposeTemplate';
import { generateAuthDockerCompose, generateAuthAPICode, generateAuthClientAdapter } from './selfHostedAuthTemplate';

// ═══════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════

export interface ProjectConfig {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  
  // Architecture options
  hasBackend: boolean;
  hasDatabase: boolean;
  hasAuth: boolean;
  hasStorage: boolean;
  hasRealtime: boolean;
  
  // AI options
  aiProvider?: 'ollama' | 'lmstudio' | 'openwebui' | 'openai-compatible' | 'none';
  aiModel?: string;
  aiBaseUrl?: string;
  
  // Auth options
  authProvider?: 'jwt-standalone' | 'supabase-selfhosted' | 'keycloak';
  
  // Database options
  databaseType?: 'postgres' | 'mysql' | 'sqlite' | 'mongodb';
  
  // Deployment options
  domain?: string;
  sslEmail?: string;
  deploymentTarget?: 'vps' | 'coolify' | 'docker-swarm' | 'kubernetes';
  
  // Environment variables needed
  envVars: string[];
  
  // Original source files
  sourceFiles: Map<string, string>;
}

export interface RebuiltProject {
  files: Map<string, string>;
  structure: ProjectStructure;
  config: InopayConfig;
  readme: string;
  stats: RebuildStats;
}

export interface ProjectStructure {
  backend: string[];
  frontend: string[];
  docker: string[];
  scripts: string[];
  database: string[];
  config: string[];
}

export interface InopayConfig {
  version: string;
  name: string;
  created: string;
  liberatedFrom: string;
  architecture: {
    backend: boolean;
    frontend: boolean;
    database: boolean;
    auth: boolean;
    storage: boolean;
    realtime: boolean;
    ai: boolean;
  };
  services: ServiceConfig[];
  deployment: DeploymentConfig;
  environment: EnvironmentConfig;
}

export interface ServiceConfig {
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'cache' | 'storage' | 'ai' | 'auth';
  port: number;
  image?: string;
  dockerfile?: string;
  healthCheck?: string;
}

export interface DeploymentConfig {
  target: string;
  domain?: string;
  ssl: boolean;
  autoRestart: boolean;
  monitoring: boolean;
}

export interface EnvironmentConfig {
  required: string[];
  optional: string[];
  generated: string[];
}

export interface RebuildStats {
  totalFiles: number;
  backendFiles: number;
  frontendFiles: number;
  dockerFiles: number;
  scriptFiles: number;
  generatedBytes: number;
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════
// PROJECT REBUILDER CLASS
// ═══════════════════════════════════════════════════════════════

export class ProjectRebuilder {
  private config: ProjectConfig;
  private files: Map<string, string> = new Map();
  private structure: ProjectStructure = {
    backend: [],
    frontend: [],
    docker: [],
    scripts: [],
    database: [],
    config: []
  };

  constructor(config: ProjectConfig) {
    this.config = config;
  }

  /**
   * Rebuild the project with sovereign architecture
   */
  async rebuild(): Promise<RebuiltProject> {
    // 1. Generate frontend structure
    this.generateFrontendStructure();
    
    // 2. Generate backend structure
    if (this.config.hasBackend) {
      this.generateBackendStructure();
    }
    
    // 3. Generate Docker configuration
    this.generateDockerStructure();
    
    // 4. Generate deployment scripts
    this.generateScriptsStructure();
    
    // 5. Generate database migrations if needed
    if (this.config.hasDatabase) {
      this.generateDatabaseStructure();
    }
    
    // 6. Generate auth service if needed
    if (this.config.hasAuth) {
      this.generateAuthStructure();
    }
    
    // 7. Generate inopay.config.json
    const inopayConfig = this.generateInopayConfig();
    this.files.set('inopay.config.json', JSON.stringify(inopayConfig, null, 2));
    this.structure.config.push('inopay.config.json');
    
    // 8. Generate README
    const readme = this.generateReadme();
    this.files.set('README.md', readme);
    this.structure.config.push('README.md');
    
    // 9. Generate .env.example
    const envExample = generateEnvExample(this.config.envVars, this.config.hasDatabase);
    this.files.set('.env.example', envExample);
    this.structure.config.push('.env.example');
    
    // 10. Generate .gitignore
    this.files.set('.gitignore', this.generateGitignore());
    this.structure.config.push('.gitignore');

    return {
      files: this.files,
      structure: this.structure,
      config: inopayConfig,
      readme,
      stats: this.calculateStats()
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // FRONTEND STRUCTURE
  // ═══════════════════════════════════════════════════════════════

  private generateFrontendStructure(): void {
    // Copy cleaned source files
    for (const [path, content] of this.config.sourceFiles) {
      if (this.isFrontendFile(path)) {
        const newPath = `frontend/${path}`;
        this.files.set(newPath, content);
        this.structure.frontend.push(newPath);
      }
    }

    // Generate frontend Dockerfile
    this.files.set('frontend/Dockerfile', this.generateFrontendDockerfile());
    this.structure.frontend.push('frontend/Dockerfile');

    // Generate nginx config
    this.files.set('frontend/nginx.conf', this.generateNginxConfig());
    this.structure.frontend.push('frontend/nginx.conf');

    // Generate frontend package.json if not present
    if (!this.files.has('frontend/package.json')) {
      this.files.set('frontend/package.json', this.generateFrontendPackageJson());
      this.structure.frontend.push('frontend/package.json');
    }

    // Generate vite.config.ts if not present
    if (!this.files.has('frontend/vite.config.ts')) {
      this.files.set('frontend/vite.config.ts', this.generateViteConfig());
      this.structure.frontend.push('frontend/vite.config.ts');
    }
  }

  private isFrontendFile(path: string): boolean {
    const frontendPaths = ['src/', 'public/', 'index.html', 'package.json', 'vite.config', 'tsconfig', 'tailwind.config'];
    return frontendPaths.some(p => path.startsWith(p) || path.includes(p));
  }

  private generateFrontendDockerfile(): string {
    return `# ═══════════════════════════════════════════════════════════════
# FRONTEND DOCKERFILE
# Multi-stage build for optimized production image
# ═══════════════════════════════════════════════════════════════

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production=false

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables
ARG VITE_API_URL
ARG VITE_APP_NAME
ENV VITE_API_URL=\${VITE_API_URL}
ENV VITE_APP_NAME=\${VITE_APP_NAME}

RUN npm run build

# Stage 3: Production
FROM nginx:alpine AS runner
LABEL maintainer="InoPay Liberation Pack"
LABEL org.opencontainers.image.source="https://github.com/inopay"

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Security: Non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \\
    chmod -R 755 /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
  CMD wget --spider -q http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
`;
  }

  private generateNginxConfig(): string {
    return `# ═══════════════════════════════════════════════════════════════
# NGINX Configuration for SPA
# Optimized for React/Vite applications
# ═══════════════════════════════════════════════════════════════

worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '\$remote_addr - \$remote_user [\$time_local] "\$request" '
                    '\$status \$body_bytes_sent "\$http_referer" '
                    '"\$http_user_agent" "\$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript 
               application/xml application/xml+rss text/javascript application/wasm;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;

        # Proxy API requests to backend
        location /api/ {
            proxy_pass http://backend:3000/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_cache_bypass \$http_upgrade;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 'healthy';
            add_header Content-Type text/plain;
        }

        # Cache static assets
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }

        # SPA routing - always return index.html
        location / {
            try_files \$uri \$uri/ /index.html;
        }
    }
}
`;
  }

  private generateFrontendPackageJson(): string {
    return JSON.stringify({
      name: `${this.config.name}-frontend`,
      version: this.config.version,
      private: true,
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview",
        lint: "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
      },
      dependencies: {
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
        "react-router-dom": "^6.30.1"
      },
      devDependencies: {
        "@types/react": "^18.3.0",
        "@types/react-dom": "^18.3.0",
        "@vitejs/plugin-react": "^4.3.0",
        "typescript": "^5.4.0",
        "vite": "^5.4.0"
      }
    }, null, 2);
  }

  private generateViteConfig(): string {
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\\/api/, ''),
      },
    },
  },
});
`;
  }

  // ═══════════════════════════════════════════════════════════════
  // BACKEND STRUCTURE
  // ═══════════════════════════════════════════════════════════════

  private generateBackendStructure(): void {
    // Generate backend entry point
    this.files.set('backend/src/index.ts', this.generateBackendEntry());
    this.structure.backend.push('backend/src/index.ts');

    // Generate routes
    this.files.set('backend/src/routes/index.ts', this.generateBackendRoutes());
    this.structure.backend.push('backend/src/routes/index.ts');

    // Generate health endpoint
    this.files.set('backend/src/routes/health.ts', this.generateHealthRoute());
    this.structure.backend.push('backend/src/routes/health.ts');

    // Generate middleware
    this.files.set('backend/src/middleware/auth.ts', this.generateAuthMiddleware());
    this.structure.backend.push('backend/src/middleware/auth.ts');

    this.files.set('backend/src/middleware/errorHandler.ts', this.generateErrorHandler());
    this.structure.backend.push('backend/src/middleware/errorHandler.ts');

    this.files.set('backend/src/middleware/rateLimiter.ts', this.generateRateLimiter());
    this.structure.backend.push('backend/src/middleware/rateLimiter.ts');

    // Generate utils
    this.files.set('backend/src/utils/logger.ts', this.generateLogger());
    this.structure.backend.push('backend/src/utils/logger.ts');

    // Generate AI adapter if needed
    if (this.config.aiProvider && this.config.aiProvider !== 'none') {
      this.files.set('backend/src/services/ai.ts', this.generateAIService());
      this.structure.backend.push('backend/src/services/ai.ts');
    }

    // Generate database service if needed
    if (this.config.hasDatabase) {
      this.files.set('backend/src/services/database.ts', this.generateDatabaseService());
      this.structure.backend.push('backend/src/services/database.ts');
    }

    // Generate package.json
    this.files.set('backend/package.json', this.generateBackendPackageJson());
    this.structure.backend.push('backend/package.json');

    // Generate tsconfig
    this.files.set('backend/tsconfig.json', this.generateBackendTsConfig());
    this.structure.backend.push('backend/tsconfig.json');

    // Generate Dockerfile
    this.files.set('backend/Dockerfile', this.generateBackendDockerfile());
    this.structure.backend.push('backend/Dockerfile');
  }

  private generateBackendEntry(): string {
    return `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Performance middleware
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(rateLimiter);

// Request logging
app.use((req, res, next) => {
  logger.info(\`\${req.method} \${req.path}\`);
  next();
});

// Routes
app.use('/', router);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(\`🚀 Server running on port \${PORT}\`);
  logger.info(\`📊 Environment: \${process.env.NODE_ENV || 'development'}\`);
});

export default app;
`;
  }

  private generateBackendRoutes(): string {
    return `import { Router } from 'express';
import { healthRouter } from './health';

export const router = Router();

// Health check
router.use('/health', healthRouter);

// API routes
router.get('/', (req, res) => {
  res.json({
    name: '${this.config.name}',
    version: '${this.config.version}',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// Add your routes here
// router.use('/users', usersRouter);
// router.use('/products', productsRouter);
`;
  }

  private generateHealthRoute(): string {
    return `import { Router } from 'express';
${this.config.hasDatabase ? "import { pool } from '../services/database';" : ''}

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      server: 'ok',
      ${this.config.hasDatabase ? "database: 'pending'," : ''}
    }
  };

  try {
    ${this.config.hasDatabase ? `
    // Database health check
    await pool.query('SELECT 1');
    health.checks.database = 'ok';
    ` : ''}
    
    res.json(health);
  } catch (error) {
    health.status = 'unhealthy';
    ${this.config.hasDatabase ? "health.checks.database = 'error';" : ''}
    res.status(503).json(health);
  }
});
`;
  }

  private generateAuthMiddleware(): string {
    return `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      sub: string;
      email: string;
      role: string;
    };
    
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};
`;
  }

  private generateErrorHandler(): string {
    return `import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  const message = err.message || 'Internal server error';
  
  logger.error(\`[\${req.method}] \${req.path} - \${message}\`, {
    stack: err.stack,
    statusCode
  });

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
`;
  }

  private generateRateLimiter(): string {
    return `import rateLimit from 'express-rate-limit';

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    error: 'Rate limit exceeded'
  }
});
`;
  }

  private generateLogger(): string {
    return `const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const colors = {
  error: '\\x1b[31m',
  warn: '\\x1b[33m',
  info: '\\x1b[36m',
  debug: '\\x1b[37m',
  reset: '\\x1b[0m'
};

type LogLevel = keyof typeof levels;

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

const log = (level: LogLevel, message: string, meta?: object) => {
  if (levels[level] > levels[currentLevel]) return;
  
  const timestamp = new Date().toISOString();
  const color = colors[level];
  const prefix = \`\${color}[\${timestamp}] [\${level.toUpperCase()}]\${colors.reset}\`;
  
  console.log(\`\${prefix} \${message}\`);
  if (meta) {
    console.log(JSON.stringify(meta, null, 2));
  }
};

export const logger = {
  error: (msg: string, meta?: object) => log('error', msg, meta),
  warn: (msg: string, meta?: object) => log('warn', msg, meta),
  info: (msg: string, meta?: object) => log('info', msg, meta),
  debug: (msg: string, meta?: object) => log('debug', msg, meta)
};
`;
  }

  private generateAIService(): string {
    const provider = this.config.aiProvider || 'ollama';
    
    return `/**
 * Sovereign AI Service
 * Provider: ${provider}
 */

interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface CompletionResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const AI_BASE_URL = process.env.AI_BASE_URL || 'http://localhost:11434';
const AI_MODEL = process.env.AI_MODEL || 'llama3.2';

export async function generateCompletion(
  prompt: string,
  options: CompletionOptions = {}
): Promise<CompletionResponse> {
  const { temperature = 0.7, maxTokens = 2048, stream = false } = options;

  try {
    ${provider === 'ollama' ? `
    // Ollama API
    const response = await fetch(\`\${AI_BASE_URL}/api/generate\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        prompt,
        stream,
        options: {
          temperature,
          num_predict: maxTokens
        }
      })
    });
    
    const data = await response.json();
    return {
      text: data.response,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      }
    };
    ` : `
    // OpenAI-compatible API
    const response = await fetch(\`\${AI_BASE_URL}/v1/chat/completions\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${process.env.AI_API_KEY || ''}\`
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        stream
      })
    });
    
    const data = await response.json();
    return {
      text: data.choices[0].message.content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
    `}
  } catch (error) {
    console.error('AI completion error:', error);
    throw new Error('Failed to generate AI completion');
  }
}

export async function generateEmbedding(input: string): Promise<number[]> {
  try {
    ${provider === 'ollama' ? `
    const response = await fetch(\`\${AI_BASE_URL}/api/embeddings\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: input
      })
    });
    
    const data = await response.json();
    return data.embedding;
    ` : `
    const response = await fetch(\`\${AI_BASE_URL}/v1/embeddings\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${process.env.AI_API_KEY || ''}\`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input
      })
    });
    
    const data = await response.json();
    return data.data[0].embedding;
    `}
  } catch (error) {
    console.error('Embedding error:', error);
    throw new Error('Failed to generate embedding');
  }
}
`;
  }

  private generateDatabaseService(): string {
    return `import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

export const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function transaction<T>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
`;
  }

  private generateBackendPackageJson(): string {
    const deps: Record<string, string> = {
      "express": "^4.21.0",
      "cors": "^2.8.5",
      "helmet": "^7.1.0",
      "compression": "^1.7.4",
      "express-rate-limit": "^7.4.0",
      "jsonwebtoken": "^9.0.2"
    };

    if (this.config.hasDatabase) {
      deps["pg"] = "^8.13.0";
    }

    return JSON.stringify({
      name: `${this.config.name}-backend`,
      version: this.config.version,
      private: true,
      type: "module",
      scripts: {
        dev: "tsx watch src/index.ts",
        build: "tsc",
        start: "node dist/index.js",
        lint: "eslint src --ext .ts"
      },
      dependencies: deps,
      devDependencies: {
        "@types/express": "^4.17.21",
        "@types/cors": "^2.8.17",
        "@types/compression": "^1.7.5",
        "@types/jsonwebtoken": "^9.0.7",
        "@types/pg": "^8.11.10",
        "@types/node": "^22.0.0",
        "typescript": "^5.6.0",
        "tsx": "^4.19.0"
      }
    }, null, 2);
  }

  private generateBackendTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        outDir: "dist",
        rootDir: "src",
        declaration: true
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist"]
    }, null, 2);
  }

  private generateBackendDockerfile(): string {
    return `# ═══════════════════════════════════════════════════════════════
# BACKEND DOCKERFILE
# Optimized for Node.js/Express API
# ═══════════════════════════════════════════════════════════════

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
LABEL maintainer="InoPay Liberation Pack"

WORKDIR /app

# Security: Non-root user
RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 backend

# Copy only production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER backend

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \\
  CMD wget --spider -q http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
`;
  }

  // ═══════════════════════════════════════════════════════════════
  // DOCKER STRUCTURE
  // ═══════════════════════════════════════════════════════════════

  private generateDockerStructure(): void {
    // Main docker-compose.yml
    const dockerCompose = generateDockerCompose({
      projectName: this.config.name,
      hasBackend: this.config.hasBackend,
      hasDatabase: this.config.hasDatabase,
      envVars: this.config.envVars,
      domain: this.config.domain
    });
    this.files.set('docker/docker-compose.yml', dockerCompose);
    this.structure.docker.push('docker/docker-compose.yml');

    // docker-compose.dev.yml for development
    this.files.set('docker/docker-compose.dev.yml', this.generateDevDockerCompose());
    this.structure.docker.push('docker/docker-compose.dev.yml');

    // Caddyfile
    const caddyfile = generateCaddyfile(this.config.domain || '', this.config.hasBackend);
    this.files.set('docker/caddy/Caddyfile', caddyfile);
    this.structure.docker.push('docker/caddy/Caddyfile');

    // .dockerignore
    this.files.set('docker/.dockerignore', this.generateDockerignore());
    this.structure.docker.push('docker/.dockerignore');
  }

  private generateDevDockerCompose(): string {
    return `# ═══════════════════════════════════════════════════════════════
# DOCKER COMPOSE - DÉVELOPPEMENT
# ${this.config.name}
# ═══════════════════════════════════════════════════════════════

version: '3.8'

services:
  frontend:
    build:
      context: ../frontend
      dockerfile: Dockerfile
      target: deps
    volumes:
      - ../frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    command: npm run dev
    environment:
      - VITE_API_URL=http://localhost:3000

${this.config.hasBackend ? `
  backend:
    build:
      context: ../backend
      dockerfile: Dockerfile
      target: deps
    volumes:
      - ../backend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    command: npm run dev
    environment:
      - NODE_ENV=development
      - PORT=3000
      ${this.config.hasDatabase ? '- DATABASE_URL=postgresql://app:password@postgres:5432/app' : ''}
` : ''}

${this.config.hasDatabase ? `
  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=app
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=app
    volumes:
      - postgres_dev_data:/var/lib/postgresql/data
` : ''}

${this.config.hasDatabase ? `
volumes:
  postgres_dev_data:
` : ''}
`;
  }

  private generateDockerignore(): string {
    return `# Dependencies
node_modules
npm-debug.log

# Build outputs
dist
build
.next
out

# Development
.git
.gitignore
.env
.env.local
.env.*.local

# IDE
.idea
.vscode
*.swp
*.swo

# Testing
coverage
.nyc_output

# Documentation
*.md
docs

# Misc
.DS_Store
Thumbs.db
`;
  }

  // ═══════════════════════════════════════════════════════════════
  // SCRIPTS STRUCTURE
  // ═══════════════════════════════════════════════════════════════

  private generateScriptsStructure(): void {
    // Quick deploy script
    const quickDeploy = generateQuickDeployScript(this.config.name, this.config.hasDatabase);
    this.files.set('scripts/quick-deploy.sh', quickDeploy);
    this.structure.scripts.push('scripts/quick-deploy.sh');

    // Backup script
    this.files.set('scripts/backup.sh', this.generateBackupScript());
    this.structure.scripts.push('scripts/backup.sh');

    // Update script
    this.files.set('scripts/update.sh', this.generateUpdateScript());
    this.structure.scripts.push('scripts/update.sh');

    // Status script
    this.files.set('scripts/status.sh', this.generateStatusScript());
    this.structure.scripts.push('scripts/status.sh');

    // SSL setup script
    this.files.set('scripts/setup-ssl.sh', this.generateSSLScript());
    this.structure.scripts.push('scripts/setup-ssl.sh');
  }

  private generateBackupScript(): string {
    return `#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# Script de sauvegarde
# ${this.config.name}
# ═══════════════════════════════════════════════════════════════

set -e

BACKUP_DIR="./backups/\$(date +%Y%m%d_%H%M%S)"
mkdir -p "\$BACKUP_DIR"

echo "📦 Démarrage de la sauvegarde..."

${this.config.hasDatabase ? `
# Backup PostgreSQL
echo "💾 Sauvegarde de la base de données..."
docker compose exec -T postgres pg_dump -U app app > "\$BACKUP_DIR/database.sql"
gzip "\$BACKUP_DIR/database.sql"
echo "✓ Base de données sauvegardée"
` : ''}

# Backup volumes
echo "📁 Sauvegarde des volumes..."
docker compose exec -T frontend tar czf - /usr/share/nginx/html > "\$BACKUP_DIR/frontend.tar.gz" 2>/dev/null || true

# Backup .env
cp .env "\$BACKUP_DIR/.env.backup"

echo ""
echo "✅ Sauvegarde terminée: \$BACKUP_DIR"
echo "📊 Taille: \$(du -sh \$BACKUP_DIR | cut -f1)"
`;
  }

  private generateUpdateScript(): string {
    return `#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# Script de mise à jour
# ${this.config.name}
# ═══════════════════════════════════════════════════════════════

set -e

echo "🔄 Mise à jour de l'application..."

# Sauvegarde préventive
./scripts/backup.sh

# Pull des dernières images
echo "📥 Téléchargement des images..."
docker compose pull

# Rebuild et redémarrage
echo "🔨 Reconstruction des containers..."
docker compose up -d --build

# Cleanup
echo "🧹 Nettoyage..."
docker image prune -f

echo ""
echo "✅ Mise à jour terminée !"
./scripts/status.sh
`;
  }

  private generateStatusScript(): string {
    return `#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# Script de statut
# ${this.config.name}
# ═══════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════"
echo "                    📊 STATUT DES SERVICES"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Status des containers
echo "🐳 Containers:"
docker compose ps --format "table {{.Name}}\\t{{.Status}}\\t{{.Ports}}"
echo ""

# Utilisation disque
echo "💾 Espace disque:"
df -h / | tail -1 | awk '{print "   Utilisé: " $3 " / " $2 " (" $5 ")"}'
echo ""

# Mémoire
echo "🧠 Mémoire:"
free -h | grep Mem | awk '{print "   Utilisée: " $3 " / " $2}'
echo ""

# Logs récents (erreurs)
echo "⚠️  Dernières erreurs (si présentes):"
docker compose logs --tail=5 2>&1 | grep -i error || echo "   Aucune erreur récente"
echo ""

echo "═══════════════════════════════════════════════════════════════"
`;
  }

  private generateSSLScript(): string {
    return `#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# Configuration SSL avec Caddy
# ${this.config.name}
# ═══════════════════════════════════════════════════════════════

set -e

if [ -z "\$1" ]; then
  echo "Usage: ./setup-ssl.sh <domain>"
  echo "Example: ./setup-ssl.sh app.example.com"
  exit 1
fi

DOMAIN=\$1

echo "🔐 Configuration SSL pour \$DOMAIN..."

# Update .env
sed -i "s/DOMAIN=.*/DOMAIN=\$DOMAIN/" .env

# Restart services
docker compose restart frontend

echo ""
echo "✅ SSL configuré !"
echo "   Caddy obtiendra automatiquement un certificat Let's Encrypt"
echo "   Votre site sera accessible sur https://\$DOMAIN"
`;
  }

  // ═══════════════════════════════════════════════════════════════
  // DATABASE STRUCTURE
  // ═══════════════════════════════════════════════════════════════

  private generateDatabaseStructure(): void {
    // Initial migration
    this.files.set('database/migrations/001_init.sql', this.generateInitMigration());
    this.structure.database.push('database/migrations/001_init.sql');

    // Migration runner
    this.files.set('database/migrate.sh', this.generateMigrateScript());
    this.structure.database.push('database/migrate.sh');
  }

  private generateInitMigration(): string {
    return `-- ═══════════════════════════════════════════════════════════════
-- Migration initiale
-- ${this.config.name}
-- ═══════════════════════════════════════════════════════════════

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Schema pour l'authentification
CREATE SCHEMA IF NOT EXISTS auth;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS auth.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  encrypted_password VARCHAR(255) NOT NULL,
  email_confirmed_at TIMESTAMPTZ,
  phone VARCHAR(50),
  phone_confirmed_at TIMESTAMPTZ,
  raw_user_meta_data JSONB DEFAULT '{}',
  raw_app_meta_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- Index
CREATE INDEX IF NOT EXISTS idx_users_email ON auth.users(email);

-- Table des refresh tokens
CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- TABLES MÉTIER (à personnaliser selon votre projet)
-- ═══════════════════════════════════════════════════════════════

-- Exemple: Table profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
`;
  }

  private generateMigrateScript(): string {
    return `#!/bin/bash

# ═══════════════════════════════════════════════════════════════
# Script de migration de base de données
# ═══════════════════════════════════════════════════════════════

set -e

source ../.env

echo "🗄️  Exécution des migrations..."

for file in migrations/*.sql; do
  echo "   Exécution: \$file"
  docker compose exec -T postgres psql -U \$POSTGRES_USER -d \$POSTGRES_DB < "\$file"
done

echo "✅ Migrations terminées"
`;
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTH STRUCTURE
  // ═══════════════════════════════════════════════════════════════

  private generateAuthStructure(): void {
    const authProvider = this.config.authProvider || 'jwt-standalone';
    
    // Auth docker compose
    const authCompose = generateAuthDockerCompose({
      projectName: this.config.name,
      hasExistingUsers: false,
      authProvider
    });
    this.files.set('docker/docker-compose.auth.yml', authCompose);
    this.structure.docker.push('docker/docker-compose.auth.yml');

    // Auth API code
    const authCode = generateAuthAPICode();
    for (const [filename, content] of Object.entries(authCode.files)) {
      this.files.set(`auth/${filename}`, content);
      this.structure.backend.push(`auth/${filename}`);
    }

    // Auth client adapter
    const clientAdapter = generateAuthClientAdapter();
    this.files.set('frontend/src/lib/auth.ts', clientAdapter);
    this.structure.frontend.push('frontend/src/lib/auth.ts');
  }

  // ═══════════════════════════════════════════════════════════════
  // CONFIG & DOCUMENTATION
  // ═══════════════════════════════════════════════════════════════

  private generateInopayConfig(): InopayConfig {
    const services: ServiceConfig[] = [
      {
        name: 'frontend',
        type: 'frontend',
        port: 80,
        dockerfile: 'frontend/Dockerfile',
        healthCheck: 'http://localhost:80/health'
      }
    ];

    if (this.config.hasBackend) {
      services.push({
        name: 'backend',
        type: 'backend',
        port: 3000,
        dockerfile: 'backend/Dockerfile',
        healthCheck: 'http://localhost:3000/health'
      });
    }

    if (this.config.hasDatabase) {
      services.push({
        name: 'postgres',
        type: 'database',
        port: 5432,
        image: 'postgres:15-alpine',
        healthCheck: 'pg_isready -U app'
      });
    }

    if (this.config.hasAuth) {
      services.push({
        name: 'auth',
        type: 'auth',
        port: 3001,
        dockerfile: 'auth/Dockerfile',
        healthCheck: 'http://localhost:3001/health'
      });
    }

    return {
      version: '1.0.0',
      name: this.config.name,
      created: new Date().toISOString(),
      liberatedFrom: 'Lovable',
      architecture: {
        backend: this.config.hasBackend,
        frontend: true,
        database: this.config.hasDatabase,
        auth: this.config.hasAuth,
        storage: this.config.hasStorage,
        realtime: this.config.hasRealtime,
        ai: this.config.aiProvider !== 'none' && !!this.config.aiProvider
      },
      services,
      deployment: {
        target: this.config.deploymentTarget || 'vps',
        domain: this.config.domain,
        ssl: !!this.config.domain,
        autoRestart: true,
        monitoring: true
      },
      environment: {
        required: ['JWT_SECRET', ...(this.config.hasDatabase ? ['POSTGRES_PASSWORD'] : [])],
        optional: this.config.envVars.filter(v => !['JWT_SECRET', 'POSTGRES_PASSWORD'].includes(v)),
        generated: ['JWT_SECRET', 'POSTGRES_PASSWORD']
      }
    };
  }

  private generateReadme(): string {
    return `# ${this.config.name}

> Projet libéré et autonome - Généré par InoPay Liberation Pack

## 🚀 Démarrage rapide

### Prérequis
- Docker & Docker Compose
- Un VPS avec Ubuntu 22.04+ (recommandé: 2GB RAM minimum)

### Installation

\`\`\`bash
# Cloner le projet
git clone <votre-repo>
cd ${this.config.name}

# Lancer le déploiement automatique
chmod +x scripts/quick-deploy.sh
sudo ./scripts/quick-deploy.sh
\`\`\`

## 📁 Structure du projet

\`\`\`
${this.config.name}/
├── frontend/          # Application React/Vite
│   ├── src/
│   ├── Dockerfile
│   └── nginx.conf
${this.config.hasBackend ? `├── backend/           # API Express.js
│   ├── src/
│   └── Dockerfile
` : ''}${this.config.hasAuth ? `├── auth/              # Service d'authentification
│   └── Dockerfile
` : ''}├── docker/            # Configuration Docker
│   ├── docker-compose.yml
│   └── caddy/
${this.config.hasDatabase ? `├── database/          # Migrations SQL
│   └── migrations/
` : ''}├── scripts/           # Scripts de déploiement
│   ├── quick-deploy.sh
│   ├── backup.sh
│   ├── update.sh
│   └── status.sh
├── inopay.config.json # Configuration du projet
└── .env.example       # Variables d'environnement
\`\`\`

## 🔧 Configuration

Copiez \`.env.example\` vers \`.env\` et configurez les variables:

\`\`\`bash
cp .env.example .env
nano .env
\`\`\`

## 📋 Commandes utiles

\`\`\`bash
# Voir le statut des services
./scripts/status.sh

# Créer une sauvegarde
./scripts/backup.sh

# Mettre à jour l'application
./scripts/update.sh

# Configurer SSL
./scripts/setup-ssl.sh votre-domaine.com
\`\`\`

## 🛡️ Sécurité

- [x] HTTPS automatique avec Caddy
- [x] Headers de sécurité configurés
- [x] Rate limiting activé
- [x] Authentification JWT
${this.config.hasDatabase ? '- [x] Connexions DB sécurisées\n' : ''}

## 📊 Services

| Service | Port | Health Check |
|---------|------|--------------|
| Frontend | 80/443 | /health |
${this.config.hasBackend ? '| Backend | 3000 | /health |\n' : ''}${this.config.hasDatabase ? '| PostgreSQL | 5432 | pg_isready |\n' : ''}${this.config.hasAuth ? '| Auth | 3001 | /health |\n' : ''}

---

*Libéré de Lovable avec ❤️ par InoPay*
`;
  }

  private generateGitignore(): string {
    return `# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
.next/
out/

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docker
docker/volumes/

# Backups
backups/

# Secrets (ne jamais commit)
*.pem
*.key
secrets/
`;
  }

  // ═══════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════

  private calculateStats(): RebuildStats {
    let totalBytes = 0;
    for (const content of this.files.values()) {
      totalBytes += new TextEncoder().encode(content).length;
    }

    return {
      totalFiles: this.files.size,
      backendFiles: this.structure.backend.length,
      frontendFiles: this.structure.frontend.length,
      dockerFiles: this.structure.docker.length,
      scriptFiles: this.structure.scripts.length,
      generatedBytes: totalBytes,
      timestamp: new Date().toISOString()
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export async function rebuildProject(
  sourceFiles: Map<string, string>,
  options: Partial<ProjectConfig> = {}
): Promise<RebuiltProject> {
  const config: ProjectConfig = {
    name: options.name || 'my-sovereign-app',
    version: options.version || '1.0.0',
    description: options.description,
    author: options.author,
    license: options.license || 'MIT',
    hasBackend: options.hasBackend ?? true,
    hasDatabase: options.hasDatabase ?? true,
    hasAuth: options.hasAuth ?? true,
    hasStorage: options.hasStorage ?? false,
    hasRealtime: options.hasRealtime ?? false,
    aiProvider: options.aiProvider || 'ollama',
    aiModel: options.aiModel,
    aiBaseUrl: options.aiBaseUrl,
    authProvider: options.authProvider || 'jwt-standalone',
    databaseType: options.databaseType || 'postgres',
    domain: options.domain,
    sslEmail: options.sslEmail,
    deploymentTarget: options.deploymentTarget || 'vps',
    envVars: options.envVars || [],
    sourceFiles
  };

  const rebuilder = new ProjectRebuilder(config);
  return rebuilder.rebuild();
}

export function formatRebuildStats(stats: RebuildStats): string {
  return `
╔════════════════════════════════════════════════════════════╗
║              📊 STATISTIQUES DE RECONSTRUCTION              ║
╠════════════════════════════════════════════════════════════╣
║  📁 Total fichiers générés: ${String(stats.totalFiles).padEnd(28)}║
║  ⚛️  Fichiers frontend: ${String(stats.frontendFiles).padEnd(33)}║
║  🔧 Fichiers backend: ${String(stats.backendFiles).padEnd(34)}║
║  🐳 Fichiers Docker: ${String(stats.dockerFiles).padEnd(35)}║
║  📜 Scripts: ${String(stats.scriptFiles).padEnd(43)}║
║  💾 Taille totale: ${(stats.generatedBytes / 1024).toFixed(2)} KB${' '.repeat(27)}║
║  🕐 Généré le: ${stats.timestamp.split('T')[0]}${' '.repeat(28)}║
╚════════════════════════════════════════════════════════════╝
  `.trim();
}
