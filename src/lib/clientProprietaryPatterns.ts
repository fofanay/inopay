/**
 * Client-compatible proprietary patterns for code cleaning
 * Centralized patterns used by zipAnalyzer and SimpleLiberationFlow
 * This is a client-side version of supabase/functions/_shared/proprietary-patterns.ts
 */

// ============= PROPRIETARY PATTERNS TO DETECT =============

export const PROPRIETARY_IMPORTS: RegExp[] = [
  // Lovable / GPT Engineer patterns
  /@lovable\//g,
  /@gptengineer\//g,
  /from ['"]lovable/g,
  /from ['"]gptengineer/g,
  /from ['"]@lovable/g,
  /from ['"]@gptengineer/g,
  /lovable-tagger/g,
  /componentTagger/g,
  /lovable-core/g,
  /gpt-engineer/g,
  
  // Bolt patterns
  /@bolt\//g,
  /from ['"]bolt/g,
  /from ['"]@bolt/g,
  
  // v0 (Vercel) patterns
  /@v0\//g,
  /from ['"]v0/g,
  /from ['"]@v0/g,
  /v0-tagger/g,
  /v0-runtime/g,
  
  // Cursor patterns
  /@cursor\//g,
  /from ['"]cursor/g,
  /from ['"]@cursor/g,
  /cursor-sdk/g,
  
  // Replit patterns
  /@replit\//g,
  /from ['"]replit/g,
  /replit-runtime/g,
];

export const PROPRIETARY_FILES: string[] = [
  // Lovable / GPT Engineer
  '.bolt',
  '.lovable',
  '.gptengineer',
  '.gpteng',
  'lovable.config',
  'gptengineer.config',
  '.lovable.json',
  '.gptengineer.json',
  'bolt.config',
  '.bolt.json',
  
  // v0 (Vercel)
  '.v0',
  'v0.config',
  '.v0.json',
  'v0-manifest.json',
  
  // Cursor
  '.cursor',
  '.cursorrc',
  'cursor.config',
  '.cursor.json',
  
  // Replit
  '.replit',
  'replit.nix',
  '.replit.json',
];

export const PROPRIETARY_CONTENT: RegExp[] = [
  // Import statements
  /import\s*{\s*componentTagger\s*}\s*from\s*['"]lovable-tagger['"]\s*;?\n?/g,
  /import\s*.*\s*from\s*['"]@lovable\/[^'"]*['"]\s*;?\n?/g,
  /import\s*.*\s*from\s*['"]@gptengineer\/[^'"]*['"]\s*;?\n?/g,
  /import\s*.*\s*from\s*['"]lovable-[^'"]*['"]\s*;?\n?/g,
  /import\s*.*\s*from\s*['"]@v0\/[^'"]*['"]\s*;?\n?/g,
  /import\s*.*\s*from\s*['"]@bolt\/[^'"]*['"]\s*;?\n?/g,
  /import\s*.*\s*from\s*['"]@cursor\/[^'"]*['"]\s*;?\n?/g,
  
  // Plugin usage in vite.config
  /mode\s*===\s*['"]development['"]\s*&&\s*componentTagger\(\)\s*,?\n?/g,
  /componentTagger\(\)\s*,?\n?/g,
  
  // Comment markers
  /\/\/\s*@lovable.*\n?/g,
  /\/\*\s*@lovable[\s\S]*?\*\//g,
  /\/\/\s*@gptengineer.*\n?/g,
  /\/\*\s*@gptengineer[\s\S]*?\*\//g,
  /\/\/\s*@bolt.*\n?/g,
  /\/\*\s*@bolt[\s\S]*?\*\//g,
  /\/\/\s*@v0.*\n?/g,
  /\/\*\s*@v0[\s\S]*?\*\//g,
  
  // Data attributes
  /data-lovable[^"]*="[^"]*"/g,
  /data-gpt[^"]*="[^"]*"/g,
  /data-bolt[^"]*="[^"]*"/g,
  /data-lov-id="[^"]*"/g,
  /data-lov-component="[^"]*"/g,
  /data-v0[^"]*="[^"]*"/g,
  
  // Environment variable references
  /VITE_LOVABLE_[A-Z_]+/g,
  /VITE_GPT_[A-Z_]+/g,
];

// Telemetry DOMAINS (not packages)
export const TELEMETRY_DOMAINS: string[] = [
  // Lovable / GPT Engineer
  'lovable.app',
  'lovable.dev',
  'events.lovable',
  'telemetry.lovable',
  'gptengineer.app',
  'analytics.lovable',
  'tracking.lovable',
  'api.lovable.dev',
  'ws.lovable.dev',
  'cdn.lovable.dev',
  'cdn.gptengineer.app',
  'assets.lovable',
  'static.lovable',
  
  // v0 (Vercel)
  'v0.dev',
  'telemetry.v0.dev',
  'api.v0.dev',
  'cdn.v0.dev',
  
  // Bolt
  'bolt.new',
  'api.bolt.new',
];

// NPM packages to remove
export const SUSPICIOUS_PACKAGES: string[] = [
  // Lovable / GPT Engineer
  'lovable-tagger',
  '@lovable/core',
  '@lovable/cli',
  '@lovable/runtime',
  '@lovable/plugin-react',
  '@gptengineer/core',
  '@gptengineer/cli',
  'gpt-engineer',
  'lovable-analytics',
  'gpt-engineer-tracker',
  
  // Bolt
  'bolt-core',
  '@bolt/core',
  '@bolt/cli',
  '@bolt/runtime',
  
  // v0 (Vercel)
  '@v0/core',
  '@v0/cli',
  '@v0/runtime',
  '@v0/ui',
  'v0-tagger',
  'v0-sdk',
  
  // Cursor
  '@cursor/core',
  '@cursor/sdk',
  'cursor-runtime',
  
  // Replit
  '@replit/core',
  '@replit/extensions',
  'replit-sdk',
];

// Proprietary CDN domains
export const PROPRIETARY_ASSET_CDNS: string[] = [
  'cdn.lovable.app',
  'cdn.lovable.dev',
  'bolt-assets',
  'assets.bolt.new',
  'cdn.bolt.new',
  'assets.gptengineer.app',
  'cdn.gptengineer.app',
  'storage.lovable.app',
  'storage.lovable.dev',
];

// ============= AUTO-POLYFILL DEFINITIONS =============

export const HOOK_POLYFILLS: Record<string, { filename: string; content: string }> = {
  'use-mobile': {
    filename: 'use-mobile.ts',
    content: `import { useState, useEffect } from 'react';

/**
 * Hook to detect mobile viewport
 * Auto-generated polyfill by Inopay Liberation
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

export default useIsMobile;`,
  },
  'use-toast': {
    filename: 'use-toast.ts',
    content: `import { useState, useCallback } from 'react';

/**
 * Simple toast notification hook
 * Auto-generated polyfill by Inopay Liberation
 */
export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastCount = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(({ title, description, variant = 'default' }: Omit<Toast, 'id'>) => {
    const id = String(++toastCount);
    const newToast: Toast = { id, title, description, variant };
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
    
    return { id, dismiss: () => setToasts(prev => prev.filter(t => t.id !== id)) };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toast, toasts, dismiss };
}

export default useToast;`,
  },
  'use-sidebar': {
    filename: 'use-sidebar.ts',
    content: `import { useState, useCallback, createContext, useContext } from 'react';

/**
 * Sidebar state management hook
 * Auto-generated polyfill by Inopay Liberation
 */
export interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar(): SidebarState {
  const context = useContext(SidebarContext);
  const [isOpen, setIsOpen] = useState(true);
  
  if (context) return context;
  
  return {
    isOpen,
    toggle: () => setIsOpen(prev => !prev),
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}

export { SidebarContext };
export default useSidebar;`,
  },
};

// ============= UTILITY FUNCTIONS =============

/**
 * Check if file should be completely removed
 */
export function shouldRemoveFile(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || '';
  for (const pattern of PROPRIETARY_FILES) {
    if (fileName === pattern || filePath.includes(`/${pattern}`) || filePath.endsWith(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if content contains proprietary patterns
 */
export function needsCleaning(content: string): boolean {
  // Check proprietary imports
  for (const pattern of PROPRIETARY_IMPORTS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    if (regex.test(content)) return true;
  }
  
  // Check for telemetry domains
  for (const domain of TELEMETRY_DOMAINS) {
    if (content.includes(domain)) return true;
  }
  
  // Check for suspicious packages in package.json
  if (content.includes('"dependencies"') || content.includes('"devDependencies"')) {
    for (const pkg of SUSPICIOUS_PACKAGES) {
      if (content.includes(`"${pkg}"`)) return true;
    }
  }
  
  return false;
}

/**
 * Clean package.json from proprietary packages
 */
export function cleanPackageJson(content: string): { cleaned: string; changes: string[] } {
  const changes: string[] = [];
  
  try {
    const pkg = JSON.parse(content);
    
    for (const dep of SUSPICIOUS_PACKAGES) {
      if (pkg.dependencies?.[dep]) {
        delete pkg.dependencies[dep];
        changes.push(`Dépendance supprimée: ${dep}`);
      }
      if (pkg.devDependencies?.[dep]) {
        delete pkg.devDependencies[dep];
        changes.push(`DevDépendance supprimée: ${dep}`);
      }
    }
    
    // Clean scripts that reference proprietary tools
    if (pkg.scripts) {
      const scriptsToRemove = ['lovable', 'gpteng', 'bolt', 'v0', 'cursor'];
      for (const [key, value] of Object.entries(pkg.scripts)) {
        if (typeof value === 'string') {
          for (const term of scriptsToRemove) {
            if (value.includes(term)) {
              delete pkg.scripts[key];
              changes.push(`Script supprimé: ${key}`);
              break;
            }
          }
        }
      }
    }
    
    return { cleaned: JSON.stringify(pkg, null, 2), changes };
  } catch (e) {
    console.error('Error cleaning package.json:', e);
    return { cleaned: content, changes };
  }
}

/**
 * Clean vite.config.ts from proprietary plugins
 */
export function cleanViteConfig(content: string): { cleaned: string; changes: string[] } {
  const changes: string[] = [];
  let cleaned = content;
  
  const before = cleaned;
  cleaned = cleaned.replace(
    /import\s*{\s*componentTagger\s*}\s*from\s*['"]lovable-tagger['"]\s*;?\n?/g,
    ''
  );
  cleaned = cleaned.replace(
    /import\s*.*\s*from\s*['"]@lovable\/[^'"]*['"]\s*;?\n?/g,
    ''
  );
  cleaned = cleaned.replace(
    /mode\s*===\s*['"]development['"]\s*&&\s*componentTagger\(\)\s*,?\n?/g,
    ''
  );
  cleaned = cleaned.replace(
    /componentTagger\(\)\s*,?\n?/g,
    ''
  );
  
  if (cleaned !== before) {
    changes.push('vite.config.ts nettoyé des plugins propriétaires');
  }
  
  return { cleaned, changes };
}

/**
 * Clean index.html from proprietary scripts and data attributes
 */
export function cleanIndexHtml(content: string): { cleaned: string; changes: string[] } {
  const changes: string[] = [];
  let cleaned = content;
  
  const before = cleaned;
  cleaned = cleaned.replace(
    /<script[^>]*lovable[^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
  cleaned = cleaned.replace(
    /<script[^>]*gptengineer[^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
  cleaned = cleaned.replace(
    /<script[^>]*bolt[^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
  cleaned = cleaned.replace(
    /<script[^>]*v0[^>]*>[\s\S]*?<\/script>/gi,
    ''
  );
  cleaned = cleaned.replace(/\s*data-lov[^=]*="[^"]*"/g, '');
  cleaned = cleaned.replace(/\s*data-gpt[^=]*="[^"]*"/g, '');
  cleaned = cleaned.replace(/\s*data-bolt[^=]*="[^"]*"/g, '');
  cleaned = cleaned.replace(/\s*data-v0[^=]*="[^"]*"/g, '');
  
  if (cleaned !== before) {
    changes.push('index.html nettoyé des scripts et attributs propriétaires');
  }
  
  return { cleaned, changes };
}

/**
 * Clean source file from proprietary patterns (basic client-side cleaning)
 */
export function cleanSourceFile(content: string): { cleaned: string; changes: string[] } {
  const changes: string[] = [];
  let cleaned = content;
  
  // Remove proprietary content patterns
  for (const pattern of PROPRIETARY_CONTENT) {
    const regex = new RegExp(pattern.source, pattern.flags);
    if (regex.test(cleaned)) {
      cleaned = cleaned.replace(new RegExp(pattern.source, pattern.flags), '');
      changes.push(`Pattern supprimé: ${pattern.source.substring(0, 30)}...`);
    }
  }
  
  // Remove telemetry domain references
  for (const domain of TELEMETRY_DOMAINS) {
    const domainPattern = new RegExp(`['"\`][^'"\`]*${domain.replace(/\./g, '\\.')}[^'"\`]*['"\`]`, 'gi');
    if (domainPattern.test(cleaned)) {
      cleaned = cleaned.replace(domainPattern, '""');
      changes.push(`Télémétrie supprimée: ${domain}`);
    }
  }
  
  // Clean up empty lines left behind
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return { cleaned, changes };
}

/**
 * Check for proprietary CDN assets
 */
export function checkProprietaryCDN(content: string): { found: boolean; urls: string[] } {
  const urls: string[] = [];
  
  for (const cdn of PROPRIETARY_ASSET_CDNS) {
    const regex = new RegExp(`https?://[^'"\\s]*${cdn.replace(/\./g, '\\.')}[^'"\\s]*`, 'gi');
    const matches = content.match(regex);
    if (matches) {
      urls.push(...matches);
    }
  }
  
  return { found: urls.length > 0, urls };
}

/**
 * Detect which polyfills are needed based on file content
 */
export function detectNeededPolyfills(files: Map<string, string>): string[] {
  const needed = new Set<string>();
  
  for (const [path, content] of files) {
    if (!path.match(/\.(ts|tsx|js|jsx)$/)) continue;
    
    // Check for use-mobile
    if (/useIsMobile|use-mobile|useMobile/i.test(content)) {
      if (/@lovable|@gptengineer|lovable-|gptengineer-/i.test(content)) {
        needed.add('use-mobile');
      }
    }
    
    // Check for use-toast 
    if (/useToast|use-toast/i.test(content)) {
      if (/@lovable|@gptengineer|lovable-|gptengineer-/i.test(content)) {
        needed.add('use-toast');
      }
    }
    
    // Check for use-sidebar
    if (/useSidebar|use-sidebar/i.test(content)) {
      if (/@lovable|@gptengineer|lovable-|gptengineer-/i.test(content)) {
        needed.add('use-sidebar');
      }
    }
  }
  
  return Array.from(needed);
}

/**
 * Generate .env.example from detected environment variables
 */
export function generateEnvExample(files: Map<string, string>): string {
  const envVars = new Set<string>();
  
  for (const [, content] of files) {
    // Match VITE_ and REACT_APP_ environment variables
    const matches = content.matchAll(/(?:import\.meta\.env\.|process\.env\.)(VITE_[A-Z_]+|REACT_APP_[A-Z_]+)/g);
    for (const match of matches) {
      // Skip proprietary env vars
      if (!match[1].includes('LOVABLE') && !match[1].includes('GPT')) {
        envVars.add(match[1]);
      }
    }
  }
  
  if (envVars.size === 0) {
    return `# Variables d'environnement
# Ajoutez vos variables ici
# VITE_API_URL=https://api.example.com
`;
  }
  
  let result = `# Variables d'environnement générées par Inopay
# Remplissez les valeurs selon votre configuration

`;
  
  for (const v of envVars) {
    result += `${v}=\n`;
  }
  
  return result;
}
