import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, FileText, DollarSign, TrendingUp, RefreshCw, Loader2, Zap, Target, CreditCard, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";

interface Stats {
  totalUsers: number;
  totalProjects: number;
  totalDeployments: number;
  creditsVendus30j: number;
  revenusPayPerService: number;
  averageScore: number;
  tauxConversion: number;
}

const AdminStats = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useLocaleFormat();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const formatAmount = (amount: number) => {
    return formatCurrency(amount / 100, "CAD");
  };

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

      // Fetch purchases from last 30 days for Pay-per-Service metrics
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: recentPurchases, error: purchasesError } = await supabase
        .from("user_purchases")
        .select("amount, used, is_subscription")
        .eq("status", "completed")
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (purchasesError) throw purchasesError;

      // Calculate credits sold (non-subscription purchases)
      const creditPurchases = recentPurchases?.filter(p => !p.is_subscription) || [];
      const creditsVendus = creditPurchases.length;
      const revenusPayPerService = creditPurchases.reduce((sum, p) => sum + p.amount, 0);
      const usedCredits = creditPurchases.filter(p => p.used).length;
      const tauxConversion = creditsVendus > 0 ? Math.round((usedCredits / creditsVendus) * 100) : 0;

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
        creditsVendus30j: creditsVendus,
        revenusPayPerService: revenusPayPerService,
        averageScore: avgScore,
        tauxConversion,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error(t("adminStats.loadingError"));
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
      title: t("adminStats.users"),
      value: stats?.totalUsers || 0,
      subtitle: t("adminStats.registeredAccounts"),
      icon: Users,
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: t("adminStats.creditsSold30d"),
      value: stats?.creditsVendus30j || 0,
      subtitle: t("adminStats.payPerService"),
      icon: CreditCard,
      gradient: "from-violet-500 to-violet-400",
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
    },
    {
      title: t("adminStats.revenue30d"),
      value: formatAmount(stats?.revenusPayPerService || 0),
      subtitle: t("adminStats.payPerService"),
      icon: DollarSign,
      gradient: "from-emerald-500 to-emerald-400",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
    },
    {
      title: t("adminStats.conversionRate"),
      value: `${stats?.tauxConversion || 0}%`,
      subtitle: t("adminStats.creditToDeployment"),
      icon: Rocket,
      gradient: "from-amber-500 to-amber-400",
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
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
                  <CardTitle>{t("adminStats.averageFreedomScore")}</CardTitle>
                  <CardDescription>{t("adminStats.analysisPerformance")}</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchStats} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                {t("adminStats.refresh")}
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
                    ? t("adminStats.excellent")
                    : (stats?.averageScore || 0) >= 60 
                      ? t("adminStats.average")
                      : t("adminStats.needsImprovement")}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {t("adminStats.averageScoreOn", { count: stats?.totalProjects || 0 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Summary */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-accent/10">
                <Zap className="h-6 w-6 text-accent" />
              </div>
              <div>
                <CardTitle>{t("adminStats.activitySummary")}</CardTitle>
                <CardDescription>{t("adminStats.keyMetrics")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span>{t("adminStats.analyzedProjects")}</span>
              </div>
              <span className="font-bold text-primary">{stats?.totalProjects || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                <span>{t("adminStats.totalDeployments")}</span>
              </div>
              <span className="font-bold text-success">{stats?.totalDeployments || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-400" />
                <span>{t("adminStats.payPerServiceRevenue")}</span>
              </div>
              <span className="font-bold text-emerald-400">{formatAmount(stats?.revenusPayPerService || 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminStats;