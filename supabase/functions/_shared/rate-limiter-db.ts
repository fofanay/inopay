/**
 * Rate Limiter distribué utilisant Supabase
 * Permet le partage d'état entre toutes les instances Edge Functions
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

/**
 * Vérifie et applique le rate limiting via la base de données Supabase
 */
export async function checkRateLimitDB(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { maxRequests, windowMs, keyPrefix = "rl" } = config;
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();
  const resetAt = now + windowMs;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Essayer d'insérer ou mettre à jour l'entrée
    const { data: existing, error: selectError } = await supabase
      .from("rate_limits")
      .select("count, reset_at")
      .eq("key", key)
      .single();

    if (selectError && selectError.code !== "PGRST116") {
      // Erreur autre que "no rows"
      console.error("[RATE-LIMIT-DB] Select error:", selectError);
      // Fallback: autoriser la requête en cas d'erreur DB
      return { allowed: true, remaining: maxRequests - 1, resetAt };
    }

    // Pas d'entrée existante ou fenêtre expirée
    if (!existing || new Date(existing.reset_at).getTime() < now) {
      const { error: upsertError } = await supabase
        .from("rate_limits")
        .upsert({
          key,
          count: 1,
          reset_at: new Date(resetAt).toISOString(),
          created_at: new Date().toISOString(),
        });

      if (upsertError) {
        console.error("[RATE-LIMIT-DB] Upsert error:", upsertError);
      }

      return { allowed: true, remaining: maxRequests - 1, resetAt };
    }

    // Vérifier si la limite est dépassée
    if (existing.count >= maxRequests) {
      const existingResetAt = new Date(existing.reset_at).getTime();
      const retryAfter = Math.ceil((existingResetAt - now) / 1000);
      return {
        allowed: false,
        remaining: 0,
        resetAt: existingResetAt,
        retryAfter: Math.max(1, retryAfter),
      };
    }

    // Incrémenter le compteur
    const { error: updateError } = await supabase
      .from("rate_limits")
      .update({ count: existing.count + 1 })
      .eq("key", key);

    if (updateError) {
      console.error("[RATE-LIMIT-DB] Update error:", updateError);
    }

    return {
      allowed: true,
      remaining: maxRequests - (existing.count + 1),
      resetAt: new Date(existing.reset_at).getTime(),
    };
  } catch (error) {
    console.error("[RATE-LIMIT-DB] Unexpected error:", error);
    // Fallback: autoriser la requête en cas d'erreur
    return { allowed: true, remaining: maxRequests - 1, resetAt };
  }
}

/**
 * Vérifie si une IP est bloquée
 */
export async function isIPBlocked(ipAddress: string): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { data, error } = await supabase
      .from("blocked_ips")
      .select("id, expires_at")
      .eq("ip_address", ipAddress)
      .single();

    if (error || !data) return false;

    // Vérifier si le blocage a expiré
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      // Supprimer l'entrée expirée
      await supabase.from("blocked_ips").delete().eq("id", data.id);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Bloque une IP
 */
export async function blockIP(
  ipAddress: string,
  reason: string,
  expiresInMs?: number
): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const expiresAt = expiresInMs
    ? new Date(Date.now() + expiresInMs).toISOString()
    : null;

  await supabase.from("blocked_ips").upsert({
    ip_address: ipAddress,
    reason,
    expires_at: expiresAt,
    blocked_at: new Date().toISOString(),
  });

  console.log(`[SECURITY] IP blocked: ${ipAddress} - ${reason}`);
}

/**
 * Enregistre un événement de sécurité
 */
export async function logSecurityEvent(
  eventType: string,
  details: Record<string, unknown>,
  severity: "info" | "warn" | "error" | "critical" = "info",
  ipAddress?: string,
  userId?: string,
  endpoint?: string
): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    await supabase.from("security_events").insert({
      event_type: eventType,
      ip_address: ipAddress,
      user_id: userId,
      endpoint,
      details,
      severity,
    });
  } catch (error) {
    console.error("[SECURITY-LOG] Failed to log event:", error);
  }
}

/**
 * Configurations de rate limiting par endpoint
 */
export const RATE_LIMITS_CONFIG = {
  // Endpoints critiques - limites strictes
  "create-checkout": { maxRequests: 10, windowMs: 60 * 1000 },
  "create-liberation-checkout": { maxRequests: 5, windowMs: 60 * 1000 },
  "stripe-webhook": { maxRequests: 100, windowMs: 60 * 1000 },

  // Endpoints d'authentification - très stricts
  "send-otp": { maxRequests: 3, windowMs: 15 * 60 * 1000 }, // 3 req/15min
  "verify-otp": { maxRequests: 5, windowMs: 15 * 60 * 1000 },
  "widget-auth": { maxRequests: 10, windowMs: 60 * 1000 },

  // Déploiements - modérés
  "deploy-ftp": { maxRequests: 5, windowMs: 60 * 1000 },
  "deploy-coolify": { maxRequests: 5, windowMs: 60 * 1000 },
  "deploy-direct": { maxRequests: 5, windowMs: 60 * 1000 },

  // IA/Opérations coûteuses - strictes
  "clean-code": { maxRequests: 20, windowMs: 60 * 1000 },
  "fofy-chat": { maxRequests: 30, windowMs: 60 * 1000 },
  "generate-archive": { maxRequests: 10, windowMs: 60 * 1000 },
  "generate-liberation-pack": { maxRequests: 5, windowMs: 60 * 1000 },

  // Lecture - relaxés
  "check-subscription": { maxRequests: 60, windowMs: 60 * 1000 },
  "list-github-repos": { maxRequests: 30, windowMs: 60 * 1000 },
  "get-user-credits": { maxRequests: 60, windowMs: 60 * 1000 },

  // Admin - modérés
  "admin-list-users": { maxRequests: 30, windowMs: 60 * 1000 },
  "admin-list-payments": { maxRequests: 30, windowMs: 60 * 1000 },
  "global-reset": { maxRequests: 1, windowMs: 60 * 60 * 1000 }, // 1 req/heure

  // Par défaut
  default: { maxRequests: 100, windowMs: 60 * 1000 },
} as const;

/**
 * Headers de rate limiting pour la réponse
 */
export function createRateLimitHeaders(
  result: RateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.resetAt.toString(),
    ...(result.retryAfter && { "Retry-After": result.retryAfter.toString() }),
  };
}

/**
 * Crée une réponse de rate limit dépassé
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
 * Middleware de rate limiting pour Edge Functions
 */
export async function withRateLimitDB(
  req: Request,
  userId: string | null,
  endpointName: string,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "anonymous";

  // Vérifier si l'IP est bloquée
  if (await isIPBlocked(ip)) {
    await logSecurityEvent(
      "blocked_ip_attempt",
      { endpoint: endpointName },
      "warn",
      ip,
      userId || undefined,
      endpointName
    );

    return new Response(
      JSON.stringify({
        error: "Access denied",
        message: "Votre adresse IP a été temporairement bloquée.",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Utiliser user ID si authentifié, sinon IP
  const identifier = userId || ip;

  const config =
    RATE_LIMITS_CONFIG[endpointName as keyof typeof RATE_LIMITS_CONFIG] ||
    RATE_LIMITS_CONFIG.default;

  const result = await checkRateLimitDB(identifier, {
    ...config,
    keyPrefix: endpointName,
  });

  if (!result.allowed) {
    console.log(
      `[RATE-LIMIT-DB] ${endpointName} limit exceeded for ${identifier.substring(0, 8)}...`
    );

    // Logger l'événement de sécurité
    await logSecurityEvent(
      "rate_limit_exceeded",
      {
        endpoint: endpointName,
        remaining: result.remaining,
        resetAt: result.resetAt,
      },
      "warn",
      ip,
      userId || undefined,
      endpointName
    );

    // Si trop de tentatives, bloquer l'IP temporairement
    const { data: recentEvents } = await createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )
      .from("security_events")
      .select("id")
      .eq("event_type", "rate_limit_exceeded")
      .eq("ip_address", ip)
      .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (recentEvents && recentEvents.length >= 10) {
      await blockIP(
        ip,
        "Repeated rate limit violations",
        30 * 60 * 1000 // 30 minutes
      );
    }

    return createRateLimitedResponse(result, corsHeaders);
  }

  return null; // Requête autorisée
}
