import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Server, 
  Rocket, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  ChevronRight,
  Zap,
  Shield,
  TrendingUp,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GettingStartedChecklist } from "./GettingStartedChecklist";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface FleetStats {
  totalServers: number;
  readyServers: number;
  totalDeployments: number;
  healthyDeployments: number;
  failedDeployments: number;
  pendingDeployments: number;
}

interface ServerStatus {
  id: string;
  name: string;
  ip_address: string;
  status: string;
  coolify_url: string | null;
  updated_at: string;
}

interface DeploymentStatus {
  id: string;
  project_name: string;
  status: string;
  health_status: string | null;
  deployed_url: string | null;
  updated_at: string;
  server_name?: string;
}

interface UserDashboardOverviewProps {
  onNavigate: (tab: string) => void;
  onGitHubConnect: () => void;
}

export function UserDashboardOverview({ onNavigate, onGitHubConnect }: UserDashboardOverviewProps) {
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [servers, setServers] = useState<ServerStatus[]>([]);
  const [deployments, setDeployments] = useState<DeploymentStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFleetData = async () => {
    try {
      // Fetch servers
      const { data: serversData } = await supabase
        .from("user_servers")
        .select("id, name, ip_address, status, coolify_url, updated_at")
        .order("updated_at", { ascending: false })
        .limit(5);

      // Fetch deployments with server info
      const { data: deploymentsData } = await supabase
        .from("server_deployments")
        .select(`
          id, 
          project_name, 
          status, 
          health_status, 
          deployed_url, 
          updated_at,
          user_servers!inner(name)
        `)
        .order("updated_at", { ascending: false })
        .limit(5);

      const serversList = serversData || [];
      const deploymentsList = (deploymentsData || []).map(d => ({
        ...d,
        server_name: (d.user_servers as any)?.name
      }));

      setServers(serversList);
      setDeployments(deploymentsList);

      // Compute stats
      const readyServers = serversList.filter(s => s.status === 'ready').length;
      const healthyDeps = deploymentsList.filter(d => d.health_status === 'healthy').length;
      const failedDeps = deploymentsList.filter(d => d.status === 'failed' || d.health_status === 'unhealthy').length;
      const pendingDeps = deploymentsList.filter(d => d.status === 'pending' || d.status === 'deploying').length;

      setStats({
        totalServers: serversList.length,
        readyServers,
        totalDeployments: deploymentsList.length,
        healthyDeployments: healthyDeps,
        failedDeployments: failedDeps,
        pendingDeployments: pendingDeps,
      });
    } catch (error) {
      console.error("Error fetching fleet data:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleetData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'healthy':
      case 'deployed':
        return 'text-emerald-500 bg-emerald-500/10';
      case 'pending':
      case 'deploying':
        return 'text-amber-500 bg-amber-500/10';
      case 'error':
      case 'failed':
      case 'unhealthy':
        return 'text-destructive bg-destructive/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
      case 'healthy':
      case 'deployed':
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case 'pending':
      case 'deploying':
        return <Clock className="h-3.5 w-3.5" />;
      case 'error':
      case 'failed':
      case 'unhealthy':
        return <XCircle className="h-3.5 w-3.5" />;
      default:
        return <Activity className="h-3.5 w-3.5" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'ready': 'Opérationnel',
      'healthy': 'Sain',
      'deployed': 'Déployé',
      'pending': 'En attente',
      'deploying': 'Déploiement...',
      'error': 'Erreur',
      'failed': 'Échec',
      'unhealthy': 'Problème',
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasFleet = (stats?.totalServers || 0) > 0;
  const fleetHealth = stats?.totalServers 
    ? Math.round((stats.readyServers / stats.totalServers) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* CTA Principal - Libération */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Pilotez votre flotte souveraine</h3>
                <p className="text-sm text-muted-foreground">
                  {hasFleet 
                    ? `${stats?.readyServers}/${stats?.totalServers} serveurs opérationnels`
                    : "Configurez votre premier serveur pour commencer"
                  }
                </p>
              </div>
            </div>
            <Button 
              onClick={() => onNavigate(hasFleet ? "liberation" : "servers")}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {hasFleet ? "Nouvelle libération" : "Configurer un serveur"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Server className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalServers || 0}</p>
                <p className="text-xs text-muted-foreground">Serveurs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalDeployments || 0}</p>
                <p className="text-xs text-muted-foreground">Déploiements</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.healthyDeployments || 0}</p>
                <p className="text-xs text-muted-foreground">Apps saines</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                (stats?.failedDeployments || 0) > 0 ? "bg-destructive/10" : "bg-emerald-500/10"
              )}>
                {(stats?.failedDeployments || 0) > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <Shield className="h-5 w-5 text-emerald-500" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.failedDeployments || 0}</p>
                <p className="text-xs text-muted-foreground">Incidents</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Onboarding Checklist */}
      <GettingStartedChecklist onNavigate={onNavigate} onGitHubConnect={onGitHubConnect} />

      {/* Fleet Activity - Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Servers Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Mes Serveurs</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onNavigate("servers")}
                className="text-xs"
              >
                Voir tout
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {servers.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun serveur configuré</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => onNavigate("servers")}
                >
                  Ajouter un serveur
                </Button>
              </div>
            ) : (
              servers.map(server => (
                <div 
                  key={server.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-1.5 rounded-full", getStatusColor(server.status))}>
                      {getStatusIcon(server.status)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{server.name}</p>
                      <p className="text-xs text-muted-foreground">{server.ip_address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[10px]", getStatusColor(server.status))}>
                      {getStatusLabel(server.status)}
                    </Badge>
                    {server.coolify_url && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => window.open(server.coolify_url!, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Deployments Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Déploiements récents</CardTitle>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => onNavigate("projects")}
                className="text-xs"
              >
                Voir tout
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {deployments.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Rocket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun déploiement</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => onNavigate("liberation")}
                >
                  Lancer une libération
                </Button>
              </div>
            ) : (
              deployments.map(deployment => (
                <div 
                  key={deployment.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-1.5 rounded-full", 
                      getStatusColor(deployment.health_status || deployment.status)
                    )}>
                      {getStatusIcon(deployment.health_status || deployment.status)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{deployment.project_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {deployment.server_name} • {formatDistanceToNow(new Date(deployment.updated_at), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px]", getStatusColor(deployment.health_status || deployment.status))}
                    >
                      {getStatusLabel(deployment.health_status || deployment.status)}
                    </Badge>
                    {deployment.deployed_url && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={() => window.open(deployment.deployed_url!, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fleet Health Summary */}
      {hasFleet && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Santé de la flotte</p>
                  <p className="text-xs text-muted-foreground">
                    {stats?.readyServers} serveurs prêts, {stats?.healthyDeployments} apps saines
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={fleetHealth} className="h-2 w-24" />
                <span className="text-sm font-medium">{fleetHealth}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refresh */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={fetchFleetData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>
    </div>
  );
}

export default UserDashboardOverview;
