import { useState } from "react";
import { Loader2, Package, Download, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProjectExporterProps {
  projectId?: string;
  projectName: string;
  extractedFiles: Map<string, string>;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const ProjectExporter = ({ 
  projectId, 
  projectName, 
  extractedFiles, 
  isOpen, 
  onClose,
  onComplete 
}: ProjectExporterProps) => {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "cleaning" | "packaging" | "uploading" | "complete">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cleanedFilesCount, setCleanedFilesCount] = useState(0);

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);
    setStatus("cleaning");
    setDownloadUrl(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Non connecté",
          description: "Veuillez vous connecter pour utiliser cette fonctionnalité",
          variant: "destructive",
        });
        setExporting(false);
        return;
      }

      // Step 1: Clean all files that need cleaning
      const cleanedFiles: Record<string, string> = {};
      const filesToClean = Array.from(extractedFiles.entries());
      const totalFiles = filesToClean.length;
      
      for (let i = 0; i < filesToClean.length; i++) {
        const [filePath, content] = filesToClean[i];
        setProgress((i / totalFiles) * 60); // 60% for cleaning

        // Check if file needs cleaning (contains Lovable/GPTEngineer references)
        const needsCleaning = 
          content.includes('@lovable') || 
          content.includes('@gptengineer') ||
          content.includes('use-mobile') ||
          content.includes('lovable.dev');

        if (needsCleaning && (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx'))) {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clean-code`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ code: content, fileName: filePath }),
              }
            );

            if (response.ok) {
              const data = await response.json();
              cleanedFiles[filePath] = data.cleanedCode;
              setCleanedFilesCount(prev => prev + 1);
            } else {
              // If cleaning fails, keep original
              cleanedFiles[filePath] = content;
            }
          } catch {
            // If cleaning fails, keep original
            cleanedFiles[filePath] = content;
          }
        } else {
          // No cleaning needed, keep original
          cleanedFiles[filePath] = content;
        }
      }

      setProgress(60);
      setStatus("packaging");

      // Step 2: Generate and upload archive
      setProgress(70);
      setStatus("uploading");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-archive`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            projectId, 
            projectName,
            cleanedFiles 
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la génération");
      }

      setProgress(100);
      setStatus("complete");
      setDownloadUrl(data.downloadUrl);

      toast({
        title: "Archive générée",
        description: "Votre projet autonome est prêt à être téléchargé",
      });

      onComplete?.();
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de l'export",
        variant: "destructive",
      });
      setStatus("idle");
    } finally {
      setExporting(false);
    }
  };

  const handleClose = () => {
    setStatus("idle");
    setProgress(0);
    setDownloadUrl(null);
    setCleanedFilesCount(0);
    onClose();
  };

  const getStatusMessage = () => {
    switch (status) {
      case "cleaning":
        return `Nettoyage des fichiers... (${cleanedFilesCount} nettoyés)`;
      case "packaging":
        return "Création de l'archive ZIP...";
      case "uploading":
        return "Upload vers le stockage sécurisé...";
      case "complete":
        return "Export terminé !";
      default:
        return "Prêt à exporter";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Exporter le projet autonome
          </DialogTitle>
          <DialogDescription>
            Générer une archive ZIP avec Dockerfile et documentation
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {status === "idle" ? (
            <Card className="border-dashed">
              <CardHeader className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <Package className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>Prêt à exporter</CardTitle>
                <CardDescription>
                  Cette opération va :
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Nettoyer tous les fichiers avec dépendances propriétaires
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Ajouter un Dockerfile pour le déploiement
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Inclure README_FREEDOM.md avec les instructions
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Générer un lien de téléchargement sécurisé
                  </li>
                </ul>
                <Button onClick={handleExport} className="w-full glow-sm" size="lg">
                  <Package className="mr-2 h-5 w-5" />
                  Générer l'archive autonome
                </Button>
              </CardContent>
            </Card>
          ) : status === "complete" && downloadUrl ? (
            <Card className="border-success/30 bg-success/5">
              <CardContent className="pt-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/20 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Export réussi !</h3>
                <p className="text-muted-foreground mb-6">
                  {cleanedFilesCount} fichier{cleanedFilesCount > 1 ? 's' : ''} nettoyé{cleanedFilesCount > 1 ? 's' : ''}
                </p>
                <div className="space-y-3">
                  <Button asChild className="w-full" size="lg">
                    <a href={downloadUrl} download>
                      <Download className="mr-2 h-5 w-5" />
                      Télécharger l'archive
                    </a>
                  </Button>
                  <Button variant="outline" asChild className="w-full">
                    <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Ouvrir dans un nouvel onglet
                    </a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Le lien expire dans 1 heure
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4 animate-pulse-glow">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{getStatusMessage()}</h3>
                  <div className="w-full mt-4">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-2">{Math.round(progress)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectExporter;
