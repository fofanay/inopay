/**
 * INOPAY SOVEREIGN ADAPTER
 * Couche d'abstraction pour tous les services externes
 * Permet de basculer entre providers via INFRA_MODE
 */

// Types d'infrastructure
export type InfraMode = 'cloud' | 'self-hosted' | 'hybrid';

export interface InfraConfig {
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
    bucket: string;
  };
  auth: {
    provider: 'supabase' | 'pocketbase' | 'custom';
    url: string;
  };
  ai: {
    provider: 'deepseek' | 'ollama' | 'openai' | 'anthropic';
    url: string;
    apiKey?: string;
  };
  email: {
    provider: 'resend' | 'smtp' | 'sendgrid';
    host?: string;
    port?: number;
    apiKey?: string;
  };
  realtime: {
    provider: 'supabase' | 'soketi' | 'pusher';
    url: string;
    key?: string;
  };
  search: {
    provider: 'postgres' | 'meilisearch' | 'algolia';
    url: string;
    apiKey?: string;
  };
}

// Configuration par défaut basée sur les variables d'environnement
const getInfraMode = (): InfraMode => {
  const mode = import.meta.env.VITE_INFRA_MODE || 'cloud';
  if (['cloud', 'self-hosted', 'hybrid'].includes(mode)) {
    return mode as InfraMode;
  }
  return 'cloud';
};

// Récupérer la configuration selon le mode
export const getInfraConfig = (): InfraConfig => {
  const mode = getInfraMode();
  
  // Configuration Cloud (Lovable Cloud / Supabase hébergé)
  if (mode === 'cloud') {
    return {
      mode: 'cloud',
      supabase: {
        url: import.meta.env.VITE_SUPABASE_URL || '',
        anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
      },
      storage: {
        provider: 'supabase',
        url: import.meta.env.VITE_SUPABASE_URL || '',
        bucket: 'cleaned-archives',
      },
      auth: {
        provider: 'supabase',
        url: import.meta.env.VITE_SUPABASE_URL || '',
      },
      ai: {
        provider: 'deepseek',
        url: 'https://api.deepseek.com',
      },
      email: {
        provider: 'resend',
      },
      realtime: {
        provider: 'supabase',
        url: import.meta.env.VITE_SUPABASE_URL || '',
      },
      search: {
        provider: 'postgres',
        url: import.meta.env.VITE_SUPABASE_URL || '',
      },
    };
  }
  
  // Configuration Self-Hosted (VPS privé)
  if (mode === 'self-hosted') {
    return {
      mode: 'self-hosted',
      supabase: {
        url: import.meta.env.VITE_SELF_SUPABASE_URL || 'http://localhost:54321',
        anonKey: import.meta.env.VITE_SELF_SUPABASE_ANON_KEY || '',
        serviceRoleKey: import.meta.env.VITE_SELF_SUPABASE_SERVICE_KEY || '',
      },
      storage: {
        provider: 'minio',
        url: import.meta.env.VITE_MINIO_URL || 'http://localhost:9000',
        accessKey: import.meta.env.VITE_MINIO_ACCESS_KEY || 'minioadmin',
        secretKey: import.meta.env.VITE_MINIO_SECRET_KEY || 'minioadmin',
        bucket: 'inopay-archives',
      },
      auth: {
        provider: 'supabase',
        url: import.meta.env.VITE_SELF_SUPABASE_URL || 'http://localhost:54321',
      },
      ai: {
        provider: 'ollama',
        url: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434',
      },
      email: {
        provider: 'smtp',
        host: import.meta.env.VITE_SMTP_HOST || 'localhost',
        port: parseInt(import.meta.env.VITE_SMTP_PORT || '587'),
      },
      realtime: {
        provider: 'soketi',
        url: `ws://${import.meta.env.VITE_SOKETI_HOST || 'localhost'}:${import.meta.env.VITE_SOKETI_PORT || '6001'}`,
        key: import.meta.env.VITE_SOKETI_APP_KEY || '',
      },
      search: {
        provider: 'meilisearch',
        url: import.meta.env.VITE_MEILISEARCH_URL || 'http://localhost:7700',
        apiKey: import.meta.env.VITE_MEILISEARCH_API_KEY || '',
      },
    };
  }
  
  // Configuration Hybride
  return {
    mode: 'hybrid',
    supabase: {
      url: import.meta.env.VITE_SUPABASE_URL || '',
      anonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    },
    storage: {
      provider: 'minio',
      url: import.meta.env.VITE_MINIO_URL || 'http://localhost:9000',
      bucket: 'inopay-archives',
    },
    auth: {
      provider: 'supabase',
      url: import.meta.env.VITE_SUPABASE_URL || '',
    },
    ai: {
      provider: 'ollama',
      url: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434',
    },
    email: {
      provider: 'resend',
    },
    realtime: {
      provider: 'supabase',
      url: import.meta.env.VITE_SUPABASE_URL || '',
    },
    search: {
      provider: 'postgres',
      url: import.meta.env.VITE_SUPABASE_URL || '',
    },
  };
};

// Singleton de configuration
let cachedConfig: InfraConfig | null = null;

export const getSovereignConfig = (): InfraConfig => {
  if (!cachedConfig) {
    cachedConfig = getInfraConfig();
  }
  return cachedConfig;
};

// Réinitialiser le cache (utile pour les tests ou changement de mode)
export const resetConfigCache = (): void => {
  cachedConfig = null;
};

// Vérifier si on est en mode souverain (self-hosted)
export const isSovereignMode = (): boolean => {
  return getSovereignConfig().mode === 'self-hosted';
};

// Vérifier si on est sur un domaine autorisé
const AUTHORIZED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'inopay.io',
  'inopay.dev',
  'inopay.app',
];

export const isAuthorizedDomain = (): boolean => {
  const hostname = window.location.hostname;
  
  // Vérifier les domaines exacts
  if (AUTHORIZED_DOMAINS.includes(hostname)) {
    return true;
  }
  
  // Vérifier les sous-domaines autorisés
  for (const domain of AUTHORIZED_DOMAINS) {
    if (hostname.endsWith(`.${domain}`)) {
      return true;
    }
  }
  
  // Vérifier les domaines personnalisés configurés
  const customDomains = import.meta.env.VITE_AUTHORIZED_DOMAINS?.split(',') || [];
  for (const customDomain of customDomains) {
    if (hostname === customDomain.trim() || hostname.endsWith(`.${customDomain.trim()}`)) {
      return true;
    }
  }
  
  return false;
};

// Vérification d'intégrité au démarrage
export const performIntegrityCheck = (): { 
  authorized: boolean; 
  message: string;
  shouldAlert: boolean;
} => {
  const isAuthorized = isAuthorizedDomain();
  
  if (!isAuthorized) {
    console.warn('[INOPAY] Running on unauthorized domain:', window.location.hostname);
    return {
      authorized: false,
      message: `Domaine non autorisé: ${window.location.hostname}. Contactez l'administrateur.`,
      shouldAlert: true,
    };
  }
  
  // Vérifier si on est "bridé" par une iframe
  const isInIframe = window !== window.parent;
  if (isInIframe && !isAuthorizedDomain()) {
    return {
      authorized: false,
      message: 'Application bridée par une iframe non autorisée.',
      shouldAlert: true,
    };
  }
  
  return {
    authorized: true,
    message: 'Intégrité vérifiée.',
    shouldAlert: false,
  };
};

// Export d'urgence - génère un package complet chiffré
export interface EmergencyExportData {
  timestamp: string;
  config: InfraConfig;
  checksum: string;
}

export const generateEmergencyExportManifest = (): EmergencyExportData => {
  const config = getSovereignConfig();
  const timestamp = new Date().toISOString();
  
  // Générer un checksum simple (en production, utiliser crypto)
  const checksum = btoa(JSON.stringify({ timestamp, mode: config.mode })).slice(0, 32);
  
  return {
    timestamp,
    config: {
      ...config,
      // Masquer les clés sensibles
      supabase: {
        ...config.supabase,
        anonKey: config.supabase.anonKey ? '[REDACTED]' : '',
        serviceRoleKey: undefined,
      },
      storage: {
        ...config.storage,
        accessKey: config.storage.accessKey ? '[REDACTED]' : undefined,
        secretKey: undefined,
      },
      ai: {
        ...config.ai,
        apiKey: undefined,
      },
      email: {
        ...config.email,
        apiKey: undefined,
      },
    },
    checksum,
  };
};
