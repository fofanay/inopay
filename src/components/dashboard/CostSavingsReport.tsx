import { useState } from "react";
import { 
  DollarSign, 
  TrendingDown, 
  Server, 
  CheckCircle2, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Download,
  Sparkles,
  Calculator,
  Zap,
  Wand2,
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  CostAnalysisResult, 
  CostlyServiceDetection, 
  COST_CATEGORIES,
  generateDockerComposeAlternatives,
  generateEnvTemplate
} from "@/lib/costOptimization";
import AutoMigrationButton from "./AutoMigrationButton";

interface CostSavingsReportProps {
  costAnalysis: CostAnalysisResult;
  onMigrate?: (services: CostlyServiceDetection[]) => void;
  projectName?: string;
  extractedFiles?: Map<string, string>;
  onMigrationComplete?: (migratedFiles: Map<string, string>) => void;
}

const CostSavingsReport = ({ costAnalysis, onMigrate, projectName, extractedFiles, onMigrationComplete }: CostSavingsReportProps) => {
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [selectedServices, setSelectedServices] = useState<Set<string>>(
    new Set(costAnalysis.detectedServices.map(s => s.service.id))
  );

  const toggleService = (serviceId: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceId)) {
      newExpanded.delete(serviceId);
    } else {
      newExpanded.add(serviceId);
    }
    setExpandedServices(newExpanded);
  };

  const toggleServiceSelection = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const selectedForMigration = costAnalysis.detectedServices.filter(s => 
    selectedServices.has(s.service.id)
  );

  const totalSelectedSavings = selectedForMigration.reduce(
    (sum, s) => sum + s.estimatedMonthlyCost, 
    0
  );

  const handleDownloadDockerCompose = () => {
    const content = generateDockerComposeAlternatives(selectedForMigration);
    const blob = new Blob([content], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "docker-compose.alternatives.yml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadEnvTemplate = () => {
    const content = generateEnvTemplate(selectedForMigration);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env.alternatives.example";
    a.click();
    URL.revokeObjectURL(url);
  };

  const getSavingsLevelBadge = () => {
    switch (costAnalysis.savingsLevel) {
      case "high":
        return (
          <Badge className="bg-success/20 text-success border-success/30 gap-1">
            <TrendingDown className="h-3 w-3" />
            Potentiel Élevé
          </Badge>
        );
      case "medium":
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30 gap-1">
            <TrendingDown className="h-3 w-3" />
            Potentiel Moyen
          </Badge>
        );
      case "low":
        return (
          <Badge className="bg-info/20 text-info border-info/30 gap-1">
            <TrendingDown className="h-3 w-3" />
            Potentiel Faible
          </Badge>
        );
      default:
        return (
          <Badge className="bg-muted/20 text-muted-foreground border-muted/30 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Optimisé
          </Badge>
        );
    }
  };

  const getComplexityBadge = (complexity: "low" | "medium" | "high") => {
    switch (complexity) {
      case "low":
        return <Badge variant="outline" className="text-success border-success/30">Facile</Badge>;
      case "medium":
        return <Badge variant="outline" className="text-warning border-warning/30">Moyen</Badge>;
      case "high":
        return <Badge variant="outline" className="text-destructive border-destructive/30">Complexe</Badge>;
    }
  };

  if (costAnalysis.detectedServices.length === 0) {
    return (
      <Card className="border-success/20 bg-gradient-to-br from-success/5 to-emerald-500/5">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <CardTitle className="text-xl text-foreground">Projet Optimisé</CardTitle>
          <CardDescription>
            Aucun service cloud coûteux détecté. Votre projet est déjà économe !
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-success/5 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-success/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />

      <CardHeader className="relative">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Conseiller en Économies
              </CardTitle>
              <CardDescription>
                Migrez vers Open Source et économisez sur vos factures API
              </CardDescription>
            </div>
          </div>
          {getSavingsLevelBadge()}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-6">
        {/* Savings Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Monthly Savings */}
          <div className="p-4 rounded-xl bg-card/50 border border-border text-center">
            <p className="text-sm text-muted-foreground mb-1">Économie Mensuelle</p>
            <p className="text-3xl font-bold text-success">{costAnalysis.potentialSavings}$</p>
            <p className="text-xs text-muted-foreground mt-1">par mois</p>
          </div>

          {/* Yearly Projection */}
          <div className="p-4 rounded-xl bg-card/50 border border-border text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sur 12 mois</p>
            </div>
            <p className="text-3xl font-bold text-primary">{costAnalysis.yearlyProjection}$</p>
            <p className="text-xs text-muted-foreground mt-1">d'économies</p>
          </div>

          {/* Services Count */}
          <div className="p-4 rounded-xl bg-card/50 border border-border text-center">
            <p className="text-sm text-muted-foreground mb-1">Services Détectés</p>
            <p className="text-3xl font-bold text-foreground">{costAnalysis.detectedServices.length}</p>
            <p className="text-xs text-muted-foreground mt-1">à migrer</p>
          </div>
        </div>

        {/* ROI Calculator */}
        <div className="p-4 rounded-xl bg-muted/30 border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-warning" />
            <p className="text-sm font-medium text-foreground">Retour sur Investissement</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Avec un déploiement Inopay à <span className="font-semibold text-primary">99$</span>, 
            vous rentabilisez en <span className="font-semibold text-success">
              {costAnalysis.potentialSavings > 0 
                ? Math.ceil(99 / costAnalysis.potentialSavings)
                : "∞"
              } mois
            </span>.
            Ensuite, c'est <span className="font-semibold text-success">{costAnalysis.potentialSavings}$/mois</span> dans votre poche !
          </p>
        </div>

        {/* Services List */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Server className="h-4 w-4" />
            Services Coûteux Détectés
          </h4>

          {costAnalysis.detectedServices.map((detection) => {
            const category = COST_CATEGORIES[detection.service.category];
            const isExpanded = expandedServices.has(detection.service.id);
            const isSelected = selectedServices.has(detection.service.id);

            return (
              <Collapsible key={detection.service.id} open={isExpanded}>
                <div className={`p-4 rounded-xl border transition-colors ${
                  isSelected 
                    ? "bg-card border-primary/30" 
                    : "bg-card/50 border-border/50"
                }`}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => toggleServiceSelection(detection.service.id)}
                              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                                isSelected
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              {isSelected ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <span className="text-lg">{category.icon}</span>
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {isSelected ? "Retirer de la migration" : "Inclure dans la migration"}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-foreground">{detection.service.name}</p>
                          <Badge variant="outline" className="text-xs">
                            {category.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          → {detection.service.alternative.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-semibold text-destructive line-through text-sm">
                          {detection.estimatedMonthlyCost}$/mois
                        </p>
                        <p className="text-success font-semibold">0$/mois</p>
                      </div>
                      
                      <CollapsibleTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => toggleService(detection.service.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>

                  <CollapsibleContent className="mt-4 pt-4 border-t border-border space-y-4">
                    {/* Detection details */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Détecté dans ({detection.detectedIn.length} occurrences)
                      </p>
                      <div className="space-y-1">
                        {detection.detectedIn.slice(0, 5).map((loc, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded">
                            {loc.file}{loc.line ? `:${loc.line}` : ""} — <span className="text-primary">{loc.pattern}</span>
                          </p>
                        ))}
                        {detection.detectedIn.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            + {detection.detectedIn.length - 5} autres occurrences
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Alternative details */}
                    <div className="p-3 rounded-lg bg-success/5 border border-success/20">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-success flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Alternative: {detection.service.alternative.name}
                        </p>
                        {getComplexityBadge(detection.service.alternative.complexity)}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {detection.service.alternative.codeReplacement.instructions}
                      </p>
                      <code className="text-xs bg-muted/50 px-2 py-1 rounded block overflow-x-auto">
                        {detection.service.alternative.configTemplate}
                      </code>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>

        {/* Selected Summary */}
        {selectedForMigration.length > 0 && (
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-foreground">
                {selectedForMigration.length} service(s) sélectionné(s)
              </p>
              <p className="text-lg font-bold text-success">
                Économie: {totalSelectedSavings}$/mois
              </p>
            </div>
            <Progress 
              value={(selectedForMigration.length / costAnalysis.detectedServices.length) * 100} 
              className="h-2 mb-4"
            />
            
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDownloadDockerCompose}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Docker Compose
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDownloadEnvTemplate}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                .env Template
              </Button>
              {onMigrate && (
                <Button 
                  size="sm"
                  onClick={() => onMigrate(selectedForMigration)}
                  className="gap-2 ml-auto"
                >
                  Migrer Automatiquement
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Educational note */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Note:</strong> Les estimations de coûts sont basées sur une utilisation moyenne. 
            Vos économies réelles peuvent varier selon votre consommation. 
            L'auto-hébergement nécessite un VPS (dès 5$/mois chez Hetzner ou Contabo).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CostSavingsReport;
