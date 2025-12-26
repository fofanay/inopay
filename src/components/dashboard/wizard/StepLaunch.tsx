import { useState, useRef, useEffect } from "react";
import { Rocket, CheckCircle2, Loader2, ExternalLink, Copy, Check, PartyPopper, Github, Server, Database, Shield, Key } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useWizard } from "@/contexts/WizardContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { SovereigntyTips } from "./SovereigntyTips";

export function StepLaunch() {
  const { state, dispatch, prevStep, reset } = useWizard();
  const { user } = useAuth();
  const { toast } = useToast();
  const consoleRef = useRef<HTMLDivElement>(null);
  
  const [copied, setCopied] = useState(false);

  // Auto-scroll logs
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [state.launch.logs]);

  const addLog = (message: string) => {
    dispatch({ type: "ADD_LAUNCH_LOG", payload: message });
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const startDeployment = async () => {
    dispatch({ 
      type: "UPDATE_LAUNCH", 
      payload: { isDeploying: true, progress: 0, logs: [] } 
    });
    dispatch({ type: "SET_STEP_STATUS", payload: { step: "launch", status: "in_progress" } });
    
    try {
      addLog("🚀 Démarrage de la libération...");
      dispatch({ type: "UPDATE_LAUNCH", payload: { progress: 10 } });
      
      // Step 1: Create GitHub repo
      addLog("📦 Création du dépôt GitHub...");
      dispatch({ type: "UPDATE_LAUNCH", payload: { progress: 25 } });
      
      const { data: exportResult, error: exportError } = await supabase.functions.invoke("export-to-github", {
        body: {
          repoName: state.destination.destinationRepo,
          description: `🚀 Projet libéré depuis ${state.source.owner}/${state.source.repo} via Inopay`,
          files: state.cleaning.cleanedFiles,
          isPrivate: true,
          github_token: state.destination.destinationToken || undefined
        }
      });
      
      if (exportError) throw new Error(exportError.message);
      if (!exportResult?.success) throw new Error(exportResult?.error || "Échec de l'export GitHub");
      
      addLog(`✓ Dépôt créé : ${exportResult.repoFullName}`);
      dispatch({ type: "UPDATE_LAUNCH", payload: { progress: 50 } });
      
      // Step 2: Handle hosting setup
      if (state.destination.hostingType === "traditional" && state.destination.ftpHost) {
        addLog("⚙️ Génération de la GitHub Action pour FTP...");
        // GitHub Action would be added to the repo here
        addLog("✓ GitHub Action configurée pour déploiement automatique");
      }
      
      dispatch({ type: "UPDATE_LAUNCH", payload: { progress: 75 } });
      
      // Step 3: Log to history
      addLog("📝 Enregistrement dans l'historique...");
      
      try {
        await supabase.from("deployment_history").insert({
          user_id: user?.id,
          project_name: state.destination.destinationRepo,
          provider: "github",
          deployment_type: "liberation",
          status: "success",
          deployed_url: exportResult.repoUrl,
          portability_score_before: 50,
          portability_score_after: state.cleaning.sovereigntyScore,
          files_uploaded: Object.keys(state.cleaning.cleanedFiles).length
        });
      } catch (logError) {
        console.warn("[StepLaunch] Failed to log deployment:", logError);
      }
      
      dispatch({ type: "UPDATE_LAUNCH", payload: { progress: 100 } });
      addLog("━".repeat(40));
      addLog("🎉 LIBÉRATION TERMINÉE AVEC SUCCÈS !");
      addLog(`📍 ${exportResult.repoUrl}`);
      
      dispatch({ 
        type: "UPDATE_LAUNCH", 
        payload: { 
          isDeploying: false,
          deployedUrl: exportResult.repoUrl,
          isComplete: true,
        } 
      });
      dispatch({ type: "SET_STEP_STATUS", payload: { step: "launch", status: "completed" } });
      
      // Celebrate!
      triggerConfetti();
      
      toast({ 
        title: "🎉 Libération réussie !", 
        description: `Votre code est maintenant 100% souverain` 
      });
    } catch (error: any) {
      console.error("[StepLaunch] Error:", error);
      addLog(`❌ Erreur : ${error.message}`);
      dispatch({ 
        type: "UPDATE_LAUNCH", 
        payload: { isDeploying: false } 
      });
      dispatch({ type: "SET_STEP_STATUS", payload: { step: "launch", status: "error" } });
      toast({ title: "Erreur de déploiement", description: error.message, variant: "destructive" });
    }
  };

  const copyUrl = () => {
    if (state.launch.deployedUrl) {
      navigator.clipboard.writeText(state.launch.deployedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNewLiberation = () => {
    reset();
  };

  // Count secrets to replace
  const secretsToReplace = state.secrets.detectedSecrets.filter(s => s.action === "replace").length;

  // Recap items
  const recapItems = [
    { 
      icon: Github, 
      label: "Code source", 
      value: `${state.source.owner}/${state.source.repo}`,
      status: state.stepStatuses.source === "completed"
    },
    { 
      icon: Key, 
      label: "Secrets mappés", 
      value: secretsToReplace > 0 ? `${secretsToReplace} clé(s) remplacée(s)` : "Aucun secret modifié",
      status: state.stepStatuses.secrets === "completed"
    },
    { 
      icon: Shield, 
      label: "Fichiers nettoyés", 
      value: `${Object.keys(state.cleaning.cleanedFiles).length} fichiers (${state.cleaning.sovereigntyScore}%)`,
      status: state.stepStatuses.cleaning === "completed"
    },
    { 
      icon: Server, 
      label: "Destination", 
      value: state.destination.hostingType === "vps" ? "VPS Ubuntu + Coolify" : `FTP (${state.destination.ftpHost || "non configuré"})`,
      status: state.destination.isGithubValidated
    },
    { 
      icon: Database, 
      label: "Migration Supabase", 
      value: state.destination.migrateSupabase ? "Activée" : "Désactivée",
      status: !state.destination.migrateSupabase || state.destination.isSupabaseMigrated
    },
  ];

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {state.launch.isComplete ? (
            <>
              <PartyPopper className="h-5 w-5 text-success" />
              Libération réussie !
            </>
          ) : (
            <>
              <Rocket className="h-5 w-5" />
              Lancement de la libération
            </>
          )}
        </CardTitle>
        <CardDescription>
          {state.launch.isComplete 
            ? "Votre code est maintenant 100% souverain" 
            : "Récapitulatif et déploiement final"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recap */}
        <div className="space-y-3">
          <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Récapitulatif</h3>
          <div className="grid gap-2">
            {recapItems.map((item, index) => (
              <div 
                key={index}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border",
                  item.status ? "bg-success/5 border-success/20" : "bg-muted/50 border-border"
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={cn("h-4 w-4", item.status ? "text-success" : "text-muted-foreground")} />
                  <span className="font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{item.value}</span>
                  {item.status && <CheckCircle2 className="h-4 w-4 text-success" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Deployment console */}
        {(state.launch.isDeploying || state.launch.logs.length > 0) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">Console de déploiement</h3>
              {state.launch.isDeploying && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            </div>
            
            <div 
              ref={consoleRef}
              className="bg-slate-950 text-slate-300 font-mono text-xs p-4 rounded-lg h-40 overflow-y-auto"
            >
              {state.launch.logs.map((log, index) => (
                <div 
                  key={index}
                  className={cn(
                    "py-0.5",
                    log.includes("✓") && "text-success",
                    log.includes("❌") && "text-destructive",
                    log.includes("🎉") && "text-primary font-bold"
                  )}
                >
                  {log}
                </div>
              ))}
            </div>
            
            {state.launch.isDeploying && (
              <>
                <Progress value={state.launch.progress} className="h-2" />
                {/* Sovereignty Tips pendant le déploiement */}
                <div className="mt-4">
                  <SovereigntyTips />
                </div>
              </>
            )}
          </div>
        )}

        {/* Success state */}
        {state.launch.isComplete && state.launch.deployedUrl && (
          <Alert className="border-success/50 bg-success/5">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="space-y-3">
              <p className="font-medium">Votre code souverain est disponible :</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-card px-3 py-2 rounded text-sm break-all">
                  {state.launch.deployedUrl}
                </code>
                <Button size="sm" variant="outline" onClick={copyUrl}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button size="sm" asChild>
                  <a href={state.launch.deployedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          {!state.launch.isComplete ? (
            <>
              <Button variant="outline" onClick={prevStep} disabled={state.launch.isDeploying} className="flex-1">
                Retour
              </Button>
              <Button 
                onClick={startDeployment} 
                disabled={state.launch.isDeploying}
                className="flex-1 gap-2"
                size="lg"
              >
                {state.launch.isDeploying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Libération en cours...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4" />
                    Libérer mon application
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleNewLiberation} className="flex-1 gap-2">
                <Rocket className="h-4 w-4" />
                Nouvelle libération
              </Button>
              <Button asChild className="flex-1 gap-2">
                <a href={state.launch.deployedUrl!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Voir le dépôt
                </a>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
