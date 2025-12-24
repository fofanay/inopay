import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecretsCleanupButton } from "./SecretsCleanupButton";
import { CoolifyOrphansCleanupButton } from "./CoolifyOrphansCleanupButton";
import { PurgeDeploymentsButton } from "./PurgeDeploymentsButton";
import { 
  Rocket, 
  ExternalLink, 
  Clock, 
  Server,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  FileText,
  RotateCcw,
  CheckCircle2
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";

interface ServerDeployment {
  id: string;
  project_name: string;
  status: string;
  deployed_url: string | null;
  created_at: string;
  server_id: string;
  secrets_cleaned: boolean;
  secrets_cleaned_at: string | null;
  health_status: string | null;
  last_health_check: string | null;
  error_message: string | null;
  github_repo_url: string | null;
  domain: string | null;
  coolify_app_uuid: string | null;
  retry_count: number | null;
  last_retry_at: string | null;
  user_servers: {
    name: string;
    ip_address: string;
  } | null;
}

// Check if a deployment is stuck (deploying for more than 5 minutes)
const isDeploymentStuck = (deployment: ServerDeployment): boolean => {
  if (deployment.status !== 'deploying') return false;
  const createdAt = new Date(deployment.created_at).getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return (now - createdAt) > fiveMinutes;
};

// Retries: volontairement illimités (les causes d'échec sont visibles via les logs)
const canRetry = (_deployment: ServerDeployment): boolean => true;

export function ServerDeploymentsManager() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [deployments, setDeployments] = useState<ServerDeployment[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previousStatuses, setPreviousStatuses] = useState<Record<string, string>>({});
  
  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  const fetchDeployments = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("server_deployments")
        .select(`
          id,
          project_name,
          status,
          deployed_url,
          created_at,
          server_id,
          secrets_cleaned,
          secrets_cleaned_at,
          health_status,
          last_health_check,
          error_message,
          github_repo_url,
          domain,
          coolify_app_uuid,
          retry_count,
          last_retry_at,
          user_servers (
            name,
            ip_address
          )
        `)
        .eq('user_id', user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      const fetchedDeployments = data || [];
      setDeployments(fetchedDeployments);
      
      // Track initial statuses for realtime comparison
      const statuses: Record<string, string> = {};
      fetchedDeployments.forEach(d => {
        statuses[d.id] = d.status;
      });
      setPreviousStatuses(statuses);
    } catch (error) {
      console.error("Error fetching server deployments:", error);
      toast.error("Impossible de charger les déploiements serveur");
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('server-deployments-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'server_deployments',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const updated = payload.new as ServerDeployment;
          const previousStatus = previousStatuses[updated.id];
          
          // Show notification on status change
          if (previousStatus && previousStatus !== updated.status) {
            if (updated.status === 'deployed') {
              toast.success(`🚀 ${updated.project_name} déployé avec succès !`, {
                description: updated.deployed_url ? `Disponible sur ${updated.deployed_url}` : undefined,
                duration: 8000
              });
            } else if (updated.status === 'failed') {
              toast.error(`❌ Échec du déploiement de ${updated.project_name}`, {
                description: "Consultez les logs pour plus de détails",
                duration: 8000
              });
            }
          }
          
          // Update local state
          setDeployments(prev => 
            prev.map(d => d.id === updated.id ? { ...d, ...updated } : d)
          );
          setPreviousStatuses(prev => ({ ...prev, [updated.id]: updated.status }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'server_deployments',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newDeployment = payload.new as ServerDeployment;
          toast.info(`📦 Nouveau déploiement lancé: ${newDeployment.project_name}`);
          fetchDeployments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, previousStatuses]);

  useEffect(() => {
    fetchDeployments();
  }, [user]);

  const handleRetry = async (deployment: ServerDeployment) => {
    if (!deployment.github_repo_url) {
      toast.error("URL du repo GitHub manquante pour relancer le déploiement");
      return;
    }

    setRetryingId(deployment.id);
    
    try {
      const newRetryCount = (deployment.retry_count || 0) + 1;
      
      // Delete failed deployment record to avoid duplicates
      const { error: deleteError } = await supabase
        .from("server_deployments")
        .delete()
        .eq("id", deployment.id);

      if (deleteError) {
        console.warn("Could not delete old deployment record:", deleteError);
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Session expirée");
      }

      // Call deploy-coolify with the same parameters
      const response = await supabase.functions.invoke("deploy-coolify", {
        body: {
          server_id: deployment.server_id,
          project_name: deployment.project_name,
          github_repo_url: deployment.github_repo_url,
          domain: deployment.domain || undefined,
          retry_count: newRetryCount,
          is_retry: true
        }
      });

      if (response.error) {
        throw new Error(response.error.message || "Échec du redéploiement");
      }

      toast.success("Redéploiement lancé !");
      fetchDeployments();
    } catch (error) {
      console.error("Retry deployment error:", error);
      toast.error(error instanceof Error ? error.message : "Échec du redéploiement");
    } finally {
      setRetryingId(null);
    }
  };

  const handleSyncStatus = async (deployment: ServerDeployment) => {
    // Log deployment info for debugging
    console.log(`[handleSyncStatus] Syncing deployment:`, {
      id: deployment.id,
      project_name: deployment.project_name,
      coolify_app_uuid: deployment.coolify_app_uuid,
      current_status: deployment.status
    });

    setSyncingId(deployment.id);
    
    try {
      const response = await supabase.functions.invoke("sync-coolify-status", {
        body: { deployment_id: deployment.id }
      });

      if (response.error) {
        throw new Error(response.error.message || "Échec de la synchronisation");
      }

      const result = response.data;
      console.log(`[handleSyncStatus] Result:`, result);
      
      if (result.success) {
        // Build description based on result
        let description = '';
        if (result.app_not_found) {
          description = `App introuvable dans Coolify. `;
        }
        if (result.url_healthy) {
          description += `URL accessible (HTTP ${result.url_http_status || '2xx'})`;
        } else if (result.url_http_status) {
          description += `URL: HTTP ${result.url_http_status}`;
        } else {
          description += 'URL non testée';
        }

        toast.success(`Statut: ${result.new_status} / ${result.new_health_status}`, {
          description,
          duration: 5000
        });
        
        // Show warning if app not found in Coolify
        if (result.app_not_found) {
          toast.warning("Application introuvable dans Coolify", {
            description: "Le statut a été déterminé via le test URL uniquement. Considérez nettoyer les orphelins.",
            duration: 8000
          });
        }
        
        fetchDeployments();
      } else {
        throw new Error(result.error || "Échec de la synchronisation");
      }
    } catch (error) {
      console.error("Sync status error:", error);
      toast.error(error instanceof Error ? error.message : "Échec de la synchronisation");
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    if (deployments.length === 0) return;
    
    setSyncingAll(true);
    let successCount = 0;
    let errorCount = 0;
    
    console.log(`[handleSyncAll] Starting sync for ${deployments.length} deployments`);
    
    for (const deployment of deployments) {
      try {
        const response = await supabase.functions.invoke("sync-coolify-status", {
          body: { deployment_id: deployment.id }
        });

        if (response.error) {
          console.error(`[handleSyncAll] Error syncing ${deployment.project_name}:`, response.error);
          errorCount++;
        } else if (response.data?.success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`[handleSyncAll] Error syncing ${deployment.project_name}:`, error);
        errorCount++;
      }
    }
    
    setSyncingAll(false);
    fetchDeployments();
    
    if (errorCount === 0) {
      toast.success(`${successCount} déploiements synchronisés`);
    } else {
      toast.warning(`${successCount} synchronisés, ${errorCount} erreurs`);
    }
  };

  const getStatusBadge = (status: string, secretsCleaned: boolean) => {
    if (status === 'deployed' && secretsCleaned) {
      return (
        <Badge className="bg-success/10 text-success border-success/30 gap-1">
          <ShieldCheck className="h-3 w-3" />
          Zero-Knowledge
        </Badge>
      );
    }
    
    if (status === 'deployed') {
      return (
        <Badge variant="outline" className="gap-1 text-warning border-warning/30">
          <AlertTriangle className="h-3 w-3" />
          Secrets temporaires
        </Badge>
      );
    }

    switch (status) {
      case 'pending':
        return <Badge variant="outline">En attente</Badge>;
      case 'deploying':
        return <Badge className="bg-info/10 text-info border-info/30">Déploiement...</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échec</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStuckBadge = (deployment: ServerDeployment) => {
    if (!isDeploymentStuck(deployment)) return null;
    return (
      <Badge className="bg-warning/10 text-warning border-warning/30 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Bloqué
      </Badge>
    );
  };

  const getHealthBadge = (healthStatus: string | null) => {
    if (!healthStatus || healthStatus === 'unknown') return null;
    
    if (healthStatus === 'healthy') {
      return (
        <Badge variant="outline" className="text-success border-success/30 text-xs">
          En ligne
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
        Hors ligne
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  if (deployments.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Server className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">Aucun déploiement serveur</h3>
          <p className="text-sm text-muted-foreground">
            Vos déploiements VPS/Coolify apparaîtront ici
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get unique server IDs for cleanup button
  const uniqueServerIds = [...new Set(deployments.map(d => d.server_id))];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Déploiements Serveur
            </CardTitle>
            <CardDescription>
              Vos applications sur VPS avec statut Zero-Knowledge
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* Sync all button */}
            {deployments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncAll}
                disabled={syncingAll}
                className="gap-1"
              >
                {syncingAll ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Vérifier tout
              </Button>
            )}
            {/* Show purge button if there's at least one server */}
            {uniqueServerIds.length > 0 && (
              <PurgeDeploymentsButton
                serverId={uniqueServerIds[0]}
                onPurgeComplete={fetchDeployments}
              />
            )}
            {/* Show cleanup button if there's at least one server */}
            {uniqueServerIds.length > 0 && (
              <CoolifyOrphansCleanupButton
                serverId={uniqueServerIds[0]}
                onCleanupComplete={fetchDeployments}
              />
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchDeployments}
              className="gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {deployments.map((deployment) => (
            <div
              key={deployment.id}
              className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Rocket className="h-5 w-5 text-primary" />
                </div>
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground truncate">
                    {deployment.project_name}
                  </span>
                  {getStatusBadge(deployment.status, deployment.secrets_cleaned || false)}
                  {getStuckBadge(deployment)}
                  {getHealthBadge(deployment.health_status)}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                  <span>{deployment.user_servers?.name || 'Serveur inconnu'}</span>
                  <span>•</span>
                  <span>{deployment.user_servers?.ip_address}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(deployment.created_at), { 
                      addSuffix: true, 
                      locale: fr 
                    })}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {/* Sync status button - show for all deployments (will search by repo if no UUID) */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => handleSyncStatus(deployment)}
                  disabled={syncingId === deployment.id}
                  title={deployment.coolify_app_uuid 
                    ? `Vérifier le statut (UUID: ${deployment.coolify_app_uuid.substring(0, 8)}...)` 
                    : "Rechercher et vérifier le statut dans Coolify"
                  }
                >
                  {syncingId === deployment.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Vérifier
                </Button>

                {/* Show retry button for failed or stuck deployments */}
                {(deployment.status === 'failed' || isDeploymentStuck(deployment)) && deployment.github_repo_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1"
                    onClick={() => handleRetry(deployment)}
                    disabled={retryingId === deployment.id}
                    title={t("ui.retryDeployment")}
                  >
                    {retryingId === deployment.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    {t("serverManagement.retry")}
                  </Button>
                )}

                {/* Show logs button for failed deployments */}
                {deployment.status === 'failed' && deployment.error_message && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-destructive hover:text-destructive"
                      >
                        <FileText className="h-4 w-4" />
                        Logs
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle>Logs de build - {deployment.project_name}</DialogTitle>
                      </DialogHeader>

                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(deployment.error_message || "");
                              toast.success("Logs copiés");
                            } catch {
                              toast.error("Impossible de copier les logs");
                            }
                          }}
                        >
                          Copier
                        </Button>
                      </div>

                      <ScrollArea className="h-[60vh] rounded-md border p-4 bg-muted/50">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
                          {deployment.error_message}
                        </pre>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Cleanup button - only show if deployed and not cleaned */}
                {deployment.status === 'deployed' && !deployment.secrets_cleaned && (
                  <SecretsCleanupButton
                    deploymentId={deployment.id}
                    serverId={deployment.server_id}
                    secretsCleaned={deployment.secrets_cleaned || false}
                    deployedUrl={deployment.deployed_url}
                    onCleanupComplete={fetchDeployments}
                    compact
                  />
                )}
                
                {/* Open URL */}
                {deployment.deployed_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(deployment.deployed_url!, "_blank")}
                    className="h-8 w-8 p-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
