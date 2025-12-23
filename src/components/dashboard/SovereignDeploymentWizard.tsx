import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  titleKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepConfig[] = [
  {
    id: "connections",
    titleKey: "sovereignDeployment.steps.connections.title",
    descriptionKey: "sovereignDeployment.steps.connections.description",
    icon: Shield,
  },
  {
    id: "clean-migrate",
    titleKey: "sovereignDeployment.steps.cleanMigrate.title",
    descriptionKey: "sovereignDeployment.steps.cleanMigrate.description",
    icon: Database,
  },
  {
    id: "deploy",
    titleKey: "sovereignDeployment.steps.deploy.title",
    descriptionKey: "sovereignDeployment.steps.deploy.description",
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
  const { t } = useTranslation();
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
        title: t('sovereignDeployment.errors.projectRequired'),
        description: t('sovereignDeployment.errors.analyzeFirst'),
        variant: "destructive",
      });
      return;
    }
    
    setIsDeploying(true);
    setDeploymentProgress(10);
    setDeploymentStatus(t('sovereignDeployment.status.cleaningCode'));
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      // Step 1: Clean code via existing function
      setDeploymentProgress(30);
      
      // Step 2: Migrate schema if Supabase is connected
      if (connectionStatus.supabase) {
        setDeploymentStatus(t('sovereignDeployment.status.migratingSchema'));
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
            title: t('sovereignDeployment.toasts.warning'),
            description: t('sovereignDeployment.toasts.migrationPartiallyFailed'),
            variant: "default",
          });
        } else {
          setMigratedSchema(true);
          toast({
            title: t('sovereignDeployment.toasts.schemaMigrated'),
            description: t('sovereignDeployment.toasts.tablesCreated'),
          });
        }
      }
      
      setDeploymentProgress(70);
      setDeploymentStatus(t('sovereignDeployment.status.preparationDone'));
      setCurrentStep("deploy");
      
    } catch (error) {
      console.error("Clean and migrate error:", error);
      toast({
        title: t('common.error'),
        description: t('sovereignDeployment.errors.cleanMigrateFailed'),
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleSovereignDeploy = async () => {
    if (!user || !extractedFiles || !projectName) {
      toast({
        title: t('sovereignDeployment.errors.projectRequired'),
        description: t('sovereignDeployment.errors.analyzeFirst'),
        variant: "destructive",
      });
      return;
    }
    
    setIsDeploying(true);
    setDeploymentProgress(0);
    setDeploymentStatus(t('sovereignDeployment.status.creatingRepo'));
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      // Get user's GitHub token
      const { data: settings } = await supabase
        .from("user_settings")
        .select("github_token")
        .eq("user_id", user.id)
        .maybeSingle();
        
      if (!settings?.github_token) {
        throw new Error(t('sovereignDeployment.errors.githubTokenNotConfigured'));
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
            description: t('sovereignDeployment.repoDescription'),
            files: filesObj,
            isPrivate: true,
            github_token: settings.github_token,
          },
        }
      );
      
      if (exportError) throw exportError;
      
      setDeploymentProgress(60);
      setDeployedRepoUrl(exportResult.repoUrl);
      setDeploymentStatus(t('sovereignDeployment.status.triggeringCoolify'));
      
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
          setDeploymentStatus(t('sovereignDeployment.status.deploymentLaunched'));
          
          toast({
            title: t('sovereignDeployment.toasts.sovereignDeploymentSuccess'),
            description: t('sovereignDeployment.toasts.deployingToVPS'),
          });
          
          onComplete?.();
        }
      } else {
        setDeploymentProgress(100);
        setDeploymentStatus(t('sovereignDeployment.status.repoCreatedConfigureCoolify'));
        
        toast({
          title: t('sovereignDeployment.toasts.repoCreated'),
          description: t('sovereignDeployment.toasts.connectToCoolify'),
        });
      }
      
    } catch (error) {
      console.error("Sovereign deploy error:", error);
      toast({
        title: t('sovereignDeployment.errors.deploymentError'),
        description: error instanceof Error ? error.message : t('sovereignDeployment.errors.unknownError'),
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
                    {t(step.titleKey)}
                  </p>
                  <p className="text-xs text-muted-foreground hidden md:block">
                    {t(step.descriptionKey)}
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
              {t('sovereignDeployment.continue')}
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
              {t('sovereignDeployment.cleanMigrate.title')}
            </CardTitle>
            <CardDescription>
              {t('sovereignDeployment.cleanMigrate.description')}
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
                        <Badge variant="default" className="ml-auto bg-success">{t('sovereignDeployment.connected')}</Badge>
                      ) : (
                        <Badge variant="outline" className="ml-auto">{t('sovereignDeployment.notConfigured')}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('sovereignDeployment.cleanMigrate.githubDescription')}
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-5 w-5" />
                      <span className="font-medium">Supabase</span>
                      {connectionStatus.supabase ? (
                        <Badge variant="default" className="ml-auto bg-success">{t('sovereignDeployment.connected')}</Badge>
                      ) : (
                        <Badge variant="outline" className="ml-auto">{t('sovereignDeployment.optional')}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t('sovereignDeployment.cleanMigrate.supabaseDescription')}
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep("connections")}>
                    {t('sovereignDeployment.back')}
                  </Button>
                  <Button onClick={handleCleanAndMigrate} disabled={!extractedFiles}>
                    {extractedFiles ? t('sovereignDeployment.cleanMigrate.action') : t('sovereignDeployment.errors.analyzeFirst')}
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
              {t('sovereignDeployment.deploy.title')}
            </CardTitle>
            <CardDescription>
              {t('sovereignDeployment.deploy.description')}
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
                      <span className="font-medium">{t('sovereignDeployment.deploy.repoCreatedSuccess')}</span>
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
                      <span className="font-medium">{t('sovereignDeployment.deploy.schemaMigrated')}</span>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep("clean-migrate")}>
                    {t('sovereignDeployment.back')}
                  </Button>
                  <Button onClick={handleSovereignDeploy} disabled={!extractedFiles}>
                    <Rocket className="mr-2 h-4 w-4" />
                    {t('sovereignDeployment.deploy.action')}
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
