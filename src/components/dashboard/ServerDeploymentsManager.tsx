import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecretsCleanupButton } from "./SecretsCleanupButton";
import { 
  Rocket, 
  ExternalLink, 
  Clock, 
  Server,
  RefreshCw,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
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
  user_servers: {
    name: string;
    ip_address: string;
  } | null;
}

export function ServerDeploymentsManager() {
  const { user } = useAuth();
  const [deployments, setDeployments] = useState<ServerDeployment[]>([]);
  const [loading, setLoading] = useState(true);

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
          user_servers (
            name,
            ip_address
          )
        `)
        .eq('user_id', user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setDeployments(data || []);
    } catch (error) {
      console.error("Error fetching server deployments:", error);
      toast.error("Impossible de charger les déploiements serveur");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, [user]);

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
