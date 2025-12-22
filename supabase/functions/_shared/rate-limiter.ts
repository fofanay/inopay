/**
 * Rate Limiter for Edge Functions
 * Uses in-memory storage with sliding window algorithm
 * For production at scale, use Redis or Supabase table
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// In-memory store (suitable for edge functions with short lifespan)
// For 1000+ users, consider migrating to Redis or Supabase
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries periodically
function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 60 seconds
setInterval(cleanupExpiredEntries, 60000);

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const { maxRequests, windowMs, keyPrefix = "rl" } = config;
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();

  const existing = rateLimitStore.get(key);

  // If no existing record or window has expired, create new window
  if (!existing || now > existing.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt,
    };
  }

  // Check if limit exceeded
  if (existing.count >= maxRequests) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter,
    };
  }

  // Increment counter
  existing.count += 1;
  rateLimitStore.set(key, existing);

  return {
    allowed: true,
    remaining: maxRequests - existing.count,
    resetAt: existing.resetAt,
  };
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Critical payment endpoints - strict limits
  "create-checkout": { maxRequests: 10, windowMs: 60 * 1000 }, // 10 req/min
  
  // Deployment endpoints - moderate limits
  "deploy-ftp": { maxRequests: 5, windowMs: 60 * 1000 }, // 5 req/min
  "deploy-coolify": { maxRequests: 5, windowMs: 60 * 1000 },
  "deploy-direct": { maxRequests: 5, windowMs: 60 * 1000 },
  
  // AI/expensive operations - strict limits
  "clean-code": { maxRequests: 20, windowMs: 60 * 1000 }, // 20 req/min
  "generate-archive": { maxRequests: 10, windowMs: 60 * 1000 },
  
  // Read-heavy endpoints - relaxed limits
  "check-subscription": { maxRequests: 60, windowMs: 60 * 1000 }, // 60 req/min
  "list-github-repos": { maxRequests: 30, windowMs: 60 * 1000 },
  
  // Webhook endpoints - needs higher limits for Stripe bursts
  "stripe-webhook": { maxRequests: 100, windowMs: 60 * 1000 }, // 100 req/min
  
  // Customer portal - moderate limits
  "customer-portal": { maxRequests: 10, windowMs: 60 * 1000 }, // 10 req/min
  
  // Default for unspecified endpoints
  default: { maxRequests: 100, windowMs: 60 * 1000 }, // 100 req/min
} as const;

/**
 * Creates rate limit headers for response
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.resetAt.toString(),
    ...(result.retryAfter && { "Retry-After": result.retryAfter.toString() }),
  };
}

/**
 * Creates a rate limited response
 */
export function createRateLimitedResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: "Trop de requêtes. Veuillez réessayer dans quelques instants.",
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...createRateLimitHeaders(result),
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Middleware helper for applying rate limits
 */
export function withRateLimit(
  req: Request,
  userId: string | null,
  endpointName: string,
  corsHeaders: Record<string, string>
): Response | null {
  // Use user ID if authenticated, otherwise use IP-based identifier
  const identifier = userId || req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";
  
  const config = RATE_LIMITS[endpointName as keyof typeof RATE_LIMITS] || RATE_LIMITS.default;
  const result = checkRateLimit(identifier, { ...config, keyPrefix: endpointName });

  if (!result.allowed) {
    console.log(`[RATE-LIMIT] ${endpointName} limit exceeded for ${identifier.substring(0, 8)}...`);
    return createRateLimitedResponse(result, corsHeaders);
  }

  return null; // Request allowed
}
