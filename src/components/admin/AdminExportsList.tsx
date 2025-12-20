import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, 
  Download, 
  RefreshCw, 
  Loader2, 
  ExternalLink,
  CheckCircle2,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface DeploymentRecord {
  id: string;
  user_id: string;
  project_name: string;
  provider: string;
  deployment_type: string;
  files_uploaded: number;
  deployed_url: string | null;
  created_at: string;
  status: string;
}

const AdminExportsList = () => {
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeployments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("deployment_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setDeployments(data || []);
    } catch (error) {
      console.error("Error fetching deployments:", error);
      toast.error("Erreur lors du chargement des exports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
  }, []);

  const handleDownload = async (deployment: DeploymentRecord) => {
    // Try to download from storage if available
    try {
      const { data, error } = await supabase.storage
        .from("cleaned-archives")
        .download(`${deployment.user_id}/${deployment.project_name}.zip`);

      if (error) {
        toast.error("Fichier non disponible dans le stockage");
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
                <FileText className="h-5 w-5" />
                Exports Récents
              </CardTitle>
              <CardDescription>
                Derniers fichiers nettoyés par l'IA - Vérifiez la qualité du travail
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
              Aucun export trouvé
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
                        <Badge className="bg-success/10 text-success gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Réussi
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{deployment.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {deployment.deployed_url && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(deployment.deployed_url!, "_blank")}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(deployment)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quality Note */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Conseil :</strong> Téléchargez régulièrement des exports pour vérifier que l'IA produit du code de qualité. 
            Assurez-vous que les dépendances propriétaires sont bien remplacées par des alternatives open source.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminExportsList;
