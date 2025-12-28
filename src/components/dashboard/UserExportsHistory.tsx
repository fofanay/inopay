import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { 
  FileText, 
  Download, 
  RefreshCw, 
  Loader2, 
  ExternalLink,
  CheckCircle2,
  Clock,
  Package,
  Github
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import JSZip from "jszip";

interface DeploymentRecord {
  id: string;
  project_name: string;
  provider: string;
  deployment_type: string;
  files_uploaded: number;
  deployed_url: string | null;
  created_at: string;
  status: string;
  archive_path: string | null;
  portability_score_after: number | null;
}

export function UserExportsHistory() {
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pushingToGitHub, setPushingToGitHub] = useState<string | null>(null);
  const [gitHubProgress, setGitHubProgress] = useState(0);
  const [gitHubMessage, setGitHubMessage] = useState("");

  const fetchDeployments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("deployment_history")
        .select("id, project_name, provider, deployment_type, files_uploaded, deployed_url, created_at, status, archive_path, portability_score_after")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setDeployments(data || []);
    } catch (error) {
      console.error("Error fetching deployments:", error);
      toast.error("Erreur lors du chargement de l'historique");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, []);

  const handleDownload = async (deployment: DeploymentRecord) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Vous devez être connecté");
        return;
      }

      // Try archive_path first, then fallback to project name
      const archivePath = deployment.archive_path || `${userData.user.id}/${deployment.project_name}.zip`;

      const { data, error } = await supabase.storage
        .from("cleaned-archives")
        .download(archivePath);

      if (error) {
        toast.error("Fichier non disponible");
        return;
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deployment.project_name}_cleaned.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Téléchargement démarré");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handlePushToGitHub = async (deployment: DeploymentRecord) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Vous devez être connecté");
        return;
      }

      // Get user settings for GitHub config
      const { data: settings, error: settingsError } = await supabase
        .from("user_settings")
        .select("github_destination_token, github_destination_username, default_repo_private")
        .eq("user_id", userData.user.id)
        .single();

      if (settingsError || !settings?.github_destination_token || !settings?.github_destination_username) {
        toast.error("Configuration GitHub manquante. Allez dans Paramètres > GitHub pour configurer.");
        return;
      }

      setPushingToGitHub(deployment.id);
      setGitHubProgress(0);
      setGitHubMessage("Téléchargement de l'archive...");

      // Download the archive
      const archivePath = deployment.archive_path || `${userData.user.id}/${deployment.project_name}.zip`;
      
      const { data: archiveData, error: downloadError } = await supabase.storage
        .from("cleaned-archives")
        .download(archivePath);

      if (downloadError || !archiveData) {
        toast.error("Archive non disponible");
        setPushingToGitHub(null);
        return;
      }

      setGitHubProgress(20);
      setGitHubMessage("Extraction des fichiers...");

      // Extract files from ZIP
      const zip = await JSZip.loadAsync(archiveData);
      const filesForExport: Record<string, string> = {};

      // Include patterns for source files
      const includePatterns = [
        /^frontend\/src\//,
        /^frontend\/public\//,
        /^frontend\/package\.json$/,
        /^frontend\/tsconfig\.json$/,
        /^frontend\/vite\.config\./,
        /^frontend\/tailwind\.config\./,
        /^frontend\/index\.html$/,
        /^src\//,
        /^public\//,
        /^package\.json$/,
        /^tsconfig\.json$/,
      ];

      for (const [path, file] of Object.entries(zip.files)) {
        if (!file.dir) {
          // Check if file matches include patterns
          const shouldInclude = includePatterns.some(pattern => pattern.test(path));
          if (shouldInclude) {
            const content = await file.async("string");
            // Remove "frontend/" prefix if present
            const cleanPath = path.replace(/^frontend\//, '');
            filesForExport[cleanPath] = content;
          }
        }
      }

      if (Object.keys(filesForExport).length === 0) {
        toast.error("Aucun fichier source trouvé dans l'archive");
        setPushingToGitHub(null);
        return;
      }

      setGitHubProgress(40);
      setGitHubMessage("Connexion à GitHub...");

      // Progress animation
      const progressInterval = setInterval(() => {
        setGitHubProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      setGitHubMessage("Envoi vers GitHub...");

      const repoName = `${deployment.project_name.toLowerCase().replace(/\s+/g, '-')}-liberated`;

      const { data, error } = await supabase.functions.invoke('export-to-github', {
        body: {
          files: filesForExport,
          repoName,
          isPrivate: settings.default_repo_private ?? true,
          description: `Code libéré par Inopay - Score: ${deployment.portability_score_after || 100}%`,
          github_token: settings.github_destination_token,
          destinationUsername: settings.github_destination_username
        }
      });

      clearInterval(progressInterval);

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.repoUrl) {
        setGitHubProgress(100);
        setGitHubMessage("Terminé !");
        toast.success(
          <div className="flex flex-col gap-1">
            <span>Code poussé vers GitHub !</span>
            <a href={data.repoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline text-sm">
              {data.repoUrl}
            </a>
          </div>
        );
      }
    } catch (error) {
      console.error("GitHub push error:", error);
      toast.error(error instanceof Error ? error.message : "Erreur lors du push GitHub");
    } finally {
      setTimeout(() => {
        setPushingToGitHub(null);
        setGitHubProgress(0);
        setGitHubMessage("");
      }, 2000);
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
    if (providerLower.includes("coolify")) return "🚀";
    if (providerLower.includes("liberation")) return "🛡️";
    return "🌐";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Mes Exports
              </CardTitle>
              <CardDescription>
                Historique de vos projets nettoyés et déployés
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchDeployments}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucun export trouvé</p>
              <p className="text-sm">Vos projets nettoyés apparaîtront ici</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>Hébergeur</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Fichiers</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((deployment) => (
                  <TableRow key={deployment.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getProviderIcon(deployment.provider)}</span>
                        <span className="font-medium">{deployment.project_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{deployment.provider}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {deployment.deployment_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{deployment.files_uploaded || 0}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(deployment.created_at), { 
                          addSuffix: true, 
                          locale: fr 
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      {deployment.status === "success" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Réussi
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{deployment.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {pushingToGitHub === deployment.id ? (
                          <div className="flex items-center gap-2 min-w-[150px]">
                            <Progress value={gitHubProgress} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground">{gitHubProgress}%</span>
                          </div>
                        ) : (
                          <>
                            {deployment.deployed_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(deployment.deployed_url!, "_blank")}
                                title="Voir le site déployé"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePushToGitHub(deployment)}
                              title="Pousser vers GitHub"
                              disabled={!!pushingToGitHub}
                            >
                              <Github className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(deployment)}
                              title="Télécharger l'archive"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default UserExportsHistory;
