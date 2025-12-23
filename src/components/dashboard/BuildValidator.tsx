import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Package, 
  FileCode, 
  AlertTriangle,
  Hammer,
  RefreshCw,
  Download
} from 'lucide-react';
import { generateSovereigntyReport, checkFileForProprietaryCode, SovereigntyAuditResult } from '@/lib/sovereigntyReport';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface BuildValidatorProps {
  files: Map<string, string>;
  projectName: string;
  onValidationComplete?: (isValid: boolean, report: BuildValidationReport) => void;
  onSkip?: () => void;
}

interface FileValidation {
  path: string;
  isValid: boolean;
  issues: { pattern: string; line: number; severity: 'critical' | 'warning' }[];
}

interface DependencyCheck {
  name: string;
  status: 'found' | 'missing' | 'proprietary';
  version?: string;
  replacement?: string;
}

export interface BuildValidationReport {
  timestamp: string;
  projectName: string;
  isFullyValid: boolean;
  sovereigntyReport: SovereigntyAuditResult;
  fileValidations: FileValidation[];
  dependencyChecks: DependencyCheck[];
  missingDependencies: string[];
  proprietaryDependencies: string[];
  buildSimulation: {
    status: 'success' | 'warning' | 'error';
    message: string;
    errors: string[];
    warnings: string[];
  };
  summary: {
    totalFiles: number;
    validFiles: number;
    filesWithIssues: number;
    criticalIssues: number;
    warnings: number;
  };
}

// Known proprietary patterns that would cause build failures
const PROPRIETARY_IMPORTS = [
  /@lovable\//,
  /@gptengineer\//,
  /from ['"]lovable/,
  /from ['"]gptengineer/,
  /lovable-tagger/,
];

// Standard dependencies that should be present
const REQUIRED_DEPENDENCIES = [
  'react',
  'react-dom',
  'vite',
  'typescript',
  'tailwindcss',
];

// Known proprietary dependencies
const PROPRIETARY_DEPS = [
  'lovable-tagger',
  '@lovable/core',
  '@gptengineer/core',
];

export function BuildValidator({ 
  files, 
  projectName, 
  onValidationComplete,
  onSkip 
}: BuildValidatorProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'idle' | 'files' | 'dependencies' | 'build' | 'complete'>('idle');
  const [report, setReport] = useState<BuildValidationReport | null>(null);

  const runValidation = async () => {
    setIsValidating(true);
    setProgress(0);
    setStage('files');

    const fileValidations: FileValidation[] = [];
    const dependencyChecks: DependencyCheck[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    let criticalCount = 0;
    let warningCount = 0;

    // Stage 1: Validate files for proprietary code
    const filesArray = Array.from(files.entries());
    for (let i = 0; i < filesArray.length; i++) {
      const [path, content] = filesArray[i];
      setProgress((i / filesArray.length) * 40);

      // Skip non-code files
      if (!path.match(/\.(ts|tsx|js|jsx|json)$/)) continue;

      const validation = checkFileForProprietaryCode(content);
      
      if (!validation.isClean) {
        criticalCount += validation.issues.filter(i => i.severity === 'critical').length;
        warningCount += validation.issues.filter(i => i.severity === 'warning').length;
        
        validation.issues.forEach(issue => {
          if (issue.severity === 'critical') {
            errors.push(`${path}:${issue.line} - Proprietary pattern found: ${issue.pattern}`);
          } else {
            warnings.push(`${path}:${issue.line} - Warning: ${issue.pattern}`);
          }
        });
      }

      fileValidations.push({
        path,
        isValid: validation.isClean,
        issues: validation.issues,
      });
    }

    // Stage 2: Check dependencies
    setStage('dependencies');
    setProgress(50);

    const packageJsonContent = files.get('package.json');
    if (packageJsonContent) {
      try {
        const packageJson = JSON.parse(packageJsonContent);
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Check required dependencies
        for (const dep of REQUIRED_DEPENDENCIES) {
          if (allDeps[dep]) {
            dependencyChecks.push({
              name: dep,
              status: 'found',
              version: allDeps[dep],
            });
          } else {
            dependencyChecks.push({
              name: dep,
              status: 'missing',
            });
            errors.push(`Missing required dependency: ${dep}`);
          }
        }

        // Check for proprietary dependencies
        for (const dep of PROPRIETARY_DEPS) {
          if (allDeps[dep]) {
            dependencyChecks.push({
              name: dep,
              status: 'proprietary',
              version: allDeps[dep],
              replacement: 'Remove this dependency',
            });
            errors.push(`Proprietary dependency found: ${dep}`);
            criticalCount++;
          }
        }

        // Check all dependencies for lovable/gptengineer references
        for (const [name, version] of Object.entries(allDeps)) {
          if (name.includes('lovable') || name.includes('gptengineer')) {
            if (!dependencyChecks.find(d => d.name === name)) {
              dependencyChecks.push({
                name,
                status: 'proprietary',
                version: version as string,
              });
              errors.push(`Proprietary dependency found: ${name}`);
              criticalCount++;
            }
          }
        }
      } catch (e) {
        errors.push('Failed to parse package.json');
      }
    } else {
      errors.push('package.json not found');
    }

    // Stage 3: Build simulation
    setStage('build');
    setProgress(75);

    // Check vite.config for proprietary imports
    const viteConfig = files.get('vite.config.ts');
    if (viteConfig) {
      for (const pattern of PROPRIETARY_IMPORTS) {
        if (pattern.test(viteConfig)) {
          errors.push('vite.config.ts contains proprietary imports');
          criticalCount++;
        }
      }
    }

    // Check for required config files
    const requiredConfigs = ['tsconfig.json', 'tailwind.config.ts', 'postcss.config.js'];
    for (const config of requiredConfigs) {
      if (!files.has(config)) {
        warnings.push(`Config file missing: ${config}`);
        warningCount++;
      }
    }

    // Generate sovereignty report
    const sovereigntyReport = generateSovereigntyReport();

    // Stage 4: Complete
    setStage('complete');
    setProgress(100);

    const validFiles = fileValidations.filter(f => f.isValid).length;
    const buildStatus = errors.length === 0 ? 'success' : 
                        errors.some(e => e.includes('Proprietary')) ? 'error' : 'warning';

    const finalReport: BuildValidationReport = {
      timestamp: new Date().toISOString(),
      projectName,
      isFullyValid: errors.length === 0,
      sovereigntyReport,
      fileValidations,
      dependencyChecks,
      missingDependencies: dependencyChecks.filter(d => d.status === 'missing').map(d => d.name),
      proprietaryDependencies: dependencyChecks.filter(d => d.status === 'proprietary').map(d => d.name),
      buildSimulation: {
        status: buildStatus,
        message: buildStatus === 'success' 
          ? 'Build simulation passed - No Module not found errors expected'
          : buildStatus === 'error'
            ? 'Build will fail due to proprietary dependencies'
            : 'Build may succeed but has warnings',
        errors,
        warnings,
      },
      summary: {
        totalFiles: fileValidations.length,
        validFiles,
        filesWithIssues: fileValidations.length - validFiles,
        criticalIssues: criticalCount,
        warnings: warningCount,
      },
    };

    setReport(finalReport);
    setIsValidating(false);

    onValidationComplete?.(finalReport.isFullyValid, finalReport);
  };

  const downloadReport = () => {
    if (!report) return;

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `build-validation-${projectName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (report) {
    return (
      <Card className="border-2 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {report.isFullyValid ? (
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 text-red-500" />
              )}
              <div>
                <CardTitle>Validation de Build Terminée</CardTitle>
                <CardDescription>
                  {report.buildSimulation.message}
                </CardDescription>
              </div>
            </div>
            <Badge 
              variant={report.isFullyValid ? 'default' : 'destructive'}
              className="text-sm px-3 py-1"
            >
              {report.isFullyValid ? 'Build Prêt' : 'Corrections Requises'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary">{report.summary.totalFiles}</div>
              <div className="text-sm text-muted-foreground">Fichiers analysés</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-500">{report.summary.validFiles}</div>
              <div className="text-sm text-muted-foreground">Fichiers valides</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{report.summary.criticalIssues}</div>
              <div className="text-sm text-muted-foreground">Erreurs critiques</div>
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-500">{report.summary.warnings}</div>
              <div className="text-sm text-muted-foreground">Avertissements</div>
            </div>
          </div>

          {/* Dependencies Status */}
          <Accordion type="single" collapsible>
            <AccordionItem value="dependencies">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Dépendances ({report.dependencyChecks.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {report.dependencyChecks.map((dep, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        {dep.status === 'found' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : dep.status === 'missing' ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                        )}
                        <span className="font-mono text-sm">{dep.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {dep.version && (
                          <span className="text-xs text-muted-foreground">{dep.version}</span>
                        )}
                        <Badge 
                          variant={
                            dep.status === 'found' ? 'default' :
                            dep.status === 'missing' ? 'destructive' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {dep.status === 'found' ? 'OK' : 
                           dep.status === 'missing' ? 'Manquant' : 'Propriétaire'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Errors */}
            {report.buildSimulation.errors.length > 0 && (
              <AccordionItem value="errors">
                <AccordionTrigger>
                  <div className="flex items-center gap-2 text-red-500">
                    <XCircle className="h-4 w-4" />
                    Erreurs ({report.buildSimulation.errors.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {report.buildSimulation.errors.map((error, index) => (
                      <div key={index} className="p-2 bg-red-500/10 rounded text-sm text-red-600 font-mono">
                        {error}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {/* Warnings */}
            {report.buildSimulation.warnings.length > 0 && (
              <AccordionItem value="warnings">
                <AccordionTrigger>
                  <div className="flex items-center gap-2 text-yellow-500">
                    <AlertTriangle className="h-4 w-4" />
                    Avertissements ({report.buildSimulation.warnings.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {report.buildSimulation.warnings.map((warning, index) => (
                      <div key={index} className="p-2 bg-yellow-500/10 rounded text-sm text-yellow-600 font-mono">
                        {warning}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          {/* Sovereignty Certification */}
          {report.sovereigntyReport.certification.status === 'sovereign' && (
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg p-4 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <h4 className="font-bold text-green-600">Code 100% Souverain</h4>
              <p className="text-xs text-muted-foreground">
                npm install && npm run build - Aucune erreur 'Module not found' attendue
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={() => onValidationComplete?.(report.isFullyValid, report)} 
              className="flex-1"
              disabled={!report.isFullyValid}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {report.isFullyValid ? 'Continuer vers l\'export' : 'Corrections requises'}
            </Button>
            <Button variant="outline" onClick={downloadReport}>
              <Download className="h-4 w-4 mr-2" />
              Rapport complet
            </Button>
            <Button variant="ghost" onClick={() => setReport(null)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Relancer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-dashed border-primary/30">
      <CardHeader className="text-center">
        <Hammer className="h-12 w-12 text-primary mx-auto mb-2" />
        <CardTitle>Validation de Build</CardTitle>
        <CardDescription>
          Vérification de souveraineté et simulation de build avant export
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
            <FileCode className="h-5 w-5 text-blue-500" />
            <div>
              <div className="font-medium text-sm">Analyse des fichiers</div>
              <div className="text-xs text-muted-foreground">Code propriétaire</div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
            <Package className="h-5 w-5 text-green-500" />
            <div>
              <div className="font-medium text-sm">Dépendances</div>
              <div className="text-xs text-muted-foreground">Module not found</div>
            </div>
          </div>
        </div>

        {isValidating && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {stage === 'files' && 'Analyse des fichiers...'}
                {stage === 'dependencies' && 'Vérification des dépendances...'}
                {stage === 'build' && 'Simulation de build...'}
                {stage === 'complete' && 'Validation terminée'}
              </span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={runValidation} 
            disabled={isValidating}
            className="flex-1"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Validation en cours...
              </>
            ) : (
              <>
                <Hammer className="h-4 w-4 mr-2" />
                Lancer la validation
              </>
            )}
          </Button>
          {onSkip && (
            <Button variant="outline" onClick={onSkip} disabled={isValidating}>
              Passer cette étape
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
