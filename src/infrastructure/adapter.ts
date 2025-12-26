/**
 * INOPAY SOVEREIGN INFRASTRUCTURE ADAPTER
 * ========================================
 * Couche d'abstraction unifiée pour tous les services externes.
 * Permet de basculer entre cloud et self-hosted via VITE_INFRA_MODE.
 * 
 * © 2024 Inovaq Canada Inc. - Code 100% Souverain
 */

// ============= Types =============

export type InfraMode = 'cloud' | 'self-hosted' | 'hybrid';
export type StorageProvider = 'supabase' | 'minio' | 's3';
export type AuthProvider = 'supabase' | 'pocketbase' | 'custom';
export type AIProvider = 'deepseek' | 'ollama' | 'openai' | 'anthropic' | 'lovable';
export type EmailProvider = 'resend' | 'smtp' | 'sendgrid';
export type RealtimeProvider = 'supabase' | 'soketi' | 'pusher';
export type SearchProvider = 'postgres' | 'meilisearch' | 'algolia';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
}

export interface StorageConfig {
  provider: StorageProvider;
  url: string;
  accessKey?: string;
  secretKey?: string;
  bucket: string;
}

export interface AuthConfig {
  provider: AuthProvider;
  url: string;
}

export interface AIConfig {
  provider: AIProvider;
  url: string;
  apiKey?: string;
  model?: string;
}

export interface EmailConfig {
  provider: EmailProvider;
  host?: string;
  port?: number;
  apiKey?: string;
  from?: string;
}

export interface RealtimeConfig {
  provider: RealtimeProvider;
  url: string;
  key?: string;
  cluster?: string;
}

export interface SearchConfig {
  provider: SearchProvider;
  url: string;
  apiKey?: string;
  index?: string;
}

export interface InfraConfig {
  mode: InfraMode;
  supabase: SupabaseConfig;
  storage: StorageConfig;
  auth: AuthConfig;
  ai: AIConfig;
  email: EmailConfig;
  realtime: RealtimeConfig;
  search: SearchConfig;
}

// ============= Environment Helpers =============

const env = (key: string, fallback: string = ''): string => {
  return import.meta.env[key] ?? fallback;
};

const envInt = (key: string, fallback: number = 0): number => {
  const value = import.meta.env[key];
  return value ? parseInt(value, 10) : fallback;
};

const envBool = (key: string, fallback: boolean = false): boolean => {
  const value = import.meta.env[key];
  return value ? value === 'true' : fallback;
};

// ============= Mode Detection =============

const getInfraMode = (): InfraMode => {
  const mode = env('VITE_INFRA_MODE', 'cloud');
  if (['cloud', 'self-hosted', 'hybrid'].includes(mode)) {
    return mode as InfraMode;
  }
  return 'cloud';
};

// ============= Configuration Builders =============

const buildCloudConfig = (): InfraConfig => ({
  mode: 'cloud',
  supabase: {
    url: env('VITE_SUPABASE_URL'),
    anonKey: env('VITE_SUPABASE_PUBLISHABLE_KEY'),
  },
  storage: {
    provider: 'supabase',
    url: env('VITE_SUPABASE_URL'),
    bucket: 'cleaned-archives',
  },
  auth: {
    provider: 'supabase',
    url: env('VITE_SUPABASE_URL'),
  },
  ai: {
    provider: 'lovable',
    url: env('VITE_SUPABASE_URL') + '/functions/v1',
  },
  email: {
    provider: 'resend',
    from: 'noreply@inopay.io',
  },
  realtime: {
    provider: 'supabase',
    url: env('VITE_SUPABASE_URL'),
  },
  search: {
    provider: 'postgres',
    url: env('VITE_SUPABASE_URL'),
  },
});

const buildSelfHostedConfig = (): InfraConfig => ({
  mode: 'self-hosted',
  supabase: {
    url: env('VITE_SELF_SUPABASE_URL', 'http://localhost:54321'),
    anonKey: env('VITE_SELF_SUPABASE_ANON_KEY'),
    serviceRoleKey: env('VITE_SELF_SUPABASE_SERVICE_KEY'),
  },
  storage: {
    provider: 'minio',
    url: env('VITE_MINIO_URL', 'http://localhost:9000'),
    accessKey: env('VITE_MINIO_ACCESS_KEY', 'minioadmin'),
    secretKey: env('VITE_MINIO_SECRET_KEY', 'minioadmin'),
    bucket: 'inopay-archives',
  },
  auth: {
    provider: 'supabase',
    url: env('VITE_SELF_SUPABASE_URL', 'http://localhost:54321'),
  },
  ai: {
    provider: 'ollama',
    url: env('VITE_OLLAMA_BASE_URL', 'http://localhost:11434'),
    model: env('VITE_OLLAMA_MODEL', 'llama3'),
  },
  email: {
    provider: 'smtp',
    host: env('VITE_SMTP_HOST', 'localhost'),
    port: envInt('VITE_SMTP_PORT', 587),
    from: env('VITE_SMTP_FROM', 'noreply@localhost'),
  },
  realtime: {
    provider: 'soketi',
    url: `ws://${env('VITE_SOKETI_HOST', 'localhost')}:${env('VITE_SOKETI_PORT', '6001')}`,
    key: env('VITE_SOKETI_APP_KEY'),
  },
  search: {
    provider: 'meilisearch',
    url: env('VITE_MEILISEARCH_URL', 'http://localhost:7700'),
    apiKey: env('VITE_MEILISEARCH_API_KEY'),
  },
});

const buildHybridConfig = (): InfraConfig => ({
  mode: 'hybrid',
  supabase: {
    url: env('VITE_SUPABASE_URL'),
    anonKey: env('VITE_SUPABASE_PUBLISHABLE_KEY'),
  },
  storage: {
    provider: 'minio',
    url: env('VITE_MINIO_URL', 'http://localhost:9000'),
    bucket: 'inopay-archives',
  },
  auth: {
    provider: 'supabase',
    url: env('VITE_SUPABASE_URL'),
  },
  ai: {
    provider: 'ollama',
    url: env('VITE_OLLAMA_BASE_URL', 'http://localhost:11434'),
  },
  email: {
    provider: 'resend',
    from: 'noreply@inopay.io',
  },
  realtime: {
    provider: 'supabase',
    url: env('VITE_SUPABASE_URL'),
  },
  search: {
    provider: 'postgres',
    url: env('VITE_SUPABASE_URL'),
  },
});

// ============= Configuration Manager =============

let cachedConfig: InfraConfig | null = null;

export const getInfraConfig = (): InfraConfig => {
  if (cachedConfig) return cachedConfig;
  
  const mode = getInfraMode();
  
  switch (mode) {
    case 'self-hosted':
      cachedConfig = buildSelfHostedConfig();
      break;
    case 'hybrid':
      cachedConfig = buildHybridConfig();
      break;
    default:
      cachedConfig = buildCloudConfig();
  }
  
  return cachedConfig;
};

export const resetConfigCache = (): void => {
  cachedConfig = null;
};

// ============= Convenience Getters =============

export const getSupabaseConfig = (): SupabaseConfig => getInfraConfig().supabase;
export const getStorageConfig = (): StorageConfig => getInfraConfig().storage;
export const getAuthConfig = (): AuthConfig => getInfraConfig().auth;
export const getAIConfig = (): AIConfig => getInfraConfig().ai;
export const getEmailConfig = (): EmailConfig => getInfraConfig().email;
export const getRealtimeConfig = (): RealtimeConfig => getInfraConfig().realtime;
export const getSearchConfig = (): SearchConfig => getInfraConfig().search;

// ============= Mode Checks =============

export const isCloudMode = (): boolean => getInfraConfig().mode === 'cloud';
export const isSelfHostedMode = (): boolean => getInfraConfig().mode === 'self-hosted';
export const isHybridMode = (): boolean => getInfraConfig().mode === 'hybrid';
export const isSovereignMode = (): boolean => isSelfHostedMode();

// ============= Domain Authorization =============

const AUTHORIZED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'inopay.io',
  'inopay.dev',
  'inopay.app',
  'getinopay.com',
];

export const isAuthorizedDomain = (): boolean => {
  if (typeof window === 'undefined') return true;
  
  const hostname = window.location.hostname;
  
  // Check exact matches
  if (AUTHORIZED_DOMAINS.includes(hostname)) return true;
  
  // Check subdomains
  for (const domain of AUTHORIZED_DOMAINS) {
    if (hostname.endsWith(`.${domain}`)) return true;
  }
  
  // Check custom domains from env
  const customDomains = env('VITE_AUTHORIZED_DOMAINS', '').split(',').filter(Boolean);
  for (const customDomain of customDomains) {
    const trimmed = customDomain.trim();
    if (hostname === trimmed || hostname.endsWith(`.${trimmed}`)) return true;
  }
  
  return false;
};

// ============= Integrity Check =============

export interface IntegrityCheckResult {
  authorized: boolean;
  mode: InfraMode;
  message: string;
  shouldAlert: boolean;
  isInIframe: boolean;
  domain: string;
}

export const performIntegrityCheck = (): IntegrityCheckResult => {
  if (typeof window === 'undefined') {
    return {
      authorized: true,
      mode: getInfraMode(),
      message: 'SSR mode',
      shouldAlert: false,
      isInIframe: false,
      domain: 'server',
    };
  }
  
  const isAuthorized = isAuthorizedDomain();
  const isInIframe = window !== window.parent;
  const domain = window.location.hostname;
  const mode = getInfraMode();
  
  if (!isAuthorized) {
    return {
      authorized: false,
      mode,
      message: `Domaine non autorisé: ${domain}`,
      shouldAlert: true,
      isInIframe,
      domain,
    };
  }
  
  if (isInIframe && !isAuthorized) {
    return {
      authorized: false,
      mode,
      message: 'Application dans une iframe non autorisée',
      shouldAlert: true,
      isInIframe,
      domain,
    };
  }
  
  return {
    authorized: true,
    mode,
    message: 'Intégrité vérifiée',
    shouldAlert: false,
    isInIframe,
    domain,
  };
};

// ============= Secure Logging =============

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

export const secureLog = (level: LogLevel, message: string, data?: unknown): void => {
  // Never log in production unless it's an error
  if (import.meta.env.PROD && level !== 'error' && level !== 'warn') {
    return;
  }
  
  // Sanitize data before logging
  const sanitized = data ? sanitizeForLog(data) : undefined;
  
  const prefix = '[INOPAY]';
  
  switch (level) {
    case 'error':
      console.error(prefix, message, sanitized ?? '');
      break;
    case 'warn':
      console.warn(prefix, message, sanitized ?? '');
      break;
    case 'info':
      console.info(prefix, message, sanitized ?? '');
      break;
    case 'debug':
      console.debug(prefix, message, sanitized ?? '');
      break;
    default:
      console.log(prefix, message, sanitized ?? '');
  }
};

const SENSITIVE_KEYS = [
  'password', 'secret', 'token', 'key', 'apiKey', 'api_key',
  'authorization', 'auth', 'credential', 'ssh', 'private',
];

const sanitizeForLog = (data: unknown): unknown => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeForLog);
  }
  
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

// ============= Startup Check =============

export interface StartupCheckResult {
  healthy: boolean;
  mode: InfraMode;
  warnings: string[];
  errors: string[];
}

export const performStartupCheck = (): StartupCheckResult => {
  const config = getInfraConfig();
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check Supabase config
  if (!config.supabase.url) {
    errors.push('VITE_SUPABASE_URL manquant');
  }
  if (!config.supabase.anonKey) {
    errors.push('VITE_SUPABASE_PUBLISHABLE_KEY manquant');
  }
  
  // Check self-hosted specific configs
  if (config.mode === 'self-hosted') {
    if (!config.storage.accessKey) {
      warnings.push('VITE_MINIO_ACCESS_KEY non configuré');
    }
    if (!config.search.apiKey) {
      warnings.push('VITE_MEILISEARCH_API_KEY non configuré');
    }
  }
  
  return {
    healthy: errors.length === 0,
    mode: config.mode,
    warnings,
    errors,
  };
};

// ============= Export Manifest =============

export interface ExportManifest {
  timestamp: string;
  mode: InfraMode;
  checksum: string;
  services: {
    name: string;
    provider: string;
    configured: boolean;
  }[];
}

export const generateExportManifest = (): ExportManifest => {
  const config = getInfraConfig();
  const timestamp = new Date().toISOString();
  const checksum = btoa(JSON.stringify({ timestamp, mode: config.mode })).slice(0, 32);
  
  return {
    timestamp,
    mode: config.mode,
    checksum,
    services: [
      { name: 'Database', provider: 'supabase', configured: !!config.supabase.url },
      { name: 'Storage', provider: config.storage.provider, configured: !!config.storage.url },
      { name: 'Auth', provider: config.auth.provider, configured: !!config.auth.url },
      { name: 'AI', provider: config.ai.provider, configured: !!config.ai.url },
      { name: 'Email', provider: config.email.provider, configured: true },
      { name: 'Realtime', provider: config.realtime.provider, configured: !!config.realtime.url },
      { name: 'Search', provider: config.search.provider, configured: !!config.search.url },
    ],
  };
};

// ============= Default Export =============

export default {
  getConfig: getInfraConfig,
  getSupabase: getSupabaseConfig,
  getStorage: getStorageConfig,
  getAuth: getAuthConfig,
  getAI: getAIConfig,
  getEmail: getEmailConfig,
  getRealtime: getRealtimeConfig,
  getSearch: getSearchConfig,
  isCloud: isCloudMode,
  isSelfHosted: isSelfHostedMode,
  isHybrid: isHybridMode,
  isSovereign: isSovereignMode,
  checkIntegrity: performIntegrityCheck,
  checkStartup: performStartupCheck,
  log: secureLog,
};
