import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RLSPolicy {
  tableName: string;
  policyName: string;
  command: string;
  permissive: boolean;
  roles: string[];
  usingExpression: string | null;
  withCheckExpression: string | null;
}

interface MiddlewareOutput {
  name: string;
  content: string;
  tableName: string;
  policyName: string;
}

/**
 * Convert RLS expression to JavaScript condition
 */
function convertToJSCondition(expression: string | null): string {
  if (!expression) return 'true';

  let js = expression;

  // Replace auth.uid() with req.user.id
  js = js.replace(/auth\.uid\(\)/g, 'req.user?.id');

  // Replace equality
  js = js.replace(/\s*=\s*(?!=)/g, ' === ');

  // Replace role checks
  js = js.replace(
    /has_role\(auth\.uid\(\),\s*['"](\w+)['"](?:::app_role)?\)/g,
    "req.user?.role === '$1'"
  );

  // Replace auth.role()
  js = js.replace(/auth\.role\(\)/g, "req.user?.role || 'anon'");

  // Handle service_role check
  js = js.replace(
    /\(auth\.role\(\)\s*=\s*['"]service_role['"]\)/g,
    "(req.isServiceRole === true)"
  );

  // Simplify true/false
  js = js.replace(/\btrue\b/gi, 'true');
  js = js.replace(/\bfalse\b/gi, 'false');

  return js;
}

/**
 * Generate Express middleware from RLS policy
 */
function generateMiddleware(policy: RLSPolicy): MiddlewareOutput {
  const funcName = `check${policy.tableName.charAt(0).toUpperCase() + policy.tableName.slice(1)}${policy.command}`;
  
  const condition = policy.command === 'INSERT' 
    ? convertToJSCondition(policy.withCheckExpression)
    : convertToJSCondition(policy.usingExpression);

  const content = `import { Request, Response, NextFunction } from 'express';

/**
 * Middleware: ${policy.policyName}
 * Table: ${policy.tableName}
 * Command: ${policy.command}
 * Original USING: ${policy.usingExpression || 'N/A'}
 * Original WITH CHECK: ${policy.withCheckExpression || 'N/A'}
 */
export const ${funcName} = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check authentication
    if (!req.user && ${!policy.roles.includes('anon')}) {
      return res.status(401).json({ 
        error: 'Authentication required',
        policy: '${policy.policyName}'
      });
    }

    // Apply policy condition
    const allowed = ${condition};
    
    if (!allowed) {
      return res.status(403).json({ 
        error: 'Access denied',
        policy: '${policy.policyName}',
        table: '${policy.tableName}'
      });
    }

    next();
  } catch (error) {
    console.error('Policy check error:', error);
    res.status(500).json({ error: 'Authorization error' });
  }
};
`;

  return {
    name: funcName,
    content,
    tableName: policy.tableName,
    policyName: policy.policyName,
  };
}

/**
 * Generate auth middleware file
 */
function generateAuthMiddleware(): string {
  return `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  email: string;
  role?: 'admin' | 'moderator' | 'user';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      isServiceRole?: boolean;
    }
  }
}

/**
 * JWT Authentication Middleware
 * Validates Bearer token and attaches user to request
 */
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Check for service role token
    if (token === process.env.SERVICE_ROLE_SECRET) {
      req.isServiceRole = true;
      return next();
    }

    const decoded = jwt.verify(token, secret) as AuthUser;
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Optional authentication - continues even without valid token
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET;

      if (secret) {
        try {
          req.user = jwt.verify(token, secret) as AuthUser;
        } catch {
          // Invalid token, continue without user
        }
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

/**
 * Role-based access control middleware
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: \`Required role: \${roles.join(' or ')}\`,
        currentRole: req.user.role || 'none'
      });
    }

    next();
  };
};

/**
 * Resource ownership check middleware factory
 */
export const requireOwnership = (userIdField: string = 'user_id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const resourceUserId = req.body?.[userIdField] || req.params?.[userIdField];
    
    if (resourceUserId && resourceUserId !== req.user.id) {
      return res.status(403).json({ error: 'You can only access your own resources' });
    }

    next();
  };
};
`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { migrationFiles, projectId } = await req.json();

    // Extract policies from SQL if provided
    let policies: RLSPolicy[] = [];

    if (migrationFiles && typeof migrationFiles === 'object') {
      // Parse migration files for CREATE POLICY statements
      for (const [fileName, content] of Object.entries(migrationFiles)) {
        if (typeof content !== 'string') continue;

        const policyRegex = /CREATE\s+POLICY\s+["']([^"']+)["']\s+ON\s+(?:public\.)?(\w+)\s+(?:AS\s+(PERMISSIVE|RESTRICTIVE)\s+)?FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)\s+(?:TO\s+(\w+(?:\s*,\s*\w+)*)\s+)?(?:USING\s*\(([^)]+(?:\([^)]*\))?[^)]*)\)\s*)?(?:WITH\s+CHECK\s*\(([^)]+(?:\([^)]*\))?[^)]*)\))?/gi;

        let match;
        while ((match = policyRegex.exec(content)) !== null) {
          policies.push({
            policyName: match[1],
            tableName: match[2],
            permissive: match[3]?.toUpperCase() !== 'RESTRICTIVE',
            command: match[4].toUpperCase(),
            roles: match[5] ? match[5].split(',').map(r => r.trim()) : ['authenticated'],
            usingExpression: match[6] || null,
            withCheckExpression: match[7] || null,
          });
        }
      }

      console.log(`Extracted ${policies.length} policies from migration files`);
    }

    // If no policies found and we have projectId, try to fetch from Supabase
    if (policies.length === 0 && projectId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Note: This would require direct database access to pg_policies
      // For now, we return empty if no migration files provided
      console.log('No migration files provided, skipping policy extraction');
    }

    // Generate middlewares
    const middlewares = policies.map(p => generateMiddleware(p));
    const authMiddleware = generateAuthMiddleware();

    // Generate index file
    const indexContent = `// ============================================
// Security Middleware - Auto-generated from RLS Policies
// ============================================

export { authMiddleware, optionalAuth, requireRole, requireOwnership } from './auth';

${middlewares.map(m => `export { ${m.name} } from './${m.name}';`).join('\n')}

// Policy summary:
${policies.map(p => `// - ${p.tableName}.${p.command}: ${p.policyName}`).join('\n')}
`;

    // Group middlewares by table
    const middlewaresByTable: Record<string, MiddlewareOutput[]> = {};
    for (const m of middlewares) {
      if (!middlewaresByTable[m.tableName]) {
        middlewaresByTable[m.tableName] = [];
      }
      middlewaresByTable[m.tableName].push(m);
    }

    console.log(`Generated ${middlewares.length} middleware functions`);

    return new Response(
      JSON.stringify({
        success: true,
        policiesFound: policies.length,
        policies,
        middlewares: middlewares.map(m => ({
          name: m.name,
          content: m.content,
          tableName: m.tableName,
          policyName: m.policyName,
        })),
        authMiddleware,
        indexContent,
        summary: {
          totalPolicies: policies.length,
          tables: Object.keys(middlewaresByTable),
          byTable: Object.fromEntries(
            Object.entries(middlewaresByTable).map(([table, mw]) => [
              table,
              mw.map(m => m.name)
            ])
          ),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting RLS policies:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
