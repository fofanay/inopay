import { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Code,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  FileCode,
  ChevronRight,
  Bug,
  SkipForward,
  Wand2,
  Filter,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ValidationError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
  code?: string;
  category?: "frontend" | "backend" | "tooling" | "config";
}

interface AutoFixResult {
  fixedFiles: Record<string, string>;
  fixCount: number;
  totalReplacements: number;
  fixedPatterns: { pattern: string; count: number }[];
}

interface TypeScriptValidatorProps {
  files: Record<string, string>;
  onValidationComplete: (isValid: boolean, errors: ValidationError[]) => void;
  onContinueAnyway?: () => void;
  onAutoFix?: (fixedFiles: Record<string, string>) => void;
}

// Patterns for backend files (supabase functions, server)
const BACKEND_FILE_PATTERNS = [
  /^backend\//,
  /^supabase\/functions\//,
  /^server\//,
  /^api\//,
  /\.server\.(ts|js)$/,
];

// Patterns for tooling/non-bundled files (cli, scripts, docker, docs)
const TOOLING_FILE_PATTERNS = [
  /^cli\//,
  /^scripts\//,
  /^docker\//,
  /^docs\//,
  /^public\/sw\.js$/,
  /^public\/.*\.(js|ts)$/,
  /\.config\.(ts|js|mjs|cjs)$/,
  /vite\.config\./,
  /eslint\.config\./,
  /tsconfig.*\.json$/,
  /tailwind\.config\./,
  /postcss\.config\./,
];

// Only check patterns relevant to bundled frontend code
const SYNTAX_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  message: string;
  severity: "error" | "warning";
}> = [
  // Serious errors
  { pattern: /import\s+from\s+/g, message: "Import sans spécificateur", severity: "error" },
  { pattern: /<\/[A-Z][a-zA-Z]*>\s*<\/[A-Z][a-zA-Z]*>/g, message: "Fermetures JSX potentiellement incorrectes", severity: "warning" },
  
  // Warnings for cleanup
  { pattern: /import\s*{\s*}\s*from/g, message: "Import vide détecté", severity: "warning" },
  { pattern: /<>\s*<\/>/g, message: "Fragment JSX vide", severity: "warning" },
  { pattern: /console\.(log|debug|info)\s*\(/g, message: "console.log détecté (supprimer en production)", severity: "warning" },
  { pattern: /\$\{\s*\}/g, message: "Template literal vide", severity: "warning" },
  { pattern: /=>\s*{\s*}\s*[;,]/g, message: "Fonction fléchée vide", severity: "warning" },
  { pattern: /debugger\s*;?/g, message: "debugger détecté", severity: "warning" },
];

/**
 * Determine file category
 */
function getFileCategory(filePath: string): "frontend" | "backend" | "tooling" | "config" {
  if (BACKEND_FILE_PATTERNS.some(p => p.test(filePath))) return "backend";
  if (TOOLING_FILE_PATTERNS.some(p => p.test(filePath))) return "tooling";
  if (filePath.includes('.config.') || filePath.endsWith('.json')) return "config";
  return "frontend";
}

/**
 * Check if file should be validated (only src/ frontend files)
 */
function shouldValidate(filePath: string): boolean {
  const category = getFileCategory(filePath);
  // Only validate frontend files (typically src/)
  if (category !== "frontend") return false;
  // Must be in src/ or a critical root file
  return filePath.startsWith('src/') || 
         filePath === 'index.html' ||
         filePath === 'main.tsx' ||
         filePath === 'App.tsx';
}

/**
 * Auto-fix common issues - enhanced version
 */
function autoFixFiles(files: Record<string, string>): AutoFixResult {
  const fixedFiles: Record<string, string> = {};
  let totalReplacements = 0;
  const patternCounts: Record<string, number> = {};
  
  for (const [filePath, content] of Object.entries(files)) {
    // Skip non-JS/TS files
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      fixedFiles[filePath] = content;
      continue;
    }
    
    // Skip backend and tooling files
    const category = getFileCategory(filePath);
    if (category !== "frontend") {
      fixedFiles[filePath] = content;
      continue;
    }
    
    let fixed = content;
    
    // 1. Remove console.log/debug/info statements (multi-line aware)
    const consoleMatches = fixed.match(/console\.(log|debug|info)\s*\([^;]*\);?/g);
    if (consoleMatches) {
      for (const match of consoleMatches) {
        // Handle potential multi-line by finding balanced parentheses
        let depth = 0;
        let endIdx = 0;
        const startIdx = fixed.indexOf(match);
        if (startIdx === -1) continue;
        
        for (let i = startIdx; i < fixed.length; i++) {
          if (fixed[i] === '(') depth++;
          if (fixed[i] === ')') depth--;
          if (depth === 0 && fixed[i] === ')') {
            endIdx = i + 1;
            // Include trailing semicolon if present
            if (fixed[endIdx] === ';') endIdx++;
            break;
          }
        }
        
        if (endIdx > startIdx) {
          const toRemove = fixed.substring(startIdx, endIdx);
          // Only remove if it's on its own line or with semicolon
          if (/^\s*console\.(log|debug|info)\s*\(/.test(fixed.substring(Math.max(0, startIdx - 50), startIdx + toRemove.length))) {
            fixed = fixed.substring(0, startIdx) + fixed.substring(endIdx);
            patternCounts['console.log'] = (patternCounts['console.log'] || 0) + 1;
            totalReplacements++;
          }
        }
      }
    }
    
    // 2. Remove debugger statements
    const debuggerPattern = /\bdebugger\s*;?\n?/g;
    const debuggerMatches = fixed.match(debuggerPattern);
    if (debuggerMatches) {
      fixed = fixed.replace(debuggerPattern, '');
      patternCounts['debugger'] = (patternCounts['debugger'] || 0) + debuggerMatches.length;
      totalReplacements += debuggerMatches.length;
    }
    
    // 3. Remove empty imports: import {} from '...'
    const emptyImportPattern = /import\s*{\s*}\s*from\s*['"][^'"]+['"];?\n?/g;
    const emptyImportMatches = fixed.match(emptyImportPattern);
    if (emptyImportMatches) {
      fixed = fixed.replace(emptyImportPattern, '');
      patternCounts['imports vides'] = (patternCounts['imports vides'] || 0) + emptyImportMatches.length;
      totalReplacements += emptyImportMatches.length;
    }
    
    // 4. Remove empty JSX fragments: <></> -> remove from returns
    const emptyFragmentPattern = /<>\s*<\/>/g;
    const emptyFragmentMatches = fixed.match(emptyFragmentPattern);
    if (emptyFragmentMatches) {
      // In return statements, replace with null
      fixed = fixed.replace(/return\s*\(\s*<>\s*<\/>\s*\)/g, 'return null');
      fixed = fixed.replace(/return\s+<>\s*<\/>/g, 'return null');
      // Otherwise remove empty fragments
      fixed = fixed.replace(emptyFragmentPattern, '');
      patternCounts['fragments JSX vides'] = (patternCounts['fragments JSX vides'] || 0) + emptyFragmentMatches.length;
      totalReplacements += emptyFragmentMatches.length;
    }
    
    // 5. Remove empty template literals: ${}
    const emptyTemplateLiteralPattern = /\$\{\s*\}/g;
    const emptyTLMatches = fixed.match(emptyTemplateLiteralPattern);
    if (emptyTLMatches) {
      fixed = fixed.replace(emptyTemplateLiteralPattern, '');
      patternCounts['template literals vides'] = (patternCounts['template literals vides'] || 0) + emptyTLMatches.length;
      totalReplacements += emptyTLMatches.length;
    }
    
    // 6. Clean up multiple empty lines (more than 2)
    const beforeCleanup = fixed;
    fixed = fixed.replace(/\n{4,}/g, '\n\n\n');
    if (fixed !== beforeCleanup) {
      patternCounts['lignes vides multiples'] = (patternCounts['lignes vides multiples'] || 0) + 1;
    }
    
    fixedFiles[filePath] = fixed;
  }
  
  // Convert pattern counts to array sorted by count
  const fixedPatterns = Object.entries(patternCounts)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);
  
  return {
    fixedFiles,
    fixCount: Object.entries(fixedFiles).filter(([path, content]) => 
      files[path] !== content
    ).length,
    totalReplacements,
    fixedPatterns,
  };
}

// Check for balanced brackets
function checkBracketBalance(content: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const stack: Array<{ char: string; line: number; col: number }> = [];
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
  const lines = content.split('\n');
  
  let inString = false;
  let stringChar = '';
  let inMultilineComment = false;
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    
    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      const prevChar = col > 0 ? line[col - 1] : '';
      const nextChar = col < line.length - 1 ? line[col + 1] : '';
      
      // Handle comments
      if (!inString && !inMultilineComment && char === '/' && nextChar === '/') {
        break;
      }
      if (!inString && char === '/' && nextChar === '*') {
        inMultilineComment = true;
        col++;
        continue;
      }
      if (inMultilineComment && char === '*' && nextChar === '/') {
        inMultilineComment = false;
        col++;
        continue;
      }
      if (inMultilineComment) continue;
      
      // Handle strings
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
        continue;
      }
      if (inString) continue;
      
      // Check brackets
      if (pairs[char]) {
        stack.push({ char, line: lineNum + 1, col: col + 1 });
      } else if (Object.values(pairs).includes(char)) {
        const expected = Object.entries(pairs).find(([, v]) => v === char)?.[0];
        if (stack.length === 0) {
          errors.push({
            file: '',
            line: lineNum + 1,
            column: col + 1,
            message: `'${char}' sans '${expected}' correspondant`,
            severity: 'error',
            code: line.slice(Math.max(0, col - 20), col + 20).trim(),
          });
        } else {
          const last = stack.pop()!;
          if (pairs[last.char] !== char) {
            errors.push({
              file: '',
              line: lineNum + 1,
              column: col + 1,
              message: `Attendu '${pairs[last.char]}' mais trouvé '${char}'`,
              severity: 'error',
              code: line.slice(Math.max(0, col - 20), col + 20).trim(),
            });
          }
        }
      }
    }
  }
  
  // Report unclosed brackets (limit to 3)
  for (const unclosed of stack.slice(-3)) {
    errors.push({
      file: '',
      line: unclosed.line,
      column: unclosed.col,
      message: `'${unclosed.char}' non fermé`,
      severity: 'error',
    });
  }
  
  return errors;
}

// Check for missing/invalid imports (simplified for frontend)
function checkImports(content: string, filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for @/integrations imports (proprietary)
    if (/from\s+['"]@\/integrations\//.test(line) && 
        !line.includes('@/integrations/supabase/client') &&
        !line.includes('@/integrations/supabase/types')) {
      errors.push({
        file: filePath,
        line: i + 1,
        column: 1,
        message: `Import vers @/integrations détecté - vérifier si nettoyé`,
        severity: 'warning',
        code: line.trim(),
      });
    }
  }
  
  return errors;
}

/**
 * TypeScriptValidator - Real-time TypeScript validation with auto-revalidation
 */
export function TypeScriptValidator({ files, onValidationComplete, onContinueAnyway, onAutoFix }: TypeScriptValidatorProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [hasRun, setHasRun] = useState(false);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [pendingRevalidate, setPendingRevalidate] = useState(false);
  
  // Filter options
  const [hideToolingErrors, setHideToolingErrors] = useState(true);
  const [hideWarnings, setHideWarnings] = useState(false);
  const [acknowledgeRisks, setAcknowledgeRisks] = useState(false);

  // Run validation
  const runValidation = useCallback(async () => {
    setIsValidating(true);
    setValidationProgress(0);
    setErrors([]);

    const allErrors: ValidationError[] = [];
    
    // Only validate frontend files
    const frontendFiles = Object.entries(files).filter(([path]) => 
      /\.(ts|tsx|js|jsx)$/.test(path) && shouldValidate(path)
    );

    for (let i = 0; i < frontendFiles.length; i++) {
      const [filePath, content] = frontendFiles[i];
      
      setValidationProgress(((i + 1) / frontendFiles.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 5));

      const category = getFileCategory(filePath);

      // 1. Check bracket balance
      const bracketErrors = checkBracketBalance(content);
      bracketErrors.forEach(err => {
        err.file = filePath;
        err.category = category;
        allErrors.push(err);
      });

      // 2. Check syntax patterns
      const lines = content.split('\n');
      for (const { pattern, message, severity } of SYNTAX_ERROR_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum];
          let match;
          while ((match = regex.exec(line)) !== null) {
            allErrors.push({
              file: filePath,
              line: lineNum + 1,
              column: match.index + 1,
              message,
              severity,
              category,
              code: line.trim().slice(0, 80),
            });
            if (!pattern.flags.includes('g')) break;
          }
        }
      }

      // 3. Check imports
      const importErrors = checkImports(content, filePath);
      importErrors.forEach(err => { err.category = category; });
      allErrors.push(...importErrors);
    }

    // Deduplicate
    const uniqueErrors = allErrors.filter((err, idx, arr) => 
      arr.findIndex(e => 
        e.file === err.file && e.line === err.line && e.message === err.message
      ) === idx
    );

    // Sort by severity
    uniqueErrors.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
      return a.file.localeCompare(b.file);
    });

    setErrors(uniqueErrors);
    setIsValidating(false);
    setHasRun(true);

    // Only frontend errors are blocking
    const frontendErrors = uniqueErrors.filter(e => 
      e.severity === 'error' && e.category === 'frontend'
    );
    const isValid = frontendErrors.length === 0;
    onValidationComplete(isValid, uniqueErrors);

  }, [files, onValidationComplete]);

  // Auto-revalidate after files change (when triggered by auto-fix)
  useEffect(() => {
    if (pendingRevalidate) {
      setPendingRevalidate(false);
      const timer = setTimeout(() => {
        runValidation();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [pendingRevalidate, runValidation]);

  // Filter displayed errors
  const displayedErrors = useMemo(() => {
    return errors.filter(err => {
      if (hideToolingErrors && (err.category === 'backend' || err.category === 'tooling')) return false;
      if (hideWarnings && err.severity === 'warning') return false;
      return true;
    });
  }, [errors, hideToolingErrors, hideWarnings]);

  // Group by file
  const errorsByFile = useMemo(() => {
    const grouped = new Map<string, ValidationError[]>();
    for (const error of displayedErrors) {
      const existing = grouped.get(error.file) || [];
      existing.push(error);
      grouped.set(error.file, existing);
    }
    return grouped;
  }, [displayedErrors]);

  // Top error messages (histogram)
  const topMessages = useMemo(() => {
    const frontendErrors = errors.filter(e => e.category === 'frontend');
    const counts: Record<string, number> = {};
    for (const err of frontendErrors) {
      counts[err.message] = (counts[err.message] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));
  }, [errors]);

  // Stats
  const stats = useMemo(() => {
    const frontendErrors = errors.filter(e => e.severity === 'error' && e.category === 'frontend');
    const toolingErrors = errors.filter(e => e.severity === 'error' && (e.category === 'backend' || e.category === 'tooling'));
    
    return {
      totalFiles: Object.keys(files).filter(p => /\.(ts|tsx|js|jsx)$/.test(p) && shouldValidate(p)).length,
      filesWithErrors: errorsByFile.size,
      frontendErrors: frontendErrors.length,
      toolingErrors: toolingErrors.length,
      totalErrors: errors.filter(e => e.severity === 'error').length,
      warnings: errors.filter(e => e.severity === 'warning').length,
    };
  }, [files, errors, errorsByFile]);

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  };

  const isFrontendValid = stats.frontendErrors === 0;
  const canContinue = isFrontendValid || acknowledgeRisks;

  const handleContinueAnyway = () => {
    if (onContinueAnyway) onContinueAnyway();
  };

  // Handle auto-fix with auto-revalidation
  const handleAutoFix = useCallback(async () => {
    setIsAutoFixing(true);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const result = autoFixFiles(files);
    
    if (result.totalReplacements > 0 && onAutoFix) {
      onAutoFix(result.fixedFiles);
      
      // Show detailed summary
      const patternSummary = result.fixedPatterns
        .slice(0, 3)
        .map(p => `${p.pattern} (${p.count})`)
        .join(', ');
      
      toast.success(
        `${result.fixCount} fichier${result.fixCount > 1 ? 's' : ''} corrigé${result.fixCount > 1 ? 's' : ''} (${result.totalReplacements} corrections)`,
        { description: patternSummary }
      );
      
      // Trigger revalidation
      setPendingRevalidate(true);
    } else {
      toast.info('Aucune correction automatique applicable', {
        description: 'Les erreurs restantes nécessitent une intervention manuelle.'
      });
    }
    
    setIsAutoFixing(false);
  }, [files, onAutoFix]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5 text-primary" />
              Validation TypeScript
            </CardTitle>
            <CardDescription>
              Validation du code frontend (src/) uniquement
            </CardDescription>
          </div>
          
          <Button
            onClick={runValidation}
            disabled={isValidating}
            variant={hasRun ? (isFrontendValid ? "outline" : "destructive") : "default"}
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : hasRun ? (
              isFrontendValid ? (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              ) : (
                <Bug className="h-4 w-4 mr-2" />
              )
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isValidating ? "Validation..." : hasRun ? "Revalider" : "Valider"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress */}
        {isValidating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Analyse du code frontend...</span>
              <span>{Math.round(validationProgress)}%</span>
            </div>
            <Progress value={validationProgress} />
          </div>
        )}

        {/* Stats */}
        {hasRun && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              <FileCode className="h-3 w-3 mr-1" />
              {stats.totalFiles} fichiers frontend
            </Badge>
            {stats.frontendErrors > 0 ? (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {stats.frontendErrors} erreur{stats.frontendErrors > 1 ? 's' : ''}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-success/10 text-success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Frontend OK
              </Badge>
            )}
            {stats.warnings > 0 && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {stats.warnings} avertissement{stats.warnings > 1 ? 's' : ''}
              </Badge>
            )}
            {stats.toolingErrors > 0 && hideToolingErrors && (
              <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                +{stats.toolingErrors} tooling (masqués)
              </Badge>
            )}
          </div>
        )}

        {/* Filters */}
        {hasRun && errors.length > 0 && (
          <div className="flex flex-wrap items-center gap-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtres :</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={hideToolingErrors}
                onCheckedChange={(checked) => setHideToolingErrors(checked === true)}
              />
              <span className="text-sm">Masquer backend/tooling</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={hideWarnings}
                onCheckedChange={(checked) => setHideWarnings(checked === true)}
              />
              <span className="text-sm">Masquer avertissements</span>
            </label>
          </div>
        )}

        {/* Top messages */}
        {hasRun && topMessages.length > 0 && stats.frontendErrors > 0 && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Erreurs les plus fréquentes :</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {topMessages.map(({ message, count }, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {message} ({count})
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {hasRun && (
          isFrontendValid ? (
            <Alert className="border-success/30 bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                <strong>Validation réussie !</strong> Aucune erreur bloquante dans le code frontend.
                {stats.warnings > 0 && ` (${stats.warnings} avertissements à vérifier)`}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{stats.frontendErrors} erreur{stats.frontendErrors > 1 ? 's' : ''} frontend</strong> — 
                Ces erreurs peuvent empêcher le build.
              </AlertDescription>
            </Alert>
          )
        )}

        {/* Actions when errors exist */}
        {hasRun && !isFrontendValid && (
          <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-muted/30">
            <div className="w-full mb-2">
              <p className="text-sm text-muted-foreground">
                Des erreurs ont été détectées. Vous pouvez :
              </p>
            </div>
            
            {/* Auto-fix button */}
            {onAutoFix && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleAutoFix}
                disabled={isAutoFixing}
              >
                {isAutoFixing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4 mr-2" />
                )}
                Correction automatique
              </Button>
            )}
            
            {/* Continue anyway */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <SkipForward className="h-4 w-4 mr-2" />
                  Continuer malgré les erreurs
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Continuer avec des erreurs ?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3">
                    <p>
                      Le code contient <strong>{stats.frontendErrors} erreur{stats.frontendErrors > 1 ? 's' : ''}</strong>.
                    </p>
                    <div className="p-3 bg-muted rounded text-xs">
                      <strong>Ce que l'auto-fix ne corrige pas :</strong>
                      <ul className="list-disc list-inside mt-1">
                        <li>Erreurs de syntaxe (accolades non fermées)</li>
                        <li>Imports introuvables</li>
                        <li>Types manquants</li>
                      </ul>
                    </div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <Checkbox 
                        checked={acknowledgeRisks}
                        onCheckedChange={(checked) => setAcknowledgeRisks(checked === true)}
                        className="mt-0.5"
                      />
                      <span className="text-sm">
                        Je comprends que le pack peut ne pas fonctionner.
                      </span>
                    </label>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    disabled={!acknowledgeRisks}
                    onClick={handleContinueAnyway}
                  >
                    Continuer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Error list */}
        {displayedErrors.length > 0 && (
          <ScrollArea className="h-[300px] border rounded-lg">
            <div className="divide-y">
              {Array.from(errorsByFile.entries()).map(([file, fileErrors]) => (
                <Collapsible
                  key={file}
                  open={expandedFiles.has(file)}
                  onOpenChange={() => toggleFile(file)}
                >
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 hover:bg-muted/50 text-left">
                    <ChevronRight className={`h-4 w-4 transition-transform ${
                      expandedFiles.has(file) ? 'rotate-90' : ''
                    }`} />
                    <FileCode className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 font-mono text-sm truncate">{file}</span>
                    <div className="flex gap-1">
                      {fileErrors.filter(e => e.severity === 'error').length > 0 && (
                        <Badge variant="destructive" className="h-5 text-xs">
                          {fileErrors.filter(e => e.severity === 'error').length}
                        </Badge>
                      )}
                      {fileErrors.filter(e => e.severity === 'warning').length > 0 && (
                        <Badge variant="outline" className="h-5 text-xs bg-yellow-500/10 text-yellow-600">
                          {fileErrors.filter(e => e.severity === 'warning').length}
                        </Badge>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="bg-muted/30 border-t">
                      {fileErrors.map((error, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`px-4 py-2 border-l-2 ${
                            error.severity === 'error'
                              ? 'border-l-destructive bg-destructive/5'
                              : 'border-l-yellow-500 bg-yellow-500/5'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {error.severity === 'error' ? (
                              <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{error.message}</div>
                              <div className="text-xs text-muted-foreground">
                                Ligne {error.line}, colonne {error.column}
                              </div>
                              {error.code && (
                                <code className="text-xs text-muted-foreground bg-muted px-1 py-0.5 rounded mt-1 block truncate">
                                  {error.code}
                                </code>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* All hidden by filters */}
        {hasRun && displayedErrors.length === 0 && errors.length > 0 && (
          <div className="p-4 text-center text-muted-foreground border rounded-lg">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Toutes les erreurs sont masquées par les filtres.</p>
            <button 
              onClick={() => { setHideToolingErrors(false); setHideWarnings(false); }}
              className="text-primary underline hover:no-underline mt-1"
            >
              Afficher tout
            </button>
          </div>
        )}

        {/* Initial state */}
        {!hasRun && !isValidating && (
          <div className="p-8 text-center text-muted-foreground border rounded-lg border-dashed">
            <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Cliquez sur "Valider" pour analyser le code</p>
            <p className="text-sm mt-1">Seuls les fichiers frontend (src/) sont validés</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
