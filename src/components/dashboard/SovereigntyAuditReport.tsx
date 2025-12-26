import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileSearch,
  Lock,
  Server,
  Code,
  RefreshCw,
  Download
} from 'lucide-react';
import { generateSovereigntyReport, generateReportSummary, type SovereigntyAuditResult } from '@/lib/sovereigntyReport';
import { cleanDOMSignatures } from '@/lib/security-cleaner';
import { useTranslation } from 'react-i18next';

export function SovereigntyAuditReport() {
  const { t } = useTranslation();
  const [report, setReport] = useState<SovereigntyAuditResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const runAudit = () => {
    setIsScanning(true);
    
    // Simuler un scan progressif
    setTimeout(() => {
      const newReport = generateSovereigntyReport();
      
      // Nettoyer le DOM et compter les signatures
      const signaturesRemoved = cleanDOMSignatures();
      newReport.domStatus.signaturesRemoved = signaturesRemoved;
      
      setReport(newReport);
      setIsScanning(false);
    }, 1500);
  };

  useEffect(() => {
    runAudit();
  }, []);

  const downloadReport = () => {
    if (!report) return;
    
    const summary = generateReportSummary(report);
    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inopay-sovereignty-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = () => {
    if (!report) return <Shield className="h-8 w-8 text-muted-foreground animate-pulse" />;
    
    switch (report.certification.status) {
      case 'sovereign':
        return <ShieldCheck className="h-8 w-8 text-green-500" />;
      case 'almost_sovereign':
        return <Shield className="h-8 w-8 text-yellow-500" />;
      case 'requires_action':
        return <ShieldAlert className="h-8 w-8 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    if (!report) return 'bg-muted';
    
    switch (report.certification.status) {
      case 'sovereign':
        return 'bg-green-500/10 border-green-500/30';
      case 'almost_sovereign':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'requires_action':
        return 'bg-red-500/10 border-red-500/30';
    }
  };

  const CheckItem = ({ 
    label, 
    checked, 
    warning = false 
  }: { 
    label: string; 
    checked: boolean; 
    warning?: boolean;
  }) => (
    <div className="flex items-center gap-2 text-sm">
      {checked ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      ) : warning ? (
        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
      )}
      <span className={checked ? 'text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header avec score */}
      <Card className={`border-2 ${getStatusColor()}`}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              {getStatusIcon()}
              <div>
                <h2 className="text-xl font-bold">
                  Rapport de Souveraineté Inopay
                </h2>
                <p className="text-muted-foreground text-sm mt-1">
                  {report?.certification.message || 'Analyse en cours...'}
                </p>
                {report && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Audit: {new Date(report.auditDate).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={runAudit}
                disabled={isScanning}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scan...' : 'Re-scanner'}
              </Button>
              
              {report && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadReport}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>
          
          {/* Score progress */}
          {report && (
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span>Score de Souveraineté</span>
                <span className="font-bold">{report.certification.score}/100</span>
              </div>
              <Progress 
                value={report.certification.score} 
                className="h-3"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {report && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Mode Build */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Code className="h-4 w-4" />
                Configuration Build
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CheckItem 
                label={`Minification: ${report.buildConfig.minification}`}
                checked={report.buildConfig.minification === 'terser'}
              />
              <CheckItem 
                label="Source maps désactivés"
                checked={!report.buildConfig.sourceMaps}
                warning={report.buildConfig.sourceMaps}
              />
              <CheckItem 
                label="Chunks randomisés"
                checked={report.buildConfig.chunkRandomization}
              />
              <CheckItem 
                label="Console stripping"
                checked={report.buildConfig.consoleStripping}
              />
            </CardContent>
          </Card>

          {/* Protection DOM */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileSearch className="h-4 w-4" />
                Nettoyage DOM
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CheckItem 
                label="Cleaner DOM actif"
                checked={report.domStatus.cleanerActive}
              />
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">
                  {report.domStatus.signaturesRemoved} signatures supprimées
                </Badge>
              </div>
              <CheckItem 
                label="Mode production"
                checked={report.buildMode === 'production'}
                warning={report.buildMode !== 'production'}
              />
            </CardContent>
          </Card>

          {/* Protection Secrets */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Protection Secrets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CheckItem 
                label="Session storage only"
                checked={report.secretsProtection.sessionStorageOnly}
              />
              <CheckItem 
                label="Mode incognito disponible"
                checked={report.secretsProtection.incognitoModeAvailable}
              />
              <CheckItem 
                label="Pas de persistance DB"
                checked={report.secretsProtection.noDatabasePersistence}
              />
            </CardContent>
          </Card>

          {/* Infrastructure */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Server className="h-4 w-4" />
                Infrastructure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge 
                  variant={report.infrastructureMode === 'self-hosted' ? 'default' : 'secondary'}
                >
                  {report.infrastructureMode.toUpperCase()}
                </Badge>
              </div>
              <CheckItem 
                label="Abstraction active"
                checked={true}
              />
              <CheckItem 
                label="Export d'urgence prêt"
                checked={true}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dépendances auditées */}
      {report && report.summary.proprietaryDepsFound.length > 0 && (
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Dépendances Propriétaires Détectées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {report.summary.proprietaryDepsFound.map((dep) => (
                <Badge key={dep} variant="destructive">
                  {dep}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blockers */}
      {report && report.certification.blockers.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardHeader>
            <CardTitle className="text-yellow-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Actions Requises
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {report.certification.blockers.map((blocker, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-yellow-600" />
                  {blocker}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Message final */}
      {report?.isFullySovereign && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-10 w-10 text-green-500" />
              <div>
                <h3 className="font-bold text-green-700 dark:text-green-400">
                  Projet 100% Souverain
                </h3>
                <p className="text-sm text-muted-foreground">
                  Aucune trace de plateforme tierce ne subsiste dans le build final.
                  Le projet peut être déployé sur n'importe quelle infrastructure.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
