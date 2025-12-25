/**
 * Validates and normalizes Coolify URLs
 * Ensures proper format with port 8000 for HTTP connections
 */

export interface CoolifyUrlValidation {
  isValid: boolean;
  normalizedUrl: string;
  warning: string | null;
  error: string | null;
  suggestedUrl: string | null;
}

/**
 * Validates a Coolify URL and provides suggestions for fixing common issues
 */
export function validateCoolifyUrl(url: string): CoolifyUrlValidation {
  if (!url || url.trim() === '') {
    return {
      isValid: true,
      normalizedUrl: '',
      warning: null,
      error: null,
      suggestedUrl: null,
    };
  }

  const trimmedUrl = url.trim().replace(/\/$/, '');
  
  // Check if it has a protocol
  let urlWithProtocol = trimmedUrl;
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    urlWithProtocol = `http://${trimmedUrl}`;
  }

  try {
    const parsed = new URL(urlWithProtocol);
    
    // Check protocol
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        isValid: false,
        normalizedUrl: trimmedUrl,
        warning: null,
        error: "L'URL doit commencer par http:// ou https://",
        suggestedUrl: null,
      };
    }

    // Check for port - Coolify typically runs on port 8000
    const hasPort = parsed.port !== '';
    const isDefaultPort = parsed.port === '8000';
    const isHttpsPort = parsed.port === '443' || (parsed.protocol === 'https:' && parsed.port === '');
    const isHttpPort = parsed.port === '80' || (parsed.protocol === 'http:' && parsed.port === '');
    
    // If using HTTP without a specific port (defaults to 80), suggest adding :8000
    if (parsed.protocol === 'http:' && !hasPort) {
      const suggestedUrl = `${parsed.protocol}//${parsed.hostname}:8000`;
      return {
        isValid: false,
        normalizedUrl: trimmedUrl,
        warning: null,
        error: "L'URL Coolify doit inclure le port 8000 pour les connexions HTTP",
        suggestedUrl,
      };
    }

    // If using HTTP with port 80, suggest changing to 8000
    if (parsed.protocol === 'http:' && parsed.port === '80') {
      const suggestedUrl = `${parsed.protocol}//${parsed.hostname}:8000`;
      return {
        isValid: false,
        normalizedUrl: trimmedUrl,
        warning: null,
        error: "Coolify utilise généralement le port 8000, pas le port 80",
        suggestedUrl,
      };
    }

    // If using HTTP with a non-8000 port, warn but allow
    if (parsed.protocol === 'http:' && hasPort && !isDefaultPort) {
      return {
        isValid: true,
        normalizedUrl: trimmedUrl,
        warning: `Port non-standard détecté (${parsed.port}). Coolify utilise généralement le port 8000.`,
        error: null,
        suggestedUrl: `${parsed.protocol}//${parsed.hostname}:8000`,
      };
    }

    // HTTPS without port is acceptable (reverse proxy setup)
    if (parsed.protocol === 'https:' && !hasPort) {
      return {
        isValid: true,
        normalizedUrl: trimmedUrl,
        warning: null,
        error: null,
        suggestedUrl: null,
      };
    }

    // Valid URL with correct port
    return {
      isValid: true,
      normalizedUrl: trimmedUrl,
      warning: null,
      error: null,
      suggestedUrl: null,
    };

  } catch {
    return {
      isValid: false,
      normalizedUrl: trimmedUrl,
      warning: null,
      error: "Format d'URL invalide",
      suggestedUrl: null,
    };
  }
}

/**
 * Quick check if URL looks like it has port 8000 or is HTTPS
 */
export function hasCoolifyPort(url: string): boolean {
  if (!url) return false;
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `http://${url}`;
    const parsed = new URL(urlWithProtocol);
    // HTTPS (reverse proxy) or has port 8000
    return parsed.protocol === 'https:' || parsed.port === '8000';
  } catch {
    return false;
  }
}

/**
 * Suggests a corrected Coolify URL with port 8000
 */
export function suggestCoolifyUrl(url: string): string {
  if (!url) return '';
  try {
    const urlWithProtocol = url.startsWith('http') ? url : `http://${url}`;
    const parsed = new URL(urlWithProtocol);
    return `http://${parsed.hostname}:8000`;
  } catch {
    return url;
  }
}
