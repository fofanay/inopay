/**
 * Retry Handler for Edge Functions
 * Provides resilient API calls with exponential backoff and user-friendly error messages
 * 
 * SRE Audit: Production-ready retry mechanism
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'fetch failed',
    'network error',
    'rate limit',
    'too many requests',
  ],
};

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  lastError?: Error;
}

/**
 * User-friendly error messages mapping
 */
const USER_FRIENDLY_ERRORS: Record<string, string> = {
  // DeepSeek API errors
  'deepseek api error: 401': 'La clé API DeepSeek est invalide ou expirée. Contactez le support.',
  'deepseek api error: 429': 'Limite de requêtes atteinte. Réessayez dans quelques minutes.',
  'deepseek api error: 500': 'Le service de nettoyage est temporairement indisponible. Réessayez dans quelques instants.',
  'deepseek api error: 503': 'Le service DeepSeek est en maintenance. Réessayez plus tard.',
  
  // Anthropic API errors
  'anthropic api error: 401': 'La clé API Claude est invalide ou expirée.',
  'anthropic api error: 429': 'Limite de requêtes Claude atteinte. Réessayez dans quelques minutes.',
  'anthropic api error: 500': 'Le service Claude est temporairement indisponible.',
  
  // OpenAI API errors  
  'openai api error: 401': 'Votre clé API OpenAI est invalide. Vérifiez-la dans vos paramètres.',
  'openai api error: 429': 'Limite de requêtes OpenAI atteinte. Réessayez plus tard.',
  'openai api error: 500': 'Le service OpenAI est temporairement indisponible.',
  
  // GitHub errors
  'token github invalide': 'Votre token GitHub a expiré. Reconnectez votre compte GitHub dans les paramètres.',
  'authentication failed': 'Authentification GitHub échouée. Reconnectez votre compte dans les paramètres.',
  'repository not found': 'Le dépôt GitHub est introuvable. Vérifiez vos permissions.',
  'permission denied': 'Accès refusé au dépôt GitHub. Vérifiez vos permissions.',
  
  // Coolify errors
  'impossible de se connecter à coolify': 'Votre serveur Coolify ne répond pas. Vérifiez que le serveur est en ligne.',
  'application non trouvée': 'L\'application n\'existe pas sur Coolify. Créez-la depuis le dashboard Coolify.',
  
  // Generic network errors
  'fetch failed': 'Erreur de connexion réseau. Vérifiez votre connexion et réessayez.',
  'network error': 'Problème de connexion réseau. Réessayez dans quelques instants.',
  'etimedout': 'La requête a expiré. Le serveur est peut-être surchargé.',
  'econnrefused': 'Impossible de se connecter au serveur. Vérifiez qu\'il est en ligne.',
  
  // Fallback
  'default': 'Une erreur inattendue s\'est produite. Réessayez ou contactez le support.',
};

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(error: string | Error): string {
  const errorMessage = (error instanceof Error ? error.message : error).toLowerCase();
  
  for (const [pattern, friendlyMessage] of Object.entries(USER_FRIENDLY_ERRORS)) {
    if (pattern !== 'default' && errorMessage.includes(pattern.toLowerCase())) {
      return friendlyMessage;
    }
  }
  
  return USER_FRIENDLY_ERRORS['default'];
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error | string, config: RetryConfig): boolean {
  const errorMessage = (error instanceof Error ? error.message : error).toLowerCase();
  
  for (const retryableError of config.retryableErrors) {
    if (errorMessage.includes(retryableError.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * baseDelay; // Add up to 30% jitter
  return Math.min(baseDelay + jitter, config.maxDelayMs);
}

/**
 * Execute function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        data: result,
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.log(`[RETRY] Attempt ${attempt + 1}/${fullConfig.maxRetries + 1} failed: ${lastError.message}`);
      
      // Check if this is the last attempt or if error is not retryable
      if (attempt === fullConfig.maxRetries || !isRetryableError(lastError, fullConfig)) {
        console.log(`[RETRY] Giving up after ${attempt + 1} attempts`);
        break;
      }
      
      // Calculate and apply delay before next attempt
      const delay = calculateDelay(attempt, fullConfig);
      console.log(`[RETRY] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }
  
  return {
    success: false,
    error: getUserFriendlyError(lastError || 'Unknown error'),
    attempts: fullConfig.maxRetries + 1,
    lastError,
  };
}

/**
 * Fetch with retry logic
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<Response>> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;
  let lastResponse: Response | undefined;
  
  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      lastResponse = response;
      
      // Check if response status is retryable
      if (fullConfig.retryableStatusCodes.includes(response.status)) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return {
        success: true,
        data: response,
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.log(`[FETCH-RETRY] Attempt ${attempt + 1}/${fullConfig.maxRetries + 1} failed: ${lastError.message}`);
      
      if (attempt === fullConfig.maxRetries || !isRetryableError(lastError, fullConfig)) {
        break;
      }
      
      const delay = calculateDelay(attempt, fullConfig);
      console.log(`[FETCH-RETRY] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }
  
  return {
    success: false,
    data: lastResponse,
    error: getUserFriendlyError(lastError || 'Fetch failed'),
    attempts: fullConfig.maxRetries + 1,
    lastError,
  };
}

/**
 * Log error for admin monitoring
 */
export async function logErrorForAdmin(
  supabase: any,
  errorType: string,
  errorMessage: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.from('admin_activity_logs').insert({
      action_type: 'error_logged',
      title: `Erreur: ${errorType}`,
      description: errorMessage,
      status: 'error',
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        userFriendlyMessage: getUserFriendlyError(errorMessage),
      },
    });
  } catch (e) {
    console.error('[RETRY-HANDLER] Failed to log error for admin:', e);
  }
}
