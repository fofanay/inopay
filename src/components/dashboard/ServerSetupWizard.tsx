import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Server, 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Copy, 
  ExternalLink,
  RefreshCw,
  Loader2,
  Terminal,
  Shield,
  Rocket
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ServerData {
  id: string;
  name: string;
  ip_address: string;
  status: string;
  provider: string | null;
  coolify_url: string | null;
  coolify_token: string | null;
  setup_id: string | null;
  error_message: string | null;
}

interface ServerSetupWizardProps {
  server: ServerData;
  onRefresh: () => void;
}

const SETUP_STEPS = [
  {
    id: 1,
    title: "Connexion SSH",
    description: "Connectez-vous à votre VPS via SSH",
    detail: "ssh root@{ip}",
  },
  {
    id: 2,
    title: "Exécuter le script",
    description: "Copiez et exécutez le script d'installation",
    detail: "Script d'installation automatique",
  },
  {
    id: 3,
    title: "Attendre l'installation",
    description: "L'installation prend environ 5-10 minutes",
    detail: "Docker, Coolify, et configurations réseau",
  },
  {
    id: 4,
    title: "Vérification",
    description: "Le serveur sera automatiquement détecté comme prêt",
    detail: "Healthcheck automatique",
  },
];

export function ServerSetupWizard({ server, onRefresh }: ServerSetupWizardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showScript, setShowScript] = useState(false);

  const getCurrentStep = () => {
    switch (server.status) {
      case "ready":
        return 5; // All done
      case "installing":
        return 3;
      case "error":
        return 0;
      default:
        return 1; // pending
    }
  };

  const currentStep = getCurrentStep();
  const progressPercent = Math.min((currentStep / 4) * 100, 100);

  const handleCopyIP = () => {
    navigator.clipboard.writeText(server.ip_address);
    toast.success("Adresse IP copiée");
  };

  const handleCopySSH = () => {
    navigator.clipboard.writeText(`ssh root@${server.ip_address}`);
    toast.success("Commande SSH copiée");
  };

  const handleCopyScript = () => {
    const scriptUrl = `curl -fsSL https://izqveyvcebolrqpqlmho.supabase.co/functions/v1/serve-setup-script?setup_id=${server.setup_id} | bash`;
    navigator.clipboard.writeText(scriptUrl);
    toast.success("Script copié dans le presse-papiers");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Check server status via edge function
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase.functions.invoke("check-server-status", {
          body: { server_id: server.id },
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        });
      }
      onRefresh();
      toast.success("Statut actualisé");
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (server.status === "ready") {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-success">Serveur opérationnel</h3>
              <p className="text-sm text-muted-foreground">
                {server.name} ({server.ip_address}) est prêt à recevoir des déploiements
              </p>
            </div>
            {server.coolify_url && (
              <Button variant="outline" size="sm" asChild className="gap-2">
                <a href={server.coolify_url} target="_blank" rel="noopener noreferrer">
                  Ouvrir Coolify
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (server.status === "error") {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-destructive">Erreur de configuration</CardTitle>
              <CardDescription>
                Un problème est survenu lors de l'installation
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {server.error_message && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
              <p className="text-sm text-destructive font-mono">{server.error_message}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Réessayer la vérification
            </Button>
            <Button variant="ghost" onClick={handleCopySSH}>
              <Terminal className="h-4 w-4 mr-2" />
              SSH vers le serveur
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Server className="h-5 w-5 text-warning" />
            </div>
            <div>
              <CardTitle>Configuration de {server.name}</CardTitle>
              <CardDescription>
                Suivez ces étapes pour finaliser l'installation
              </CardDescription>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Progress value={progressPercent} className="h-2 mt-4" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server Info */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-background border border-border">
          <Badge variant="outline">{server.provider || "VPS"}</Badge>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono">{server.ip_address}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyIP}>
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {SETUP_STEPS.map((step) => {
            const isCompleted = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            
            return (
              <div 
                key={step.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-all",
                  isCompleted && "bg-success/5 border border-success/20",
                  isCurrent && "bg-primary/5 border border-primary/20",
                  !isCompleted && !isCurrent && "bg-muted/30 border border-border opacity-60"
                )}
              >
                <div className={cn(
                  "shrink-0 mt-0.5 p-1 rounded-full",
                  isCompleted && "bg-success/10",
                  isCurrent && "bg-primary/10 animate-pulse"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : isCurrent ? (
                    <Circle className="h-4 w-4 text-primary fill-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "font-medium text-sm",
                      isCompleted && "text-success",
                      isCurrent && "text-primary"
                    )}>
                      {step.title}
                    </span>
                    {isCurrent && (
                      <Badge className="bg-primary/10 text-primary border-0 text-xs">
                        En cours
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                  
                  {/* Action buttons for current step */}
                  {isCurrent && step.id === 1 && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="mt-2 gap-2"
                      onClick={handleCopySSH}
                    >
                      <Copy className="h-3 w-3" />
                      Copier: ssh root@{server.ip_address}
                    </Button>
                  )}
                  
                  {isCurrent && step.id === 2 && server.setup_id && (
                    <div className="mt-2 space-y-2">
                      <Button 
                        size="sm" 
                        className="gap-2"
                        onClick={handleCopyScript}
                      >
                        <Copy className="h-3 w-3" />
                        Copier le script d'installation
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Collez cette commande dans votre terminal SSH
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Help section */}
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-sm mb-1">Besoin d'aide ?</h4>
              <p className="text-xs text-muted-foreground">
                Assurez-vous que le port 22 (SSH) est ouvert sur votre serveur. 
                L'installation configure automatiquement Docker, Coolify et les certificats SSL.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
