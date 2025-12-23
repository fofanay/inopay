import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, 
  Smartphone,
  Package,
  Zap,
  Clock,
  CheckCircle2,
  Lock,
  Unlock,
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Server
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ManifesteBanner } from "./ManifesteBanner";

interface DashboardStats {
  // Exports
  totalExports: number;
  successfulExports: number;
  // Security
  totalServers: number;
  secureServers: number;
  hasSecurityIssues: boolean;
  // Widgets
  activeWidgets: number;
  activeSyncs: number;
  totalSyncsCount: number;
  timeSavedMinutes: number;
}

export function UserDashboardOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAllStats = async () => {
    try {
      // Fetch exports
      const { data: exports } = await supabase
        .from("deployment_history")
        .select("id, status");

      // Fetch servers
      const { data: servers } = await supabase
        .from("user_servers")
        .select("id");

      // Check for exposed secrets
      let exposedCount = 0;
      if (servers) {
        for (const server of servers) {
          const { data: secretCheck } = await supabase
            .from('user_servers')
            .select('id')
            .eq('id', server.id)
            .not('db_password', 'is', null)
            .single();
          if (secretCheck) exposedCount++;
        }
      }

      // Fetch sync configs
      const { data: syncConfigs } = await supabase
        .from("sync_configurations")
        .select("id, widget_token, widget_token_revoked, sync_enabled, sync_count, time_saved_minutes");

      const exportsList = exports || [];
      const serversList = servers || [];
      const syncList = syncConfigs || [];

      setStats({
        totalExports: exportsList.length,
        successfulExports: exportsList.filter(e => e.status === "success").length,
        totalServers: serversList.length,
        secureServers: serversList.length - exposedCount,
        hasSecurityIssues: exposedCount > 0,
        activeWidgets: syncList.filter(c => c.widget_token && !c.widget_token_revoked).length,
        activeSyncs: syncList.filter(c => c.sync_enabled).length,
        totalSyncsCount: syncList.reduce((sum, c) => sum + (c.sync_count || 0), 0),
        timeSavedMinutes: syncList.reduce((sum, c) => sum + (c.time_saved_minutes || 0), 0),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const exportSuccessRate = stats?.totalExports 
    ? Math.round((stats.successfulExports / stats.totalExports) * 100) 
    : 100;

  const securityScore = stats?.totalServers 
    ? Math.round((stats.secureServers / stats.totalServers) * 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Manifeste Banner */}
      <ManifesteBanner />

      {/* Security Alert */}
      {stats?.hasSecurityIssues && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-amber-600 dark:text-amber-400">
                  Secrets en attente de nettoyage
                </p>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
                  {stats.totalServers - stats.secureServers} serveur(s) avec secrets non encore nettoyés
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Exports */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{stats?.totalExports || 0}</p>
                <p className="text-xs text-muted-foreground">Exports</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Servers */}
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Server className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-500">{stats?.totalServers || 0}</p>
                <p className="text-xs text-muted-foreground">Serveurs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Syncs */}
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Zap className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-500">{stats?.totalSyncsCount || 0}</p>
                <p className="text-xs text-muted-foreground">Syncs auto</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time Saved */}
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">
                  {Math.round((stats?.timeSavedMinutes || 0) / 60)}h
                </p>
                <p className="text-xs text-muted-foreground">Économisé</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Security Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Zero-Knowledge</span>
                <Badge 
                  className={securityScore === 100 
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  }
                >
                  {securityScore === 100 ? (
                    <><Lock className="h-3 w-3 mr-1" /> Sécurisé</>
                  ) : (
                    <><Unlock className="h-3 w-3 mr-1" /> En cours</>
                  )}
                </Badge>
              </div>
              <Progress value={securityScore} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats?.secureServers}/{stats?.totalServers} serveurs sécurisés
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Export Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Exports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Taux de succès</span>
                <Badge 
                  className={exportSuccessRate >= 90 
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                    : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                  }
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {exportSuccessRate}%
                </Badge>
              </div>
              <Progress value={exportSuccessRate} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {stats?.successfulExports}/{stats?.totalExports} réussis
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Widget Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Widgets & Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Widgets actifs</span>
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  <Smartphone className="h-3 w-3 mr-1" />
                  {stats?.activeWidgets || 0}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Syncs activées</span>
                <span className="font-medium">{stats?.activeSyncs || 0}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.timeSavedMinutes || 0} minutes économisées
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={fetchAllStats}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser les statistiques
        </Button>
      </div>
    </div>
  );
}

export default UserDashboardOverview;
