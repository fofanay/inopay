// ============================================
// INOPAY - Constantes Centralisées
// ============================================

// Service types
export const SERVICE_TYPES = {
  DEPLOY: 'deploy',
  REDEPLOY: 'redeploy',
  MONITORING: 'monitoring',
  SERVER: 'server',
} as const;

// Service labels
export const SERVICE_LABELS: Record<string, string> = {
  deploy: 'Déploiement VPS',
  redeploy: 'Re-déploiement',
  monitoring: 'Monitoring',
  server: 'Serveur Supp.',
};

// Plan limits
export const PLAN_LIMITS = {
  free: { maxFiles: 100, maxRepos: 1 },
  pro: { maxFiles: 1000, maxRepos: 5 },
  portfolio: { maxFiles: Infinity, maxRepos: 50 },
  enterprise: { maxFiles: Infinity, maxRepos: Infinity },
} as const;

// Limit sources
export const LIMIT_SOURCES = {
  PLAN: 'plan',
  PURCHASE: 'purchase',
  TESTER: 'tester',
} as const;

// Prices in cents (CAD)
export const PRICES = {
  DEPLOY: 1499, // 14.99$
  REDEPLOY: 499, // 4.99$
  MONITORING_MONTHLY: 999, // 9.99$/month
  SERVER: 499, // 4.99$
} as const;

// Security status
export const SECURITY_STATUS = {
  SECURE: 'secure',
  EXPOSED: 'exposed',
  PENDING_CLEANUP: 'pending_cleanup',
} as const;

// Badge types for UI
export const BADGE_TYPES = {
  ZERO_KNOWLEDGE: 'zero-knowledge',
  SECRETS_CLEANED: 'secrets-cleaned',
  ENTERPRISE_LIMITS: 'enterprise-limits',
  ULTRA_RAPIDE: 'ultra-rapide',
  DIRECT_DEPLOY: 'direct-deploy',
} as const;

// Helper function to mask secrets
export function maskSecret(secret: string | null): string {
  if (!secret) return '—';
  if (secret.length <= 8) return '****';
  return `***${secret.slice(-4)}`;
}

// Helper function to get secret hash for identification
export function getSecretHash(secret: string | null): string {
  if (!secret) return '—';
  // Simple hash for display purposes (not cryptographic)
  let hash = 0;
  for (let i = 0; i < secret.length; i++) {
    const char = secret.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 4);
}

// Check if a secret exists (without exposing it)
export function hasSecret(secret: string | null | undefined): boolean {
  return !!secret && secret.length > 0;
}

// Format currency
export function formatAmount(amount: number, currency = 'CAD'): string {
  return new Intl.NumberFormat('fr-CA', {
    style: 'currency',
    currency,
  }).format(amount / 100);
}

// Calculate time since cleanup
export function getCleanupAge(cleanedAt: string | null): { 
  isOld: boolean; 
  ageText: string;
  ageMinutes: number;
} {
  if (!cleanedAt) {
    return { isOld: false, ageText: 'Jamais nettoyé', ageMinutes: Infinity };
  }
  
  const now = new Date();
  const cleanedDate = new Date(cleanedAt);
  const diffMs = now.getTime() - cleanedDate.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 60) {
    return { isOld: false, ageText: `Il y a ${diffMinutes} min`, ageMinutes: diffMinutes };
  }
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return { isOld: diffHours > 1, ageText: `Il y a ${diffHours}h`, ageMinutes: diffMinutes };
  }
  
  const diffDays = Math.floor(diffHours / 24);
  return { isOld: true, ageText: `Il y a ${diffDays}j`, ageMinutes: diffMinutes };
}
