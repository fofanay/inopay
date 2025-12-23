import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  FileWarning,
  Eye,
  Download,
  Loader2,
  Lock,
  Bug,
  Radio,
  Plug,
  Globe
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SecurityFinding {
  type: 'critical' | 'warning' | 'info';
  category: 'obfuscation' | 'telemetry' | 'ghost_hook' | 'cdn' | 'eval';
  filePath: string;
  line?: number;
  description: string;
  originalCode?: string;
  recommendation: string;
  quarantined: boolean;
}

interface AuditResult {
  success: boolean;
  isSovereign: boolean;
  totalFilesScanned: number;
  findings: SecurityFinding[];
  quarantinedFiles: string[];
  cleanedFiles: { path: string; originalContent: string; cleanedContent: string }[];
  summary: {
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    obfuscationFound: number;
    telemetryFound: number;
    ghostHooksFound: number;
    evalRemoved: number;
  };
  certificationStatus: 'sovereign' | 'requires_review' | 'compromised';
  certificationMessage: string;
}

interface SecurityAuditReportProps {
  files: { path: string; content: string }[];
  projectName: string;
  userId?: string;
  projectId?: string;
  onAuditComplete: (result: AuditResult, cleanedFiles: { path: string; content: string }[]) => void;
  onSkip?: () => void;
}

const categoryIcons = {
  obfuscation: Bug,
  telemetry: Radio,
  ghost_hook: Plug,
  cdn: Globe,
  eval: AlertTriangle,
};

const categoryLabels = {
  obfuscation: 'Obfuscation',
  telemetry: 'Télémétrie',
  ghost_hook: 'Hook Fantôme',
  cdn: 'CDN Propriétaire',
  eval: 'Code Dangereux',
};

export function SecurityAuditReport({ 
  files, 
  projectName, 
  userId, 
  projectId,
  onAuditComplete,
  onSkip 
}: SecurityAuditReportProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const startAudit = async () => {
    setIsScanning(true);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 200);

    try {
      const { data, error } = await supabase.functions.invoke('verify-zero-shadow-door', {
        body: {
          files: files.map(f => ({ path: f.path, content: f.content })),
          userId,
          projectId,
          projectName,
        },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setAuditResult(data);

      if (data.certificationStatus === 'sovereign') {
        toast.success('Code 100% Souverain !', {
          description: 'Aucun tracker ou code malveillant détecté',
        });
      } else if (data.certificationStatus === 'requires_review') {
        toast.warning('Vérification recommandée', {
          description: `${data.summary.warningCount} avertissement(s) détecté(s)`,
        });
      } else {
        toast.info('Nettoyage appliqué', {
          description: `${data.summary.criticalCount} problème(s) corrigé(s)`,
        });
      }

    } catch (error) {
      clearInterval(progressInterval);
      console.error('Audit error:', error);
      toast.error('Erreur lors de l\'audit de sécurité');
    } finally {
      setIsScanning(false);
    }
  };

  const handleContinue = () => {
    if (!auditResult) return;

    // Prepare cleaned files
    const cleanedFilesMap = new Map(
      auditResult.cleanedFiles.map(f => [f.path, f.cleanedContent])
    );

    const finalFiles = files.map(file => ({
      path: file.path,
      content: cleanedFilesMap.get(file.path) || file.content,
    }));

    onAuditComplete(auditResult, finalFiles);
  };

  const downloadReport = () => {
    if (!auditResult) return;

    const report = {
      projectName,
      auditDate: new Date().toISOString(),
      ...auditResult,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-audit-${projectName}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (auditResult) {
    return (
      <Card className="border-2 border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {auditResult.certificationStatus === 'sovereign' ? (
                <ShieldCheck className="h-8 w-8 text-green-500" />
              ) : auditResult.certificationStatus === 'requires_review' ? (
                <ShieldAlert className="h-8 w-8 text-yellow-500" />
              ) : (
                <Shield className="h-8 w-8 text-orange-500" />
              )}
              <div>
                <CardTitle>Rapport d'Audit de Sécurité</CardTitle>
                <CardDescription>{auditResult.certificationMessage}</CardDescription>
              </div>
            </div>
            <Badge 
              variant={
                auditResult.certificationStatus === 'sovereign' ? 'default' :
                auditResult.certificationStatus === 'requires_review' ? 'secondary' : 'destructive'
              }
              className="text-sm px-3 py-1"
            >
              {auditResult.certificationStatus === 'sovereign' ? 'Certifié' :
               auditResult.certificationStatus === 'requires_review' ? 'À Vérifier' : 'Nettoyé'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-primary">{auditResult.totalFilesScanned}</div>
              <div className="text-sm text-muted-foreground">Fichiers scannés</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-500">{auditResult.summary.criticalCount}</div>
              <div className="text-sm text-muted-foreground">Critiques</div>
            </div>
            <div className="bg-yellow-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-500">{auditResult.summary.warningCount}</div>
              <div className="text-sm text-muted-foreground">Avertissements</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-500">{auditResult.quarantinedFiles.length}</div>
              <div className="text-sm text-muted-foreground">Fichiers nettoyés</div>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {auditResult.summary.telemetryFound > 0 && (
              <div className="flex items-center gap-2 text-sm bg-destructive/10 text-destructive rounded-lg px-3 py-2">
                <Radio className="h-4 w-4" />
                <span>{auditResult.summary.telemetryFound} télémétrie</span>
              </div>
            )}
            {auditResult.summary.obfuscationFound > 0 && (
              <div className="flex items-center gap-2 text-sm bg-orange-500/10 text-orange-600 rounded-lg px-3 py-2">
                <Bug className="h-4 w-4" />
                <span>{auditResult.summary.obfuscationFound} obfuscation</span>
              </div>
            )}
            {auditResult.summary.ghostHooksFound > 0 && (
              <div className="flex items-center gap-2 text-sm bg-purple-500/10 text-purple-600 rounded-lg px-3 py-2">
                <Plug className="h-4 w-4" />
                <span>{auditResult.summary.ghostHooksFound} hooks fantômes</span>
              </div>
            )}
            {auditResult.summary.evalRemoved > 0 && (
              <div className="flex items-center gap-2 text-sm bg-red-500/10 text-red-600 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4" />
                <span>{auditResult.summary.evalRemoved} eval() supprimé</span>
              </div>
            )}
          </div>

          {/* Findings Details */}
          {auditResult.findings.length > 0 && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="findings">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Détails des découvertes ({auditResult.findings.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sévérité</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Fichier</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditResult.findings.map((finding, index) => {
                          const CategoryIcon = categoryIcons[finding.category];
                          return (
                            <TableRow key={index}>
                              <TableCell>
                                {finding.type === 'critical' ? (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                ) : finding.type === 'warning' ? (
                                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4 text-blue-500" />
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <CategoryIcon className="h-3.5 w-3.5" />
                                  <span className="text-xs">{categoryLabels[finding.category]}</span>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[200px] truncate">
                                {finding.filePath}
                                {finding.line && `:${finding.line}`}
                              </TableCell>
                              <TableCell className="max-w-[300px]">
                                <p className="text-sm">{finding.description}</p>
                                {finding.originalCode && (
                                  <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 block truncate">
                                    {finding.originalCode}
                                  </code>
                                )}
                              </TableCell>
                              <TableCell>
                                {finding.quarantined ? (
                                  <Badge variant="secondary" className="text-xs">
                                    <Lock className="h-3 w-3 mr-1" />
                                    Nettoyé
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    À vérifier
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}

          {/* Quarantined Files */}
          {auditResult.quarantinedFiles.length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-orange-600 mb-2">
                <FileWarning className="h-5 w-5" />
                <span className="font-medium">Fichiers en quarantaine ({auditResult.quarantinedFiles.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {auditResult.quarantinedFiles.map((file, index) => (
                  <Badge key={index} variant="outline" className="font-mono text-xs">
                    {file}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Certification Badge */}
          {auditResult.certificationStatus === 'sovereign' && (
            <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg p-6 text-center">
              <ShieldCheck className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-green-600 mb-1">Code 100% Souverain</h3>
              <p className="text-sm text-muted-foreground">
                Certifié par Inopay - Aucun tracker, télémétrie ou code malveillant détecté
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Inovaq Canada Inc. - {new Date().toLocaleDateString('fr-CA')}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleContinue} className="flex-1">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Continuer avec le code nettoyé
            </Button>
            <Button variant="outline" onClick={downloadReport}>
              <Download className="h-4 w-4 mr-2" />
              Télécharger le rapport
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-dashed border-primary/30">
      <CardHeader className="text-center">
        <Shield className="h-12 w-12 text-primary mx-auto mb-2" />
        <CardTitle>Audit de Sécurité Zero Shadow Door</CardTitle>
        <CardDescription>
          Scannez votre code pour détecter et supprimer tout tracker, télémétrie ou code malveillant
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
            <Bug className="h-5 w-5 text-orange-500" />
            <div>
              <div className="font-medium text-sm">Obfuscation</div>
              <div className="text-xs text-muted-foreground">Base64, Hex, etc.</div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
            <Radio className="h-5 w-5 text-red-500" />
            <div>
              <div className="font-medium text-sm">Télémétrie</div>
              <div className="text-xs text-muted-foreground">Trackers, Analytics</div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
            <Plug className="h-5 w-5 text-purple-500" />
            <div>
              <div className="font-medium text-sm">Hooks Fantômes</div>
              <div className="text-xs text-muted-foreground">Plugins cachés</div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <div>
              <div className="font-medium text-sm">Code Dangereux</div>
              <div className="text-xs text-muted-foreground">eval(), Function()</div>
            </div>
          </div>
        </div>

        {isScanning && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Analyse de la sécurité du code...</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={startAudit} 
            disabled={isScanning}
            className="flex-1"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scan en cours...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Lancer l'audit de sécurité
              </>
            )}
          </Button>
          {onSkip && (
            <Button variant="ghost" onClick={onSkip} disabled={isScanning}>
              Passer
            </Button>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          {files.length} fichiers seront analysés pour garantir un code 100% souverain
        </p>
      </CardContent>
    </Card>
  );
}
