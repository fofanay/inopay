import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

/**
 * Middleware de validation d'input utilisant Zod
 */

/**
 * Crée un middleware de validation pour le body de la requête
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Les données envoyées sont invalides.',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Crée un middleware de validation pour les query params
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Les paramètres de requête sont invalides.',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

/**
 * Crée un middleware de validation pour les params de route
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Les paramètres de route sont invalides.',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
}

// ============================================
// Schémas de validation communs
// ============================================

/**
 * Schéma pour un UUID
 */
export const uuidSchema = z.string().uuid('ID invalide');

/**
 * Schéma pour un email
 */
export const emailSchema = z.string().email('Email invalide').max(255);

/**
 * Schéma pour une URL
 */
export const urlSchema = z.string().url('URL invalide').max(2048);

/**
 * Schéma pour un nom de projet
 */
export const projectNameSchema = z
  .string()
  .min(1, 'Nom requis')
  .max(100, 'Nom trop long')
  .regex(/^[a-zA-Z0-9\-_\s]+$/, 'Caractères invalides dans le nom');

/**
 * Schéma pour le nettoyage de code
 */
export const cleanCodeSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().max(500),
      content: z.string().max(500000), // 500KB max par fichier
    })
  ).max(100), // 100 fichiers max
  projectName: projectNameSchema.optional(),
  options: z.object({
    removeComments: z.boolean().optional(),
    removeLogs: z.boolean().optional(),
    minify: z.boolean().optional(),
  }).optional(),
});

/**
 * Schéma pour la génération d'archive
 */
export const generateArchiveSchema = z.object({
  files: z.array(
    z.object({
      path: z.string().max(500),
      content: z.string().max(1000000), // 1MB max par fichier
    })
  ).max(500), // 500 fichiers max
  projectName: projectNameSchema,
  format: z.enum(['zip', 'tar']).optional().default('zip'),
});

/**
 * Schéma pour le déploiement FTP
 */
export const deployFtpSchema = z.object({
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535).optional().default(21),
  user: z.string().min(1).max(100),
  password: z.string().min(1).max(100),
  remotePath: z.string().max(500).optional().default('/'),
  files: z.array(
    z.object({
      path: z.string().max(500),
      content: z.string().max(10000000), // 10MB max par fichier
    })
  ).max(1000),
});

/**
 * Schéma pour l'export GitHub
 */
export const exportGithubSchema = z.object({
  repoName: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9\-_]+$/, 'Nom de repo invalide'),
  branch: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9\-_\/]+$/, 'Nom de branche invalide')
    .optional()
    .default('main'),
  files: z.array(
    z.object({
      path: z.string().max(500),
      content: z.string().max(10000000),
    })
  ).max(1000),
  commitMessage: z.string().max(500).optional().default('Update from Inopay'),
  isPrivate: z.boolean().optional().default(true),
});

/**
 * Schéma pour la création de checkout Stripe
 */
export const createCheckoutSchema = z.object({
  priceId: z.string().min(1).max(100),
  successUrl: urlSchema,
  cancelUrl: urlSchema,
  metadata: z.record(z.string().max(500)).optional(),
});

// ============================================
// Sanitisation des inputs
// ============================================

/**
 * Sanitise une chaîne pour éviter les injections XSS
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitise récursivement un objet
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'string'
          ? sanitizeString(item)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  
  return result as T;
}

/**
 * Middleware de sanitisation globale
 */
export function sanitizeInputs(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Vérifie si une chaîne contient des patterns d'injection SQL
 */
export function detectSQLInjection(input: string): boolean {
  const patterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
    /insert\s+into/i,
    /select.*from/i,
    /delete\s+from/i,
    /drop\s+table/i,
    /update\s+\w+\s+set/i,
  ];
  
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Vérifie si une chaîne contient des patterns XSS
 */
export function detectXSS(input: string): boolean {
  const patterns = [
    /<script\b[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<\s*img[^>]+onerror/i,
    /<\s*svg[^>]+onload/i,
    /expression\s*\(/i,
    /url\s*\(\s*["']?\s*data:/i,
  ];
  
  return patterns.some(pattern => pattern.test(input));
}

/**
 * Middleware de protection contre les injections
 */
export function injectionProtection(req: Request, res: Response, next: NextFunction) {
  const checkValue = (value: unknown, path: string): boolean => {
    if (typeof value === 'string') {
      if (detectSQLInjection(value) || detectXSS(value)) {
        console.error(`[SECURITY] Injection attempt detected in ${path}`);
        return true;
      }
    } else if (Array.isArray(value)) {
      return value.some((item, index) => checkValue(item, `${path}[${index}]`));
    } else if (typeof value === 'object' && value !== null) {
      return Object.entries(value).some(([key, val]) =>
        checkValue(val, `${path}.${key}`)
      );
    }
    return false;
  };

  // Vérifier le body
  if (req.body && checkValue(req.body, 'body')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Contenu potentiellement dangereux détecté.',
    });
  }

  // Vérifier les query params
  if (req.query && checkValue(req.query, 'query')) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Paramètres potentiellement dangereux détectés.',
    });
  }

  next();
}
