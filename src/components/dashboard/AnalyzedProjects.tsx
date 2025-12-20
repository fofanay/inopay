import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Package, 
  RefreshCw,
  Rocket,
  Trash2,
  FolderOpen,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Json } from "@/integrations/supabase/types";

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

interface AnalyzedProjectsProps {
  onSelectProject?: (project: AnalyzedProject) => void;
  onRefresh?: () => void;
  loadingProjectId?: string | null;
}

export function AnalyzedProjects({ onSelectProject, onRefresh, loadingProjectId }: AnalyzedProjectsProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<AnalyzedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

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
      toast.error("Impossible de charger les projets");
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
      toast.success("Projet supprimé");
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Impossible de supprimer le projet");
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
          <p className="mt-2 text-muted-foreground">Chargement des projets...</p>
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
          <h3 className="font-medium text-foreground mb-1">Aucun projet analysé</h3>
          <p className="text-sm text-muted-foreground">
            Importez un projet pour commencer l'analyse
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
              Projets analysés
            </CardTitle>
            <CardDescription>
              {projects.length} projet(s) analysé(s)
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { fetchProjects(); onRefresh?.(); }}
            className="gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Projet</TableHead>
              <TableHead className="text-muted-foreground">Score</TableHead>
              <TableHead className="text-muted-foreground">Statut</TableHead>
              <TableHead className="text-muted-foreground">Date</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
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
                  <Badge variant="outline" className="capitalize border-border text-muted-foreground">
                    {project.status === "analyzed" ? "Analysé" : project.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(new Date(project.created_at), { 
                    addSuffix: true, 
                    locale: fr 
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
                        Déployer
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
