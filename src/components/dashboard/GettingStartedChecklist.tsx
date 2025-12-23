import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Circle, 
  Github, 
  Server, 
  FileText, 
  Rocket,
  User,
  Crown,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  icon: typeof CheckCircle2;
  completed: boolean;
  action?: () => void;
  actionLabel?: string;
}

interface GettingStartedChecklistProps {
  onNavigate: (tab: string) => void;
  onGitHubConnect: () => void;
}

export function GettingStartedChecklist({ onNavigate, onGitHubConnect }: GettingStartedChecklistProps) {
  const { user, subscription } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [steps, setSteps] = useState<ChecklistStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkProgress = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        // Check GitHub connection (OAuth OR PAT)
        const { data: sessionData } = await supabase.auth.getSession();
        const hasOAuthToken = !!sessionData.session?.provider_token;
        
        // Also check for PAT in user_settings
        const { data: settings } = await supabase
          .from("user_settings")
          .select("github_token")
          .eq("user_id", user.id)
          .maybeSingle();
        
        const hasPAT = !!settings?.github_token;
        const hasGitHubToken = hasOAuthToken || hasPAT;

        // Check servers
        const { data: servers } = await supabase
          .from("user_servers")
          .select("id, status")
          .eq("user_id", user.id);
        
        const hasReadyServer = servers?.some(s => s.status === "ready") || false;
        const hasAnyServer = (servers?.length || 0) > 0;

        // Check projects
        const { data: projects } = await supabase
          .from("projects_analysis")
          .select("id")
          .eq("user_id", user.id);
        
        const hasProjects = (projects?.length || 0) > 0;

        // Check deployments
        const { data: deployments } = await supabase
          .from("deployment_history")
          .select("id")
          .eq("user_id", user.id);
        
        const hasDeployments = (deployments?.length || 0) > 0;

        // Check subscription
        const hasPaidPlan = subscription.planType !== "free" && subscription.subscribed;

        setSteps([
          {
            id: "account",
            title: "Créer un compte",
            description: "Inscrivez-vous sur Inopay",
            icon: User,
            completed: true, // Always true if logged in
          },
          {
            id: "subscription",
            title: "Activer un plan",
            description: hasPaidPlan 
              ? `Plan ${subscription.planType.toUpperCase()} actif` 
              : "Passez à un plan Pro ou Portfolio",
            icon: Crown,
            completed: hasPaidPlan,
            action: () => window.location.href = "/tarifs",
            actionLabel: "Voir les plans",
          },
          {
            id: "github",
            title: "Connecter GitHub",
            description: hasGitHubToken 
              ? "GitHub connecté avec succès" 
              : "Configurez votre Personal Access Token GitHub",
            icon: Github,
            completed: hasGitHubToken,
            action: () => onNavigate("sovereign-deploy"),
            actionLabel: "Configurer",
          },
          {
            id: "server",
            title: "Configurer un serveur",
            description: hasReadyServer 
              ? "Serveur opérationnel" 
              : hasAnyServer 
                ? "Serveur en attente de configuration" 
                : "Ajoutez votre premier serveur VPS",
            icon: Server,
            completed: hasReadyServer,
            action: () => onNavigate("servers"),
            actionLabel: hasAnyServer ? "Configurer" : "Ajouter",
          },
          {
            id: "analyze",
            title: "Analyser un projet",
            description: hasProjects 
              ? `${projects?.length} projet(s) analysé(s)` 
              : "Importez et analysez votre premier projet",
            icon: FileText,
            completed: hasProjects,
            action: () => onNavigate("import"),
            actionLabel: "Importer",
          },
          {
            id: "deploy",
            title: "Déployer un projet",
            description: hasDeployments 
              ? `${deployments?.length} déploiement(s) effectué(s)` 
              : "Déployez votre premier projet libéré",
            icon: Rocket,
            completed: hasDeployments,
            action: () => onNavigate("projects"),
            actionLabel: "Déployer",
          },
        ]);
      } catch (error) {
        console.error("Error checking progress:", error);
      } finally {
        setLoading(false);
      }
    };

    checkProgress();
  }, [user, subscription, onNavigate, onGitHubConnect]);

  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const allCompleted = completedCount === totalCount;

  // Don't show if all steps completed
  if (allCompleted && !loading) {
    return null;
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-md animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-6 bg-muted rounded w-1/3" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Guide de démarrage</CardTitle>
                <CardDescription>
                  {completedCount}/{totalCount} étapes complétées
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1">
                {Math.round(progressPercent)}%
              </Badge>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2 mt-3" />
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg transition-all",
                    step.completed 
                      ? "bg-success/5 border border-success/20" 
                      : "bg-muted/30 border border-border hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "shrink-0 p-2 rounded-full",
                    step.completed ? "bg-success/10" : "bg-muted"
                  )}>
                    {step.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <step.icon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "font-medium text-sm",
                        step.completed ? "text-success" : "text-foreground"
                      )}>
                        {step.title}
                      </span>
                      {step.completed && (
                        <Badge variant="outline" className="text-[10px] py-0 bg-success/10 text-success border-success/20">
                          Terminé
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {step.description}
                    </p>
                  </div>

                  {!step.completed && step.action && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={step.action}
                      className="shrink-0 gap-1 text-xs"
                    >
                      {step.actionLabel}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
