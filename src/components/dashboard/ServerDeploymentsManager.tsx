import { useState, useEffect } from "react";
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
  RotateCcw
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
import { fr } from "date-fns/locale";

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
  const { user } = useAuth();
  const [deployments, setDeployments] = useState<ServerDeployment[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previousStatuses, setPreviousStatuses] = useState<Record<string, string>>({});

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

    // Check retry limit
    if (!canRetry(deployment)) {
      const info = getRetryInfo(deployment);
      toast.error(`Limite de retry atteinte (${MAX_RETRIES_PER_HOUR}/heure)`, {
        description: `Réessayez dans ${info.resetIn}`
      });
      return;
    }

    setRetryingId(deployment.id);
    
    try {
      // Update retry count before deleting the record
      const newRetryCount = (deployment.retry_count || 0) + 1;
      
      // First, delete the failed deployment record to avoid duplicates
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

      // Call deploy-coolify with the same parameters and retry info
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

      const info = getRetryInfo({ ...deployment, retry_count: newRetryCount, last_retry_at: new Date().toISOString() });
      toast.success(`Redéploiement lancé ! (${info.remaining} essais restants cette heure)`);
      fetchDeployments();
    } catch (error) {
      console.error("Retry deployment error:", error);
      toast.error(error instanceof Error ? error.message : "Échec du redéploiement");
    } finally {
      setRetryingId(null);
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
                {/* Show retry button for failed or stuck deployments */}
                {(deployment.status === 'failed' || isDeploymentStuck(deployment)) && deployment.github_repo_url && (() => {
                  const retryInfo = getRetryInfo(deployment);
                  const canDoRetry = canRetry(deployment);
                  
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleRetry(deployment)}
                      disabled={retryingId === deployment.id || !canDoRetry}
                      title={!canDoRetry ? `Limite atteinte. Réessayez dans ${retryInfo.resetIn}` : `${retryInfo.remaining} essais restants`}
                    >
                      {retryingId === deployment.id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      Réessayer
                      {retryInfo.remaining < MAX_RETRIES_PER_HOUR && (
                        <span className="text-xs text-muted-foreground">({retryInfo.remaining})</span>
                      )}
                    </Button>
                  );
                })()}

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
