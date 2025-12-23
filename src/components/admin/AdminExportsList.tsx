import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  RefreshCw, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Package,
  Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface GlobalStats {
  totalExports: number;
  successfulExports: number;
  failedExports: number;
  uniqueUsers: number;
  recentExports: {
    id: string;
    project_name: string;
    provider: string;
    status: string;
    created_at: string;
  }[];
  topProviders: { provider: string; count: number }[];
}

const AdminExportsList = () => {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch all deployments for global stats
      const { data: deployments, error } = await supabase
        .from("deployment_history")
        .select("id, project_name, provider, status, created_at, user_id")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const data = deployments || [];
      
      // Calculate stats
      const successful = data.filter(d => d.status === "success").length;
      const failed = data.filter(d => d.status === "failed" || d.status === "error").length;
      const uniqueUsers = new Set(data.map(d => d.user_id)).size;
      
      // Top providers
      const providerCounts = data.reduce((acc, d) => {
        acc[d.provider] = (acc[d.provider] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const topProviders = Object.entries(providerCounts)
        .map(([provider, count]) => ({ provider, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setStats({
        totalExports: data.length,
        successfulExports: successful,
        failedExports: failed,
        uniqueUsers,
        recentExports: data.slice(0, 10),
        topProviders
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Erreur lors du chargement des statistiques");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const getProviderIcon = (provider: string) => {
    const providerLower = provider.toLowerCase();
    if (providerLower.includes("ionos")) return "🔵";
    if (providerLower.includes("ovh")) return "🔷";
    if (providerLower.includes("coolify")) return "🚀";
    if (providerLower.includes("vercel")) return "▲";
    return "🌐";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const successRate = stats?.totalExports 
    ? Math.round((stats.successfulExports / stats.totalExports) * 100) 
    : 100;

  return (
    <div className="space-y-6">
      {/* Alert Banner if low success rate */}
      {successRate < 90 && stats && stats.totalExports > 10 && (
        <Card className="bg-amber-900/20 border-amber-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <div>
                <p className="font-medium text-amber-300">Taux de succès faible: {successRate}%</p>
                <p className="text-sm text-amber-400/80">
                  {stats.failedExports} exports en échec sur {stats.totalExports}. Vérifiez les logs.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalExports || 0}</p>
                <p className="text-xs text-muted-foreground">Total exports</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-500">{successRate}%</p>
                <p className="text-xs text-muted-foreground">Taux de succès</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Users className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-500">{stats?.uniqueUsers || 0}</p>
                <p className="text-xs text-muted-foreground">Utilisateurs actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <TrendingUp className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{stats?.successfulExports || 0}</p>
                <p className="text-xs text-muted-foreground">Déploiements réussis</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Providers & Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Providers */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Hébergeurs Populaires
                </CardTitle>
                <CardDescription>
                  Répartition des déploiements par hébergeur
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.topProviders.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                Aucune donnée
              </div>
            ) : (
              <div className="space-y-3">
                {stats?.topProviders.map((item, index) => (
                  <div key={item.provider} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getProviderIcon(item.provider)}</span>
                      <span className="font-medium">{item.provider}</span>
                    </div>
                    <Badge variant="secondary">{item.count} exports</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Activité Récente
                </CardTitle>
                <CardDescription>
                  Derniers exports sur la plateforme
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={fetchStats}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.recentExports.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Aucun export récent</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stats?.recentExports.map((export_) => (
                  <div 
                    key={export_.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{getProviderIcon(export_.provider)}</span>
                      <span className="font-medium truncate">{export_.project_name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {export_.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(export_.created_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Admin Note */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            📊 <strong>Vue Admin</strong> : Statistiques globales de la plateforme. 
            Les utilisateurs voient leur propre historique d'exports dans leur Dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminExportsList;
