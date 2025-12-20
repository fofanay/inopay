import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, DollarSign, TrendingUp, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalDeployments: number;
  activeSubscriptions: number;
  averageScore: number;
}

const AdminStats = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // Fetch projects count and average score
      const { data: projects, error: projectsError } = await supabase
        .from("projects_analysis")
        .select("portability_score");

      if (projectsError) throw projectsError;

      // Fetch deployments count
      const { data: deployments, error: deploymentsError } = await supabase
        .from("deployment_history")
        .select("id");

      if (deploymentsError) throw deploymentsError;

      // Fetch active subscriptions
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("status", "active");

      if (subscriptionsError) throw subscriptionsError;

      // Calculate average score
      const scores = projects?.map(p => p.portability_score).filter(s => s !== null) || [];
      const avgScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + (b || 0), 0) / scores.length)
        : 0;

      // Get unique user IDs from projects (as a proxy for total users)
      const { data: uniqueUsers, error: usersError } = await supabase
        .from("subscriptions")
        .select("user_id");

      if (usersError) throw usersError;

      const uniqueUserIds = new Set(uniqueUsers?.map(u => u.user_id) || []);

      setStats({
        totalUsers: uniqueUserIds.size,
        totalProjects: projects?.length || 0,
        totalDeployments: deployments?.length || 0,
        activeSubscriptions: subscriptions?.length || 0,
        averageScore: avgScore,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Utilisateurs
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Comptes inscrits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projets Analysés
            </CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats?.totalProjects || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Analyses effectuées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Déploiements
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats?.totalDeployments || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Total déployés</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Abonnements Actifs
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats?.activeSubscriptions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Clients payants</p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Score de Liberté Moyen</CardTitle>
              <CardDescription>Performance globale des analyses</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchStats} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-5xl font-bold text-primary">{stats?.averageScore || 0}</div>
            <div className="text-muted-foreground">/100</div>
            <Badge className={`ml-4 ${
              (stats?.averageScore || 0) >= 80 
                ? "bg-success/10 text-success" 
                : (stats?.averageScore || 0) >= 60 
                  ? "bg-warning/10 text-warning" 
                  : "bg-destructive/10 text-destructive"
            }`}>
              {(stats?.averageScore || 0) >= 80 
                ? "Excellent" 
                : (stats?.averageScore || 0) >= 60 
                  ? "Moyen" 
                  : "À améliorer"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStats;
