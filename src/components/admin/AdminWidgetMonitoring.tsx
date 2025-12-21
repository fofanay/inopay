import { useState, useEffect } from "react";
import { 
  Activity,
  Server,
  Users,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Smartphone,
  Globe,
  Clock,
  TrendingUp
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ServerStats {
  total_servers: number;
  healthy_servers: number;
  unhealthy_servers: number;
  pending_servers: number;
}

interface WidgetStats {
  total_widgets: number;
  active_syncs: number;
  total_syncs_count: number;
  time_saved_hours: number;
}

interface RecentActivity {
  id: string;
  title: string;
  description: string | null;
  status: string;
  action_type: string;
  created_at: string;
  deployment_id: string | null;
}

export function AdminWidgetMonitoring() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [serverStats, setServerStats] = useState<ServerStats>({
    total_servers: 0,
    healthy_servers: 0,
    unhealthy_servers: 0,
    pending_servers: 0,
  });
  const [widgetStats, setWidgetStats] = useState<WidgetStats>({
    total_widgets: 0,
    active_syncs: 0,
    total_syncs_count: 0,
    time_saved_hours: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch server deployments stats
      const { data: deployments, error: depError } = await supabase
        .from("server_deployments")
        .select("id, status, health_status");

      if (depError) throw depError;

      const stats: ServerStats = {
        total_servers: deployments?.length || 0,
        healthy_servers: deployments?.filter(d => d.health_status === 'healthy').length || 0,
        unhealthy_servers: deployments?.filter(d => d.health_status === 'unhealthy').length || 0,
        pending_servers: deployments?.filter(d => d.status === 'pending' || d.health_status === 'unknown').length || 0,
      };
      setServerStats(stats);

      // Fetch sync configurations stats
      const { data: syncConfigs, error: syncError } = await supabase
        .from("sync_configurations")
        .select("id, widget_token, sync_enabled, sync_count");

      if (syncError) throw syncError;

      const wStats: WidgetStats = {
        total_widgets: syncConfigs?.filter(c => c.widget_token).length || 0,
        active_syncs: syncConfigs?.filter(c => c.sync_enabled).length || 0,
        total_syncs_count: syncConfigs?.reduce((sum, c) => sum + (c.sync_count || 0), 0) || 0,
        time_saved_hours: Math.round((syncConfigs?.reduce((sum, c) => sum + (c.sync_count || 0), 0) || 0) * 15 / 60),
      };
      setWidgetStats(wStats);

      // Fetch recent activity
      const { data: activity, error: actError } = await supabase
        .from("admin_activity_logs")
        .select("id, title, description, status, action_type, created_at, deployment_id")
        .order("created_at", { ascending: false })
        .limit(10);

      if (actError) throw actError;

      setRecentActivity(activity || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching admin data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de monitoring",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getHealthPercentage = () => {
    if (serverStats.total_servers === 0) return 100;
    return Math.round((serverStats.healthy_servers / serverStats.total_servers) * 100);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "À l'instant";
    if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
    return `Il y a ${Math.floor(seconds / 86400)} j`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Monitoring Global</h2>
            <p className="text-sm text-muted-foreground">
              Surveillez tous les widgets et serveurs
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Server Health */}
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4 text-green-500" />
              Santé Serveurs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{getHealthPercentage()}%</div>
            <Progress value={getHealthPercentage()} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {serverStats.healthy_servers}/{serverStats.total_servers} en ligne
            </p>
          </CardContent>
        </Card>

        {/* Active Widgets */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-500" />
              Widgets Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-500">{widgetStats.total_widgets}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {widgetStats.active_syncs} syncs actives
            </p>
          </CardContent>
        </Card>

        {/* Total Syncs */}
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-purple-500" />
              Syncs Effectuées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-500">{widgetStats.total_syncs_count}</div>
            <p className="text-xs text-muted-foreground mt-2">
              Automatisations réussies
            </p>
          </CardContent>
        </Card>

        {/* Time Saved */}
        <Card className="border-orange-500/20 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              Temps Économisé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{widgetStats.time_saved_hours}h</div>
            <p className="text-xs text-muted-foreground mt-2">
              Pour tous les utilisateurs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Server Status Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              État des Serveurs
            </CardTitle>
            <CardDescription>Vue d'ensemble de l'infrastructure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm">En ligne</span>
                </div>
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                  {serverStats.healthy_servers}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm">Hors ligne</span>
                </div>
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                  {serverStats.unhealthy_servers}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm">En attente</span>
                </div>
                <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                  {serverStats.pending_servers}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activité Récente
            </CardTitle>
            <CardDescription>Dernières actions sur la plateforme</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {getStatusIcon(activity.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {activity.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/60">
                        {formatTimeAgo(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune activité récente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last refresh indicator */}
      <p className="text-center text-xs text-muted-foreground">
        Dernière mise à jour : {lastRefresh.toLocaleTimeString('fr-FR')} • Actualisation auto toutes les 30s
      </p>
    </div>
  );
}
