import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/layout/Layout";
import LiberationReportContent, { LiberationReportData } from "@/components/dashboard/LiberationReportContent";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileDown, 
  ExternalLink, 
  ArrowLeft, 
  Home,
  Share2,
  Printer
} from "lucide-react";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

interface DeploymentRecord {
  id: string;
  project_name: string;
  provider: string;
  host: string | null;
  files_uploaded: number | null;
  deployment_type: string;
  created_at: string;
  deployed_url: string | null;
  cost_analysis: Json | null;
  cleaned_dependencies: string[] | null;
  server_ip: string | null;
  coolify_url: string | null;
  portability_score_before: number | null;
  portability_score_after: number | null;
  hosting_type: string | null;
  services_replaced: Json | null;
}

interface ServiceReplacement {
  from: string;
  to: string;
  savings: number;
}

interface CostAnalysis {
  oldMonthlyCost: number;
  newMonthlyCost: number;
  hostingSavings: number;
  apiSavings: number;
  totalSavings: number;
}

const LiberationReport = () => {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [deployment, setDeployment] = useState<DeploymentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user && deploymentId) {
      fetchDeployment();
    }
  }, [user, authLoading, deploymentId]);

  const fetchDeployment = async () => {
    try {
      const { data, error } = await supabase
        .from("deployment_history")
        .select("*")
        .eq("id", deploymentId)
        .eq("user_id", user?.id)
        .single();

      if (error) throw error;
      setDeployment(data as DeploymentRecord);

      // Mark report as generated
      await supabase
        .from("deployment_history")
        .update({ liberation_report_generated: true })
        .eq("id", deploymentId);

    } catch (error) {
      console.error("Error fetching deployment:", error);
      toast.error("Impossible de charger le rapport");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.getElementById("liberation-report");
      
      if (!element) {
        throw new Error("Report element not found");
      }

      const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: `Rapport-Liberation-${deployment?.project_name || "projet"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          letterRendering: true
        },
        jsPDF: { 
          unit: "in", 
          format: "a4", 
          orientation: "portrait" 
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success("PDF exporté avec succès !");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erreur lors de l'export PDF");
    } finally {
      setExporting(false);
    }
  };

  const shareReport = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lien copié dans le presse-papier !");
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };

  const handlePrint = () => {
    toast.info("Préparation de l'impression...");
    // Small delay to allow toast to show before print dialog
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const transformDeploymentToReportData = (dep: DeploymentRecord): LiberationReportData => {
    // Parse cost_analysis
    let costAnalysis: CostAnalysis | undefined;
    if (dep.cost_analysis && typeof dep.cost_analysis === 'object') {
      const ca = dep.cost_analysis as Record<string, unknown>;
      costAnalysis = {
        oldMonthlyCost: (ca.oldMonthlyCost as number) || 150,
        newMonthlyCost: (ca.newMonthlyCost as number) || 10,
        hostingSavings: (ca.hostingSavings as number) || 90,
        apiSavings: (ca.apiSavings as number) || 50,
        totalSavings: (ca.totalSavings as number) || 140
      };
    }

    // Parse services_replaced
    let servicesReplaced: ServiceReplacement[] = [];
    if (dep.services_replaced && Array.isArray(dep.services_replaced)) {
      servicesReplaced = (dep.services_replaced as unknown[]).map((s) => {
        const service = s as Record<string, unknown>;
        return {
          from: (service.from as string) || '',
          to: (service.to as string) || '',
          savings: (service.savings as number) || 0
        };
      });
    }

    // Default services if none provided
    if (servicesReplaced.length === 0) {
      servicesReplaced = [
        { from: "Lovable Hosting", to: "Self-hosted VPS", savings: 50 },
        { from: "@lovable/ui-kit", to: "shadcn/ui", savings: 0 },
        { from: "lovable-tagger", to: "Supprimé", savings: 0 }
      ];
    }

    // Default cleaned dependencies
    const cleanedDeps = dep.cleaned_dependencies && dep.cleaned_dependencies.length > 0
      ? dep.cleaned_dependencies
      : ["@lovable/ui-kit", "@gptengineer/core", "lovable-tagger"];

    return {
      projectName: dep.project_name,
      deployedUrl: dep.deployed_url || undefined,
      hostingProvider: dep.provider || "Auto-hébergé",
      hostingType: (dep.hosting_type as 'vps' | 'ftp' | 'github') || 
                   (dep.deployment_type === 'ftp' ? 'ftp' : 'vps'),
      serverIp: dep.server_ip || undefined,
      coolifyUrl: dep.coolify_url || undefined,
      deploymentDate: dep.created_at,
      costAnalysis,
      servicesReplaced,
      cleanedDependencies: cleanedDeps,
      portabilityScoreBefore: dep.portability_score_before || 65,
      portabilityScoreAfter: dep.portability_score_after || 100,
      filesUploaded: dep.files_uploaded || undefined
    };
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto py-8 px-4">
          <Skeleton className="h-12 w-3/4 mx-auto mb-8" />
          <Skeleton className="h-64 w-full mb-6" />
          <Skeleton className="h-48 w-full mb-6" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Layout>
    );
  }

  if (!deployment) {
    return (
      <Layout>
        <div className="container max-w-4xl mx-auto py-16 px-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Rapport introuvable</h1>
          <p className="text-muted-foreground mb-8">
            Le déploiement demandé n'existe pas ou vous n'y avez pas accès.
          </p>
          <Button asChild>
            <Link to="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Retour au Dashboard
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const reportData = transformDeploymentToReportData(deployment);

  return (
    <Layout>
      {/* Action Bar */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container max-w-4xl mx-auto py-3 px-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={shareReport} className="hidden sm:flex">
              <Share2 className="h-4 w-4 mr-2" />
              Partager
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrint}
              className="gap-1"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimer</span>
            </Button>
            <Button 
              size="sm" 
              onClick={exportToPDF}
              disabled={exporting}
              className="bg-primary hover:bg-primary/90"
            >
              <FileDown className="h-4 w-4 mr-2" />
              {exporting ? "Export..." : "PDF"}
            </Button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <LiberationReportContent data={reportData} />

        {/* Bottom Actions */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          {reportData.coolifyUrl && (
            <Button variant="outline" asChild>
              <a href={reportData.coolifyUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Accéder au Dashboard Coolify
              </a>
            </Button>
          )}
          {reportData.deployedUrl && (
            <Button variant="outline" asChild>
              <a href={reportData.deployedUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Voir mon Application
              </a>
            </Button>
          )}
          <Button asChild>
            <Link to="/dashboard">
              <Home className="h-4 w-4 mr-2" />
              Retour au Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default LiberationReport;
