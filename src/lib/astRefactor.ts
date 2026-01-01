/**
 * AST Refactor Module
 * ====================
 * Lit un fichier TS/JS, repère les patterns Lovable,
 * et réécrit automatiquement le code.
 * 
 * Utilise: Babel, ts-morph, recast
 */

// Note: Ces imports fonctionneront dans un environnement Node.js avec les packages installés
// Pour le frontend, on utilise une version simplifiée basée sur regex

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface RefactorPattern {
  name: string;
  description: string;
  find: RegExp | string;
  replace: string | ((match: string, ...args: string[]) => string);
  severity: 'critical' | 'major' | 'minor';
  category: 'import' | 'api' | 'pattern' | 'attribute' | 'comment';
}

export interface RefactorResult {
  originalCode: string;
  refactoredCode: string;
  changes: RefactorChange[];
  hasChanges: boolean;
  stats: {
    totalPatterns: number;
    appliedPatterns: number;
    linesChanged: number;
    bytesChanged: number;
  };
}

export interface RefactorChange {
  pattern: string;
  line: number;
  column: number;
  original: string;
  replacement: string;
  severity: 'critical' | 'major' | 'minor';
}

// ═══════════════════════════════════════════════════════════════
// PATTERNS À REMPLACER
// ═══════════════════════════════════════════════════════════════

export const REFACTOR_PATTERNS: RefactorPattern[] = [
  // ─────────────────────────────────────────────────────────────
  // IMPORTS - Critical
  // ─────────────────────────────────────────────────────────────
  {
    name: 'lovable-import',
    description: 'Import @lovable/*',
    find: /^import\s+(\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]@lovable\/([^'"]+)['"];?$/gm,
    replace: (match, imports, pkg) => {
      const mapping: Record<string, string> = {
        'core': '@/lib/sovereignCore',
        'ai': '@/lib/sovereignAIAdapter',
        'patterns': '@/lib/patterns',
        'utils': '@/lib/utils',
        'tagger': '', // Remove entirely
      };
      const newPkg = mapping[pkg] || `@/lib/${pkg}`;
      return newPkg ? `import ${imports} from '${newPkg}';` : `// [REMOVED] @lovable/${pkg}`;
    },
    severity: 'critical',
    category: 'import',
  },
  {
    name: 'agent-import',
    description: 'Import @agent/*',
    find: /^import\s+(\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]@agent\/([^'"]+)['"];?$/gm,
    replace: '// [REMOVED] Agent import - implement locally',
    severity: 'critical',
    category: 'import',
  },
  {
    name: 'lovable-tagger-import',
    description: 'Import lovable-tagger',
    find: /^import\s+.*from\s+['"]lovable-tagger['"];?$/gm,
    replace: '// [REMOVED] lovable-tagger',
    severity: 'critical',
    category: 'import',
  },
  {
    name: 'gptengineer-import',
    description: 'Import @gptengineer/*',
    find: /^import\s+.*from\s+['"]@gptengineer\/[^'"]+['"];?$/gm,
    replace: '// [REMOVED] GPT Engineer import',
    severity: 'critical',
    category: 'import',
  },
  {
    name: 'supabase-auto-import',
    description: 'Import @/integrations/supabase auto-generated',
    find: /from\s+['"]@\/integrations\/supabase\/client['"]/g,
    replace: "from '@/lib/supabase'",
    severity: 'major',
    category: 'import',
  },
  {
    name: 'supabase-types-import',
    description: 'Import @/integrations/supabase/types',
    find: /from\s+['"]@\/integrations\/supabase\/types['"]/g,
    replace: "from '@/types/database'",
    severity: 'major',
    category: 'import',
  },

  // ─────────────────────────────────────────────────────────────
  // API CALLS - Critical
  // ─────────────────────────────────────────────────────────────
  {
    name: 'getAIAssistant',
    description: 'getAIAssistant() → sovereignAIAdapter.createAssistant()',
    find: /getAIAssistant\s*\(/g,
    replace: 'sovereignAIAdapter.createAssistant(',
    severity: 'critical',
    category: 'api',
  },
  {
    name: 'runAssistant',
    description: 'runAssistant() → sovereignAIAdapter.run()',
    find: /runAssistant\s*\(/g,
    replace: 'sovereignAIAdapter.run(',
    severity: 'critical',
    category: 'api',
  },
  {
    name: 'lovable-generate',
    description: 'lovable.generate() → sovereignAIAdapter.generateCompletion()',
    find: /lovable\.generate\s*\(/g,
    replace: 'sovereignAIAdapter.generateCompletion(',
    severity: 'critical',
    category: 'api',
  },
  {
    name: 'lovableApi',
    description: 'lovableApi.* → api.*',
    find: /lovableApi\./g,
    replace: 'api.',
    severity: 'critical',
    category: 'api',
  },
  {
    name: 'lovable-websocket',
    description: 'WebSocket Lovable → standard WebSocket',
    find: /new\s+WebSocket\s*\(\s*['"][^'"]*lovable[^'"]*['"]\s*\)/gi,
    replace: "new WebSocket('ws://localhost:8080')",
    severity: 'critical',
    category: 'api',
  },

  // ─────────────────────────────────────────────────────────────
  // PATTERNS - Major
  // ─────────────────────────────────────────────────────────────
  {
    name: 'Pattern.Template',
    description: 'Pattern.Template → createTemplateEngine()',
    find: /Pattern\.Template/g,
    replace: 'createTemplateEngine()',
    severity: 'major',
    category: 'pattern',
  },
  {
    name: 'Pattern.State',
    description: 'Pattern.State → createStateManager()',
    find: /Pattern\.State/g,
    replace: 'createStateManager()',
    severity: 'major',
    category: 'pattern',
  },
  {
    name: 'Pattern.Router',
    description: 'Pattern.Router → createRouter()',
    find: /Pattern\.Router/g,
    replace: 'createRouter()',
    severity: 'major',
    category: 'pattern',
  },
  {
    name: 'Pattern.Form',
    description: 'Pattern.Form → createFormHandler()',
    find: /Pattern\.Form/g,
    replace: 'createFormHandler()',
    severity: 'major',
    category: 'pattern',
  },
  {
    name: 'Pattern.Modal',
    description: 'Pattern.Modal → createModalManager()',
    find: /Pattern\.Modal/g,
    replace: 'createModalManager()',
    severity: 'major',
    category: 'pattern',
  },
  {
    name: 'Pattern.Toast',
    description: 'Pattern.Toast → toast',
    find: /Pattern\.Toast/g,
    replace: 'toast',
    severity: 'major',
    category: 'pattern',
  },
  {
    name: 'EventSchema',
    description: 'EventSchema.* → z.*',
    find: /EventSchema\./g,
    replace: 'z.',
    severity: 'major',
    category: 'pattern',
  },
  {
    name: 'EventSchema-import',
    description: 'Add zod import if EventSchema was used',
    find: /^(import\s+.*from\s+['"]zod['"];?)$/m,
    replace: "import { z } from 'zod';",
    severity: 'major',
    category: 'import',
  },

  // ─────────────────────────────────────────────────────────────
  // TELEMETRY - Major
  // ─────────────────────────────────────────────────────────────
  {
    name: 'fetch-lovable-api',
    description: 'Remove fetch to lovable.dev',
    find: /fetch\s*\(\s*['"][^'"]*lovable\.dev[^'"]*['"]\s*(?:,\s*\{[^}]*\})?\s*\)/g,
    replace: '/* [REMOVED] Lovable telemetry */',
    severity: 'major',
    category: 'api',
  },
  {
    name: 'sendBeacon-lovable',
    description: 'Remove sendBeacon to lovable',
    find: /navigator\.sendBeacon\s*\(\s*['"][^'"]*lovable[^'"]*['"]\s*(?:,\s*[^)]+)?\s*\)/gi,
    replace: '/* [REMOVED] Lovable beacon */',
    severity: 'major',
    category: 'api',
  },
  {
    name: 'lovable-env-vars',
    description: 'VITE_LOVABLE_* → VITE_APP_*',
    find: /VITE_LOVABLE_([A-Z_]+)/g,
    replace: (match, varName) => `VITE_APP_${varName}`,
    severity: 'major',
    category: 'api',
  },

  // ─────────────────────────────────────────────────────────────
  // ATTRIBUTES - Minor
  // ─────────────────────────────────────────────────────────────
  {
    name: 'data-lov-id',
    description: 'Remove data-lov-id attributes',
    find: /\s+data-lov-id="[^"]*"/g,
    replace: '',
    severity: 'minor',
    category: 'attribute',
  },
  {
    name: 'data-lovable',
    description: 'Remove data-lovable-* attributes',
    find: /\s+data-lovable-[a-z-]+="[^"]*"/g,
    replace: '',
    severity: 'minor',
    category: 'attribute',
  },
  {
    name: 'lov-css-class',
    description: 'Remove lov-* CSS classes',
    find: /\blov-[a-z0-9-]+/g,
    replace: '',
    severity: 'minor',
    category: 'attribute',
  },

  // ─────────────────────────────────────────────────────────────
  // COMMENTS - Minor
  // ─────────────────────────────────────────────────────────────
  {
    name: 'lovable-annotation',
    description: 'Remove @lovable- annotations',
    find: /\/\/\s*@lovable-[a-z-]+[^\n]*/g,
    replace: '',
    severity: 'minor',
    category: 'comment',
  },
  {
    name: 'lovable-block-comment',
    description: 'Remove lovable: block comments',
    find: /\/\*\s*lovable:[^*]*\*\//g,
    replace: '',
    severity: 'minor',
    category: 'comment',
  },
  {
    name: 'generated-by-lovable',
    description: 'Remove "Generated by Lovable" comments',
    find: /\/\/[^\n]*[Gg]enerated\s+by\s+[Ll]ovable[^\n]*/g,
    replace: '',
    severity: 'minor',
    category: 'comment',
  },
];

// ═══════════════════════════════════════════════════════════════
// AST REFACTOR CLASS
// ═══════════════════════════════════════════════════════════════

export class ASTRefactor {
  private patterns: RefactorPattern[];
  private verbose: boolean;

  constructor(options: { patterns?: RefactorPattern[]; verbose?: boolean } = {}) {
    this.patterns = options.patterns || REFACTOR_PATTERNS;
    this.verbose = options.verbose || false;
  }

  /**
   * Refactor a single file
   */
  refactor(code: string, filename?: string): RefactorResult {
    const changes: RefactorChange[] = [];
    let refactoredCode = code;
    const originalLines = code.split('\n');
    
    // Apply each pattern
    for (const pattern of this.patterns) {
      const regex = typeof pattern.find === 'string' 
        ? new RegExp(pattern.find, 'g') 
        : pattern.find;
      
      // Reset regex
      regex.lastIndex = 0;
      
      let match;
      while ((match = regex.exec(code)) !== null) {
        // Find line number
        const beforeMatch = code.substring(0, match.index);
        const lineNumber = beforeMatch.split('\n').length;
        const lineStart = beforeMatch.lastIndexOf('\n') + 1;
        const column = match.index - lineStart + 1;
        
        // Calculate replacement
        let replacement: string;
        if (typeof pattern.replace === 'function') {
          replacement = pattern.replace(match[0], ...match.slice(1));
        } else {
          replacement = pattern.replace;
        }
        
        changes.push({
          pattern: pattern.name,
          line: lineNumber,
          column,
          original: match[0],
          replacement,
          severity: pattern.severity,
        });
      }
      
      // Apply replacement
      if (typeof pattern.replace === 'function') {
        refactoredCode = refactoredCode.replace(regex, pattern.replace as any);
      } else {
        refactoredCode = refactoredCode.replace(regex, pattern.replace);
      }
    }

    // Clean up: remove excessive blank lines
    refactoredCode = refactoredCode.replace(/\n{4,}/g, '\n\n\n');
    
    // Clean up: remove trailing whitespace
    refactoredCode = refactoredCode.split('\n').map(line => line.trimEnd()).join('\n');
    
    const newLines = refactoredCode.split('\n');
    
    return {
      originalCode: code,
      refactoredCode,
      changes,
      hasChanges: changes.length > 0,
      stats: {
        totalPatterns: this.patterns.length,
        appliedPatterns: new Set(changes.map(c => c.pattern)).size,
        linesChanged: Math.abs(originalLines.length - newLines.length) + changes.length,
        bytesChanged: Math.abs(code.length - refactoredCode.length),
      },
    };
  }

  /**
   * Refactor multiple files
   */
  refactorBatch(files: Map<string, string>): Map<string, RefactorResult> {
    const results = new Map<string, RefactorResult>();
    
    for (const [path, content] of files) {
      // Only refactor code files
      const ext = path.split('.').pop()?.toLowerCase();
      const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];
      
      if (ext && codeExtensions.includes(ext)) {
        results.set(path, this.refactor(content, path));
      }
    }
    
    return results;
  }

  /**
   * Generate a diff report
   */
  generateDiff(result: RefactorResult): string {
    const lines: string[] = [];
    
    if (!result.hasChanges) {
      return '// No changes needed';
    }
    
    lines.push('// ═══════════════════════════════════════════════════════════════');
    lines.push('// REFACTOR REPORT');
    lines.push('// ═══════════════════════════════════════════════════════════════');
    lines.push(`// Patterns applied: ${result.stats.appliedPatterns}`);
    lines.push(`// Changes: ${result.changes.length}`);
    lines.push(`// Lines changed: ${result.stats.linesChanged}`);
    lines.push(`// Bytes changed: ${result.stats.bytesChanged}`);
    lines.push('// ───────────────────────────────────────────────────────────────');
    lines.push('');
    
    // Group changes by severity
    const critical = result.changes.filter(c => c.severity === 'critical');
    const major = result.changes.filter(c => c.severity === 'major');
    const minor = result.changes.filter(c => c.severity === 'minor');
    
    if (critical.length > 0) {
      lines.push('// 🔴 CRITICAL CHANGES');
      for (const change of critical) {
        lines.push(`//   L${change.line}: ${change.pattern}`);
        lines.push(`//     - ${change.original}`);
        lines.push(`//     + ${change.replacement}`);
      }
      lines.push('');
    }
    
    if (major.length > 0) {
      lines.push('// 🟡 MAJOR CHANGES');
      for (const change of major) {
        lines.push(`//   L${change.line}: ${change.pattern}`);
        lines.push(`//     - ${change.original}`);
        lines.push(`//     + ${change.replacement}`);
      }
      lines.push('');
    }
    
    if (minor.length > 0) {
      lines.push('// 🔵 MINOR CHANGES');
      for (const change of minor.slice(0, 10)) {
        lines.push(`//   L${change.line}: ${change.pattern}`);
      }
      if (minor.length > 10) {
        lines.push(`//   ... and ${minor.length - 10} more`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Add a custom pattern
   */
  addPattern(pattern: RefactorPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove a pattern by name
   */
  removePattern(name: string): void {
    this.patterns = this.patterns.filter(p => p.name !== name);
  }

  /**
   * Get all patterns
   */
  getPatterns(): RefactorPattern[] {
    return [...this.patterns];
  }
}

// ═══════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Quick refactor a single file
 */
export function refactorCode(code: string, filename?: string): RefactorResult {
  const refactor = new ASTRefactor();
  return refactor.refactor(code, filename);
}

/**
 * Check if code needs refactoring
 */
export function needsRefactoring(code: string): boolean {
  for (const pattern of REFACTOR_PATTERNS) {
    const regex = typeof pattern.find === 'string'
      ? new RegExp(pattern.find, 'g')
      : pattern.find;
    
    regex.lastIndex = 0;
    if (regex.test(code)) {
      return true;
    }
  }
  return false;
}

/**
 * Count issues in code
 */
export function countIssues(code: string): { critical: number; major: number; minor: number; total: number } {
  const counts = { critical: 0, major: 0, minor: 0, total: 0 };
  
  for (const pattern of REFACTOR_PATTERNS) {
    const regex = typeof pattern.find === 'string'
      ? new RegExp(pattern.find, 'g')
      : pattern.find;
    
    regex.lastIndex = 0;
    const matches = code.match(regex);
    if (matches) {
      counts[pattern.severity] += matches.length;
      counts.total += matches.length;
    }
  }
  
  return counts;
}

/**
 * Generate polyfills for removed patterns
 */
export function generatePolyfills(): string {
  return `/**
 * Sovereign Polyfills
 * Replacements for proprietary Lovable patterns
 * Generated by InoPay Liberator
 */

import { z } from 'zod';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════
// SOVEREIGN AI ADAPTER
// ═══════════════════════════════════════════════════════════════

export const sovereignAIAdapter = {
  async generateCompletion(prompt: string, options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}) {
    const AI_URL = import.meta.env.VITE_AI_URL || 'http://localhost:11434';
    const model = options.model || 'llama3.2';
    
    const response = await fetch(\`\${AI_URL}/api/generate\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 2048,
        },
      }),
    });
    
    const data = await response.json();
    return { text: data.response, usage: { tokens: data.eval_count } };
  },

  async createAssistant(config: { name: string; instructions: string }) {
    return { id: crypto.randomUUID(), ...config };
  },

  async run(assistantId: string, input: string) {
    return this.generateCompletion(input);
  },
};

// ═══════════════════════════════════════════════════════════════
// PATTERN REPLACEMENTS
// ═══════════════════════════════════════════════════════════════

export function createTemplateEngine() {
  return {
    render: (template: string, data: Record<string, any>) => {
      return template.replace(/\\{\\{(\\w+)\\}\\}/g, (_, key) => data[key] || '');
    },
    compile: (template: string) => (data: Record<string, any>) => {
      return template.replace(/\\{\\{(\\w+)\\}\\}/g, (_, key) => data[key] || '');
    },
  };
}

export function createStateManager<T>(initial: T) {
  let state = initial;
  const listeners = new Set<(state: T) => void>();
  
  return {
    get: () => state,
    set: (newState: T) => {
      state = newState;
      listeners.forEach(fn => fn(state));
    },
    subscribe: (fn: (state: T) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export function createRouter() {
  return {
    navigate: (path: string) => window.location.href = path,
    back: () => window.history.back(),
    forward: () => window.history.forward(),
  };
}

export function createFormHandler() {
  return {
    handleSubmit: (fn: (data: any) => void) => (e: Event) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const data = Object.fromEntries(new FormData(form));
      fn(data);
    },
  };
}

export function createModalManager() {
  let isOpen = false;
  const listeners = new Set<(open: boolean) => void>();
  
  return {
    open: () => { isOpen = true; listeners.forEach(fn => fn(true)); },
    close: () => { isOpen = false; listeners.forEach(fn => fn(false)); },
    toggle: () => { isOpen = !isOpen; listeners.forEach(fn => fn(isOpen)); },
    isOpen: () => isOpen,
    onOpenChange: (fn: (open: boolean) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// Re-export common utilities
export { z, toast };

// Default API object
export const api = {
  get: async (url: string) => fetch(url).then(r => r.json()),
  post: async (url: string, data: any) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json()),
};
`;
}

export default ASTRefactor;
