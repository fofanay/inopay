// @inopay-core-protected
// Centralized proprietary patterns for all cleaning functions
// This file ensures consistency across all cleaning operations
// SRE Audit: Updated for v0, Cursor, and new Lovable markers

// ============= CORE PROTECTION SYSTEM =============
// Files marked with @inopay-core-protected are NEVER cleaned, even if they match patterns
// This prevents the cleaning engine from self-destructing during auto-liberation

export const CORE_PROTECTION_MARKER = '@inopay-core-protected';

/**
 * Check if content is protected from cleaning
 * Returns true if the file should be skipped entirely
 */
export function isProtectedContent(content: string): boolean {
  // Check for core protection marker in first 500 chars (header comment)
  const header = content.substring(0, 500);
  return header.includes(CORE_PROTECTION_MARKER);
}

// ============= SELF-PRESERVATION WHITELIST =============
// Critical files that must NEVER be removed or altered by the cleaning engine

export const INOPAY_WHITELIST: string[] = [
  // Core engine files
  'proprietary-patterns.ts',
  'rate-limiter.ts',
  'crypto-utils.ts',
  'retry-handler.ts',
  
  // Edge functions - Liberation
  'clean-code/index.ts',
  'process-project-liberation/index.ts',
  'diff-clean/index.ts',
  'verify-zero-shadow-door/index.ts',
  
  // Edge functions - Payment (Stripe)
  'stripe-webhook/index.ts',
  'create-checkout/index.ts',
  'create-liberation-checkout/index.ts',
  'check-subscription/index.ts',
  'customer-portal/index.ts',
  
  // Edge functions - Security
  'decrypt-secret/index.ts',
  'encrypt-secrets/index.ts',
  
  // Localization (critical for i18n)
  'locales/fr.json',
  'locales/en.json',
  
  // Compatibility layer
  'lib/sovereigntyReport.ts',
  'lib/costOptimization.ts',
  'lib/rlsPolicyExtractor.ts',
  'lib/edgeFunctionParser.ts',
  'lib/zipAnalyzer.ts',
];

/**
 * Check if file is in the self-preservation whitelist
 */
export function isWhitelistedFile(filePath: string): boolean {
  return INOPAY_WHITELIST.some(pattern => filePath.includes(pattern));
}

// ============= PROPRIETARY PATTERNS TO DETECT/REMOVE =============

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
  
  // v0 (Vercel) patterns - NEW
  /@v0\//g,
  /from ['"]v0/g,
  /from ['"]@v0/g,
  /v0-tagger/g,
  /v0-runtime/g,
  
  // Cursor patterns - NEW
  /@cursor\//g,
  /from ['"]cursor/g,
  /from ['"]@cursor/g,
  /cursor-sdk/g,
  
  // Replit patterns - NEW
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
  
  // v0 (Vercel) - NEW
  '.v0',
  'v0.config',
  '.v0.json',
  'v0-manifest.json',
  
  // Cursor - NEW
  '.cursor',
  '.cursorrc',
  'cursor.config',
  '.cursor.json',
  
  // Replit - NEW
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
  
  // Data attributes
  /data-lovable[^"]*="[^"]*"/g,
  /data-gpt[^"]*="[^"]*"/g,
  /data-bolt[^"]*="[^"]*"/g,
  /data-lov-id="[^"]*"/g,
  /data-lov-component="[^"]*"/g,
  
  // Environment variable references
  /VITE_LOVABLE_[A-Z_]+/g,
  /VITE_GPT_[A-Z_]+/g,
  
  // Dynamic markers
  /__lovable[^=]*=[^;]*/g,
  /__gpteng[^=]*=[^;]*/g,
];

// Telemetry DOMAINS only (not packages!)
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
  
  // v0 (Vercel) - NEW
  'v0.dev',
  'telemetry.v0.dev',
  'api.v0.dev',
  'cdn.v0.dev',
  
  // Bolt - NEW
  'bolt.new',
  'api.bolt.new',
  
  // Third-party analytics (optional - user choice)
  // 'amplitude.com',
  // 'mixpanel.com',
  // 'segment.io',
];

// NPM packages to remove from dependencies
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
  
  // v0 (Vercel) - NEW
  '@v0/core',
  '@v0/cli',
  '@v0/runtime',
  '@v0/ui',
  'v0-tagger',
  'v0-sdk',
  
  // Cursor - NEW
  '@cursor/core',
  '@cursor/sdk',
  'cursor-runtime',
  
  // Replit - NEW
  '@replit/core',
  '@replit/extensions',
  'replit-sdk',
];

// Hidden plugin patterns to detect
export const HIDDEN_PLUGIN_PATTERNS: RegExp[] = [
  /lovable.*plugin/i,
  /gptengineer.*plugin/i,
  /inject.*telemetry/i,
  /hidden.*tracker/i,
];

// ============= LOCK FILES TO EXCLUDE =============

export const LOCK_FILES: string[] = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'shrinkwrap.json',
  'npm-shrinkwrap.json',
];

// ============= ASSET CDN DOMAINS (for sovereignty check) =============

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

// Standard hook replacements with full implementations
export const HOOK_REPLACEMENTS: Record<string, { standard: string; import: string; filename: string }> = {
  'use-mobile': {
    filename: 'use-mobile.ts',
    standard: `import { useState, useEffect } from 'react';

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
    import: "import { useIsMobile } from '@/lib/inopay-compat/use-mobile';",
  },
  'use-toast': {
    filename: 'use-toast.ts',
    standard: `import { useState, useCallback } from 'react';

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
    
    // Auto dismiss after 5 seconds
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
    import: "import { useToast } from '@/lib/inopay-compat/use-toast';",
  },
  'use-sidebar': {
    filename: 'use-sidebar.ts',
    standard: `import { useState, useCallback, createContext, useContext } from 'react';

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
  
  // Fallback if not in provider
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
    import: "import { useSidebar } from '@/lib/inopay-compat/use-sidebar';",
  },
};

// ============= UTILITY FUNCTIONS =============

/**
 * Check if content needs cleaning (quick regex check)
 */
export function needsCleaning(content: string): boolean {
  // Check proprietary imports
  for (const pattern of PROPRIETARY_IMPORTS) {
    pattern.lastIndex = 0; // Reset regex state
    if (pattern.test(content)) return true;
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
 * Check if file should be completely removed
 */
export function shouldRemoveFile(filePath: string): boolean {
  for (const pattern of PROPRIETARY_FILES) {
    if (filePath.includes(pattern)) return true;
  }
  return false;
}

export interface CleaningResult {
  path: string;
  originalContent: string;
  cleanedContent: string;
  changes: string[];
  removed: boolean;
}

/**
 * Clean file content from proprietary patterns (synchronous, no AI)
 */
export function cleanFileContent(filePath: string, content: string): CleaningResult {
  const changes: string[] = [];
  let cleanedContent = content;
  let removed = false;

  // CORE PROTECTION: Skip if file is protected or whitelisted
  if (isProtectedContent(content)) {
    changes.push(`[PROTECTED] Fichier protégé ignoré: ${filePath}`);
    return { path: filePath, originalContent: content, cleanedContent: content, changes, removed: false };
  }
  
  if (isWhitelistedFile(filePath)) {
    changes.push(`[WHITELIST] Fichier critique ignoré: ${filePath}`);
    return { path: filePath, originalContent: content, cleanedContent: content, changes, removed: false };
  }

  // Check if file should be removed
  if (shouldRemoveFile(filePath)) {
    removed = true;
    changes.push(`Fichier propriétaire supprimé: ${filePath}`);
    return { path: filePath, originalContent: content, cleanedContent: '', changes, removed };
  }

  // Remove proprietary imports
  for (const pattern of PROPRIETARY_IMPORTS) {
    pattern.lastIndex = 0;
    if (pattern.test(cleanedContent)) {
      pattern.lastIndex = 0;
      cleanedContent = cleanedContent.replace(pattern, '');
      changes.push(`Import propriétaire supprimé: ${pattern.source}`);
    }
  }

  // Remove proprietary content patterns
  for (const pattern of PROPRIETARY_CONTENT) {
    pattern.lastIndex = 0;
    if (pattern.test(cleanedContent)) {
      pattern.lastIndex = 0;
      cleanedContent = cleanedContent.replace(pattern, '');
      changes.push(`Contenu propriétaire supprimé: ${pattern.source}`);
    }
  }

  // Remove telemetry domain references
  for (const domain of TELEMETRY_DOMAINS) {
    const domainPattern = new RegExp(`['"\`][^'"\`]*${domain.replace(/\./g, '\\.')}[^'"\`]*['"\`]`, 'gi');
    if (domainPattern.test(cleanedContent)) {
      cleanedContent = cleanedContent.replace(domainPattern, '""');
      changes.push(`Télémétrie supprimée: ${domain}`);
    }
  }

  // Clean package.json
  if (filePath === 'package.json' || filePath.endsWith('/package.json')) {
    try {
      const pkg = JSON.parse(cleanedContent);
      
      for (const dep of SUSPICIOUS_PACKAGES) {
        if (pkg.dependencies?.[dep]) {
          delete pkg.dependencies[dep];
          changes.push(`Dépendance supprimée: ${dep}`);
        }
        if (pkg.devDependencies?.[dep]) {
          delete pkg.devDependencies[dep];
          changes.push(`DevDépendance supprimée: ${dep}`);
        }
        if (pkg.peerDependencies?.[dep]) {
          delete pkg.peerDependencies[dep];
          changes.push(`PeerDépendance supprimée: ${dep}`);
        }
      }
      
      // Clean scripts that reference proprietary tools
      if (pkg.scripts) {
        const scriptsToRemove = ['lovable', 'gpteng', 'bolt'];
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
      
      cleanedContent = JSON.stringify(pkg, null, 2);
    } catch (e) {
      console.error('Error parsing package.json:', e);
    }
  }

  // Clean vite.config.ts
  if (filePath === 'vite.config.ts' || filePath.endsWith('/vite.config.ts')) {
    const before = cleanedContent;
    cleanedContent = cleanedContent.replace(
      /import\s*{\s*componentTagger\s*}\s*from\s*['"]lovable-tagger['"]\s*;?\n?/g,
      ''
    );
    cleanedContent = cleanedContent.replace(
      /import\s*.*\s*from\s*['"]@lovable\/[^'"]*['"]\s*;?\n?/g,
      ''
    );
    cleanedContent = cleanedContent.replace(
      /mode\s*===\s*['"]development['"]\s*&&\s*componentTagger\(\)\s*,?\n?/g,
      ''
    );
    cleanedContent = cleanedContent.replace(
      /componentTagger\(\)\s*,?\n?/g,
      ''
    );
    
    if (cleanedContent !== before) {
      changes.push('vite.config.ts nettoyé des plugins propriétaires');
    }
  }

  // Clean index.html
  if (filePath === 'index.html' || filePath.endsWith('/index.html')) {
    const before = cleanedContent;
    cleanedContent = cleanedContent.replace(
      /<script[^>]*lovable[^>]*>[\s\S]*?<\/script>/gi,
      ''
    );
    cleanedContent = cleanedContent.replace(
      /<script[^>]*gptengineer[^>]*>[\s\S]*?<\/script>/gi,
      ''
    );
    cleanedContent = cleanedContent.replace(/\s*data-lov[^=]*="[^"]*"/g, '');
    cleanedContent = cleanedContent.replace(/\s*data-gpt[^=]*="[^"]*"/g, '');
    
    if (cleanedContent !== before) {
      changes.push('index.html nettoyé des scripts propriétaires');
    }
  }

  // Clean up empty lines left behind
  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');
  
  // Clean up trailing commas in arrays/objects
  cleanedContent = cleanedContent.replace(/,(\s*[}\]])/g, '$1');

  return { path: filePath, originalContent: content, cleanedContent, changes, removed };
}

/**
 * Validate JavaScript/TypeScript syntax (basic check)
 * Returns true if code appears valid
 */
export function validateSyntax(code: string, filePath: string): { valid: boolean; error?: string } {
  // Skip non-JS/TS files
  if (!filePath.match(/\.(js|jsx|ts|tsx|mjs|cjs)$/)) {
    return { valid: true };
  }
  
  // Skip JSON files
  if (filePath.endsWith('.json')) {
    try {
      JSON.parse(code);
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }
  
  // Basic bracket matching
  const brackets = { '(': ')', '{': '}', '[': ']' };
  const stack: string[] = [];
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inMultilineComment = false;
  
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1];
    
    // Handle comments
    if (!inString && char === '/' && nextChar === '/') {
      inComment = true;
      continue;
    }
    if (!inString && char === '/' && nextChar === '*') {
      inMultilineComment = true;
      continue;
    }
    if (inMultilineComment && char === '*' && nextChar === '/') {
      inMultilineComment = false;
      i++;
      continue;
    }
    if (inComment && char === '\n') {
      inComment = false;
      continue;
    }
    if (inComment || inMultilineComment) continue;
    
    // Handle strings
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
      continue;
    }
    if (inString && char === stringChar && code[i - 1] !== '\\') {
      inString = false;
      continue;
    }
    if (inString) continue;
    
    // Handle brackets
    if (brackets[char as keyof typeof brackets]) {
      stack.push(brackets[char as keyof typeof brackets]);
    } else if (Object.values(brackets).includes(char)) {
      if (stack.pop() !== char) {
        return { valid: false, error: `Mismatched bracket: ${char} at position ${i}` };
      }
    }
  }
  
  if (stack.length > 0) {
    return { valid: false, error: `Unclosed brackets: ${stack.join('')}` };
  }
  
  return { valid: true };
}

// ============= SECURITY LIMITS =============

// Default values - can be overridden by admin_config table
export const SECURITY_LIMITS = {
  MAX_FILES_PER_LIBERATION: 500,
  MAX_FILE_SIZE_CHARS: 50000,
  MAX_API_COST_CENTS: 5000, // $50
  CACHE_TTL_HOURS: 24,
  KILL_SWITCH_ENABLED: false,
};

// Type for dynamic security limits
export interface DynamicSecurityLimits {
  MAX_FILES_PER_LIBERATION: number;
  MAX_FILE_SIZE_CHARS: number;
  MAX_API_COST_CENTS: number;
  CACHE_TTL_HOURS: number;
  KILL_SWITCH_ENABLED: boolean;
}

// Function to fetch dynamic limits from admin_config table
export async function getDynamicSecurityLimits(
  supabaseAdmin: any
): Promise<DynamicSecurityLimits> {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_config')
      .select('config_value')
      .eq('config_key', 'SECURITY_LIMITS')
      .single();
    
    if (error || !data) {
      console.log('[SECURITY] Using default limits (no config found)');
      return SECURITY_LIMITS;
    }
    
    const config = data.config_value as Record<string, any>;
    return {
      MAX_FILES_PER_LIBERATION: config.MAX_FILES_PER_LIBERATION ?? SECURITY_LIMITS.MAX_FILES_PER_LIBERATION,
      MAX_FILE_SIZE_CHARS: config.MAX_FILE_SIZE_CHARS ?? SECURITY_LIMITS.MAX_FILE_SIZE_CHARS,
      MAX_API_COST_CENTS: config.MAX_API_COST_CENTS ?? SECURITY_LIMITS.MAX_API_COST_CENTS,
      CACHE_TTL_HOURS: config.CACHE_TTL_HOURS ?? SECURITY_LIMITS.CACHE_TTL_HOURS,
      KILL_SWITCH_ENABLED: config.KILL_SWITCH_ENABLED ?? false,
    };
  } catch (e) {
    console.error('[SECURITY] Error fetching dynamic limits:', e);
    return SECURITY_LIMITS;
  }
}

// ============= LOCK FILE EXCLUSION =============

/**
 * Check if file is a lock file that should be excluded from push
 */
export function isLockFile(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || filePath;
  return LOCK_FILES.includes(fileName);
}

// ============= ASSET SOVEREIGNTY CHECK =============

export interface AssetSovereigntyResult {
  hasExternalAssets: boolean;
  externalUrls: { url: string; domain: string; filePath: string }[];
  cleanedContent?: string;
}

/**
 * Detect and optionally replace proprietary CDN URLs
 */
export function checkAssetSovereignty(
  filePath: string, 
  content: string, 
  replaceWithPlaceholder = false
): AssetSovereigntyResult {
  const externalUrls: { url: string; domain: string; filePath: string }[] = [];
  let cleanedContent = content;
  
  // Match URLs in strings
  const urlPatterns = [
    /['"`](https?:\/\/[^'"`\s]+)['"`]/g,
    /url\(['"]?(https?:\/\/[^'"`)\s]+)['"]?\)/g,
    /src=['"]?(https?:\/\/[^'"`\s>]+)['"]?/g,
    /href=['"]?(https?:\/\/[^'"`\s>]+)['"]?/g,
  ];
  
  for (const pattern of urlPatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(content)) !== null) {
      const url = match[1];
      for (const cdnDomain of PROPRIETARY_ASSET_CDNS) {
        if (url.includes(cdnDomain)) {
          externalUrls.push({ url, domain: cdnDomain, filePath });
          
          if (replaceWithPlaceholder) {
            // Replace with placeholder or local path
            const placeholder = `/assets/external-resource-${externalUrls.length}.placeholder`;
            cleanedContent = cleanedContent.replace(url, placeholder);
          }
        }
      }
    }
  }
  
  return {
    hasExternalAssets: externalUrls.length > 0,
    externalUrls,
    cleanedContent: replaceWithPlaceholder ? cleanedContent : undefined,
  };
}

// ============= AUTO-POLYFILL GENERATION =============

export interface PolyfillResult {
  generated: { path: string; content: string }[];
  importUpdates: { filePath: string; oldImport: string; newImport: string }[];
}

/**
 * Detect removed hooks and generate polyfill files
 */
export function generatePolyfills(
  originalFiles: { path: string; content: string }[],
  cleanedFiles: { path: string; content: string }[]
): PolyfillResult {
  const generated: { path: string; content: string }[] = [];
  const importUpdates: { filePath: string; oldImport: string; newImport: string }[] = [];
  const hooksNeeded = new Set<string>();
  
  // Find hooks that were referenced but might be broken after cleaning
  for (const file of cleanedFiles) {
    // Skip non-JS/TS files
    if (!file.path.match(/\.(js|jsx|ts|tsx)$/)) continue;
    
    for (const [hookName, hookDef] of Object.entries(HOOK_REPLACEMENTS)) {
      // Check if this hook is used in the file
      const hookUsagePattern = new RegExp(`use${hookName.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}|from.*['"].*${hookName}['"]`, 'i');
      
      if (hookUsagePattern.test(file.content)) {
        // Check if the original import from @lovable or similar was removed
        const originalFile = originalFiles.find(f => f.path === file.path);
        if (originalFile) {
          const hadProprietaryImport = /@lovable|lovable-|@gptengineer/i.test(originalFile.content);
          const stillHasImport = new RegExp(`from.*['"].*${hookName}['"]`).test(file.content);
          
          if (hadProprietaryImport || !stillHasImport) {
            hooksNeeded.add(hookName);
            
            // Track import update needed
            importUpdates.push({
              filePath: file.path,
              oldImport: `@lovable/${hookName}`,
              newImport: `@/lib/inopay-compat/${hookName}`,
            });
          }
        }
      }
    }
  }
  
  // Generate polyfill files for needed hooks
  for (const hookName of hooksNeeded) {
    const hookDef = HOOK_REPLACEMENTS[hookName];
    if (hookDef) {
      generated.push({
        path: `src/lib/inopay-compat/${hookDef.filename}`,
        content: hookDef.standard,
      });
    }
  }
  
  // Add index.ts if any polyfills were generated
  if (generated.length > 0) {
    const exports = Array.from(hooksNeeded).map(hookName => {
      const hookDef = HOOK_REPLACEMENTS[hookName];
      return `export * from './${hookDef.filename.replace('.ts', '')}';`;
    }).join('\n');
    
    generated.push({
      path: 'src/lib/inopay-compat/index.ts',
      content: `/**
 * Inopay Compatibility Layer
 * Auto-generated polyfills for removed proprietary hooks
 * Generated on: ${new Date().toISOString()}
 */

${exports}
`,
    });
  }
  
  return { generated, importUpdates };
}
