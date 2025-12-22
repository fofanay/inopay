import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, XCircle, AlertTriangle, Layers, BarChart3, Clock, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GitHubRepo } from "./GitHubMultiRepoSelector";

export interface BatchAnalysisResult {
  repo: GitHubRepo;
  status: "pending" | "analyzing" | "complete" | "error";
  score?: number;
  error?: string;
  analysisId?: string;
}

interface BatchAnalysisProgressProps {
  repos: GitHubRepo[];
  results: BatchAnalysisResult[];
  onComplete: () => void;
  onReset: () => void;
}

const BatchAnalysisProgress = ({ repos, results, onComplete, onReset }: BatchAnalysisProgressProps) => {
  const completedCount = results.filter(r => r.status === "complete").length;
  const errorCount = results.filter(r => r.status === "error").length;
  const analyzingCount = results.filter(r => r.status === "analyzing").length;
  const pendingCount = results.filter(r => r.status === "pending").length;
  
  const totalProgress = repos.length > 0 
    ? Math.round(((completedCount + errorCount) / repos.length) * 100)
    : 0;

  const averageScore = completedCount > 0
    ? Math.round(results.filter(r => r.status === "complete" && r.score !== undefined).reduce((sum, r) => sum + (r.score || 0), 0) / completedCount)
    : 0;

  const allDone = completedCount + errorCount === repos.length && repos.length > 0;

  useEffect(() => {
    if (allDone) {
      onComplete();
    }
  }, [allDone, onComplete]);

  const getStatusIcon = (status: BatchAnalysisResult["status"]) => {
    switch (status) {
      case "complete":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "analyzing":
        return <Loader2 className="h-4 w-4 animate-spin text-accent" />;
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 50) return "text-warning";
    return "text-destructive";
  };

  return (
    <Card className="card-shadow border border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Layers className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground">Analyse Batch en cours</CardTitle>
              <CardDescription className="text-muted-foreground">
                {allDone 
                  ? `${completedCount} projet${completedCount !== 1 ? "s" : ""} analysé${completedCount !== 1 ? "s" : ""} avec succès`
                  : `Analyse de ${repos.length} projet${repos.length !== 1 ? "s" : ""} en parallèle...`
                }
              </CardDescription>
            </div>
          </div>
          {allDone && (
            <Badge className="gap-1 bg-success/10 text-success border-success/20">
              <CheckCircle2 className="h-3 w-3" />
              Terminé
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Global progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progression globale</span>
            <span className="font-medium text-foreground">{totalProgress}%</span>
          </div>
          <Progress value={totalProgress} className="h-3" />
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
            <div className="text-2xl font-bold text-foreground">{repos.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="p-4 rounded-lg bg-success/10 border border-success/20 text-center">
            <div className="text-2xl font-bold text-success">{completedCount}</div>
            <div className="text-xs text-success/80">Complétés</div>
          </div>
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 text-center">
            <div className="text-2xl font-bold text-accent">{analyzingCount}</div>
            <div className="text-xs text-accent/80">En cours</div>
          </div>
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
            <div className="text-2xl font-bold text-destructive">{errorCount}</div>
            <div className="text-xs text-destructive/80">Erreurs</div>
          </div>
        </div>

        {/* Average score when complete */}
        {allDone && completedCount > 0 && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-accent" />
                <div>
                  <div className="font-medium text-foreground">Score moyen de portabilité</div>
                  <div className="text-sm text-muted-foreground">
                    Basé sur {completedCount} projet{completedCount !== 1 ? "s" : ""} analysé{completedCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <div className={`text-3xl font-bold ${getScoreColor(averageScore)}`}>
                {averageScore}/100
              </div>
            </div>
          </div>
        )}

        {/* Individual repos progress */}
        <ScrollArea className="h-[300px] rounded-lg border border-border">
          <div className="p-3 space-y-2">
            {results.map((result, index) => (
              <div
                key={result.repo.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  result.status === "analyzing" 
                    ? "border-accent/50 bg-accent/5" 
                    : result.status === "complete"
                    ? "border-success/30 bg-success/5"
                    : result.status === "error"
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(result.status)}
                  <div>
                    <div className="font-medium text-foreground">{result.repo.name}</div>
                    {result.status === "analyzing" && (
                      <div className="text-xs text-muted-foreground">Analyse en cours...</div>
                    )}
                    {result.status === "error" && result.error && (
                      <div className="text-xs text-destructive">{result.error}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {result.repo.language && (
                    <Badge variant="outline" className="text-xs">
                      {result.repo.language}
                    </Badge>
                  )}
                  {result.status === "complete" && result.score !== undefined && (
                    <Badge className={`${getScoreColor(result.score)} bg-transparent border`}>
                      {result.score}/100
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Actions */}
        {allDone && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button variant="outline" onClick={onReset} className="gap-2">
              <Zap className="h-4 w-4" />
              Nouvelle analyse batch
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {completedCount} projet{completedCount !== 1 ? "s" : ""} prêt{completedCount !== 1 ? "s" : ""} pour le déploiement
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BatchAnalysisProgress;
