/**
 * Pack Validator - TypeScript validation for Liberation Packs
 * Validates syntax, imports, and structure before pack generation
 * 
 * @version 1.0
 */

export interface ValidationError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

export interface PackValidationResult {
  isValid: boolean;
  score: number; // 0-100
  criticalErrors: ValidationError[];
  warnings: ValidationError[];
  suggestions: string[];
  missingPolyfills: string[];
  unresolvedImports: { file: string; importPath: string }[];
  stats: {
    totalFiles: number;
    validFiles: number;
    filesWithErrors: number;
    filesWithWarnings: number;
  };
}

// Polyfills that should exist in the pack
const REQUIRED_POLYFILLS: Record<string, string> = {
  '@/lib/supabase': 'src/lib/supabase.ts',
  '@/types/database': 'src/types/database.ts',
  '@/hooks/use-mobile': 'src/hooks/use-mobile.ts',
  '@/hooks/use-toast': 'src/hooks/use-toast.ts',
};

// Known external packages that don't need local resolution
const EXTERNAL_PACKAGES = [
  'react', 'react-dom', 'react-router-dom',
  '@supabase/supabase-js', 'sonner', 'lucide-react',
  'framer-motion', 'date-fns', 'zod', 'clsx', 'tailwind-merge',
  '@radix-ui/', '@tanstack/', 'class-variance-authority',
  'recharts', 'jszip', 'react-dropzone', 'react-hook-form',
  '@hookform/resolvers', 'next-themes', 'cmdk', 'embla-carousel-react',
  'vaul', 'input-otp', 'react-day-picker', 'qrcode.react',
  'meilisearch', 'pocketbase', 'pusher-js', 'aws-sdk',
  'canvas-confetti', 'html2pdf.js', 'react-diff-viewer-continued',
  'react-resizable-panels', 'react-hot-toast', 'i18next', 
  'react-i18next', 'i18next-browser-languagedetector',
];

/**
 * Check bracket balance in content
 */
export function validateBracketBalance(content: string, filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const stack: { char: string; line: number; col: number }[] = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const closers: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inMultilineComment = false;
  let line = 1;
  let col = 1;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    const prevChar = content[i - 1];
    
    // Track line/column
    if (char === '\n') {
      line++;
      col = 1;
      inComment = false;
      continue;
    }
    col++;
    
    // Handle comments
    if (!inString && !inMultilineComment && char === '/' && nextChar === '/') {
      inComment = true;
      continue;
    }
    if (!inString && !inComment && char === '/' && nextChar === '*') {
      inMultilineComment = true;
      continue;
    }
    if (inMultilineComment && char === '*' && nextChar === '/') {
      inMultilineComment = false;
      i++;
      continue;
    }
    if (inComment || inMultilineComment) continue;
    
    // Handle strings
    if (!inString && (char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      inString = true;
      stringChar = char;
      continue;
    }
    if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
      stringChar = '';
      continue;
    }
    if (inString) continue;
    
    // Check brackets
    if (pairs[char]) {
      stack.push({ char, line, col });
    } else if (closers[char]) {
      const last = stack.pop();
      if (!last || last.char !== closers[char]) {
        errors.push({
          file: filePath,
          line,
          column: col,
          message: last 
            ? `Mismatched bracket: expected '${pairs[last.char]}' but found '${char}'`
            : `Unexpected closing bracket '${char}'`,
          severity: 'error',
          code: 'BRACKET_MISMATCH'
        });
      }
    }
  }
  
  // Report unclosed brackets
  for (const unclosed of stack) {
    errors.push({
      file: filePath,
      line: unclosed.line,
      column: unclosed.col,
      message: `Unclosed bracket '${unclosed.char}'`,
      severity: 'error',
      code: 'UNCLOSED_BRACKET'
    });
  }
  
  return errors;
}

/**
 * Validate imports can be resolved
 */
export function validateImports(
  content: string, 
  filePath: string, 
  allFiles: Record<string, string>
): { errors: ValidationError[]; unresolvedImports: { file: string; importPath: string }[] } {
  const errors: ValidationError[] = [];
  const unresolvedImports: { file: string; importPath: string }[] = [];
  
  // Match import statements
  const importRegex = /import\s+(?:(?:type\s+)?{[^}]*}|[^'"{}]+)\s+from\s+['"]([^'"]+)['"]/g;
  const lines = content.split('\n');
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    
    // Skip external packages
    if (EXTERNAL_PACKAGES.some(pkg => importPath.startsWith(pkg))) continue;
    if (!importPath.startsWith('.') && !importPath.startsWith('@/')) continue;
    
    // Calculate line number
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
    
    // Check if import can be resolved
    let resolved = false;
    
    if (importPath.startsWith('@/')) {
      // Check polyfill paths
      const polyfillPath = REQUIRED_POLYFILLS[importPath];
      if (polyfillPath && allFiles[polyfillPath]) {
        resolved = true;
      } else {
        // Convert @/ to src/
        const srcPath = importPath.replace('@/', 'src/');
        const possiblePaths = [
          srcPath + '.ts',
          srcPath + '.tsx',
          srcPath + '/index.ts',
          srcPath + '/index.tsx',
          srcPath,
        ];
        
        resolved = possiblePaths.some(p => allFiles[p] !== undefined);
      }
    } else {
      // Relative import
      const currentDir = filePath.split('/').slice(0, -1).join('/');
      const resolvedPath = resolveRelativePath(currentDir, importPath);
      
      const possiblePaths = [
        resolvedPath + '.ts',
        resolvedPath + '.tsx',
        resolvedPath + '/index.ts',
        resolvedPath + '/index.tsx',
        resolvedPath,
      ];
      
      resolved = possiblePaths.some(p => allFiles[p] !== undefined);
    }
    
    if (!resolved) {
      unresolvedImports.push({ file: filePath, importPath });
      errors.push({
        file: filePath,
        line: lineNumber,
        column: 1,
        message: `Cannot resolve import '${importPath}'`,
        severity: 'warning',
        code: 'UNRESOLVED_IMPORT'
      });
    }
  }
  
  return { errors, unresolvedImports };
}

/**
 * Resolve relative path
 */
function resolveRelativePath(currentDir: string, relativePath: string): string {
  const parts = currentDir.split('/').filter(Boolean);
  const relParts = relativePath.split('/');
  
  for (const part of relParts) {
    if (part === '..') {
      parts.pop();
    } else if (part !== '.') {
      parts.push(part);
    }
  }
  
  return parts.join('/');
}

/**
 * Validate TypeScript syntax patterns
 */
export function validateTypeScriptSyntax(content: string, filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split('\n');
  
  // Pattern checks for common errors
  const errorPatterns = [
    {
      pattern: /type\s+\$\d+\s*=/,
      message: 'Invalid type declaration with placeholder ($1, $2, etc.)',
      code: 'INVALID_TYPE_PLACEHOLDER'
    },
    {
      pattern: /from\s+['"]@\/integrations\/supabase/,
      message: 'Proprietary import path not cleaned: @/integrations/supabase',
      code: 'PROPRIETARY_IMPORT'
    },
    {
      pattern: /import\s+{\s*}\s+from/,
      message: 'Empty import statement',
      code: 'EMPTY_IMPORT'
    },
    {
      pattern: /const\s+(?:supabase|createClient)\s*=.*createClient\s*\([^)]*\)\s*;?\s*const\s+(?:supabase|createClient)/,
      message: 'Duplicate Supabase client declaration',
      code: 'DUPLICATE_DECLARATION'
    },
    {
      pattern: /\/\/\s*Types Supabase - remplacer/,
      message: 'Placeholder comment instead of actual type replacement',
      code: 'PLACEHOLDER_COMMENT'
    },
  ];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (const { pattern, message, code } of errorPatterns) {
      if (pattern.test(line)) {
        errors.push({
          file: filePath,
          line: i + 1,
          column: 1,
          message,
          severity: 'error',
          code
        });
      }
    }
  }
  
  return errors;
}

/**
 * Check for missing polyfills based on imports
 */
export function detectMissingPolyfills(
  files: Record<string, string>
): string[] {
  const missing: string[] = [];
  const neededPolyfills = new Set<string>();
  
  // Scan all files for imports that need polyfills
  for (const [path, content] of Object.entries(files)) {
    if (!path.match(/\.(ts|tsx|js|jsx)$/)) continue;
    
    // Check for Supabase usage
    if (/import.*from\s+['"]@\/lib\/supabase['"]/.test(content) ||
        /supabase\./.test(content)) {
      neededPolyfills.add('@/lib/supabase');
    }
    
    // Check for type imports
    if (/import.*type.*from\s+['"]@\/types\/database['"]/.test(content) ||
        /Database|Tables|TablesInsert|TablesUpdate/.test(content)) {
      neededPolyfills.add('@/types/database');
    }
    
    // Check for useIsMobile
    if (/useIsMobile/.test(content)) {
      neededPolyfills.add('@/hooks/use-mobile');
    }
    
    // Check for toast usage
    if (/import.*from\s+['"]@\/hooks\/use-toast['"]/.test(content)) {
      neededPolyfills.add('@/hooks/use-toast');
    }
  }
  
  // Check if polyfills exist
  for (const polyfill of neededPolyfills) {
    const polyfillPath = REQUIRED_POLYFILLS[polyfill];
    if (polyfillPath && !files[polyfillPath]) {
      missing.push(polyfill);
    }
  }
  
  return missing;
}

/**
 * Main validation function
 */
export function validatePack(files: Record<string, string>): PackValidationResult {
  const criticalErrors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const suggestions: string[] = [];
  const allUnresolvedImports: { file: string; importPath: string }[] = [];
  
  let validFiles = 0;
  let filesWithErrors = 0;
  let filesWithWarnings = 0;
  
  const sourceFiles = Object.entries(files).filter(([path]) => 
    path.match(/\.(ts|tsx|js|jsx)$/) &&
    !path.includes('node_modules') &&
    !path.includes('.d.ts')
  );
  
  for (const [path, content] of sourceFiles) {
    let hasErrors = false;
    let hasWarnings = false;
    
    // 1. Bracket balance
    const bracketErrors = validateBracketBalance(content, path);
    for (const error of bracketErrors) {
      criticalErrors.push(error);
      hasErrors = true;
    }
    
    // 2. TypeScript syntax
    const syntaxErrors = validateTypeScriptSyntax(content, path);
    for (const error of syntaxErrors) {
      criticalErrors.push(error);
      hasErrors = true;
    }
    
    // 3. Import resolution
    const { errors: importErrors, unresolvedImports } = validateImports(content, path, files);
    for (const error of importErrors) {
      warnings.push(error);
      hasWarnings = true;
    }
    allUnresolvedImports.push(...unresolvedImports);
    
    if (hasErrors) {
      filesWithErrors++;
    } else if (hasWarnings) {
      filesWithWarnings++;
    } else {
      validFiles++;
    }
  }
  
  // Check for missing polyfills
  const missingPolyfills = detectMissingPolyfills(files);
  if (missingPolyfills.length > 0) {
    suggestions.push(`Missing polyfills: ${missingPolyfills.join(', ')}`);
  }
  
  // Calculate score
  let score = 100;
  score -= criticalErrors.length * 10;
  score -= warnings.length * 2;
  score -= missingPolyfills.length * 5;
  score = Math.max(0, Math.min(100, score));
  
  // Add suggestions
  if (criticalErrors.length > 0) {
    suggestions.push('Fix critical errors before generating the pack');
  }
  if (allUnresolvedImports.length > 5) {
    suggestions.push('Many unresolved imports detected - ensure all dependencies are included');
  }
  
  return {
    isValid: criticalErrors.length === 0,
    score,
    criticalErrors,
    warnings,
    suggestions,
    missingPolyfills,
    unresolvedImports: allUnresolvedImports,
    stats: {
      totalFiles: sourceFiles.length,
      validFiles,
      filesWithErrors,
      filesWithWarnings,
    }
  };
}

/**
 * Get validation summary as string
 */
export function getValidationSummary(result: PackValidationResult): string {
  const lines: string[] = [];
  
  lines.push(`📊 Validation Score: ${result.score}%`);
  lines.push(`📁 Files: ${result.stats.validFiles}/${result.stats.totalFiles} valid`);
  
  if (result.criticalErrors.length > 0) {
    lines.push(`\n❌ Critical Errors (${result.criticalErrors.length}):`);
    for (const error of result.criticalErrors.slice(0, 10)) {
      lines.push(`  ${error.file}:${error.line} - ${error.message}`);
    }
    if (result.criticalErrors.length > 10) {
      lines.push(`  ... and ${result.criticalErrors.length - 10} more`);
    }
  }
  
  if (result.warnings.length > 0) {
    lines.push(`\n⚠️ Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings.slice(0, 5)) {
      lines.push(`  ${warning.file}:${warning.line} - ${warning.message}`);
    }
    if (result.warnings.length > 5) {
      lines.push(`  ... and ${result.warnings.length - 5} more`);
    }
  }
  
  if (result.missingPolyfills.length > 0) {
    lines.push(`\n📦 Missing Polyfills: ${result.missingPolyfills.join(', ')}`);
  }
  
  if (result.suggestions.length > 0) {
    lines.push(`\n💡 Suggestions:`);
    for (const suggestion of result.suggestions) {
      lines.push(`  • ${suggestion}`);
    }
  }
  
  return lines.join('\n');
}
