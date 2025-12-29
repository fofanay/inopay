import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ValidationError {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
  code?: string;
}

interface TypeScriptValidatorProps {
  files: Record<string, string>;
  onValidationComplete: (isValid: boolean, errors: ValidationError[]) => void;
}

// Common syntax error patterns to detect
const SYNTAX_ERROR_PATTERNS: Array<{
  pattern: RegExp;
  message: string;
  severity: "error" | "warning";
}> = [
  // Unbalanced braces/brackets/parentheses
  { pattern: /^\s*}\s*}\s*$/m, message: "Accolade fermante orpheline", severity: "error" },
  { pattern: /{\s*{\s*$/m, message: "Accolades ouvrantes non fermées", severity: "error" },
  
  // Missing imports
  { pattern: /\bfrom\s+['"][^'"]*['"]\s*;?\s*$/m, message: "Import potentiellement incomplet", severity: "warning" },
  
  // Broken import statements
  { pattern: /import\s*{\s*}\s*from/g, message: "Import vide détecté", severity: "warning" },
  { pattern: /import\s+from\s+/g, message: "Import sans spécificateur", severity: "error" },
  
  // TypeScript type errors that will break build
  { pattern: /:\s*any\s*;\s*\/\/\s*Types?\s+Supabase/gi, message: "Type 'any' temporaire - à remplacer", severity: "warning" },
  
  // Invalid JSX
  { pattern: /<\s*>\s*<\s*\/\s*>/g, message: "Fragment JSX vide", severity: "warning" },
  { pattern: /<\/[A-Z][a-zA-Z]*>\s*<\/[A-Z][a-zA-Z]*>/g, message: "Fermetures JSX potentiellement incorrectes", severity: "warning" },
  
  // Missing semicolons in critical places
  { pattern: /export\s+(?:const|function|class)\s+\w+[^;{]*$/m, message: "Export potentiellement incomplet", severity: "warning" },
  
  // Console statements (for production)
  { pattern: /console\.(log|debug|info)\s*\(/g, message: "console.log détecté (supprimer en production)", severity: "warning" },
  
  // Undefined references that might break
  { pattern: /supabase\.\w+\([^)]*\)/g, message: "Appel Supabase - vérifier l'import", severity: "warning" },
  
  // Double declarations
  { pattern: /const\s+(\w+)\s*=[\s\S]*?const\s+\1\s*=/g, message: "Déclaration double potentielle", severity: "warning" },
  
  // Missing return in components
  { pattern: /function\s+[A-Z]\w*\s*\([^)]*\)\s*{\s*const\s+/g, message: "Composant sans return visible", severity: "warning" },
  
  // Invalid environment variable usage
  { pattern: /import\.meta\.env\.(?!VITE_)/g, message: "Variable env sans préfixe VITE_", severity: "error" },
  
  // Template literal errors
  { pattern: /\$\{\s*\}/g, message: "Template literal vide", severity: "warning" },
  
  // Arrow function errors
  { pattern: /=>\s*{\s*}\s*[;,]/g, message: "Fonction fléchée vide", severity: "warning" },
  
  // Async/await issues
  { pattern: /await\s+[^;]*(?<!;)\s*$/m, message: "await sans point-virgule", severity: "warning" },
];

// Check for balanced brackets
function checkBracketBalance(content: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const stack: Array<{ char: string; line: number; col: number }> = [];
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
  const lines = content.split('\n');
  
  // Skip string literals and comments for accurate bracket counting
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inMultilineComment = false;
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    
    for (let col = 0; col < line.length; col++) {
      const char = line[col];
      const prevChar = col > 0 ? line[col - 1] : '';
      const nextChar = col < line.length - 1 ? line[col + 1] : '';
      
      // Handle comments
      if (!inString && !inMultilineComment && char === '/' && nextChar === '/') {
        break; // Rest of line is comment
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
  
  // Report unclosed brackets
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

// Check for missing/invalid imports
function checkImports(content: string, filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split('\n');
  
  // Track what's imported
  const imports = new Set<string>();
  const usedIdentifiers = new Set<string>();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Parse imports
    const importMatch = line.match(/import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const namedImports = importMatch[1];
      const defaultImport = importMatch[2];
      const modulePath = importMatch[3];
      
      if (namedImports) {
        namedImports.split(',').forEach(name => {
          const cleaned = name.trim().split(/\s+as\s+/).pop()?.trim();
          if (cleaned) imports.add(cleaned);
        });
      }
      if (defaultImport) {
        imports.add(defaultImport);
      }
      
      // Check for invalid import paths
      if (modulePath.startsWith('@/integrations/')) {
        errors.push({
          file: filePath,
          line: i + 1,
          column: 1,
          message: `Import vers @/integrations détecté - doit être remplacé`,
          severity: 'error',
          code: line.trim(),
        });
      }
    }
    
    // Check for usage of common identifiers
    const identifierPattern = /\b(supabase|toast|useAuth|useQuery|useMutation)\b/g;
    let match;
    while ((match = identifierPattern.exec(line)) !== null) {
      usedIdentifiers.add(match[1]);
    }
  }
  
  // Check for used but not imported
  const criticalImports = ['supabase', 'toast'];
  for (const id of criticalImports) {
    if (usedIdentifiers.has(id) && !imports.has(id)) {
      // Check if it's defined inline
      if (!content.includes(`const ${id} =`) && !content.includes(`function ${id}`)) {
        errors.push({
          file: filePath,
          line: 1,
          column: 1,
          message: `'${id}' utilisé mais pas importé`,
          severity: 'error',
        });
      }
    }
  }
  
  return errors;
}

/**
 * TypeScriptValidator - Validation TypeScript en temps réel
 * Détecte les erreurs de syntaxe avant génération du pack
 */
export function TypeScriptValidator({ files, onValidationComplete }: TypeScriptValidatorProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [hasRun, setHasRun] = useState(false);

  // Run validation
  const runValidation = useCallback(async () => {
    setIsValidating(true);
    setValidationProgress(0);
    setErrors([]);

    const allErrors: ValidationError[] = [];
    const tsFiles = Object.entries(files).filter(([path]) => 
      /\.(ts|tsx|js|jsx)$/.test(path)
    );

    for (let i = 0; i < tsFiles.length; i++) {
      const [filePath, content] = tsFiles[i];
      
      // Update progress
      setValidationProgress(((i + 1) / tsFiles.length) * 100);
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 10));

      // 1. Check bracket balance
      const bracketErrors = checkBracketBalance(content);
      bracketErrors.forEach(err => {
        err.file = filePath;
        allErrors.push(err);
      });

      // 2. Check syntax patterns
      const lines = content.split('\n');
      for (const { pattern, message, severity } of SYNTAX_ERROR_PATTERNS) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        
        if (pattern.flags.includes('m')) {
          // Multi-line pattern, apply to whole content
          if (regex.test(content)) {
            allErrors.push({
              file: filePath,
              line: 1,
              column: 1,
              message,
              severity,
            });
          }
        } else {
          // Line-by-line check
          for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            while ((match = regex.exec(line)) !== null) {
              allErrors.push({
                file: filePath,
                line: lineNum + 1,
                column: match.index + 1,
                message,
                severity,
                code: line.trim().slice(0, 80),
              });
              
              // Prevent infinite loop for global patterns
              if (!pattern.flags.includes('g')) break;
            }
          }
        }
      }

      // 3. Check imports
      const importErrors = checkImports(content, filePath);
      allErrors.push(...importErrors);
    }

    // Deduplicate errors
    const uniqueErrors = allErrors.filter((err, idx, arr) => 
      arr.findIndex(e => 
        e.file === err.file && 
        e.line === err.line && 
        e.message === err.message
      ) === idx
    );

    // Sort by severity then file
    uniqueErrors.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'error' ? -1 : 1;
      }
      return a.file.localeCompare(b.file);
    });

    setErrors(uniqueErrors);
    setIsValidating(false);
    setHasRun(true);

    const errorCount = uniqueErrors.filter(e => e.severity === 'error').length;
    const isValid = errorCount === 0;
    onValidationComplete(isValid, uniqueErrors);

  }, [files, onValidationComplete]);

  // Group errors by file
  const errorsByFile = useMemo(() => {
    const grouped = new Map<string, ValidationError[]>();
    for (const error of errors) {
      const existing = grouped.get(error.file) || [];
      existing.push(error);
      grouped.set(error.file, existing);
    }
    return grouped;
  }, [errors]);

  // Stats
  const stats = useMemo(() => ({
    totalFiles: Object.keys(files).filter(p => /\.(ts|tsx|js|jsx)$/.test(p)).length,
    filesWithErrors: errorsByFile.size,
    errors: errors.filter(e => e.severity === 'error').length,
    warnings: errors.filter(e => e.severity === 'warning').length,
  }), [files, errors, errorsByFile]);

  const toggleFile = (file: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(file)) {
        next.delete(file);
      } else {
        next.add(file);
      }
      return next;
    });
  };

  const isValid = stats.errors === 0;

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
              Détecte les erreurs de syntaxe avant génération
            </CardDescription>
          </div>
          
          <Button
            onClick={runValidation}
            disabled={isValidating}
            variant={hasRun ? (isValid ? "outline" : "destructive") : "default"}
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : hasRun ? (
              isValid ? (
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
        {/* Progress bar */}
        {isValidating && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Analyse du code...</span>
              <span>{Math.round(validationProgress)}%</span>
            </div>
            <Progress value={validationProgress} />
          </div>
        )}

        {/* Stats badges */}
        {hasRun && (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              <FileCode className="h-3 w-3 mr-1" />
              {stats.totalFiles} fichiers analysés
            </Badge>
            {stats.errors > 0 ? (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" />
                {stats.errors} erreur{stats.errors > 1 ? 's' : ''}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-success/10 text-success">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Aucune erreur
              </Badge>
            )}
            {stats.warnings > 0 && (
              <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {stats.warnings} avertissement{stats.warnings > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        )}

        {/* Validation result */}
        {hasRun && (
          isValid ? (
            <Alert className="border-success/30 bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                <strong>Validation réussie !</strong> Aucune erreur de syntaxe détectée.
                {stats.warnings > 0 && ` (${stats.warnings} avertissements à vérifier)`}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{stats.errors} erreur{stats.errors > 1 ? 's' : ''} détectée{stats.errors > 1 ? 's' : ''}</strong> - 
                Corrigez ces problèmes avant de générer le pack.
              </AlertDescription>
            </Alert>
          )
        )}

        {/* Error list */}
        {errors.length > 0 && (
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

        {/* Initial state */}
        {!hasRun && !isValidating && (
          <div className="p-8 text-center text-muted-foreground border rounded-lg border-dashed">
            <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Cliquez sur "Valider" pour analyser le code</p>
            <p className="text-sm mt-1">Détection des erreurs de syntaxe, imports manquants, etc.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
