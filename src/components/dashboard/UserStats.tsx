import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Target, 
  Rocket, 
  Sparkles, 
  RefreshCw, 
  Loader2, 
  Zap,
  TrendingUp,
  ArrowRight,
  CreditCard,
  Crown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserLimits } from "@/hooks/useUserLimits";
import { SecurityBadge } from "@/components/ui/security-badge";
import { LIMIT_SOURCES } from "@/lib/constants";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface UserStatsData {
  totalProjects: number;
  totalDeployments: number;
  averageScore: number;
  cleanedFiles: number;
}

interface UserStatsProps {
  onNavigate: (tab: string) => void;
}

const UserStats = ({ onNavigate }: UserStatsProps) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const limits = useUserLimits();
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data: projects, error: projectsError } = await supabase
        .from("projects_analysis")
        .select("portability_score")
        .eq("user_id", user.id);

      if (projectsError) throw projectsError;

      const { data: deployments, error: deploymentsError } = await supabase
        .from("deployment_history")
        .select("id")
        .eq("user_id", user.id);

      if (deploymentsError) throw deploymentsError;

      const scores = projects?.map(p => p.portability_score).filter(s => s !== null) || [];
      const avgScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + (b || 0), 0) / scores.length)
        : 0;

      setStats({
        totalProjects: projects?.length || 0,
        totalDeployments: deployments?.length || 0,
        averageScore: avgScore,
        cleanedFiles: Math.floor((projects?.length || 0) * 2.5),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error(t("userStats.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  if (loading || limits.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    {
      title: t("userStats.analyzedProjects"),
      value: stats?.totalProjects || 0,
      subtitle: t("userStats.analysesPerformed"),
      icon: FileText,
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: t("userStats.averageScore"),
      value: `${stats?.averageScore || 0}%`,
      subtitle: t("userStats.averagePortability"),
      icon: Target,
      gradient: "from-success to-success/80",
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      title: t("userStats.deployments"),
      value: stats?.totalDeployments || 0,
      subtitle: t("userStats.projectsDeployed"),
      icon: Rocket,
      gradient: "from-accent to-accent/80",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
    },
    {
      title: t("userStats.availableCredits"),
      value: limits.credits.total,
      subtitle: limits.isTester ? t("userStats.unlimitedAccess") : t("userStats.deploymentsCount", { count: limits.credits.deploy }),
      icon: limits.isTester ? Crown : CreditCard,
      gradient: limits.isTester ? "from-warning to-warning/80" : "from-primary to-primary/80",
      iconBg: limits.isTester ? "bg-warning/10" : "bg-primary/10",
      iconColor: limits.isTester ? "text-warning" : "text-primary",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className="relative overflow-hidden card-hover border-0 shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
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

      {/* Limits Info Card */}
      <Card className="border-0 shadow-md bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {limits.isTester ? (
                  <Crown className="h-5 w-5 text-warning" />
                ) : limits.hasEnterpriseAccess ? (
                  <Zap className="h-5 w-5 text-primary" />
                ) : (
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="font-medium">
                  {t("userStats.limits", { files: limits.maxFiles, repos: limits.maxRepos })}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                {LIMIT_SOURCES[limits.source]}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {limits.hasEnterpriseAccess && <SecurityBadge type="enterprise-limits" size="default" />}
              {limits.isTester && <SecurityBadge type="tester" size="default" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score Card & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Freedom Score Card */}
        <Card className="relative overflow-hidden border-0 shadow-md">
          <div className="absolute inset-0 gradient-inopay opacity-5" />
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{t("userStats.freedomScore")}</CardTitle>
                  <CardDescription>{t("userStats.analysisPerformance")}</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchStats} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                {t("userStats.refresh")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32 flex items-center justify-center">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="none"
                    className="text-muted/20"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    stroke="currentColor"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${(stats?.averageScore || 0) * 3.14} 314`}
                    className="text-primary transition-all duration-500"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">{stats?.averageScore || 0}%</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Badge className={`w-fit ${
                  (stats?.averageScore || 0) >= 80 
                    ? "bg-success/10 text-success border-success/20" 
                    : (stats?.averageScore || 0) >= 60 
                      ? "bg-warning/10 text-warning border-warning/20" 
                      : "bg-destructive/10 text-destructive border-destructive/20"
                }`}>
                  {(stats?.averageScore || 0) >= 80 
                    ? t("userStats.excellent") 
                    : (stats?.averageScore || 0) >= 60 
                      ? t("userStats.good") 
                      : t("userStats.needsImprovement")}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {t("userStats.basedOnProjects", { count: stats?.totalProjects || 0 })}
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
                <CardTitle>{t("userStats.quickActions")}</CardTitle>
                <CardDescription>{t("userStats.quickActionsDesc")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              className="w-full justify-between gap-3 h-12 bg-primary hover:bg-primary/90" 
              onClick={() => onNavigate("import")}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5" />
                <span>{t("userStats.analyzeNewProject")}</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              className="w-full justify-between gap-3 h-12" 
              variant="outline"
              onClick={() => onNavigate("projects")}
            >
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-accent" />
                <span>{t("userStats.viewProjects")}</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              className="w-full justify-between gap-3 h-12" 
              variant="outline"
              onClick={() => onNavigate("deployments")}
            >
              <div className="flex items-center gap-3">
                <Rocket className="h-5 w-5 text-success" />
                <span>{t("userStats.deploymentHistory")}</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserStats;
