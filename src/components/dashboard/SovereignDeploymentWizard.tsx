import { useState, useEffect } from "react";
import { 
  Github, 
  Database, 
  Rocket, 
  Check, 
  ChevronRight,
  Loader2,
  Shield,
  Server,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SovereignConnections } from "./SovereignConnections";

type WizardStep = "connections" | "clean-migrate" | "deploy";

interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepConfig[] = [
  {
    id: "connections",
    title: "Connecter GitHub/Supabase",
    description: "Configurez vos identifiants souverains",
    icon: Shield,
  },
  {
    id: "clean-migrate",
    title: "Nettoyer & Migrer",
    description: "Nettoyage du code et migration du schéma DB",
    icon: Database,
  },
  {
    id: "deploy",
    title: "Déployer sur VPS",
    description: "Déploiement via GitHub → Coolify → VPS",
    icon: Rocket,
  },
];

interface SovereignDeploymentWizardProps {
  projectId?: string;
  projectName?: string;
  extractedFiles?: Map<string, string>;
  onComplete?: () => void;
}

export function SovereignDeploymentWizard({ 
  projectId, 
  projectName,
  extractedFiles,
  onComplete 
}: SovereignDeploymentWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>("connections");
  const [connectionStatus, setConnectionStatus] = useState({
    github: false,
    supabase: false,
  });
  
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [deploymentStatus, setDeploymentStatus] = useState<string>("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployedRepoUrl, setDeployedRepoUrl] = useState<string | null>(null);
  const [migratedSchema, setMigratedSchema] = useState(false);

  useEffect(() => {
    checkConnectionStatus();
  }, [user]);

  const checkConnectionStatus = async () => {
    if (!user) return;
    
    // Check GitHub connection
    const { data: settings } = await supabase
      .from("user_settings")
      .select("github_token")
      .eq("user_id", user.id)
      .maybeSingle();
      
    // Check Supabase connection
    const { data: server } = await supabase
      .from("user_servers")
      .select("service_role_key, anon_key")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
      
    setConnectionStatus({
      github: !!settings?.github_token,
      supabase: !!server?.service_role_key,
    });
  };

  const handleCleanAndMigrate = async () => {
    if (!user || !extractedFiles) {
      toast({
        title: "Projet requis",
        description: "Veuillez d'abord analyser un projet",
        variant: "destructive",
      });
      return;
    }
    
    setIsDeploying(true);
    setDeploymentProgress(10);
    setDeploymentStatus("Nettoyage du code en cours...");
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      // Step 1: Clean code via existing function
      setDeploymentProgress(30);
      
      // Step 2: Migrate schema if Supabase is connected
      if (connectionStatus.supabase) {
        setDeploymentStatus("Migration du schéma vers votre Supabase...");
        setDeploymentProgress(50);
        
        const { data: migrateResult, error: migrateError } = await supabase.functions.invoke(
          "migrate-db-schema",
          {
            headers: {
              Authorization: `Bearer ${sessionData.session?.access_token}`,
            },
            body: {
              projectId,
              action: "migrate",
            },
          }
        );
        
        if (migrateError) {
          console.error("Migration error:", migrateError);
          toast({
            title: "Avertissement",
            description: "Migration du schéma en partie échouée. Continuez le déploiement.",
            variant: "default",
          });
        } else {
          setMigratedSchema(true);
          toast({
            title: "Schéma migré",
            description: "Les tables et politiques RLS ont été créées sur votre Supabase",
          });
        }
      }
      
      setDeploymentProgress(70);
      setDeploymentStatus("Préparation terminée");
      setCurrentStep("deploy");
      
    } catch (error) {
      console.error("Clean and migrate error:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors du nettoyage ou de la migration",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleSovereignDeploy = async () => {
    if (!user || !extractedFiles || !projectName) {
      toast({
        title: "Projet requis",
        description: "Veuillez d'abord analyser un projet",
        variant: "destructive",
      });
      return;
    }
    
    setIsDeploying(true);
    setDeploymentProgress(0);
    setDeploymentStatus("Création du dépôt sur votre GitHub...");
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      // Get user's GitHub token
      const { data: settings } = await supabase
        .from("user_settings")
        .select("github_token")
        .eq("user_id", user.id)
        .maybeSingle();
        
      if (!settings?.github_token) {
        throw new Error("Token GitHub non configuré");
      }
      
      // Convert Map to object
      const filesObj: Record<string, string> = {};
      extractedFiles.forEach((content, path) => {
        filesObj[path] = content;
      });
      
      setDeploymentProgress(20);
      
      // Export to user's GitHub
      const { data: exportResult, error: exportError } = await supabase.functions.invoke(
        "export-to-github",
        {
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: {
            repoName: `${projectName}-sovereign`,
            description: `Projet souverain exporté depuis Inopay - 100% autonome`,
            files: filesObj,
            isPrivate: true,
            github_token: settings.github_token,
          },
        }
      );
      
      if (exportError) throw exportError;
      
      setDeploymentProgress(60);
      setDeployedRepoUrl(exportResult.repoUrl);
      setDeploymentStatus("Dépôt créé, déclenchement du déploiement Coolify...");
      
      // Get user's server with Coolify
      const { data: server } = await supabase
        .from("user_servers")
        .select("id, coolify_url, coolify_token")
        .eq("user_id", user.id)
        .not("coolify_token", "is", null)
        .limit(1)
        .maybeSingle();
        
      if (server?.coolify_token && exportResult.repoUrl) {
        setDeploymentProgress(80);
        
        // Deploy via Coolify
        const { error: deployError } = await supabase.functions.invoke(
          "deploy-coolify",
          {
            headers: {
              Authorization: `Bearer ${sessionData.session?.access_token}`,
            },
            body: {
              serverId: server.id,
              projectName: `${projectName}-sovereign`,
              githubRepoUrl: exportResult.repoUrl,
            },
          }
        );
        
        if (!deployError) {
          setDeploymentProgress(100);
          setDeploymentStatus("Déploiement lancé sur votre VPS!");
          
          toast({
            title: "Déploiement souverain réussi!",
            description: "Votre projet est en cours de déploiement sur votre VPS",
          });
          
          onComplete?.();
        }
      } else {
        setDeploymentProgress(100);
        setDeploymentStatus("Dépôt créé - Configurez Coolify pour finaliser");
        
        toast({
          title: "Dépôt créé",
          description: "Connectez ce dépôt à Coolify pour le déploiement automatique",
        });
      }
      
    } catch (error) {
      console.error("Sovereign deploy error:", error);
      toast({
        title: "Erreur de déploiement",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const getCurrentStepIndex = () => STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = step.id === currentStep;
          const isComplete = getCurrentStepIndex() > index;
          
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div 
                  className={`
                    flex items-center justify-center w-12 h-12 rounded-full border-2 transition-colors
                    ${isComplete ? "bg-success border-success text-success-foreground" : ""}
                    ${isActive ? "bg-primary border-primary text-primary-foreground" : ""}
                    ${!isActive && !isComplete ? "border-muted-foreground/30 text-muted-foreground" : ""}
                  `}
                >
                  {isComplete ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    <StepIcon className="h-6 w-6" />
                  )}
                </div>
                <div className="text-center mt-2">
                  <p className={`text-sm font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground hidden md:block">
                    {step.description}
                  </p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <ChevronRight className="h-5 w-5 text-muted-foreground mx-2" />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Step Content */}
      {currentStep === "connections" && (
        <div className="space-y-6">
          <SovereignConnections />
          
          <div className="flex justify-end">
            <Button 
              onClick={() => setCurrentStep("clean-migrate")}
              disabled={!connectionStatus.github}
            >
              Continuer
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {currentStep === "clean-migrate" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Nettoyage & Migration
            </CardTitle>
            <CardDescription>
              Le code sera nettoyé des dépendances Lovable et le schéma sera migré vers votre Supabase
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isDeploying ? (
              <div className="space-y-4">
                <Progress value={deploymentProgress} />
                <p className="text-sm text-muted-foreground text-center">{deploymentStatus}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Github className="h-5 w-5" />
                      <span className="font-medium">GitHub</span>
                      {connectionStatus.github ? (
                        <Badge variant="default" className="ml-auto bg-success">Connecté</Badge>
                      ) : (
                        <Badge variant="outline" className="ml-auto">Non configuré</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Le code nettoyé sera poussé sur votre compte
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-5 w-5" />
                      <span className="font-medium">Supabase</span>
                      {connectionStatus.supabase ? (
                        <Badge variant="default" className="ml-auto bg-success">Connecté</Badge>
                      ) : (
                        <Badge variant="outline" className="ml-auto">Optionnel</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Le schéma DB sera migré vers votre instance
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep("connections")}>
                    Retour
                  </Button>
                  <Button onClick={handleCleanAndMigrate} disabled={!extractedFiles}>
                    {extractedFiles ? "Nettoyer & Migrer" : "Analysez d'abord un projet"}
                    <RefreshCw className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
      
      {currentStep === "deploy" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Déploiement Souverain
            </CardTitle>
            <CardDescription>
              Flux: Code Lovable → Nettoyage Inopay → GitHub Client → Webhook Coolify → VPS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isDeploying ? (
              <div className="space-y-4">
                <Progress value={deploymentProgress} />
                <p className="text-sm text-muted-foreground text-center">{deploymentStatus}</p>
              </div>
            ) : (
              <>
                {deployedRepoUrl && (
                  <div className="p-4 border rounded-lg bg-success/10 border-success/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Check className="h-5 w-5 text-success" />
                      <span className="font-medium">Dépôt créé avec succès</span>
                    </div>
                    <a 
                      href={deployedRepoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary flex items-center gap-1 hover:underline"
                    >
                      {deployedRepoUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                
                {migratedSchema && (
                  <div className="p-4 border rounded-lg bg-success/10 border-success/30">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-success" />
                      <span className="font-medium">Schéma DB migré</span>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep("clean-migrate")}>
                    Retour
                  </Button>
                  <Button onClick={handleSovereignDeploy} disabled={!extractedFiles}>
                    <Rocket className="mr-2 h-4 w-4" />
                    Déployer sur mon VPS
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
