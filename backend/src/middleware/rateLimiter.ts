import { Request, Response, NextFunction } from 'express';

/**
 * Rate Limiter middleware pour Express
 * Utilise un store en mémoire (pour la production, utiliser Redis)
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

// Store en mémoire (pour production multi-instance, utiliser Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Nettoyage périodique des entrées expirées
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Toutes les minutes

/**
 * Crée un middleware de rate limiting
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'Trop de requêtes, veuillez réessayer plus tard.',
    keyGenerator = (req) => getClientIP(req),
    skip = () => false,
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();

    let entry = rateLimitStore.get(key);

    // Nouvelle fenêtre ou fenêtre expirée
    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      rateLimitStore.set(key, entry);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

      return next();
    }

    // Limite dépassée
    if (entry.count >= max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
      res.setHeader('Retry-After', retryAfter);

      console.log(`[RATE-LIMIT] Limit exceeded for ${key.substring(0, 16)}...`);

      return res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter,
      });
    }

    // Incrémenter le compteur
    entry.count++;
    rateLimitStore.set(key, entry);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - entry.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    next();
  };
}

/**
 * Extrait l'IP client de la requête
 */
function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.headers['x-real-ip'] as string || req.ip || 'unknown';
}

// ============================================
// Limiters pré-configurés
// ============================================

/**
 * Rate limiter général pour les API
 * 100 requêtes par minute
 */
export const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Trop de requêtes API, veuillez réessayer dans une minute.',
});

/**
 * Rate limiter strict pour l'authentification
 * 5 tentatives par 15 minutes
 */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.',
});

/**
 * Rate limiter pour les paiements
 * 10 requêtes par minute
 */
export const paymentLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Trop de requêtes de paiement. Veuillez réessayer dans une minute.',
});

/**
 * Rate limiter pour les déploiements
 * 5 requêtes par minute
 */
export const deployLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Trop de déploiements. Veuillez réessayer dans une minute.',
});

/**
 * Rate limiter pour les opérations IA/coûteuses
 * 20 requêtes par minute
 */
export const aiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Trop de requêtes IA. Veuillez réessayer dans une minute.',
});

/**
 * Rate limiter très strict pour les opérations sensibles
 * 3 requêtes par heure
 */
export const strictLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Limite atteinte pour cette opération sensible. Réessayez dans une heure.',
});

// ============================================
// Middleware de détection de brute-force
// ============================================

interface BruteForceEntry {
  attempts: number;
  blockedUntil?: number;
  lastAttempt: number;
}

const bruteForceStore = new Map<string, BruteForceEntry>();

/**
 * Protection contre les attaques par force brute
 */
export function bruteForceProtection(
  maxAttempts: number = 5,
  blockDurationMs: number = 15 * 60 * 1000, // 15 minutes
  windowMs: number = 60 * 60 * 1000 // 1 heure
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = getClientIP(req);
    const now = Date.now();

    let entry = bruteForceStore.get(key);

    // Nettoyer les entrées expirées
    if (entry && entry.lastAttempt < now - windowMs) {
      bruteForceStore.delete(key);
      entry = undefined;
    }

    // Vérifier si bloqué
    if (entry?.blockedUntil && entry.blockedUntil > now) {
      const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
      
      console.log(`[BRUTE-FORCE] Blocked IP attempt: ${key.substring(0, 16)}...`);

      return res.status(429).json({
        error: 'Too Many Failed Attempts',
        message: `Votre IP est temporairement bloquée. Réessayez dans ${Math.ceil(retryAfter / 60)} minutes.`,
        retryAfter,
      });
    }

    // Ajouter un handler pour les échecs
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      // Si c'est une erreur d'authentification
      if (res.statusCode === 401 || res.statusCode === 403) {
        if (!entry) {
          entry = { attempts: 0, lastAttempt: now };
        }
        entry.attempts++;
        entry.lastAttempt = now;

        // Bloquer après trop de tentatives
        if (entry.attempts >= maxAttempts) {
          entry.blockedUntil = now + blockDurationMs;
          console.log(`[BRUTE-FORCE] IP blocked: ${key.substring(0, 16)}... after ${entry.attempts} attempts`);
        }

        bruteForceStore.set(key, entry);
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        // Succès - réinitialiser les tentatives
        bruteForceStore.delete(key);
      }

      return originalJson(body);
    };

    next();
  };
}

/**
 * Middleware de logging des requêtes suspectes
 */
export function suspiciousRequestLogger(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  
  // Détecter les user-agents suspects
  const suspiciousAgents = [
    /sqlmap/i,
    /nikto/i,
    /nmap/i,
    /masscan/i,
    /zgrab/i,
    /python-requests/i,
    /curl\/\d/i,
    /wget/i,
  ];

  const isSuspicious = suspiciousAgents.some(pattern => pattern.test(userAgent));

  if (isSuspicious) {
    console.warn(`[SECURITY] Suspicious request from ${ip}: ${userAgent}`);
  }

  // Détecter les tentatives d'injection
  const url = req.url.toLowerCase();
  const body = JSON.stringify(req.body || {}).toLowerCase();
  
  const injectionPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
    /((\%27)|(\'))union/i,
    /<script\b[^>]*>/i,
    /javascript:/i,
    /on\w+\s*=/i,
  ];

  const hasInjection = injectionPatterns.some(
    pattern => pattern.test(url) || pattern.test(body)
  );

  if (hasInjection) {
    console.error(`[SECURITY] Potential injection attack from ${ip}: ${url}`);
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Requête invalide détectée.',
    });
  }

  next();
}
