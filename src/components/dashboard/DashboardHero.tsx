import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Zap, 
  ArrowRight, 
  DollarSign,
  Server,
  FileText,
  Rocket,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { CreditsBanner } from "./CreditsBanner";
import { GettingStartedChecklist } from "./GettingStartedChecklist";

interface DashboardHeroProps {
  onNavigate: (tab: string) => void;
}

interface ServerData {
  id: string;
  name: string;
  status: string;
  provider: string | null;
}

export function DashboardHero({ onNavigate }: DashboardHeroProps) {
  const { user } = useAuth();
  const [servers, setServers] = useState<ServerData[]>([]);
  const [savings, setSavings] = useState(0);
  const [avgScore, setAvgScore] = useState(0);
  const [projectsCount, setProjectsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      try {
        // Fetch projects
        const { data: projects } = await supabase
          .from("projects_analysis")
          .select("portability_score")
          .eq("user_id", user.id);

        // Fetch servers
        const { data: serversData } = await supabase
          .from("user_servers")
          .select("id, name, status, provider")
          .eq("user_id", user.id)
          .limit(3);

        // Fetch deployments with cost
        const { data: deployments } = await supabase
          .from("deployment_history")
          .select("cost_analysis")
          .eq("user_id", user.id);

        // Calculate stats
        const scores = projects?.map(p => p.portability_score).filter(s => s !== null) || [];
        const avg = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => a + (b || 0), 0) / scores.length)
          : 0;

        let totalSavings = 0;
        deployments?.forEach(d => {
          if (d.cost_analysis && typeof d.cost_analysis === 'object') {
            const costData = d.cost_analysis as { monthlySavings?: number };
            if (costData.monthlySavings) {
              totalSavings += costData.monthlySavings;
            }
          }
        });

        setServers(serversData || []);
        setSavings(totalSavings);
        setAvgScore(avg);
        setProjectsCount(projects?.length || 0);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Getting Started */}
      <GettingStartedChecklist 
        onNavigate={onNavigate}
        onGitHubConnect={() => onNavigate("liberation")}
      />

      {/* Credits Banner */}
      <CreditsBanner />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Freedom Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="relative overflow-hidden border-0 shadow-md h-full">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent" />
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Score de Liberté</CardTitle>
                  <CardDescription>Performance moyenne</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      className="text-muted/20"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${avgScore * 2.51} 251`}
                      className="text-primary transition-all duration-500"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-primary">{avgScore}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Badge className={`w-fit ${
                    avgScore >= 80 
                      ? "bg-success/10 text-success border-success/20" 
                      : avgScore >= 60 
                        ? "bg-warning/10 text-warning border-warning/20" 
                        : "bg-muted/10 text-muted-foreground border-muted/20"
                  }`}>
                    {avgScore >= 80 ? "Excellent" : avgScore >= 60 ? "Bon" : "À améliorer"}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Basé sur {projectsCount} projet(s)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 shadow-md h-full">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-accent/10">
                  <Zap className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <CardTitle>Actions Rapides</CardTitle>
                  <CardDescription>Accès aux fonctionnalités</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                className="w-full justify-between gap-3 h-11 bg-primary hover:bg-primary/90" 
                onClick={() => onNavigate("liberation")}
              >
                <div className="flex items-center gap-3">
                  <Rocket className="h-4 w-4" />
                  <span>Nouvelle libération</span>
                </div>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button 
                className="w-full justify-between gap-3 h-11" 
                variant="outline"
                onClick={() => onNavigate("fleet")}
              >
                <div className="flex items-center gap-3">
                  <Server className="h-4 w-4 text-accent" />
                  <span>Gérer ma flotte</span>
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
                    <span>Voir mes économies ({savings}$/mois)</span>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Servers Mini-Preview */}
      {servers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Server className="h-5 w-5 text-accent" />
                  </div>
                  <CardTitle className="text-base">Mes Serveurs</CardTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onNavigate("fleet")}
                >
                  Voir tout
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {servers.map((server) => (
                  <div 
                    key={server.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getServerStatusIcon(server.status)}
                      <span className="font-medium text-sm">{server.name}</span>
                    </div>
                    {server.provider && (
                      <Badge variant="outline" className="text-xs">
                        {server.provider}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
