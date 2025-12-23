import { useState, useEffect, useRef } from "react";
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
  FolderOpen,
  FileDown,
  Loader2,
  ExternalLink,
  GitBranch,
  Server
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Json } from "@/integrations/supabase/types";
import { COSTLY_SERVICES } from "@/lib/costOptimization";
import html2pdf from "html2pdf.js";

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
  source: "history" | "server";
}

interface ServerDeploymentRecord {
  id: string;
  project_name: string;
  status: string;
  deployed_url: string | null;
  created_at: string;
  github_repo_url: string | null;
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

interface MyPersonalFleetProps {
  onSelectProject?: (project: FleetProject) => void;
  onNavigate?: (tab: string) => void;
}

export function MyPersonalFleet({ onSelectProject, onNavigate }: MyPersonalFleetProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<FleetProject[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch from ALL THREE sources: projects_analysis, deployment_history, AND server_deployments
      const [projectsRes, historyRes, serverDeploymentsRes] = await Promise.all([
        supabase
          .from("projects_analysis")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("deployment_history")
          .select("id, project_name, status, created_at, deployed_url")
          .order("created_at", { ascending: false }),
        supabase
          .from("server_deployments")
          .select("id, project_name, status, deployed_url, created_at, github_repo_url")
          .order("created_at", { ascending: false })
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (historyRes.error) throw historyRes.error;
      if (serverDeploymentsRes.error) throw serverDeploymentsRes.error;
      
      // Merge deployments from BOTH sources with a source indicator
      const historyDeployments: DeploymentRecord[] = (historyRes.data || []).map(d => ({
        ...d,
        source: "history" as const
      }));
      
      const serverDeployments: DeploymentRecord[] = (serverDeploymentsRes.data || []).map(d => ({
        id: d.id,
        project_name: d.project_name,
        status: d.status === "deployed" ? "success" : d.status,
        created_at: d.created_at,
        deployed_url: d.deployed_url,
        source: "server" as const
      }));
      
      // Combine all deployments
      const allDeployments = [...historyDeployments, ...serverDeployments];
      
      setProjects(projectsRes.data || []);
      setDeployments(allDeployments);
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
    // Check if project has been deployed (in EITHER deployment_history OR server_deployments)
    const isDeployed = deployments.some(
      d => d.project_name.toLowerCase() === project.project_name.toLowerCase() && 
           (d.status === "success" || d.status === "deployed")
    );
    if (isDeployed) return "deployed";
    
    // Check if ready to deploy (score >= 70)
    if (project.status === "analyzed" && (project.portability_score ?? 0) >= 70) return "ready";
    
    // Analyzed but needs work
    if (project.status === "analyzed") return "analyzed";
    
    // Default to pending
    return "pending";
  };
  
  // Get deployment info for a project (from either source)
  const getDeploymentInfo = (projectName: string): DeploymentRecord | undefined => {
    return deployments.find(
      d => d.project_name.toLowerCase() === projectName.toLowerCase() && 
           (d.status === "success" || d.status === "deployed")
    );
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

  const handleExportPDF = async () => {
    setExporting(true);
    
    try {
      const reportContent = document.createElement("div");
      reportContent.innerHTML = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 40px; color: #1a1a2e;">
          <div style="text-align: center; margin-bottom: 40px;">
            <h1 style="font-size: 28px; margin: 0; color: #7c3aed;">Rapport Fleet Portfolio</h1>
            <p style="color: #6b7280; margin-top: 8px;">Généré le ${format(new Date(), "dd MMMM yyyy à HH:mm", { locale: fr })}</p>
          </div>

          <div style="background: linear-gradient(135deg, #f3f4f6, #e5e7eb); border-radius: 12px; padding: 24px; margin-bottom: 32px;">
            <h2 style="font-size: 18px; margin: 0 0 20px 0; color: #374151;">Métriques Globales</h2>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
              <div style="background: white; padding: 16px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #7c3aed;">${totalProjects}</div>
                <div style="font-size: 12px; color: #6b7280;">Total Projets</div>
              </div>
              <div style="background: white; padding: 16px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #22c55e;">${deployedCount}</div>
                <div style="font-size: 12px; color: #6b7280;">Déployés</div>
              </div>
              <div style="background: white; padding: 16px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #f59e0b;">${readyCount}</div>
                <div style="font-size: 12px; color: #6b7280;">Prêts à Déployer</div>
              </div>
              <div style="background: white; padding: 16px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #3b82f6;">${analyzedCount}</div>
                <div style="font-size: 12px; color: #6b7280;">En Analyse</div>
              </div>
              <div style="background: white; padding: 16px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #7c3aed;">${averageScore}</div>
                <div style="font-size: 12px; color: #6b7280;">Score Moyen</div>
              </div>
              <div style="background: white; padding: 16px; border-radius: 8px; text-align: center;">
                <div style="font-size: 32px; font-weight: bold; color: #22c55e;">$${totalSavings}</div>
                <div style="font-size: 12px; color: #6b7280;">Économies/mois</div>
              </div>
            </div>
          </div>

          <div style="background: #f3f4f6; border-radius: 12px; padding: 16px; margin-bottom: 32px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: 500;">Progression du Portfolio</span>
              <span style="color: #6b7280;">${deployedCount}/${totalProjects} projets déployés (${deploymentRate}%)</span>
            </div>
            <div style="background: #d1d5db; border-radius: 9999px; height: 12px; overflow: hidden;">
              <div style="background: linear-gradient(90deg, #7c3aed, #22c55e); height: 100%; width: ${deploymentRate}%; border-radius: 9999px;"></div>
            </div>
          </div>

          <h2 style="font-size: 18px; margin: 0 0 16px 0; color: #374151;">Liste des Projets</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="text-align: left; padding: 12px; border-bottom: 2px solid #e5e7eb;">Projet</th>
                <th style="text-align: center; padding: 12px; border-bottom: 2px solid #e5e7eb;">Score</th>
                <th style="text-align: center; padding: 12px; border-bottom: 2px solid #e5e7eb;">Statut</th>
                <th style="text-align: right; padding: 12px; border-bottom: 2px solid #e5e7eb;">Économies</th>
                <th style="text-align: right; padding: 12px; border-bottom: 2px solid #e5e7eb;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${projects.map((project, idx) => {
                const column = getProjectColumn(project);
                const statusLabel = COLUMN_CONFIG[column].label;
                const statusColor = column === "deployed" ? "#22c55e" : column === "ready" ? "#f59e0b" : column === "analyzed" ? "#3b82f6" : "#6b7280";
                const savings = estimateSavings(project.detected_issues);
                return `
                  <tr style="background: ${idx % 2 === 0 ? "#ffffff" : "#f9fafb"};">
                    <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${project.project_name}</td>
                    <td style="text-align: center; padding: 12px; border-bottom: 1px solid #e5e7eb;">
                      <span style="background: ${(project.portability_score ?? 0) >= 80 ? "#dcfce7" : (project.portability_score ?? 0) >= 60 ? "#fef3c7" : "#fee2e2"}; color: ${(project.portability_score ?? 0) >= 80 ? "#166534" : (project.portability_score ?? 0) >= 60 ? "#92400e" : "#991b1b"}; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
                        ${project.portability_score ?? "N/A"}
                      </span>
                    </td>
                    <td style="text-align: center; padding: 12px; border-bottom: 1px solid #e5e7eb;">
                      <span style="color: ${statusColor}; font-weight: 500;">${statusLabel}</span>
                    </td>
                    <td style="text-align: right; padding: 12px; border-bottom: 1px solid #e5e7eb; color: ${savings > 0 ? "#22c55e" : "#6b7280"};">
                      ${savings > 0 ? `-$${savings}/mois` : "-"}
                    </td>
                    <td style="text-align: right; padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">
                      ${format(new Date(project.created_at), "dd/MM/yyyy", { locale: fr })}
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>

          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px;">
            <p>Rapport généré par InoPay • ${format(new Date(), "yyyy")}</p>
            <p>Économies totales estimées: $${totalSavings * 12}/an</p>
          </div>
        </div>
      `;

      const opt = {
        margin: 10,
        filename: `fleet-report-${format(new Date(), "yyyy-MM-dd")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      };

      await html2pdf().set(opt).from(reportContent).save();
      toast.success("Rapport PDF exporté avec succès");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erreur lors de l'export PDF");
    } finally {
      setExporting(false);
    }
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
    <div className="space-y-4 md:space-y-6">
      {/* Fleet Metrics - Scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 min-w-[600px] md:min-w-0">
          <Card className="bg-gradient-to-br from-accent/10 to-primary/10 border-accent/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <Layers className="h-6 md:h-8 w-6 md:w-8 text-accent" />
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-bold text-foreground">{totalProjects}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Total Projets</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <CheckCircle2 className="h-6 md:h-8 w-6 md:w-8 text-success" />
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-bold text-success">{deployedCount}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Déployés</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-warning/5 border-warning/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <Rocket className="h-6 md:h-8 w-6 md:w-8 text-warning" />
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-bold text-warning">{readyCount}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Prêts</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-info/5 border-info/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <BarChart3 className="h-6 md:h-8 w-6 md:w-8 text-info" />
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-bold text-info">{averageScore}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Score Moyen</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <TrendingDown className="h-6 md:h-8 w-6 md:w-8 text-success" />
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-bold text-success">${totalSavings}</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Économies/mois</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <Target className="h-6 md:h-8 w-6 md:w-8 text-primary" />
                <div className="text-right">
                  <div className="text-2xl md:text-3xl font-bold text-primary">{deploymentRate}%</div>
                  <div className="text-[10px] md:text-xs text-muted-foreground">Taux Deploy</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Deployment Progress */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
            <span className="text-sm font-medium text-foreground">Progression du Portfolio</span>
            <span className="text-xs sm:text-sm text-muted-foreground">{deployedCount}/{totalProjects} projets déployés</span>
          </div>
          <Progress value={deploymentRate} className="h-2 md:h-3" />
        </CardContent>
      </Card>

      {/* Kanban Board */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 md:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center shrink-0">
                <LayoutGrid className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-lg md:text-xl">Fleet Kanban</CardTitle>
                <CardDescription className="text-xs md:text-sm truncate">Vue d'ensemble de tous vos projets par statut</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportPDF} 
                disabled={exporting || projects.length === 0}
                className="gap-2 text-xs md:text-sm"
              >
                {exporting ? (
                  <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin" />
                ) : (
                  <FileDown className="h-3 w-3 md:h-4 md:w-4" />
                )}
                <span className="hidden sm:inline">Export PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
              <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 text-xs md:text-sm">
                <RefreshCw className="h-3 w-3 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Actualiser</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {/* Kanban - Horizontal scroll on mobile */}
          <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0 pb-2">
            <div className="grid grid-cols-4 gap-3 md:gap-4 min-w-[800px] md:min-w-0">
              {(Object.keys(COLUMN_CONFIG) as KanbanColumn[]).map((columnKey) => {
                const config = COLUMN_CONFIG[columnKey];
                const columnProjects = groupedProjects[columnKey] || [];
                const Icon = config.icon;

                return (
                  <div key={columnKey} className="flex flex-col min-w-[180px] md:min-w-0">
                    {/* Column Header */}
                    <div className={`flex items-center gap-2 p-2 md:p-3 rounded-t-lg ${config.bgColor}`}>
                      <Icon className={`h-3 w-3 md:h-4 md:w-4 ${config.color}`} />
                      <span className={`font-medium text-xs md:text-sm ${config.color} truncate`}>{config.label}</span>
                      <Badge variant="outline" className="ml-auto text-[10px] md:text-xs shrink-0">
                        {columnProjects.length}
                      </Badge>
                    </div>

                    {/* Column Content */}
                    <ScrollArea className="flex-1 min-h-[200px] md:min-h-[300px] max-h-[300px] md:max-h-[500px] border border-t-0 rounded-b-lg bg-muted/20">
                      <div className="p-1.5 md:p-2 space-y-1.5 md:space-y-2">
                        {columnProjects.length === 0 ? (
                          <div className="text-center py-6 md:py-8 text-muted-foreground text-xs md:text-sm">
                            Aucun projet
                          </div>
                        ) : (
                          columnProjects.map((project) => {
                            const deploymentInfo = getDeploymentInfo(project.project_name);
                            const column = getProjectColumn(project);
                            
                            return (
                              <Card 
                                key={project.id} 
                                className="cursor-pointer hover:shadow-md transition-all hover:border-accent/50 group"
                                onClick={() => onSelectProject?.(project)}
                              >
                                <CardContent className="p-2 md:p-3">
                                  <div className="flex items-start justify-between gap-1 md:gap-2 mb-1 md:mb-2">
                                    <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                                      <FolderOpen className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground shrink-0" />
                                      <span className="font-medium text-xs md:text-sm truncate text-foreground">
                                        {project.project_name}
                                      </span>
                                    </div>
                                    <ArrowRight className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </div>
                                  
                                  <div className="flex items-center justify-between">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-[10px] md:text-xs ${getScoreColor(project.portability_score)}`}
                                    >
                                      {project.portability_score ?? "N/A"}/100
                                    </Badge>
                                    <span className="text-[10px] md:text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(project.created_at), { 
                                        addSuffix: true, 
                                        locale: fr 
                                      })}
                                    </span>
                                  </div>

                                  {estimateSavings(project.detected_issues) > 0 && (
                                    <div className="mt-1.5 md:mt-2 flex items-center gap-1 text-[10px] md:text-xs text-success">
                                      <TrendingDown className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                      -{estimateSavings(project.detected_issues)}$/mois
                                    </div>
                                  )}
                                  
                                  {/* Show deployment URL if deployed */}
                                  {column === "deployed" && deploymentInfo?.deployed_url && (
                                    <a
                                      href={deploymentInfo.deployed_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="mt-1.5 md:mt-2 flex items-center gap-1 text-[10px] md:text-xs text-primary hover:underline"
                                    >
                                      <ExternalLink className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                      <span className="truncate">{new URL(deploymentInfo.deployed_url).hostname}</span>
                                    </a>
                                  )}
                                  
                                  {/* Show source badge if deployed from server */}
                                  {column === "deployed" && deploymentInfo?.source === "server" && (
                                    <Badge variant="outline" className="mt-1.5 text-[9px] gap-1 bg-accent/10 text-accent border-accent/30">
                                      <Server className="h-2 w-2" />
                                      VPS
                                    </Badge>
                                  )}
                                  
                                  {/* Action buttons based on status */}
                                  <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {column === "ready" && (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="h-6 text-[10px] px-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onNavigate?.("deploy-choice");
                                        }}
                                      >
                                        <Rocket className="h-2.5 w-2.5 mr-1" />
                                        Déployer
                                      </Button>
                                    )}
                                    {column === "deployed" && (
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="h-6 text-[10px] px-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onNavigate?.("sync-mirror");
                                        }}
                                      >
                                        <GitBranch className="h-2.5 w-2.5 mr-1" />
                                        Sync
                                      </Button>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-4">
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

export default MyPersonalFleet;
