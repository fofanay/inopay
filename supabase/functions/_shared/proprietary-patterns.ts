// Centralized proprietary patterns for all cleaning functions
// This file ensures consistency across all cleaning operations

// ============= PROPRIETARY PATTERNS TO DETECT/REMOVE =============

export const PROPRIETARY_IMPORTS: RegExp[] = [
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
  /@bolt\//g,
  /from ['"]bolt/g,
];

export const PROPRIETARY_FILES: string[] = [
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
  // Third-party analytics (optional - user choice)
  // 'amplitude.com',
  // 'mixpanel.com',
  // 'segment.io',
];

// NPM packages to remove from dependencies
export const SUSPICIOUS_PACKAGES: string[] = [
  'lovable-tagger',
  '@lovable/core',
  '@lovable/cli',
  '@lovable/runtime',
  '@lovable/plugin-react',
  '@gptengineer/core',
  '@gptengineer/cli',
  'gpt-engineer',
  'bolt-core',
  '@bolt/core',
  'lovable-analytics',
  'gpt-engineer-tracker',
];

// Hidden plugin patterns to detect
export const HIDDEN_PLUGIN_PATTERNS: RegExp[] = [
  /lovable.*plugin/i,
  /gptengineer.*plugin/i,
  /inject.*telemetry/i,
  /hidden.*tracker/i,
];

// Standard hook replacements
export const HOOK_REPLACEMENTS: Record<string, { standard: string; import: string }> = {
  'use-mobile': {
    standard: `import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}`,
    import: "import { useIsMobile } from '@/hooks/use-mobile';",
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

export const SECURITY_LIMITS = {
  MAX_FILES_PER_LIBERATION: 500,
  MAX_FILE_SIZE_CHARS: 50000,
  MAX_API_COST_CENTS: 5000, // $50
  CACHE_TTL_HOURS: 24,
};
