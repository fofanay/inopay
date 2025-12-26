/**
 * INOPAY INCOGNITO MODE
 * Gestion sécurisée des données sensibles en sessionStorage
 * Efface toutes les traces à la fermeture de l'onglet
 */

// Préfixe pour identifier les données sensibles
const SENSITIVE_PREFIX = '__inopay_sensitive_';

// Données sensibles à stocker uniquement en session
export interface SensitiveData {
  githubToken?: string;
  sshKey?: string;
  ftpPassword?: string;
  supabaseServiceKey?: string;
  coolifyToken?: string;
  encryptionKey?: string;
}

// Encoder les données en base64 (obfuscation simple)
const encode = (data: string): string => {
  try {
    return btoa(encodeURIComponent(data));
  } catch {
    return data;
  }
};

// Décoder les données base64
const decode = (data: string): string => {
  try {
    return decodeURIComponent(atob(data));
  } catch {
    return data;
  }
};

// Stocker une donnée sensible
export const storeSensitive = (key: keyof SensitiveData, value: string): void => {
  if (!value) {
    removeSensitive(key);
    return;
  }
  
  // Stocker uniquement en sessionStorage (efface à la fermeture)
  sessionStorage.setItem(`${SENSITIVE_PREFIX}${key}`, encode(value));
  
  // Ne JAMAIS stocker en localStorage pour les données sensibles
  localStorage.removeItem(`${SENSITIVE_PREFIX}${key}`);
};

// Récupérer une donnée sensible
export const getSensitive = (key: keyof SensitiveData): string | null => {
  const encoded = sessionStorage.getItem(`${SENSITIVE_PREFIX}${key}`);
  if (!encoded) return null;
  return decode(encoded);
};

// Supprimer une donnée sensible
export const removeSensitive = (key: keyof SensitiveData): void => {
  sessionStorage.removeItem(`${SENSITIVE_PREFIX}${key}`);
  localStorage.removeItem(`${SENSITIVE_PREFIX}${key}`);
};

// Effacer toutes les données sensibles
export const clearAllSensitive = (): void => {
  // Nettoyer sessionStorage
  const sessionKeys = Object.keys(sessionStorage);
  for (const key of sessionKeys) {
    if (key.startsWith(SENSITIVE_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  }
  
  // Nettoyer localStorage (au cas où)
  const localKeys = Object.keys(localStorage);
  for (const key of localKeys) {
    if (key.startsWith(SENSITIVE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
};

// Vérifier si des données sensibles existent
export const hasSensitiveData = (): boolean => {
  const sessionKeys = Object.keys(sessionStorage);
  return sessionKeys.some(key => key.startsWith(SENSITIVE_PREFIX));
};

// Lister les clés sensibles stockées (sans valeurs)
export const listSensitiveKeys = (): string[] => {
  const sessionKeys = Object.keys(sessionStorage);
  return sessionKeys
    .filter(key => key.startsWith(SENSITIVE_PREFIX))
    .map(key => key.replace(SENSITIVE_PREFIX, ''));
};

// Mode incognito activé
let incognitoModeActive = false;
let cleanupHandlerRegistered = false;

// Activer le mode incognito
export const enableIncognitoMode = (): void => {
  if (incognitoModeActive) return;
  
  incognitoModeActive = true;
  
  // Enregistrer le handler de nettoyage une seule fois
  if (!cleanupHandlerRegistered) {
    // Nettoyer à la fermeture de l'onglet
    window.addEventListener('beforeunload', () => {
      if (incognitoModeActive) {
        clearAllSensitive();
      }
    });
    
    // Nettoyer à la perte de visibilité (changement d'onglet prolongé)
    let hiddenTimeout: ReturnType<typeof setTimeout> | null = null;
    
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && incognitoModeActive) {
        // Attendre 5 minutes avant de nettoyer (évite les faux positifs)
        hiddenTimeout = setTimeout(() => {
          clearAllSensitive();
        }, 5 * 60 * 1000);
      } else if (hiddenTimeout) {
        clearTimeout(hiddenTimeout);
        hiddenTimeout = null;
      }
    });
    
    // Nettoyer à la déconnexion
    window.addEventListener('storage', (event) => {
      if (event.key === 'supabase.auth.token' && !event.newValue) {
        clearAllSensitive();
      }
    });
    
    cleanupHandlerRegistered = true;
  }
  
  console.log('[INOPAY] Mode Incognito activé - données sensibles protégées');
};

// Désactiver le mode incognito (efface tout)
export const disableIncognitoMode = (): void => {
  clearAllSensitive();
  incognitoModeActive = false;
  console.log('[INOPAY] Mode Incognito désactivé - données sensibles effacées');
};

// Vérifier si le mode incognito est actif
export const isIncognitoModeActive = (): boolean => {
  return incognitoModeActive;
};

// Hook pour React - à utiliser dans les composants sensibles
export const useSensitiveStorage = () => {
  return {
    store: storeSensitive,
    get: getSensitive,
    remove: removeSensitive,
    clear: clearAllSensitive,
    hasData: hasSensitiveData,
    listKeys: listSensitiveKeys,
    enableIncognito: enableIncognitoMode,
    disableIncognito: disableIncognitoMode,
    isIncognitoActive: isIncognitoModeActive,
  };
};
