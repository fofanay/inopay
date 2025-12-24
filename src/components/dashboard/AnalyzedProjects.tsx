import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Package, 
  RefreshCw,
  Rocket,
  Trash2,
  FolderOpen,
  Loader2,
  TrendingDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Json } from "@/integrations/supabase/types";
import { COSTLY_SERVICES } from "@/lib/costOptimization";
import { useTranslation } from "react-i18next";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";

export interface AnalyzedProject {
  id: string;
  project_name: string;
  file_name: string | null;
  portability_score: number | null;
  status: string;
  created_at: string;
  detected_issues: Json;
  recommendations: Json;
}

// Helper to estimate potential savings from detected issues
const estimateSavings = (detectedIssues: Json): number => {
  if (!detectedIssues || !Array.isArray(detectedIssues)) return 0;
  
  let savings = 0;
  const issuesStr = JSON.stringify(detectedIssues).toLowerCase();
  
  // Check for patterns in detected issues
  COSTLY_SERVICES.forEach(service => {
    service.patterns.forEach(pattern => {
      if (issuesStr.includes(pattern.toLowerCase())) {
        savings += service.averageMonthlyCost;
      }
    });
    service.envPatterns.forEach(pattern => {
      if (issuesStr.includes(pattern.toLowerCase())) {
        if (!savings) savings += service.averageMonthlyCost;
      }
    });
  });
  
  return savings;
};

interface AnalyzedProjectsProps {
  onSelectProject?: (project: AnalyzedProject) => void;
  onRefresh?: () => void;
  loadingProjectId?: string | null;
}

export function AnalyzedProjects({ onSelectProject, onRefresh, loadingProjectId }: AnalyzedProjectsProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useLocaleFormat();
  const [projects, setProjects] = useState<AnalyzedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  const fetchProjects = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("projects_analysis")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error(t("analyzedProjects.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from("projects_analysis")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setProjects(prev => prev.filter(p => p.id !== id));
      toast.success(t("analyzedProjects.deleteSuccess"));
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error(t("analyzedProjects.deleteError"));
    } finally {
      setDeleting(null);
    }
  };

  const getScoreBadgeClass = (score: number | null) => {
    if (score === null) return "bg-muted text-muted-foreground";
    if (score >= 80) return "bg-success/10 text-success border-success/20";
    if (score >= 60) return "bg-warning/10 text-warning border-warning/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">{t("analyzedProjects.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">{t("analyzedProjects.noProjects")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("analyzedProjects.noProjectsDesc")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {t("analyzedProjects.title")}
            </CardTitle>
            <CardDescription>
              {projects.length} {t("analyzedProjects.projectCount")}
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { fetchProjects(); onRefresh?.(); }}
            className="gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            {t("analyzedProjects.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">{t("analyzedProjects.columns.project")}</TableHead>
              <TableHead className="text-muted-foreground">{t("analyzedProjects.columns.score")}</TableHead>
              <TableHead className="text-muted-foreground">{t("analyzedProjects.columns.savings")}</TableHead>
              <TableHead className="text-muted-foreground">{t("analyzedProjects.columns.status")}</TableHead>
              <TableHead className="text-muted-foreground">{t("analyzedProjects.columns.date")}</TableHead>
              <TableHead className="text-muted-foreground text-right">{t("analyzedProjects.columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => {
              const potentialSavings = estimateSavings(project.detected_issues);
              
              return (
                <TableRow key={project.id} className="border-border hover:bg-muted/50 group">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-foreground">{project.project_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getScoreBadgeClass(project.portability_score)}>
                      {project.portability_score !== null ? `${project.portability_score}/100` : "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {potentialSavings > 0 ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge className="bg-success/10 text-success border-success/20 gap-1 cursor-help">
                              <TrendingDown className="h-3 w-3" />
                              -{formatCurrency(potentialSavings, i18n.language === 'fr' ? 'CAD' : 'USD')}/{t("common.month")}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t("analyzedProjects.savingsTooltip")}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-muted">
                        {t("analyzedProjects.optimized")}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize border-border text-muted-foreground">
                      {project.status === "analyzed" ? t("analyzedProjects.analyzed") : project.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(project.created_at), { 
                      addSuffix: true, 
                      locale: dateLocale 
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onSelectProject && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectProject(project)}
                          disabled={loadingProjectId === project.id}
                          className="h-8 gap-1 text-primary hover:text-primary hover:bg-primary/10"
                        >
                          {loadingProjectId === project.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Rocket className="h-4 w-4" />
                          )}
                          {t("analyzedProjects.deploy")}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(project.id)}
                        disabled={deleting === project.id || loadingProjectId === project.id}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      >
                        {deleting === project.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}