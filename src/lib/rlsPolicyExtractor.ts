/**
 * RLS Policy Extractor & Middleware Generator
 * Converts Supabase RLS policies to Express middleware
 */

export interface RLSPolicy {
  tableName: string;
  policyName: string;
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  usingExpression?: string;
  withCheckExpression?: string;
  roles: string[];
}

export interface MiddlewareOutput {
  name: string;
  content: string;
  description: string;
}

/**
 * Parse RLS policy SQL to extract conditions
 */
export function parseRLSPolicy(sql: string): RLSPolicy | null {
  const policyMatch = sql.match(
    /CREATE\s+POLICY\s+["']([^"']+)["']\s+ON\s+(?:public\.)?(\w+)/i
  );

  if (!policyMatch) return null;

  const policy: RLSPolicy = {
    tableName: policyMatch[2],
    policyName: policyMatch[1],
    command: 'ALL',
    roles: ['authenticated'],
  };

  // Extract command
  const commandMatch = sql.match(/FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)/i);
  if (commandMatch) {
    policy.command = commandMatch[1].toUpperCase() as RLSPolicy['command'];
  }

  // Extract USING expression
  const usingMatch = sql.match(/USING\s*\(([^)]+(?:\([^)]*\))?[^)]*)\)/i);
  if (usingMatch) {
    policy.usingExpression = usingMatch[1].trim();
  }

  // Extract WITH CHECK expression
  const withCheckMatch = sql.match(/WITH\s+CHECK\s*\(([^)]+(?:\([^)]*\))?[^)]*)\)/i);
  if (withCheckMatch) {
    policy.withCheckExpression = withCheckMatch[1].trim();
  }

  // Extract roles
  const rolesMatch = sql.match(/TO\s+(\w+(?:\s*,\s*\w+)*)/i);
  if (rolesMatch) {
    policy.roles = rolesMatch[1].split(',').map(r => r.trim());
  }

  return policy;
}

/**
 * Convert RLS expression to JavaScript condition
 */
export function convertRLSExpressionToJS(expression: string): string {
  if (!expression) return 'true';

  let jsCondition = expression;

  // Replace auth.uid() with req.user.id
  jsCondition = jsCondition.replace(/auth\.uid\(\)/g, 'req.user?.id');

  // Replace column references like user_id with req.body.user_id or req.params.user_id
  jsCondition = jsCondition.replace(/(\w+)\.(\w+)/g, (match, table, col) => {
    if (table === 'auth' || table === 'public') return match;
    return `req.body.${col}`;
  });

  // Replace = with ===
  jsCondition = jsCondition.replace(/\s*=\s*(?!=)/g, ' === ');

  // Replace true/false
  jsCondition = jsCondition.replace(/\btrue\b/gi, 'true');
  jsCondition = jsCondition.replace(/\bfalse\b/gi, 'false');

  // Handle has_role function
  jsCondition = jsCondition.replace(
    /has_role\(auth\.uid\(\),\s*['"](\w+)['"]\)/g,
    "req.user?.role === '$1'"
  );

  // Handle EXISTS clauses (simplified)
  if (jsCondition.includes('EXISTS')) {
    jsCondition = '/* Complex EXISTS clause - needs manual review */ true';
  }

  return jsCondition;
}

/**
 * Generate Express middleware from RLS policy
 */
export function generateMiddleware(policy: RLSPolicy): MiddlewareOutput {
  const middlewareName = `require${policy.tableName.charAt(0).toUpperCase() + policy.tableName.slice(1)}${policy.policyName.replace(/\s+/g, '')}`;
  
  const description = `
// Middleware generated from RLS policy: "${policy.policyName}"
// Table: ${policy.tableName}
// Command: ${policy.command}
// Original USING: ${policy.usingExpression || 'N/A'}
// Original WITH CHECK: ${policy.withCheckExpression || 'N/A'}
`;

  let condition = 'true';
  
  if (policy.command === 'SELECT' || policy.command === 'ALL') {
    condition = convertRLSExpressionToJS(policy.usingExpression || 'true');
  } else if (policy.command === 'INSERT') {
    condition = convertRLSExpressionToJS(policy.withCheckExpression || 'true');
  } else {
    condition = convertRLSExpressionToJS(policy.usingExpression || 'true');
  }

  const content = `import { Request, Response, NextFunction } from 'express';

${description}
export const ${middlewareName} = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Apply policy condition
    const allowed = ${condition};
    
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied by policy: ${policy.policyName}' });
    }

    next();
  } catch (error) {
    console.error('Middleware error:', error);
    res.status(500).json({ error: 'Authorization error' });
  }
};
`;

  return {
    name: middlewareName,
    content,
    description: policy.policyName,
  };
}

/**
 * Generate authentication middleware
 */
export function generateAuthMiddleware(): string {
  return `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, jwtSecret) as AuthUser;
    req.user = decoded;
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtSecret = process.env.JWT_SECRET;

      if (jwtSecret) {
        try {
          const decoded = jwt.verify(token, jwtSecret) as AuthUser;
          req.user = decoded;
        } catch {
          // Token invalid but optional, continue without user
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};

export const requireRole = (role: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: \`Role '\${role}' required\` });
    }

    next();
  };
};
`;
}

/**
 * Generate all middleware files from policies
 */
export function generateAllMiddleware(policies: RLSPolicy[]): {
  middlewares: MiddlewareOutput[];
  indexContent: string;
  authMiddleware: string;
} {
  const middlewares = policies.map(p => generateMiddleware(p));
  const authMiddleware = generateAuthMiddleware();

  const indexContent = `// Middleware index - Auto-generated from RLS policies
export { authMiddleware, optionalAuth, requireRole } from './auth';

${middlewares.map(m => `export { ${m.name} } from './${m.name}';`).join('\n')}
`;

  return {
    middlewares,
    indexContent,
    authMiddleware,
  };
}

/**
 * Extract RLS policies from migration files
 */
export function extractPoliciesFromMigrations(files: Record<string, string>): RLSPolicy[] {
  const policies: RLSPolicy[] = [];

  for (const [path, content] of Object.entries(files)) {
    if (!path.includes('migrations') || !path.endsWith('.sql')) continue;

    // Find all CREATE POLICY statements
    const policyRegex = /CREATE\s+POLICY[^;]+;/gi;
    let match;

    while ((match = policyRegex.exec(content)) !== null) {
      const policy = parseRLSPolicy(match[0]);
      if (policy) {
        policies.push(policy);
      }
    }
  }

  return policies;
}
