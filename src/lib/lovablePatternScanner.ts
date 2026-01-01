/**
 * Lovable Pattern Scanner - AST-based detection module
 * Detects proprietary patterns in Lovable projects
 * 
 * Patterns detected:
 * - lovable.generate
 * - lovableApi
 * - getAIAssistant, runAssistant, @agent/*
 * - EventSchema
 * - Pattern.*
 * - All Lovable dependencies
 */

// ============= TYPES =============

export type IssueSeverity = 'critical' | 'major' | 'minor';

export interface ScanIssue {
  id: string;
  file: string;
  line: number;
  column: number;
  pattern: string;
  matchedText: string;
  severity: IssueSeverity;
  category: string;
  suggestion: string;
  autoFixable: boolean;
}

export interface ScanResult {
  totalFiles: number;
  filesScanned: number;
  filesWithIssues: number;
  issues: ScanIssue[];
  summary: {
    critical: number;
    major: number;
    minor: number;
  };
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

// ============= PATTERN DEFINITIONS =============

interface PatternDefinition {
  id: string;
  pattern: RegExp;
  severity: IssueSeverity;
  category: string;
  description: string;
  suggestion: string;
  autoFixable: boolean;
}

const LOVABLE_PATTERNS: PatternDefinition[] = [
  // === CRITICAL: Core Lovable APIs ===
  {
    id: 'lovable-generate',
    pattern: /lovable\.generate\s*\(/g,
    severity: 'critical',
    category: 'Lovable API',
    description: 'Lovable AI generation call',
    suggestion: 'Replace with UnifiedLLM.complete() from src/lib/unifiedLLM.ts',
    autoFixable: true
  },
  {
    id: 'lovable-api',
    pattern: /lovableApi\s*[\.\(]/g,
    severity: 'critical',
    category: 'Lovable API',
    description: 'Lovable API usage',
    suggestion: 'Replace with sovereign API adapter',
    autoFixable: true
  },
  {
    id: 'get-ai-assistant',
    pattern: /getAIAssistant\s*\(/g,
    severity: 'critical',
    category: 'AI Assistant',
    description: 'Lovable AI Assistant initialization',
    suggestion: 'Replace with UnifiedLLM instance',
    autoFixable: true
  },
  {
    id: 'run-assistant',
    pattern: /runAssistant\s*\(/g,
    severity: 'critical',
    category: 'AI Assistant',
    description: 'Lovable Assistant execution',
    suggestion: 'Replace with UnifiedLLM.chat() method',
    autoFixable: true
  },
  
  // === CRITICAL: Agent imports ===
  {
    id: 'agent-import',
    pattern: /from\s+['"]@agent\/[^'"]+['"]/g,
    severity: 'critical',
    category: 'Agent Import',
    description: 'Lovable Agent module import',
    suggestion: 'Remove agent import and implement with local logic',
    autoFixable: false
  },
  {
    id: 'agent-require',
    pattern: /require\s*\(\s*['"]@agent\/[^'"]+['"]\s*\)/g,
    severity: 'critical',
    category: 'Agent Import',
    description: 'Lovable Agent require statement',
    suggestion: 'Remove agent require and implement with local logic',
    autoFixable: false
  },
  
  // === MAJOR: Event & Pattern schemas ===
  {
    id: 'event-schema',
    pattern: /EventSchema\s*[\.\[]/g,
    severity: 'major',
    category: 'Schema',
    description: 'Lovable EventSchema usage',
    suggestion: 'Replace with custom Zod schema or TypeScript interface',
    autoFixable: true
  },
  {
    id: 'pattern-usage',
    pattern: /Pattern\.\w+/g,
    severity: 'major',
    category: 'Pattern',
    description: 'Lovable Pattern.* usage',
    suggestion: 'Replace with custom regex patterns from clientProprietaryPatterns.ts',
    autoFixable: true
  },
  
  // === MAJOR: Lovable imports ===
  {
    id: 'lovable-import',
    pattern: /from\s+['"]@lovable\/[^'"]+['"]/g,
    severity: 'major',
    category: 'Import',
    description: 'Lovable package import',
    suggestion: 'Remove or replace with open-source alternative',
    autoFixable: true
  },
  {
    id: 'lovable-tagger',
    pattern: /import\s*{\s*componentTagger\s*}\s*from\s*['"]lovable-tagger['"]/g,
    severity: 'major',
    category: 'Import',
    description: 'Lovable tagger import (debug tool)',
    suggestion: 'Remove import - not needed in production',
    autoFixable: true
  },
  {
    id: 'gptengineer-import',
    pattern: /from\s+['"]@gptengineer\/[^'"]+['"]/g,
    severity: 'major',
    category: 'Import',
    description: 'GPT Engineer package import',
    suggestion: 'Remove or replace with open-source alternative',
    autoFixable: true
  },
  
  // === MAJOR: Supabase integrations (auto-generated) ===
  {
    id: 'supabase-integration-import',
    pattern: /from\s+['"]@\/integrations\/supabase\/[^'"]+['"]/g,
    severity: 'major',
    category: 'Supabase',
    description: 'Auto-generated Supabase integration import',
    suggestion: 'Replace with direct @supabase/supabase-js import',
    autoFixable: true
  },
  {
    id: 'supabase-relative-import',
    pattern: /from\s+['"]\.+\/integrations\/supabase\/[^'"]+['"]/g,
    severity: 'major',
    category: 'Supabase',
    description: 'Relative Supabase integration import',
    suggestion: 'Replace with direct @supabase/supabase-js import',
    autoFixable: true
  },
  
  // === MINOR: Comments and markers ===
  {
    id: 'lovable-comment',
    pattern: /\/\/\s*@lovable[^\n]*/g,
    severity: 'minor',
    category: 'Comment',
    description: 'Lovable annotation comment',
    suggestion: 'Remove comment',
    autoFixable: true
  },
  {
    id: 'generated-by-lovable',
    pattern: /\/\/\s*Generated by Lovable[^\n]*/gi,
    severity: 'minor',
    category: 'Comment',
    description: 'Lovable generation comment',
    suggestion: 'Remove comment',
    autoFixable: true
  },
  {
    id: 'gptengineer-comment',
    pattern: /\/\/\s*@gptengineer[^\n]*/g,
    severity: 'minor',
    category: 'Comment',
    description: 'GPT Engineer annotation comment',
    suggestion: 'Remove comment',
    autoFixable: true
  },
  
  // === MINOR: Data attributes ===
  {
    id: 'data-lovable-attr',
    pattern: /data-lov-[a-z-]+="[^"]*"/g,
    severity: 'minor',
    category: 'Attribute',
    description: 'Lovable data attribute',
    suggestion: 'Remove data attribute',
    autoFixable: true
  },
  {
    id: 'data-lovable-id',
    pattern: /data-lovable-id="[^"]*"/g,
    severity: 'minor',
    category: 'Attribute',
    description: 'Lovable ID attribute',
    suggestion: 'Remove data attribute',
    autoFixable: true
  },
  
  // === MINOR: Telemetry ===
  {
    id: 'lovable-telemetry-fetch',
    pattern: /fetch\s*\(\s*['"][^'"]*lovable[^'"]*['"]/gi,
    severity: 'major',
    category: 'Telemetry',
    description: 'Lovable telemetry fetch call',
    suggestion: 'Remove telemetry call',
    autoFixable: true
  },
  {
    id: 'lovable-beacon',
    pattern: /navigator\.sendBeacon\s*\([^)]*lovable[^)]*\)/gi,
    severity: 'major',
    category: 'Telemetry',
    description: 'Lovable telemetry beacon',
    suggestion: 'Remove beacon call',
    autoFixable: true
  },
  
  // === CRITICAL: Environment variables ===
  {
    id: 'lovable-env-var',
    pattern: /VITE_LOVABLE_[A-Z_]+/g,
    severity: 'major',
    category: 'Environment',
    description: 'Lovable environment variable',
    suggestion: 'Replace with generic environment variable',
    autoFixable: true
  },
  
  // === CRITICAL: WebSocket connections ===
  {
    id: 'lovable-websocket',
    pattern: /new\s+WebSocket\s*\([^)]*lovable[^)]*\)/gi,
    severity: 'critical',
    category: 'WebSocket',
    description: 'Lovable WebSocket connection',
    suggestion: 'Remove or replace with self-hosted WebSocket server',
    autoFixable: false
  },
  
  // === CRITICAL: Service workers ===
  {
    id: 'lovable-service-worker',
    pattern: /navigator\.serviceWorker\.register\s*\([^)]*lovable[^)]*\)/gi,
    severity: 'critical',
    category: 'Service Worker',
    description: 'Lovable service worker registration',
    suggestion: 'Replace with custom service worker',
    autoFixable: false
  }
];

// ============= DEPENDENCY PATTERNS =============

const LOVABLE_DEPENDENCIES: string[] = [
  'lovable-tagger',
  '@lovable/core',
  '@lovable/ui',
  '@lovable/runtime',
  '@lovable/sdk',
  '@gptengineer/core',
  '@gptengineer/ui',
  'lovable-core',
  'gpt-engineer',
  'gptengineer-core'
];

// ============= SCANNER CLASS =============

export class LovablePatternScanner {
  private patterns: PatternDefinition[];
  private dependencies: string[];
  
  constructor() {
    this.patterns = LOVABLE_PATTERNS;
    this.dependencies = LOVABLE_DEPENDENCIES;
  }
  
  /**
   * Scan a single file for Lovable patterns
   */
  scanFile(filePath: string, content: string): ScanIssue[] {
    const issues: ScanIssue[] = [];
    const lines = content.split('\n');
    
    for (const patternDef of this.patterns) {
      // Reset regex lastIndex for each file
      patternDef.pattern.lastIndex = 0;
      
      let match: RegExpExecArray | null;
      while ((match = patternDef.pattern.exec(content)) !== null) {
        // Calculate line and column from match index
        const { line, column } = this.getLineAndColumn(content, match.index);
        
        issues.push({
          id: `${patternDef.id}-${filePath}-${line}`,
          file: filePath,
          line,
          column,
          pattern: patternDef.id,
          matchedText: match[0],
          severity: patternDef.severity,
          category: patternDef.category,
          suggestion: patternDef.suggestion,
          autoFixable: patternDef.autoFixable
        });
      }
    }
    
    return issues;
  }
  
  /**
   * Scan package.json for Lovable dependencies
   */
  scanPackageJson(content: string): ScanIssue[] {
    const issues: ScanIssue[] = [];
    
    try {
      const pkg = JSON.parse(content);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
        ...pkg.peerDependencies
      };
      
      for (const dep of this.dependencies) {
        if (allDeps[dep]) {
          issues.push({
            id: `dep-${dep}`,
            file: 'package.json',
            line: this.findLineInJson(content, dep),
            column: 1,
            pattern: 'lovable-dependency',
            matchedText: `"${dep}": "${allDeps[dep]}"`,
            severity: 'major',
            category: 'Dependency',
            suggestion: `Remove "${dep}" from dependencies`,
            autoFixable: true
          });
        }
      }
    } catch {
      // Invalid JSON, skip
    }
    
    return issues;
  }
  
  /**
   * Scan all files in a project
   */
  scanProject(files: Record<string, string>): ScanResult {
    const allIssues: ScanIssue[] = [];
    const filesWithIssues = new Set<string>();
    let filesScanned = 0;
    
    for (const [filePath, content] of Object.entries(files)) {
      // Skip binary files and node_modules
      if (this.shouldSkipFile(filePath)) continue;
      
      filesScanned++;
      
      let issues: ScanIssue[] = [];
      
      if (filePath === 'package.json' || filePath.endsWith('/package.json')) {
        issues = this.scanPackageJson(content);
      } else if (this.isCodeFile(filePath)) {
        issues = this.scanFile(filePath, content);
      }
      
      if (issues.length > 0) {
        filesWithIssues.add(filePath);
        allIssues.push(...issues);
      }
    }
    
    // Calculate summary
    const summary = {
      critical: allIssues.filter(i => i.severity === 'critical').length,
      major: allIssues.filter(i => i.severity === 'major').length,
      minor: allIssues.filter(i => i.severity === 'minor').length
    };
    
    // Calculate score (100 - penalties)
    const score = Math.max(0, 100 - (summary.critical * 15) - (summary.major * 5) - (summary.minor * 1));
    
    // Calculate grade
    const grade = this.calculateGrade(score);
    
    return {
      totalFiles: Object.keys(files).length,
      filesScanned,
      filesWithIssues: filesWithIssues.size,
      issues: allIssues,
      summary,
      score,
      grade
    };
  }
  
  /**
   * Get patterns for external use
   */
  getPatterns(): PatternDefinition[] {
    return [...this.patterns];
  }
  
  /**
   * Add custom pattern
   */
  addPattern(pattern: PatternDefinition): void {
    this.patterns.push(pattern);
  }
  
  // ============= HELPER METHODS =============
  
  private getLineAndColumn(content: string, index: number): { line: number; column: number } {
    const lines = content.substring(0, index).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column };
  }
  
  private findLineInJson(content: string, key: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`"${key}"`)) {
        return i + 1;
      }
    }
    return 1;
  }
  
  private shouldSkipFile(filePath: string): boolean {
    const skipPatterns = [
      'node_modules/',
      '.git/',
      'dist/',
      'build/',
      '.next/',
      '.nuxt/',
      'coverage/',
      '.cache/',
      '*.min.js',
      '*.min.css',
      '*.map'
    ];
    
    return skipPatterns.some(pattern => {
      if (pattern.startsWith('*')) {
        return filePath.endsWith(pattern.slice(1));
      }
      return filePath.includes(pattern);
    });
  }
  
  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
      '.vue', '.svelte', '.astro',
      '.json', '.yaml', '.yml', '.toml',
      '.html', '.htm', '.css', '.scss', '.less',
      '.md', '.mdx'
    ];
    
    return codeExtensions.some(ext => filePath.endsWith(ext));
  }
  
  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 95) return 'A';
    if (score >= 80) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }
}

// ============= UTILITY FUNCTIONS =============

/**
 * Quick scan function for simple use cases
 */
export function quickScan(files: Record<string, string>): ScanResult {
  const scanner = new LovablePatternScanner();
  return scanner.scanProject(files);
}

/**
 * Format issues as readable report
 */
export function formatReport(result: ScanResult): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════',
    '           INOPAY LOVABLE PATTERN SCANNER REPORT           ',
    '═══════════════════════════════════════════════════════════',
    '',
    `📊 Score: ${result.score}/100 (Grade: ${result.grade})`,
    '',
    `📁 Files scanned: ${result.filesScanned}/${result.totalFiles}`,
    `⚠️  Files with issues: ${result.filesWithIssues}`,
    '',
    '───────────────────────────────────────────────────────────',
    '                       SUMMARY                             ',
    '───────────────────────────────────────────────────────────',
    `🔴 Critical: ${result.summary.critical}`,
    `🟠 Major:    ${result.summary.major}`,
    `🟡 Minor:    ${result.summary.minor}`,
    ''
  ];
  
  if (result.issues.length > 0) {
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('                       ISSUES                              ');
    lines.push('───────────────────────────────────────────────────────────');
    lines.push('');
    
    // Group by severity
    const groupedIssues = {
      critical: result.issues.filter(i => i.severity === 'critical'),
      major: result.issues.filter(i => i.severity === 'major'),
      minor: result.issues.filter(i => i.severity === 'minor')
    };
    
    for (const [severity, issues] of Object.entries(groupedIssues)) {
      if (issues.length === 0) continue;
      
      const icon = severity === 'critical' ? '🔴' : severity === 'major' ? '🟠' : '🟡';
      lines.push(`${icon} ${severity.toUpperCase()} (${issues.length})`);
      lines.push('');
      
      for (const issue of issues) {
        lines.push(`  📄 ${issue.file}:${issue.line}:${issue.column}`);
        lines.push(`     Pattern: ${issue.pattern}`);
        lines.push(`     Match: "${issue.matchedText.substring(0, 50)}${issue.matchedText.length > 50 ? '...' : ''}"`);
        lines.push(`     💡 ${issue.suggestion}`);
        lines.push(`     ${issue.autoFixable ? '✅ Auto-fixable' : '⚠️ Manual fix required'}`);
        lines.push('');
      }
    }
  } else {
    lines.push('✅ No Lovable patterns detected! Project is sovereign.');
  }
  
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('              Report generated by Inopay Liberator          ');
  lines.push('═══════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}

/**
 * Export issues as JSON for programmatic use
 */
export function exportAsJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

// Default export
export default LovablePatternScanner;
