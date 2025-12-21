import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EdgeFunctionInfo {
  name: string;
  content: string;
  hasAuth: boolean;
  httpMethods: string[];
  envVars: string[];
}

interface ConversionResult {
  routes: { name: string; content: string }[];
  indexTs: string;
  packageJson: string;
  dockerfile: string;
  dockerCompose: string;
  envExample: string;
  tsconfigJson: string;
}

/**
 * Parse Edge Function content to extract metadata
 */
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

  // Detect auth requirement
  const hasAuth = content.includes('Authorization') || 
                  content.includes('auth.getUser') ||
                  content.includes('supabase.auth');

  return { name, content, hasAuth, httpMethods, envVars };
}

/**
 * Convert a single Edge Function to Express route
 */
function convertToExpressRoute(func: EdgeFunctionInfo): string {
  const routeName = func.name.replace(/-/g, '_');
  
  let route = `import { Router, Request, Response } from 'express';
`;

  if (func.content.includes('supabase') || func.content.includes('@supabase')) {
    route += `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

`;
  }

  route += `export const ${routeName}Router = Router();

`;

  // Add main route handler
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
    
    res.json({ success: true, message: 'Converted from ${func.name}' });
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

/**
 * Generate complete Express backend
 */
function generateBackend(functions: EdgeFunctionInfo[]): ConversionResult {
  const routes = functions.map(func => ({
    name: func.name.replace(/-/g, '_'),
    content: convertToExpressRoute(func),
  }));

  const allEnvVars = new Set<string>(['PORT', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET']);
  functions.forEach(f => f.envVars.forEach(v => allEnvVars.add(v)));

  // Generate index.ts
  const indexTs = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

${routes.map(r => `import { ${r.name}Router } from './routes/${r.name}';`).join('\n')}

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes (converted from Edge Functions)
${routes.map(r => `app.use('/api/${r.name.replace(/_/g, '-')}', ${r.name}Router);`).join('\n')}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(\`
╔════════════════════════════════════════════════════════════╗
║  🚀 Backend Server Started                                  ║
║  📍 Port: \${PORT}                                           ║
║  🔗 Health: http://localhost:\${PORT}/health                 ║
╠════════════════════════════════════════════════════════════╣
║  Available API Routes:                                      ║
${routes.map(r => `║  • /api/${r.name.replace(/_/g, '-').padEnd(45)}║`).join('\n')}
╚════════════════════════════════════════════════════════════╝
  \`);
});

export default app;
`;

  // Generate package.json
  const packageJson = JSON.stringify({
    name: "backend-api",
    version: "1.0.0",
    description: "Backend API - Converted from Supabase Edge Functions",
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
      "@supabase/supabase-js": "^2.39.0",
      jsonwebtoken: "^9.0.2"
    },
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/cors": "^2.8.17",
      "@types/node": "^20.10.0",
      "@types/jsonwebtoken": "^9.0.5",
      tsx: "^4.7.0",
      typescript: "^5.3.0",
      eslint: "^8.56.0",
      "@typescript-eslint/eslint-plugin": "^6.15.0",
      "@typescript-eslint/parser": "^6.15.0"
    },
    engines: { node: ">=18.0.0" }
  }, null, 2);

  // Generate tsconfig.json
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
      declarationMap: true,
      sourceMap: true
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist"]
  }, null, 2);

  // Generate Dockerfile
  const dockerfile = `# ============================================
# Backend API Dockerfile
# Converted from Supabase Edge Functions
# ============================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
`;

  // Generate docker-compose.yml
  const dockerCompose = `version: '3.8'

# ============================================
# Backend Stack - Converted from Edge Functions
# ============================================

services:
  backend:
    build: .
    container_name: backend-api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
${Array.from(allEnvVars).map(v => `      - ${v}=\${${v}}`).join('\n')}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - app-network
    depends_on:
      - postgres

  postgres:
    image: postgres:15-alpine
    container_name: postgres-db
    environment:
      - POSTGRES_USER=\${POSTGRES_USER:-app}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD:-changeme}
      - POSTGRES_DB=\${POSTGRES_DB:-app}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge

volumes:
  postgres_data:
`;

  // Generate .env.example
  const envExample = `# ============================================
# Backend Environment Variables
# Converted from Supabase Edge Functions
# ============================================

# Server Configuration
PORT=3000
NODE_ENV=development

# Database
POSTGRES_USER=app
POSTGRES_PASSWORD=changeme
POSTGRES_DB=app
DATABASE_URL=postgresql://app:changeme@localhost:5432/app

# Supabase (if migrating data)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# API Keys (from your Edge Functions)
${Array.from(allEnvVars)
  .filter(v => !['PORT', 'NODE_ENV', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'].includes(v))
  .map(v => `${v}=`)
  .join('\n')}
`;

  return {
    routes,
    indexTs,
    packageJson,
    dockerfile,
    dockerCompose,
    envExample,
    tsconfigJson,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { edgeFunctions } = await req.json();

    if (!edgeFunctions || !Array.isArray(edgeFunctions) || edgeFunctions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Edge functions array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Converting ${edgeFunctions.length} Edge Functions to Express backend...`);

    // Parse all edge functions
    const parsedFunctions = edgeFunctions.map((ef: { name: string; content: string }) => 
      parseEdgeFunction(ef.name, ef.content)
    );

    // Generate complete backend
    const result = generateBackend(parsedFunctions);

    console.log(`Generated ${result.routes.length} Express routes`);

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        summary: {
          totalFunctions: edgeFunctions.length,
          routesGenerated: result.routes.length,
          functionsWithAuth: parsedFunctions.filter(f => f.hasAuth).length,
          envVarsDetected: [...new Set(parsedFunctions.flatMap(f => f.envVars))].length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error converting Edge Functions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
