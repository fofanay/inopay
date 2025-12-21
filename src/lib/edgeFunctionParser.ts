/**
 * Edge Function Parser & Converter
 * Transforms Deno Edge Functions to Express.js routes
 */

export interface EdgeFunctionInfo {
  name: string;
  path: string;
  content: string;
  hasAuth: boolean;
  httpMethods: string[];
  envVars: string[];
  imports: string[];
}

export interface ExpressRouteOutput {
  routeName: string;
  routeContent: string;
  dependencies: string[];
}

export interface BackendOutput {
  routes: ExpressRouteOutput[];
  indexContent: string;
  packageJson: string;
  dockerfile: string;
  dockerCompose: string;
  envExample: string;
}

/**
 * Parse Edge Function content to extract metadata
 */
export function parseEdgeFunction(name: string, content: string): EdgeFunctionInfo {
  const envVars: string[] = [];
  const imports: string[] = [];
  const httpMethods: string[] = [];

  // Detect env variables
  const envPatterns = [
    /Deno\.env\.get\(['"](\w+)['"]\)/g,
    /Deno\.env\.get\(["'](\w+)["']\)!/g,
  ];
  
  for (const pattern of envPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1] && !envVars.includes(match[1])) {
        envVars.push(match[1]);
      }
    }
  }

  // Detect HTTP methods
  const methodPatterns = [
    /req\.method\s*===?\s*['"]GET['"]/gi,
    /req\.method\s*===?\s*['"]POST['"]/gi,
    /req\.method\s*===?\s*['"]PUT['"]/gi,
    /req\.method\s*===?\s*['"]DELETE['"]/gi,
    /req\.method\s*===?\s*['"]PATCH['"]/gi,
    /req\.method\s*===?\s*['"]OPTIONS['"]/gi,
  ];

  for (const pattern of methodPatterns) {
    if (pattern.test(content)) {
      const method = pattern.source.match(/['"](\w+)['"]/)?.[1];
      if (method && !httpMethods.includes(method)) {
        httpMethods.push(method);
      }
    }
  }

  // Default to POST if no method detected
  if (httpMethods.length === 0) {
    httpMethods.push('POST');
  }

  // Detect auth requirement
  const hasAuth = content.includes('Authorization') || 
                  content.includes('auth.getUser') ||
                  content.includes('supabase.auth');

  // Detect imports
  const importMatches = content.matchAll(/import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g);
  for (const match of importMatches) {
    imports.push(match[1]);
  }

  return {
    name,
    path: `supabase/functions/${name}/index.ts`,
    content,
    hasAuth,
    httpMethods,
    envVars,
    imports,
  };
}

/**
 * Convert Edge Function to Express route
 */
export function convertToExpressRoute(edgeFunc: EdgeFunctionInfo): ExpressRouteOutput {
  const routeName = edgeFunc.name.replace(/-/g, '_');
  const dependencies: string[] = ['express'];

  // Start building the route file
  let routeContent = `import { Router, Request, Response } from 'express';
`;

  // Add Supabase import if needed
  if (edgeFunc.content.includes('supabase') || edgeFunc.content.includes('@supabase')) {
    routeContent += `import { createClient } from '@supabase/supabase-js';
`;
    dependencies.push('@supabase/supabase-js');
  }

  // Add other common imports
  if (edgeFunc.content.includes('fetch(')) {
    // fetch is native in Node 18+
  }

  routeContent += `
export const ${routeName}Router = Router();

`;

  // Add Supabase client setup if needed
  if (edgeFunc.content.includes('supabase') || edgeFunc.content.includes('@supabase')) {
    routeContent += `const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

`;
  }

  // Convert route handlers for each HTTP method
  const methods = edgeFunc.httpMethods.filter(m => m !== 'OPTIONS');
  
  for (const method of methods) {
    const methodLower = method.toLowerCase();
    routeContent += `${routeName}Router.${methodLower}('/', async (req: Request, res: Response) => {
  try {
`;

    // Add auth check if needed
    if (edgeFunc.hasAuth) {
      routeContent += `    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Non autorisé' });
    }

`;
    }

    // Add body parsing for POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      routeContent += `    const body = req.body;
`;
    }

    routeContent += `    // TODO: Implement your business logic here
    // Original edge function: ${edgeFunc.name}
    
    res.json({ success: true, message: 'Route converted from ${edgeFunc.name}' });
  } catch (error) {
    console.error('Error in ${routeName}:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Internal error' });
  }
});

`;
  }

  return {
    routeName,
    routeContent,
    dependencies,
  };
}

/**
 * Generate complete Express backend from Edge Functions
 */
export function generateExpressBackend(edgeFunctions: EdgeFunctionInfo[]): BackendOutput {
  const routes = edgeFunctions.map(ef => convertToExpressRoute(ef));
  const allDependencies = new Set<string>(['express', 'cors', 'helmet', 'dotenv']);
  const allEnvVars = new Set<string>();

  for (const ef of edgeFunctions) {
    ef.envVars.forEach(v => allEnvVars.add(v));
  }
  for (const route of routes) {
    route.dependencies.forEach(d => allDependencies.add(d));
  }

  // Generate index.ts
  const indexContent = `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

${routes.map(r => `import { ${r.routeName}Router } from './routes/${r.routeName}';`).join('\n')}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
${routes.map(r => `app.use('/api/${r.routeName.replace(/_/g, '-')}', ${r.routeName}Router);`).join('\n')}

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
  console.log(\`📝 Available routes:\`);
${routes.map(r => `  console.log('  - /api/${r.routeName.replace(/_/g, '-')}');`).join('\n')}
});

export default app;
`;

  // Generate package.json
  const packageJson = JSON.stringify({
    name: "backend",
    version: "1.0.0",
    description: "Backend API converted from Edge Functions",
    main: "dist/index.js",
    scripts: {
      "dev": "tsx watch src/index.ts",
      "build": "tsc",
      "start": "node dist/index.js",
      "typecheck": "tsc --noEmit"
    },
    dependencies: Object.fromEntries(
      Array.from(allDependencies).map(dep => {
        const versions: Record<string, string> = {
          'express': '^4.18.2',
          'cors': '^2.8.5',
          'helmet': '^7.1.0',
          'dotenv': '^16.3.1',
          '@supabase/supabase-js': '^2.39.0',
          'stripe': '^14.10.0',
        };
        return [dep, versions[dep] || 'latest'];
      })
    ),
    devDependencies: {
      "@types/express": "^4.17.21",
      "@types/cors": "^2.8.17",
      "@types/node": "^20.10.0",
      "tsx": "^4.7.0",
      "typescript": "^5.3.0"
    },
    engines: {
      node: ">=18.0.0"
    }
  }, null, 2);

  // Generate Dockerfile
  const dockerfile = `FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
`;

  // Generate docker-compose.yml
  const dockerCompose = `version: '3.8'

services:
  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
${Array.from(allEnvVars).map(v => `      - ${v}=\${${v}}`).join('\n')}
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
`;

  // Generate .env.example
  const envExample = `# Backend Environment Variables
# Generated from Edge Functions

PORT=3000

${Array.from(allEnvVars).map(v => `${v}=`).join('\n')}
`;

  return {
    routes,
    indexContent,
    packageJson,
    dockerfile,
    dockerCompose,
    envExample,
  };
}

/**
 * Detect Edge Functions from project files
 */
export function detectEdgeFunctions(files: Record<string, string>): EdgeFunctionInfo[] {
  const edgeFunctions: EdgeFunctionInfo[] = [];

  for (const [path, content] of Object.entries(files)) {
    // Match supabase/functions/*/index.ts pattern
    const match = path.match(/^supabase\/functions\/([^/]+)\/index\.ts$/);
    if (match) {
      const funcName = match[1];
      edgeFunctions.push(parseEdgeFunction(funcName, content));
    }
  }

  return edgeFunctions;
}
