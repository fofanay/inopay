import { useState, useEffect } from "react";
import { 
  RefreshCw, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  GitBranch,
  ExternalLink,
  Settings,
  History,
  Power,
  PowerOff,
  Smartphone
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SyncSetupWizard } from "./SyncSetupWizard";
import { SyncHistory } from "./SyncHistory";
import { WidgetManager } from "./WidgetManager";

interface SyncConfig {
  id: string;
  deployment_id: string;
  github_repo_url: string;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_commit: string | null;
  last_sync_error: string | null;
  sync_count: number;
  allowed_branches: string[];
  widget_token: string | null;
  server_deployments?: {
    project_name: string;
    deployed_url: string | null;
    status: string;
  };
}

interface Deployment {
  id: string;
  project_name: string;
  deployed_url: string | null;
  status: string;
  github_repo_url: string | null;
  coolify_app_uuid: string | null;
}

export function SyncMirror() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [syncConfigs, setSyncConfigs] = useState<SyncConfig[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedConfigForHistory, setSelectedConfigForHistory] = useState<string | null>(null);
  const [showWidgetManager, setShowWidgetManager] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch sync configurations
      const { data: configs, error: configError } = await supabase
        .from("sync_configurations")
        .select(`
          *,
          server_deployments(project_name, deployed_url, status)
        `)
        .order("created_at", { ascending: false });

      if (configError) throw configError;

      // Fetch deployments that can be synced (have GitHub repo and Coolify)
      const { data: deps, error: depError } = await supabase
        .from("server_deployments")
        .select("id, project_name, deployed_url, status, github_repo_url, coolify_app_uuid")
        .not("github_repo_url", "is", null)
        .not("coolify_app_uuid", "is", null)
        .eq("status", "deployed")
        .order("created_at", { ascending: false });

      if (depError) throw depError;

      setSyncConfigs(configs || []);
      setDeployments(deps || []);
    } catch (error) {
      console.error("Error fetching sync data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les configurations de synchronisation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSync = async (configId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("sync_configurations")
        .update({ sync_enabled: enabled })
        .eq("id", configId);

      if (error) throw error;

      setSyncConfigs(prev =>
        prev.map(c => (c.id === configId ? { ...c, sync_enabled: enabled } : c))
      );

      toast({
        title: enabled ? "Synchronisation activée" : "Synchronisation désactivée",
        description: enabled
          ? "Les modifications seront automatiquement déployées"
          : "La synchronisation automatique est en pause",
      });
    } catch (error) {
      console.error("Error toggling sync:", error);
      toast({
        title: "Erreur",
        description: "Impossible de modifier l'état de synchronisation",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "failed":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "processing":
      case "deploying":
        return <RefreshCw className="h-4 w-4 text-info animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success/20 text-success border-success/30">Complété</Badge>;
      case "failed":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Échoué</Badge>;
      case "processing":
        return <Badge className="bg-info/20 text-info border-info/30">En cours</Badge>;
      case "deploying":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Déploiement</Badge>;
      default:
        return <Badge className="bg-muted/20 text-muted-foreground border-muted/30">En attente</Badge>;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Jamais";
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeploymentsWithoutSync = () => {
    const syncedDeploymentIds = new Set(syncConfigs.map(c => c.deployment_id));
    return deployments.filter(d => !syncedDeploymentIds.has(d.id));
  };

  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    setSelectedDeployment(null);
    fetchData();
  };

  if (showHistory && selectedConfigForHistory) {
    return (
      <SyncHistory
        syncConfigId={selectedConfigForHistory}
        onBack={() => {
          setShowHistory(false);
          setSelectedConfigForHistory(null);
        }}
      />
    );
  }

  if (showSetupWizard && selectedDeployment) {
    return (
      <SyncSetupWizard
        deployment={selectedDeployment}
        onComplete={handleSetupComplete}
        onCancel={() => {
          setShowSetupWizard(false);
          setSelectedDeployment(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">Inopay Sync Mirror</CardTitle>
              <CardDescription>
                Synchronisation automatique entre Lovable et votre serveur privé
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-background/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">{syncConfigs.length}</p>
              <p className="text-sm text-muted-foreground">Projets configurés</p>
            </div>
            <div className="text-center p-4 bg-background/50 rounded-lg">
              <p className="text-3xl font-bold text-success">
                {syncConfigs.filter(c => c.sync_enabled).length}
              </p>
              <p className="text-sm text-muted-foreground">Sync actives</p>
            </div>
            <div className="text-center p-4 bg-background/50 rounded-lg">
              <p className="text-3xl font-bold text-info">
                {syncConfigs.reduce((sum, c) => sum + c.sync_count, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Total syncs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deployments without sync configured */}
      {getDeploymentsWithoutSync().length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Power className="h-5 w-5 text-primary" />
              Activer la Synchronisation Magique
            </CardTitle>
            <CardDescription>
              Ces déploiements peuvent être synchronisés automatiquement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getDeploymentsWithoutSync().map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <GitBranch className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{deployment.project_name}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-xs">
                        {deployment.github_repo_url}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedDeployment(deployment);
                      setShowSetupWizard(true);
                    }}
                    className="gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Configurer
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Sync Configurations */}
      {syncConfigs.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-success" />
              Configurations actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {syncConfigs.map((config) => (
                <div
                  key={config.id}
                  className={`p-4 rounded-lg border transition-colors ${
                    config.sync_enabled
                      ? "bg-success/5 border-success/30"
                      : "bg-muted/30 border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(config.last_sync_status)}
                        <span className="font-medium">
                          {config.server_deployments?.project_name || "Projet"}
                        </span>
                        {getStatusBadge(config.last_sync_status)}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {config.github_repo_url}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Dernière sync: {formatDate(config.last_sync_at)}</span>
                        <span>•</span>
                        <span>{config.sync_count} synchronisation(s)</span>
                        {config.last_sync_commit && (
                          <>
                            <span>•</span>
                            <span className="font-mono">
                              {config.last_sync_commit.substring(0, 7)}
                            </span>
                          </>
                        )}
                      </div>
                      {config.last_sync_error && (
                        <p className="text-sm text-destructive mt-2">
                          Erreur: {config.last_sync_error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowWidgetManager(showWidgetManager === config.id ? null : config.id)}
                        className={showWidgetManager === config.id ? "bg-primary/10" : ""}
                      >
                        <Smartphone className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedConfigForHistory(config.id);
                          setShowHistory(true);
                        }}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      {config.server_deployments?.deployed_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            window.open(config.server_deployments?.deployed_url!, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      <div className="flex items-center gap-2">
                        {config.sync_enabled ? (
                          <Power className="h-4 w-4 text-success" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        <Switch
                          checked={config.sync_enabled}
                          onCheckedChange={(checked) => toggleSync(config.id, checked)}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Widget Manager Panel */}
                  {showWidgetManager === config.id && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <WidgetManager
                        syncConfigId={config.id}
                        currentToken={config.widget_token}
                        onTokenUpdate={(newToken) => {
                          setSyncConfigs(prev =>
                            prev.map(c => (c.id === config.id ? { ...c, widget_token: newToken } : c))
                          );
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        !loading &&
        getDeploymentsWithoutSync().length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <Zap className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Aucun déploiement compatible</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Pour utiliser Sync Mirror, vous devez d'abord déployer un projet via Coolify avec un
                dépôt GitHub lié.
              </p>
            </CardContent>
          </Card>
        )
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Comment ça marche ?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-2">
                1
              </div>
              <p className="text-sm font-medium">Modifiez sur Lovable</p>
              <p className="text-xs text-muted-foreground">Codez par chat comme d'habitude</p>
            </div>
            <div className="text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-2">
                2
              </div>
              <p className="text-sm font-medium">Push vers GitHub</p>
              <p className="text-xs text-muted-foreground">Lovable synchronise automatiquement</p>
            </div>
            <div className="text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-2">
                3
              </div>
              <p className="text-sm font-medium">Nettoyage intelligent</p>
              <p className="text-xs text-muted-foreground">Inopay supprime les verrous</p>
            </div>
            <div className="text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto mb-2">
                4
              </div>
              <p className="text-sm font-medium">Déploiement auto</p>
              <p className="text-xs text-muted-foreground">Mise à jour sans interruption</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SyncMirror;
