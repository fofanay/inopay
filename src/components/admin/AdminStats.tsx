import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, DollarSign, TrendingUp, RefreshCw, Loader2, Zap, Target } from "lucide-react";
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
      const { data: projects, error: projectsError } = await supabase
        .from("projects_analysis")
        .select("portability_score");

      if (projectsError) throw projectsError;

      const { data: deployments, error: deploymentsError } = await supabase
        .from("deployment_history")
        .select("id");

      if (deploymentsError) throw deploymentsError;

      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from("subscriptions")
        .select("id, status")
        .eq("status", "active");

      if (subscriptionsError) throw subscriptionsError;

      const scores = projects?.map(p => p.portability_score).filter(s => s !== null) || [];
      const avgScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + (b || 0), 0) / scores.length)
        : 0;

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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Utilisateurs",
      value: stats?.totalUsers || 0,
      subtitle: "Comptes inscrits",
      icon: Users,
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "Projets Analysés",
      value: stats?.totalProjects || 0,
      subtitle: "Analyses effectuées",
      icon: FileText,
      gradient: "from-accent to-accent/80",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
    },
    {
      title: "Déploiements",
      value: stats?.totalDeployments || 0,
      subtitle: "Total déployés",
      icon: TrendingUp,
      gradient: "from-success to-success/80",
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      title: "Abonnements Actifs",
      value: stats?.activeSubscriptions || 0,
      subtitle: "Clients payants",
      icon: DollarSign,
      gradient: "from-warning to-warning/80",
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden card-hover border-0 shadow-md">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Score Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="relative overflow-hidden border-0 shadow-md">
          <div className="absolute inset-0 gradient-inopay opacity-5" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Score de Liberté Moyen</CardTitle>
                  <CardDescription>Performance globale des analyses</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchStats} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Actualiser
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="relative">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted/20"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(stats?.averageScore || 0) * 2.51} 251`}
                    className="text-primary transition-all duration-500"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">{stats?.averageScore || 0}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Badge className={`w-fit ${
                  (stats?.averageScore || 0) >= 80 
                    ? "bg-success/10 text-success border-success/20" 
                    : (stats?.averageScore || 0) >= 60 
                      ? "bg-warning/10 text-warning border-warning/20" 
                      : "bg-destructive/10 text-destructive border-destructive/20"
                }`}>
                  {(stats?.averageScore || 0) >= 80 
                    ? "Excellent" 
                    : (stats?.averageScore || 0) >= 60 
                      ? "Moyen" 
                      : "À améliorer"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Score moyen sur {stats?.totalProjects || 0} projets
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-accent/10">
                <Zap className="h-6 w-6 text-accent" />
              </div>
              <div>
                <CardTitle>Actions Rapides</CardTitle>
                <CardDescription>Accès aux fonctions principales</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start gap-3 h-12" variant="outline">
              <Users className="h-5 w-5 text-primary" />
              <span>Gérer les utilisateurs</span>
            </Button>
            <Button className="w-full justify-start gap-3 h-12" variant="outline">
              <FileText className="h-5 w-5 text-accent" />
              <span>Voir les exports récents</span>
            </Button>
            <Button className="w-full justify-start gap-3 h-12" variant="outline">
              <DollarSign className="h-5 w-5 text-success" />
              <span>Consulter les paiements</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminStats;
