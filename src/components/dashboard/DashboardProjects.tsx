import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Rocket
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface DashboardProjectsProps {
  onNavigate: (tab: string) => void;
}

interface Project {
  id: string;
  project_name: string;
  portability_score: number | null;
  status: string;
  created_at: string;
}

export function DashboardProjects({ onNavigate }: DashboardProjectsProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .from("projects_analysis")
          .select("id, project_name, portability_score, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        setProjects(data || []);
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [user]);

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getStatusIcon = (status: string, score: number | null) => {
    if (status === "analyzed" && (score ?? 0) >= 70) {
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
    if (status === "analyzed") {
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-dashed border-2">
          <CardContent className="py-12 text-center">
            <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Aucun projet analysé</h3>
            <p className="text-muted-foreground mb-4">
              Commencez par analyser votre premier projet
            </p>
            <Button onClick={() => onNavigate("liberation")}>
              <Rocket className="h-4 w-4 mr-2" />
              Analyser un projet
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Projets Récents</CardTitle>
                <CardDescription>{projects.length} projet(s) analysé(s)</CardDescription>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onNavigate("liberation")}
            >
              Nouveau
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {projects.map((project, index) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {getStatusIcon(project.status, project.portability_score)}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{project.project_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(project.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${getScoreColor(project.portability_score)}`}>
                    {project.portability_score ?? "—"}
                  </span>
                  {project.status === "analyzed" && (project.portability_score ?? 0) >= 70 && (
                    <Badge className="bg-success/10 text-success border-success/20 text-xs">
                      Prêt
                    </Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
