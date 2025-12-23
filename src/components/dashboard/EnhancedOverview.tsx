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
  Crown,
  Server,
  DollarSign,
  FileBarChart,
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Github
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserLimits } from "@/hooks/useUserLimits";
import { SecurityBadge } from "@/components/ui/security-badge";
import { CreditsBanner } from "./CreditsBanner";
import { GettingStartedChecklist } from "./GettingStartedChecklist";
import { GitHubConnectionStatus } from "./GitHubConnectionStatus";
import { LIMIT_SOURCES } from "@/lib/constants";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface UserStatsData {
  totalProjects: number;
  totalDeployments: number;
  averageScore: number;
  cleanedFiles: number;
  totalSavings: number;
}

interface ServerData {
  id: string;
  name: string;
  status: string;
  provider: string | null;
}

interface ServerDeploymentData {
  id: string;
  project_name: string;
  status: string;
  deployed_url: string | null;
  created_at: string;
}

interface RecentReport {
  id: string;
  project_name: string;
  created_at: string;
  portability_score_after: number | null;
}

interface EnhancedOverviewProps {
  onNavigate: (tab: string) => void;
}

const EnhancedOverview = ({ onNavigate }: EnhancedOverviewProps) => {
  const { user } = useAuth();
  const limits = useUserLimits();
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [serverDeployments, setServerDeployments] = useState<ServerDeploymentData[]>([]);
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAllData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch projects stats
      const { data: projects, error: projectsError } = await supabase
        .from("projects_analysis")
        .select("portability_score")
        .eq("user_id", user.id);

      if (projectsError) throw projectsError;

      // Fetch deployments with cost analysis from deployment_history
      const { data: deployments, error: deploymentsError } = await supabase
        .from("deployment_history")
        .select("id, cost_analysis")
        .eq("user_id", user.id);

      if (deploymentsError) throw deploymentsError;

      // Fetch server deployments
      const { data: serverDeploymentsData, error: serverDeploymentsError } = await supabase
        .from("server_deployments")
        .select("id, project_name, status, deployed_url, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (serverDeploymentsError) throw serverDeploymentsError;

      // Calculate total savings from cost_analysis
      let totalSavings = 0;
      deployments?.forEach(d => {
        if (d.cost_analysis && typeof d.cost_analysis === 'object') {
          const costData = d.cost_analysis as { monthlySavings?: number };
          if (costData.monthlySavings) {
            totalSavings += costData.monthlySavings;
          }
        }
      });

      // Fetch servers
      const { data: serversData, error: serversError } = await supabase
        .from("user_servers")
        .select("id, name, status, provider")
        .eq("user_id", user.id)
        .limit(5);

      if (serversError) throw serversError;

      // Fetch recent reports (deployments with liberation_report_generated)
      const { data: reportsData, error: reportsError } = await supabase
        .from("deployment_history")
        .select("id, project_name, created_at, portability_score_after")
        .eq("user_id", user.id)
        .eq("liberation_report_generated", true)
        .order("created_at", { ascending: false })
        .limit(3);

      if (reportsError) throw reportsError;

      // Count TOTAL deployments from BOTH sources
      const historyCount = deployments?.length || 0;
      const serverCount = serverDeploymentsData?.filter(d => d.status === "deployed").length || 0;
      const totalDeployments = historyCount + serverCount;

      const scores = projects?.map(p => p.portability_score).filter(s => s !== null) || [];
      const avgScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + (b || 0), 0) / scores.length)
        : 0;

      setStats({
        totalProjects: projects?.length || 0,
        totalDeployments: totalDeployments,
        averageScore: avgScore,
        cleanedFiles: Math.floor((projects?.length || 0) * 2.5),
        totalSavings,
      });

      setServers(serversData || []);
      setServerDeployments(serverDeploymentsData || []);
      setRecentReports(reportsData || []);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des statistiques");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
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
      title: "Projets Analysés",
      value: stats?.totalProjects || 0,
      subtitle: "Analyses effectuées",
      icon: FileText,
      gradient: "from-primary to-primary/80",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "Score Moyen",
      value: `${stats?.averageScore || 0}%`,
      subtitle: "Portabilité moyenne",
      icon: Target,
      gradient: "from-success to-success/80",
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      title: "Déploiements",
      value: stats?.totalDeployments || 0,
      subtitle: "Projets déployés",
      icon: Rocket,
      gradient: "from-accent to-accent/80",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
    },
    {
      title: "Économies",
      value: `${stats?.totalSavings || 0}$`,
      subtitle: "Par mois",
      icon: DollarSign,
      gradient: "from-success to-success/80",
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
  ];

  const getServerStatusIcon = (status: string) => {
    switch (status) {
      case "ready":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "installing":
        return <Clock className="h-4 w-4 text-warning animate-pulse" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getServerStatusLabel = (status: string) => {
    switch (status) {
      case "ready":
        return "En ligne";
      case "installing":
        return "Installation...";
      case "error":
        return "Erreur";
      default:
        return "En attente";
    }
  };

  const handleGitHubConnect = () => {
    // Redirect to sovereignty wizard for PAT-based GitHub connection
    onNavigate("sovereign-deploy");
    toast.info("Connectez votre GitHub avec un Personal Access Token pour une souveraineté totale de votre code.");
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Getting Started Checklist */}
      <GettingStartedChecklist 
        onNavigate={onNavigate}
        onGitHubConnect={handleGitHubConnect}
      />

      {/* GitHub Connection Status - show only if not fully connected */}
      <GitHubConnectionStatus variant="full" onConnect={handleGitHubConnect} />

      {/* Credits Banner */}
      <CreditsBanner />

      {/* Stats Cards - 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className="relative overflow-hidden card-hover border-0 shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-5`} />
            <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6">
              <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground truncate">
                {stat.title}
              </CardTitle>
              <div className={`p-1.5 md:p-2 rounded-lg ${stat.iconBg} shrink-0`}>
                <stat.icon className={`h-3 w-3 md:h-4 md:w-4 ${stat.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
              <div className="text-xl md:text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1">{stat.subtitle}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid: Score + Quick Actions - Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
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
                  <CardTitle>Score de Liberté Global</CardTitle>
                  <CardDescription>Performance de vos analyses</CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={fetchAllData} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Actualiser
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 120 120">
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
                  <span className="text-2xl font-bold text-primary">{stats?.averageScore || 0}%</span>
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
                      ? "Bon" 
                      : "À améliorer"}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Basé sur {stats?.totalProjects || 0} projet(s)
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
                <CardDescription>Accédez rapidement aux fonctionnalités</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button 
              className="w-full justify-between gap-3 h-11 bg-primary hover:bg-primary/90" 
              onClick={() => onNavigate("import")}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4" />
                <span>Analyser un nouveau projet</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              className="w-full justify-between gap-3 h-11" 
              variant="outline"
              onClick={() => onNavigate("servers")}
            >
              <div className="flex items-center gap-3">
                <Server className="h-4 w-4 text-accent" />
                <span>Configurer un serveur VPS</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              className="w-full justify-between gap-3 h-11" 
              variant="outline"
              asChild
            >
              <Link to="/economies">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span>Calculateur d'économies</span>
                </div>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button 
              className="w-full justify-between gap-3 h-11" 
              variant="outline"
              onClick={() => onNavigate("deployments")}
            >
              <div className="flex items-center gap-3">
                <Rocket className="h-4 w-4 text-primary" />
                <span>Historique des déploiements</span>
              </div>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid: Savings Summary + Servers + Recent Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Savings Summary */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-success/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <CardTitle className="text-base">Résumé des Économies</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-center py-2">
              <div className="text-3xl font-bold text-success">{stats?.totalSavings || 0}$/mois</div>
              <p className="text-sm text-muted-foreground">
                {((stats?.totalSavings || 0) * 12).toLocaleString()}$/an potentiels
              </p>
            </div>
            <Button 
              variant="outline" 
              className="w-full gap-2 border-success/30 text-success hover:bg-success/10"
              asChild
            >
              <Link to="/economies">
                Voir les détails
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Servers & Deployments Mini Card */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Server className="h-5 w-5 text-accent" />
                </div>
                <CardTitle className="text-base">
                  Infrastructure ({servers.length} serveurs, {serverDeployments.filter(d => d.status === "deployed").length} apps)
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {servers.length === 0 && serverDeployments.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">Aucun serveur configuré</p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onNavigate("servers")}
                >
                  Ajouter un serveur
                </Button>
              </div>
            ) : (
              <>
                {/* Active Server Deployments */}
                {serverDeployments.filter(d => d.status === "deployed").slice(0, 2).map((deployment) => (
                  <div 
                    key={deployment.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-success/5 border border-success/20"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-sm font-medium">{deployment.project_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {deployment.deployed_url && (
                        <a
                          href={deployment.deployed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Live
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Servers */}
                {servers.slice(0, 2).map((server) => (
                  <div 
                    key={server.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      {getServerStatusIcon(server.status)}
                      <span className="text-sm font-medium">{server.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {getServerStatusLabel(server.status)}
                    </Badge>
                  </div>
                ))}
                <Button 
                  variant="ghost" 
                  className="w-full gap-2 text-sm"
                  onClick={() => onNavigate("servers")}
                >
                  Gérer l'infrastructure
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Reports */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileBarChart className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-base">Rapports Récents</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentReports.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Aucun rapport généré</p>
              </div>
            ) : (
              <>
                {recentReports.map((report) => (
                  <Link 
                    key={report.id}
                    to={`/liberation-report/${report.id}`}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{report.project_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(report.created_at), "dd MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {report.portability_score_after && (
                        <Badge className="bg-success/10 text-success border-success/20">
                          {report.portability_score_after}%
                        </Badge>
                      )}
                      <ExternalLink className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
                <Button 
                  variant="ghost" 
                  className="w-full gap-2 text-sm"
                  onClick={() => onNavigate("deployments")}
                >
                  Voir tous les rapports
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EnhancedOverview;
