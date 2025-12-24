import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecurityBadge } from "@/components/ui/security-badge";
import { 
  Rocket, 
  ExternalLink, 
  Clock, 
  Server, 
  CheckCircle2, 
  Trash2,
  RefreshCw,
  History,
  Globe,
  Zap,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useTranslation } from "react-i18next";

interface DeploymentRecord {
  id: string;
  project_name: string;
  provider: string;
  host: string | null;
  files_uploaded: number;
  deployment_type: string;
  status: string;
  deployed_url: string | null;
  created_at: string;
}

interface DeploymentHistoryProps {
  onRefresh?: () => void;
}

export function DeploymentHistory({ onRefresh }: DeploymentHistoryProps) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  
  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  const fetchDeployments = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("deployment_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setDeployments(data || []);
    } catch (error) {
      console.error("Error fetching deployments:", error);
      toast.error(t("deploymentHistory.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, [user]);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const { error } = await supabase
        .from("deployment_history")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setDeployments(prev => prev.filter(d => d.id !== id));
      toast.success(t("deploymentHistory.deleteSuccess"));
    } catch (error) {
      console.error("Error deleting deployment:", error);
      toast.error(t("deploymentHistory.deleteError"));
    } finally {
      setDeleting(null);
    }
  };

  const getProviderIcon = (provider: string) => {
    const providerLower = provider.toLowerCase();
    if (providerLower.includes("ionos")) return "🔵";
    if (providerLower.includes("ovh")) return "🔷";
    if (providerLower.includes("green")) return "🌱";
    if (providerLower.includes("hostinger")) return "🟣";
    if (providerLower.includes("o2switch")) return "⚡";
    if (providerLower.includes("vercel")) return "▲";
    if (providerLower.includes("netlify")) return "◆";
    return "🌐";
  };

  const getDeploymentTypeBadge = (type: string) => {
    switch (type) {
      case "ftp":
        return <Badge variant="outline" className="gap-1"><Server className="h-3 w-3" />FTP</Badge>;
      case "github":
        return <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" />GitHub</Badge>;
      case "direct":
        return (
          <Badge variant="outline" className="gap-1 bg-primary/10 border-primary/30 text-primary">
            <Zap className="h-3 w-3" />
            {t("deploymentHistory.ultraFast")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">{t("common.loading")}</p>
        </CardContent>
      </Card>
    );
  }

  if (deployments.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <History className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">{t("deploymentHistory.noDeployments")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("deploymentHistory.noDeploymentsDesc")}
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
              <Rocket className="h-5 w-5 text-primary" />
              {t("deploymentHistory.title")}
            </CardTitle>
            <CardDescription>
              {t("deploymentHistory.lastDeployments", { count: deployments.length })}
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => { fetchDeployments(); onRefresh?.(); }}
            className="gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            {t("deploymentHistory.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {deployments.map((deployment) => (
            <div
              key={deployment.id}
              className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors group"
            >
              {/* Provider icon */}
              <div className="flex-shrink-0 text-2xl">
                {getProviderIcon(deployment.provider)}
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-foreground truncate">
                    {deployment.project_name}
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  {/* Security badge for direct deployments */}
                  {deployment.deployment_type === "direct" && (
                    <SecurityBadge type="ultra-rapide" size="default" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                  <span>{deployment.provider}</span>
                  <span>•</span>
                  <span>{t("deploymentHistory.filesCount", { count: deployment.files_uploaded })}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(deployment.created_at), { 
                      addSuffix: true, 
                      locale: dateLocale 
                    })}
                  </span>
                </div>
              </div>

              {/* Type badge */}
              <div className="hidden sm:block">
                {getDeploymentTypeBadge(deployment.deployment_type)}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {/* Liberation Report Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="h-8 px-2 gap-1 text-primary hover:text-primary hover:bg-primary/10"
                >
                  <Link to={`/rapport-liberation/${deployment.id}`}>
                    <FileText className="h-4 w-4" />
                    <span className="hidden md:inline text-xs">{t("deploymentHistory.report")}</span>
                  </Link>
                </Button>
                {deployment.deployed_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(deployment.deployed_url!, "_blank")}
                    className="h-8 w-8 p-0"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(deployment.id)}
                  disabled={deleting === deployment.id}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  {deleting === deployment.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to save a deployment to history and send liberation report email
export async function saveDeploymentToHistory(
  userId: string,
  projectName: string,
  provider: string,
  options: {
    host?: string;
    filesUploaded?: number;
    deploymentType?: string;
    deployedUrl?: string;
    serverIp?: string;
    coolifyUrl?: string;
    costAnalysis?: {
      oldMonthlyCost: number;
      newMonthlyCost: number;
      hostingSavings: number;
      apiSavings: number;
      totalSavings: number;
    };
    servicesReplaced?: Array<{ from: string; to: string; savings: number }>;
    cleanedDependencies?: string[];
    portabilityScoreBefore?: number;
    portabilityScoreAfter?: number;
    hostingType?: string;
    sendEmailReport?: boolean;
  } = {}
) {
  try {
    const { data, error } = await supabase
      .from("deployment_history")
      .insert({
        user_id: userId,
        project_name: projectName,
        provider,
        host: options.host,
        files_uploaded: options.filesUploaded || 0,
        deployment_type: options.deploymentType || "ftp",
        status: "success",
        deployed_url: options.deployedUrl,
        server_ip: options.serverIp,
        coolify_url: options.coolifyUrl,
        cost_analysis: options.costAnalysis,
        services_replaced: options.servicesReplaced,
        cleaned_dependencies: options.cleanedDependencies,
        portability_score_before: options.portabilityScoreBefore,
        portability_score_after: options.portabilityScoreAfter || 100,
        hosting_type: options.hostingType || "vps",
      })
      .select()
      .single();

    if (error) throw error;

    const deploymentId = data?.id;

    // Send Liberation Report email automatically
    if (deploymentId && options.sendEmailReport !== false) {
      try {
        console.log("Sending liberation report email for deployment:", deploymentId);
        await supabase.functions.invoke("send-liberation-report", {
          body: { deploymentId }
        });
        console.log("Liberation report email sent successfully");
      } catch (emailError) {
        console.error("Failed to send liberation report email:", emailError);
        // Don't fail the deployment save if email fails
      }
    }

    return { success: true, deploymentId };
  } catch (error) {
    console.error("Error saving deployment history:", error);
    return { success: false, error };
  }
}
