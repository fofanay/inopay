import { 
  CheckCircle2, 
  ExternalLink, 
  Server, 
  Shield, 
  TrendingDown, 
  Lightbulb, 
  ArrowRight,
  Globe,
  Database,
  Lock,
  Sparkles,
  Smartphone
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";

interface ServiceReplacement {
  from: string;
  to: string;
  savings: number;
}

interface CostAnalysis {
  oldMonthlyCost: number;
  newMonthlyCost: number;
  hostingSavings: number;
  apiSavings: number;
  totalSavings: number;
}

export interface LiberationReportData {
  projectName: string;
  deployedUrl?: string;
  hostingProvider: string;
  hostingType: 'vps' | 'ftp' | 'github';
  serverIp?: string;
  coolifyUrl?: string;
  deploymentDate: string;
  costAnalysis?: CostAnalysis;
  servicesReplaced?: ServiceReplacement[];
  cleanedDependencies?: string[];
  portabilityScoreBefore?: number;
  portabilityScoreAfter: number;
  filesUploaded?: number;
}

interface LiberationReportContentProps {
  data: LiberationReportData;
}

const LiberationReportContent = ({ data }: LiberationReportContentProps) => {
  const {
    projectName,
    deployedUrl,
    hostingProvider,
    hostingType,
    serverIp,
    coolifyUrl,
    deploymentDate,
    costAnalysis,
    servicesReplaced = [],
    cleanedDependencies = [],
    portabilityScoreBefore = 65,
    portabilityScoreAfter,
    filesUploaded
  } = data;

  const formattedDate = format(new Date(deploymentDate), "d MMMM yyyy 'à' HH:mm", { locale: fr });
  
  const defaultCostAnalysis: CostAnalysis = costAnalysis || {
    oldMonthlyCost: 150,
    newMonthlyCost: 10,
    hostingSavings: 90,
    apiSavings: 50,
    totalSavings: 140
  };

  const annualSavings = defaultCostAnalysis.totalSavings * 12;

  const hostingTypeLabels = {
    vps: 'VPS avec Coolify',
    ftp: 'Hébergement Classique (FTP)',
    github: 'GitHub Pages / Vercel'
  };

  return (
    <div id="liberation-report" className="max-w-4xl mx-auto p-8 bg-background print:bg-white">
      {/* Header avec logo */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">INOPAY</h2>
            <p className="text-xs text-muted-foreground">Rapport de Libération</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs">
          {formattedDate}
        </Badge>
      </div>

      {/* Titre Principal */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-success/10 rounded-full mb-6">
          <CheckCircle2 className="h-12 w-12 text-success" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Votre Projet <span className="text-primary">"{projectName}"</span>
          <br />est maintenant <span className="text-success">LIBRE</span> !
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Félicitations ! Votre application est en ligne et autonome sur votre propre serveur.
          Vous avez repris le contrôle total de votre code.
        </p>
      </div>

      {/* Statut du Déploiement */}
      <Card className="mb-6 border-success/30 bg-success/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-success" />
            Statut du Déploiement
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          {deployedUrl && (
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <ExternalLink className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">URL de l'application</p>
                <a 
                  href={deployedUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium truncate block"
                >
                  {deployedUrl}
                </a>
              </div>
            </div>
          )}
          <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
            <Server className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Hébergeur</p>
              <p className="font-medium">{hostingProvider}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
            <Database className="h-5 w-5 text-primary flex-shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Type de déploiement</p>
              <p className="font-medium">{hostingTypeLabels[hostingType]}</p>
            </div>
          </div>
          {filesUploaded && (
            <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Fichiers déployés</p>
                <p className="font-medium">{filesUploaded} fichiers</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Résumé des Économies */}
      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingDown className="h-5 w-5 text-primary" />
            Résumé des Économies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Graphique comparatif */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Anciens coûts (Cloud)</span>
                  <span className="font-bold text-destructive">{defaultCostAnalysis.oldMonthlyCost}$/mois</span>
                </div>
                <div className="h-6 bg-destructive/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-destructive rounded-full transition-all duration-1000"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Nouveaux coûts (Self-hosted)</span>
                  <span className="font-bold text-success">{defaultCostAnalysis.newMonthlyCost}$/mois</span>
                </div>
                <div className="h-6 bg-success/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-success rounded-full transition-all duration-1000"
                    style={{ width: `${(defaultCostAnalysis.newMonthlyCost / defaultCostAnalysis.oldMonthlyCost) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-background p-4 rounded-xl border border-border">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Économie mensuelle</p>
                <p className="text-4xl font-bold text-success">{defaultCostAnalysis.totalSavings}$</p>
                <p className="text-xs text-muted-foreground mt-1">
                  soit <span className="font-semibold text-primary">{annualSavings}$/an</span>
                </p>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-2 text-center text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Hébergement</p>
                  <p className="font-semibold text-success">-{defaultCostAnalysis.hostingSavings}$</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">APIs tierces</p>
                  <p className="font-semibold text-success">-{defaultCostAnalysis.apiSavings}$</p>
                </div>
              </div>
            </div>
          </div>

          {/* Services remplacés */}
          {servicesReplaced.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-3">Services remplacés par des alternatives Open Source :</p>
              <div className="grid md:grid-cols-2 gap-2">
                {servicesReplaced.map((service, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-2 p-2 bg-background rounded-lg text-sm"
                  >
                    <span className="text-destructive line-through">{service.from}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-success font-medium">{service.to}</span>
                    {service.savings > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs">
                        -{service.savings}$/mois
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Détails du Serveur */}
      {(serverIp || coolifyUrl) && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5 text-primary" />
              Détails du Serveur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {serverIp && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Adresse IP du serveur</p>
                  <p className="font-mono font-medium">{serverIp}</p>
                </div>
              </div>
            )}
            {coolifyUrl && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Dashboard Coolify</p>
                  <a 
                    href={coolifyUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline font-medium"
                  >
                    {coolifyUrl}
                  </a>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/30">
              <Lock className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">Sécurité Zero-Knowledge</p>
                <p className="text-muted-foreground">
                  Vos identifiants ne sont pas stockés par Inopay. Les secrets ont été nettoyés après le déploiement.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit de Portabilité */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Audit de Portabilité Inopay
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-center gap-6 mb-6">
            {/* Score avant */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Avant nettoyage</p>
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${portabilityScoreBefore * 2.51} 251`}
                    className="text-destructive"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-destructive">
                  {portabilityScoreBefore}%
                </span>
              </div>
            </div>

            <ArrowRight className="h-8 w-8 text-muted-foreground" />

            {/* Score après */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-2">Après nettoyage</p>
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${portabilityScoreAfter * 3.52} 352`}
                    className="text-success"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-success">
                  {portabilityScoreAfter}%
                </span>
              </div>
              <Badge className="mt-2 bg-success/10 text-success border-success/30">
                Code 100% Libre
              </Badge>
            </div>
          </div>

          {/* Dépendances nettoyées */}
          {cleanedDependencies.length > 0 && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium mb-3">Dépendances propriétaires purgées :</p>
              <div className="flex flex-wrap gap-2">
                {cleanedDependencies.map((dep, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="line-through text-muted-foreground"
                  >
                    ✓ {dep}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-success mt-3 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Toutes ces dépendances ont été remplacées par des standards Open Source.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conseils Post-Déploiement */}
      <Card className="mb-6 border-warning/30 bg-warning/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-warning" />
            Conseils Post-Déploiement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-warning/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-warning text-xs font-bold">1</span>
              </div>
              <div>
                <p className="font-medium">Configurez votre nom de domaine</p>
                <p className="text-sm text-muted-foreground">
                  Faites pointer votre domaine vers l'IP de votre serveur pour un accès personnalisé.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-warning/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-warning text-xs font-bold">2</span>
              </div>
              <div>
                <p className="font-medium">Faites des sauvegardes régulières</p>
                <p className="text-sm text-muted-foreground">
                  Votre application est sous votre contrôle total. Planifiez des sauvegardes automatiques.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-warning/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-warning text-xs font-bold">3</span>
              </div>
              <div>
                <p className="font-medium">Mettez à jour vos dépendances</p>
                <p className="text-sm text-muted-foreground">
                  Gardez vos packages à jour pour bénéficier des correctifs de sécurité.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 bg-warning/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-warning text-xs font-bold">4</span>
              </div>
              <div>
                <p className="font-medium">Consultez la documentation</p>
                <p className="text-sm text-muted-foreground">
                  {hostingType === 'vps' 
                    ? "Explorez le dashboard Coolify pour gérer vos déploiements futurs."
                    : "Familiarisez-vous avec votre panneau d'hébergement pour les mises à jour futures."
                  }
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* QR Code Section */}
      {deployedUrl && (
        <Card className="mb-6 print:break-inside-avoid">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5 text-primary" />
              Accès Mobile Rapide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                <QRCodeSVG 
                  value={deployedUrl} 
                  size={140}
                  level="H"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#1B3A5F"
                />
              </div>
              <div className="text-center md:text-left">
                <p className="font-medium mb-2">Scannez pour accéder à votre application</p>
                <p className="text-sm text-muted-foreground mb-3">
                  Utilisez l'appareil photo de votre smartphone pour scanner ce QR code et accéder directement à votre application déployée.
                </p>
                <a 
                  href={deployedUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-sm font-medium inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  {deployedUrl}
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="text-center mt-8 pt-6 border-t border-border print:mt-4 print:pt-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-bold text-primary">INOPAY</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Libérez votre code, maîtrisez votre avenir.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Rapport généré le {formattedDate}
        </p>
      </div>
    </div>
  );
};

export default LiberationReportContent;
