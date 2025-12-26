/**
 * INOPAY CONFIG MANAGER
 * Centralise toutes les configurations d'infrastructure
 * Permet de basculer entre Cloud et Self-Hosted via VITE_INFRA_MODE
 */

type InfraMode = 'cloud' | 'self-hosted' | 'hybrid';

interface InfraConfig {
  mode: InfraMode;
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  storage: {
    provider: 'supabase' | 'minio' | 's3';
    url: string;
    accessKey?: string;
    secretKey?: string;
    bucket?: string;
  };
  auth: {
    provider: 'supabase' | 'pocketbase' | 'custom';
    url: string;
  };
  ai: {
    provider: 'lovable' | 'ollama' | 'openai' | 'anthropic';
    url: string;
    apiKey?: string;
  };
  search: {
    provider: 'postgres' | 'meilisearch' | 'algolia';
    url: string;
    apiKey?: string;
  };
  realtime: {
    provider: 'supabase' | 'soketi' | 'pusher';
    host: string;
    port: string;
    appKey?: string;
  };
  email: {
    provider: 'resend' | 'smtp' | 'sendgrid';
    host?: string;
    port?: string;
    apiKey?: string;
  };
}

// Détection du mode d'infrastructure
const detectInfraMode = (): InfraMode => {
  const envMode = import.meta.env.VITE_INFRA_MODE as string;
  if (envMode === 'self-hosted' || envMode === 'hybrid') {
    return envMode;
  }
  // Par défaut, cloud si on détecte Supabase Cloud URL
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  if (supabaseUrl.includes('supabase.co')) {
    return 'cloud';
  }
  return 'self-hosted';
};

// Configuration par défaut
const buildConfig = (): InfraConfig => {
  const mode = detectInfraMode();
  
  return {
    mode,
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321',
      anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      serviceRoleKey: undefined, // Never expose in frontend
    },
    storage: {
      provider: mode === 'cloud' ? 'supabase' : 'minio',
      url: mode === 'cloud' 
        ? import.meta.env.VITE_SUPABASE_URL 
        : (import.meta.env.VITE_MINIO_URL || 'http://localhost:9000'),
      accessKey: import.meta.env.VITE_MINIO_ACCESS_KEY,
      secretKey: undefined, // Never expose
      bucket: 'inopay-files',
    },
    auth: {
      provider: mode === 'cloud' ? 'supabase' : 'supabase',
      url: import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321',
    },
    ai: {
      provider: mode === 'cloud' ? 'lovable' : 'ollama',
      url: mode === 'cloud' 
        ? '/api/ai' 
        : (import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434'),
      apiKey: undefined, // Never expose
    },
    search: {
      provider: mode === 'cloud' ? 'postgres' : 'meilisearch',
      url: import.meta.env.VITE_MEILISEARCH_URL || 'http://localhost:7700',
      apiKey: import.meta.env.VITE_MEILISEARCH_API_KEY,
    },
    realtime: {
      provider: mode === 'cloud' ? 'supabase' : 'soketi',
      host: import.meta.env.VITE_SOKETI_HOST || 'localhost',
      port: import.meta.env.VITE_SOKETI_PORT || '6001',
      appKey: import.meta.env.VITE_SOKETI_APP_KEY,
    },
    email: {
      provider: mode === 'cloud' ? 'resend' : 'smtp',
      host: import.meta.env.VITE_SMTP_HOST,
      port: import.meta.env.VITE_SMTP_PORT,
      apiKey: undefined, // Never expose
    },
  };
};

// Instance singleton
let configInstance: InfraConfig | null = null;

/**
 * Obtenir la configuration d'infrastructure
 */
export const getConfig = (): InfraConfig => {
  if (!configInstance) {
    configInstance = buildConfig();
  }
  return configInstance;
};

/**
 * Vérifier si une clé API critique est configurée
 */
export const hasRequiredKeys = (): { valid: boolean; missing: string[] } => {
  const config = getConfig();
  const missing: string[] = [];
  
  if (!config.supabase.url) missing.push('SUPABASE_URL');
  if (!config.supabase.anonKey) missing.push('SUPABASE_ANON_KEY');
  
  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Vérifier si on est en mode développement Cloud (désactive les logs sensibles)
 */
export const isSecureEnvironment = (): boolean => {
  const config = getConfig();
  
  // En production, toujours sécurisé
  if (import.meta.env.PROD) return true;
  
  // En dev self-hosted, considéré comme sécurisé
  if (config.mode === 'self-hosted') return true;
  
  // En dev cloud, ne pas logger les données sensibles
  return false;
};

/**
 * Logger sécurisé - n'affiche pas les données sensibles en mode Cloud Dev
 */
export const secureLog = (
  level: 'log' | 'warn' | 'error',
  message: string,
  data?: unknown
): void => {
  if (!isSecureEnvironment()) {
    // En mode Cloud Dev, masquer les données
    console[level](`[INOPAY] ${message}`, data ? '[DATA HIDDEN]' : '');
    return;
  }
  
  // En prod ou self-hosted, log complet
  if (data) {
    console[level](`[INOPAY] ${message}`, data);
  } else {
    console[level](`[INOPAY] ${message}`);
  }
};

/**
 * Vérification de santé au démarrage
 */
export const performStartupCheck = (): {
  healthy: boolean;
  mode: InfraMode;
  warnings: string[];
} => {
  const config = getConfig();
  const warnings: string[] = [];
  
  const keysCheck = hasRequiredKeys();
  if (!keysCheck.valid) {
    warnings.push(`Clés manquantes: ${keysCheck.missing.join(', ')}`);
  }
  
  // Vérifier la cohérence du mode
  if (config.mode === 'cloud' && !config.supabase.url.includes('supabase')) {
    warnings.push('Mode cloud détecté mais URL Supabase semble locale');
  }
  
  return {
    healthy: keysCheck.valid,
    mode: config.mode,
    warnings,
  };
};

/**
 * Obtenir les variables d'environnement publiques (pour debug)
 */
export const getPublicEnvInfo = (): Record<string, string> => {
  const config = getConfig();
  
  return {
    INFRA_MODE: config.mode,
    SUPABASE_URL: config.supabase.url ? '[SET]' : '[MISSING]',
    SUPABASE_ANON_KEY: config.supabase.anonKey ? '[SET]' : '[MISSING]',
    STORAGE_PROVIDER: config.storage.provider,
    AUTH_PROVIDER: config.auth.provider,
    AI_PROVIDER: config.ai.provider,
    SEARCH_PROVIDER: config.search.provider,
    REALTIME_PROVIDER: config.realtime.provider,
    EMAIL_PROVIDER: config.email.provider,
  };
};

// Export du type pour utilisation externe
export type { InfraConfig, InfraMode };
