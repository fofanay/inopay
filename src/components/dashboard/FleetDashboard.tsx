import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { 
  LayoutGrid, 
  RefreshCw, 
  Rocket, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  TrendingDown,
  BarChart3,
  Layers,
  Target,
  Zap,
  ArrowRight,
  FolderOpen
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Json } from "@/integrations/supabase/types";
import { COSTLY_SERVICES } from "@/lib/costOptimization";

interface FleetProject {
  id: string;
  project_name: string;
  file_name: string | null;
  portability_score: number | null;
  status: string;
  created_at: string;
  detected_issues: Json;
  recommendations: Json;
}

interface DeploymentRecord {
  id: string;
  project_name: string;
  status: string;
  created_at: string;
  deployed_url: string | null;
}

type KanbanColumn = "pending" | "analyzed" | "ready" | "deployed";

const COLUMN_CONFIG: Record<KanbanColumn, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  pending: { 
    label: "En attente", 
    icon: Clock, 
    color: "text-muted-foreground",
    bgColor: "bg-muted/50"
  },
  analyzed: { 
    label: "Analysés", 
    icon: BarChart3, 
    color: "text-info",
    bgColor: "bg-info/10"
  },
  ready: { 
    label: "Prêts à déployer", 
    icon: Target, 
    color: "text-warning",
    bgColor: "bg-warning/10"
  },
  deployed: { 
    label: "Déployés", 
    icon: CheckCircle2, 
    color: "text-success",
    bgColor: "bg-success/10"
  },
};

const estimateSavings = (detectedIssues: Json): number => {
  if (!detectedIssues || !Array.isArray(detectedIssues)) return 0;
  
  let savings = 0;
  const issuesStr = JSON.stringify(detectedIssues).toLowerCase();
  
  COSTLY_SERVICES.forEach(service => {
    service.patterns.forEach(pattern => {
      if (issuesStr.includes(pattern.toLowerCase())) {
        savings += service.averageMonthlyCost;
      }
    });
  });
  
  return savings;
};

interface FleetDashboardProps {
  onSelectProject?: (project: FleetProject) => void;
  onNavigate?: (tab: string) => void;
}

export function FleetDashboard({ onSelectProject, onNavigate }: FleetDashboardProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<FleetProject[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const [projectsRes, deploymentsRes] = await Promise.all([
        supabase
          .from("projects_analysis")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("deployment_history")
          .select("id, project_name, status, created_at, deployed_url")
          .order("created_at", { ascending: false })
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (deploymentsRes.error) throw deploymentsRes.error;
      
      setProjects(projectsRes.data || []);
      setDeployments(deploymentsRes.data || []);
    } catch (error) {
      console.error("Error fetching fleet data:", error);
      toast.error("Impossible de charger les données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Categorize projects into Kanban columns
  const getProjectColumn = (project: FleetProject): KanbanColumn => {
    // Check if project has been deployed
    const isDeployed = deployments.some(
      d => d.project_name.toLowerCase() === project.project_name.toLowerCase() && d.status === "success"
    );
    if (isDeployed) return "deployed";
    
    // Check if ready to deploy (score >= 70)
    if (project.status === "analyzed" && (project.portability_score ?? 0) >= 70) return "ready";
    
    // Analyzed but needs work
    if (project.status === "analyzed") return "analyzed";
    
    // Default to pending
    return "pending";
  };

  const groupedProjects = projects.reduce((acc, project) => {
    const column = getProjectColumn(project);
    if (!acc[column]) acc[column] = [];
    acc[column].push(project);
    return acc;
  }, {} as Record<KanbanColumn, FleetProject[]>);

  // Fleet metrics
  const totalProjects = projects.length;
  const deployedCount = groupedProjects.deployed?.length || 0;
  const readyCount = groupedProjects.ready?.length || 0;
  const analyzedCount = groupedProjects.analyzed?.length || 0;
  
  const averageScore = projects.length > 0
    ? Math.round(projects.reduce((sum, p) => sum + (p.portability_score || 0), 0) / projects.length)
    : 0;

  const totalSavings = projects.reduce((sum, p) => sum + estimateSavings(p.detected_issues), 0);

  const deploymentRate = totalProjects > 0 
    ? Math.round((deployedCount / totalProjects) * 100) 
    : 0;

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Chargement du Fleet Dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fleet Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-accent/10 to-primary/10 border-accent/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Layers className="h-8 w-8 text-accent" />
              <div className="text-right">
                <div className="text-3xl font-bold text-foreground">{totalProjects}</div>
                <div className="text-xs text-muted-foreground">Total Projets</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <CheckCircle2 className="h-8 w-8 text-success" />
              <div className="text-right">
                <div className="text-3xl font-bold text-success">{deployedCount}</div>
                <div className="text-xs text-muted-foreground">Déployés</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Rocket className="h-8 w-8 text-warning" />
              <div className="text-right">
                <div className="text-3xl font-bold text-warning">{readyCount}</div>
                <div className="text-xs text-muted-foreground">Prêts</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-info/5 border-info/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <BarChart3 className="h-8 w-8 text-info" />
              <div className="text-right">
                <div className="text-3xl font-bold text-info">{averageScore}</div>
                <div className="text-xs text-muted-foreground">Score Moyen</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <TrendingDown className="h-8 w-8 text-success" />
              <div className="text-right">
                <div className="text-3xl font-bold text-success">${totalSavings}</div>
                <div className="text-xs text-muted-foreground">Économies/mois</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <Target className="h-8 w-8 text-primary" />
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{deploymentRate}%</div>
                <div className="text-xs text-muted-foreground">Taux Deploy</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progression du Portfolio</span>
            <span className="text-sm text-muted-foreground">{deployedCount}/{totalProjects} projets déployés</span>
          </div>
          <Progress value={deploymentRate} className="h-3" />
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <LayoutGrid className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">Fleet Kanban</CardTitle>
                <CardDescription>Vue d'ensemble de tous vos projets par statut</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(Object.keys(COLUMN_CONFIG) as KanbanColumn[]).map((columnKey) => {
              const config = COLUMN_CONFIG[columnKey];
              const columnProjects = groupedProjects[columnKey] || [];
              const Icon = config.icon;

              return (
                <div key={columnKey} className="flex flex-col">
                  {/* Column Header */}
                  <div className={`flex items-center gap-2 p-3 rounded-t-lg ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className={`font-medium text-sm ${config.color}`}>{config.label}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {columnProjects.length}
                    </Badge>
                  </div>

                  {/* Column Content */}
                  <ScrollArea className="flex-1 min-h-[300px] max-h-[500px] border border-t-0 rounded-b-lg bg-muted/20">
                    <div className="p-2 space-y-2">
                      {columnProjects.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          Aucun projet
                        </div>
                      ) : (
                        columnProjects.map((project) => (
                          <Card 
                            key={project.id} 
                            className="cursor-pointer hover:shadow-md transition-all hover:border-accent/50 group"
                            onClick={() => onSelectProject?.(project)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="font-medium text-sm truncate text-foreground">
                                    {project.project_name}
                                  </span>
                                </div>
                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </div>
                              
                              <div className="flex items-center justify-between">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${getScoreColor(project.portability_score)}`}
                                >
                                  {project.portability_score ?? "N/A"}/100
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(project.created_at), { 
                                    addSuffix: true, 
                                    locale: fr 
                                  })}
                                </span>
                              </div>

                              {estimateSavings(project.detected_issues) > 0 && (
                                <div className="mt-2 flex items-center gap-1 text-xs text-success">
                                  <TrendingDown className="h-3 w-3" />
                                  -{estimateSavings(project.detected_issues)}$/mois
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex items-center justify-center gap-4">
        <Button 
          onClick={() => onNavigate?.("batch-import")} 
          className="gap-2 bg-gradient-to-r from-accent to-primary"
        >
          <Zap className="h-4 w-4" />
          Import Batch
        </Button>
        <Button 
          variant="outline" 
          onClick={() => onNavigate?.("import")}
          className="gap-2"
        >
          <Rocket className="h-4 w-4" />
          Nouveau Projet
        </Button>
      </div>
    </div>
  );
}

export default FleetDashboard;
