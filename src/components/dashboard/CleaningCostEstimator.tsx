import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Calculator, 
  FileCode, 
  DollarSign, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight,
  Folder,
  FolderMinus,
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FileInfo {
  path: string;
  lines: number;
  chars: number;
  needsCleaning: boolean;
}

interface EstimationResult {
  totalFiles: number;
  cleanableFiles: number;
  totalLines: number;
  totalChars: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostCents: number;
  salePriceCents: number;
  marginCents: number;
  marginPercentage: number;
  isLargeProject: boolean;
  requiresAdminApproval: boolean;
  files: FileInfo[];
  excludedPaths: string[];
}

interface CleaningCostEstimatorProps {
  files: Array<{ path: string; content: string }>;
  projectName: string;
  onEstimationComplete?: (estimation: EstimationResult) => void;
  onProceed?: () => void;
}

// Common folders to exclude
const DEFAULT_EXCLUDED = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  'coverage',
  '.cache',
  'public/assets',
  'assets/images',
];

export function CleaningCostEstimator({ 
  files, 
  projectName, 
  onEstimationComplete,
  onProceed 
}: CleaningCostEstimatorProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [estimation, setEstimation] = useState<EstimationResult | null>(null);
  const [excludedPaths, setExcludedPaths] = useState<string[]>(DEFAULT_EXCLUDED);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Group files by folder
  const groupedFiles = files.reduce((acc, file) => {
    const parts = file.path.split('/');
    const folder = parts.length > 1 ? parts[0] : '/';
    if (!acc[folder]) acc[folder] = [];
    acc[folder].push(file);
    return acc;
  }, {} as Record<string, typeof files>);

  const runEstimation = async () => {
    setAnalyzing(true);
    setProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const { data, error } = await supabase.functions.invoke('estimate-cleaning-cost', {
        body: { 
          files: files.map(f => ({ path: f.path, content: f.content })),
          projectName,
          excludedPaths,
        },
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (error) throw error;

      setEstimation(data);
      onEstimationComplete?.(data);

      if (data.isLargeProject) {
        toast.warning("Projet volumineux détecté", {
          description: `${data.totalFiles} fichiers nécessitent un forfait Portfolio.`,
        });
      }

      if (data.requiresAdminApproval) {
        toast.error("Validation requise", {
          description: "Ce projet nécessite une approbation admin en raison de sa complexité.",
        });
      }
    } catch (error) {
      console.error('Estimation error:', error);
      toast.error("Erreur lors de l'estimation");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleFolder = (folder: string) => {
    if (excludedPaths.includes(folder)) {
      setExcludedPaths(prev => prev.filter(p => p !== folder));
    } else {
      setExcludedPaths(prev => [...prev, folder]);
    }
  };

  const toggleExpand = (folder: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folder)) {
      newExpanded.delete(folder);
    } else {
      newExpanded.add(folder);
    }
    setExpandedFolders(newExpanded);
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(cents / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-CA').format(num);
  };

  return (
    <div className="space-y-4">
      {/* File Selector */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            Sélection des dossiers
          </CardTitle>
          <CardDescription>
            Décochez les dossiers inutiles pour réduire le coût et accélérer le processus
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48 rounded-md border border-border p-3">
            <div className="space-y-1">
              {Object.entries(groupedFiles).map(([folder, folderFiles]) => {
                const isExcluded = excludedPaths.includes(folder);
                const isExpanded = expandedFolders.has(folder);
                
                return (
                  <Collapsible key={folder} open={isExpanded}>
                    <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50">
                      <Checkbox 
                        checked={!isExcluded}
                        onCheckedChange={() => toggleFolder(folder)}
                        id={`folder-${folder}`}
                      />
                      <CollapsibleTrigger 
                        onClick={() => toggleExpand(folder)}
                        className="flex items-center gap-1 flex-1 cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        {isExcluded ? (
                          <FolderMinus className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Folder className="h-4 w-4 text-primary" />
                        )}
                        <span className={isExcluded ? "text-muted-foreground line-through" : "text-foreground"}>
                          {folder}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {folderFiles.length} fichiers
                        </Badge>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent>
                      <div className="ml-8 space-y-1 text-sm text-muted-foreground">
                        {folderFiles.slice(0, 5).map(file => (
                          <div key={file.path} className="flex items-center gap-2 py-0.5">
                            <FileCode className="h-3 w-3" />
                            <span className="truncate">{file.path.split('/').pop()}</span>
                          </div>
                        ))}
                        {folderFiles.length > 5 && (
                          <div className="text-xs italic">
                            +{folderFiles.length - 5} autres fichiers...
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          </ScrollArea>
          
          <Button 
            onClick={runEstimation} 
            className="w-full mt-4"
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyse de la complexité du code...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Estimer le coût de libération
              </>
            )}
          </Button>
          
          {analyzing && (
            <div className="mt-3 space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Analyse en cours... {progress}%
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estimation Results */}
      {estimation && (
        <Card className={`border-2 ${estimation.requiresAdminApproval ? 'border-destructive' : 'border-success'}`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Estimation du coût de libération
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Project Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{estimation.totalFiles}</p>
                <p className="text-xs text-muted-foreground">Fichiers</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{estimation.cleanableFiles}</p>
                <p className="text-xs text-muted-foreground">À nettoyer</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-foreground">{formatNumber(estimation.totalLines)}</p>
                <p className="text-xs text-muted-foreground">Lignes de code</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {formatNumber(estimation.estimatedInputTokens + estimation.estimatedOutputTokens)}
                </p>
                <p className="text-xs text-muted-foreground">Tokens estimés</p>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground">Coût API estimé :</span>
                <span className="font-mono text-foreground">{formatCurrency(estimation.estimatedCostCents)}</span>
              </div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-muted-foreground">Prix de vente :</span>
                <span className="font-mono text-foreground">{formatCurrency(estimation.salePriceCents)}</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">Marge :</span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono font-bold ${estimation.marginCents > 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(estimation.marginCents)}
                  </span>
                  <Badge variant={estimation.marginPercentage > 40 ? "default" : "destructive"}>
                    {estimation.marginPercentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {estimation.isLargeProject && (
              <Alert variant="default" className="border-warning bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle className="text-warning">Projet volumineux détecté</AlertTitle>
                <AlertDescription>
                  Votre projet contient {estimation.totalFiles} fichiers. 
                  Nécessite un forfait Portfolio ou un supplément de {formatCurrency(500)}.
                </AlertDescription>
              </Alert>
            )}

            {estimation.requiresAdminApproval && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Validation admin requise</AlertTitle>
                <AlertDescription>
                  Le coût estimé dépasse 60% du prix de vente. 
                  Une validation manuelle par l'équipe Inopay est nécessaire.
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={runEstimation}
              >
                Recalculer
              </Button>
              <Button 
                className="flex-1"
                disabled={estimation.requiresAdminApproval}
                onClick={onProceed}
              >
                {estimation.requiresAdminApproval ? (
                  <>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    En attente d'approbation
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Procéder au nettoyage
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
