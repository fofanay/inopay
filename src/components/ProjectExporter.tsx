import { useState } from "react";
import { Loader2, Package, Download, CheckCircle2, ExternalLink, Github, PartyPopper, Rocket, Zap, Cloud, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PostDeploymentAssistant from "./PostDeploymentAssistant";
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
  const [status, setStatus] = useState<"idle" | "cleaning" | "packaging" | "uploading" | "github" | "complete">("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [cleanedFilesCount, setCleanedFilesCount] = useState(0);
  const [exportType, setExportType] = useState<"zip" | "github">("zip");
  const [repoName, setRepoName] = useState(projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase());
  const [repoDescription, setRepoDescription] = useState("Projet exporté depuis InoPay Cleaner - 100% autonome");
  const [isPrivate, setIsPrivate] = useState(true);
  const [githubRepoUrl, setGithubRepoUrl] = useState<string | null>(null);
  const [envExampleUrl, setEnvExampleUrl] = useState<string | null>(null);
  const [detectedEnvVars, setDetectedEnvVars] = useState<string[]>([]);
  const [showAssistant, setShowAssistant] = useState(false);

  const cleanFiles = async (session: { access_token: string }) => {
    const cleanedFiles: Record<string, string> = {};
    const filesToClean = Array.from(extractedFiles.entries());
    const totalFiles = filesToClean.length;
    
    for (let i = 0; i < filesToClean.length; i++) {
      const [filePath, content] = filesToClean[i];
      setProgress((i / totalFiles) * 50);

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
            cleanedFiles[filePath] = content;
          }
        } catch {
          cleanedFiles[filePath] = content;
        }
      } else {
        cleanedFiles[filePath] = content;
      }
    }
    
    return cleanedFiles;
  };

  const handleExportZip = async () => {
    setExporting(true);
    setProgress(0);
    setStatus("cleaning");
    setDownloadUrl(null);
    setEnvExampleUrl(null);

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

      const cleanedFiles = await cleanFiles(session);

      setProgress(60);
      setStatus("packaging");

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
      setEnvExampleUrl(data.envExampleContent);
      setDetectedEnvVars(data.detectedEnvVars || []);

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

  const handleExportGithub = async () => {
    if (!repoName.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez entrer un nom pour le dépôt GitHub",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    setProgress(0);
    setStatus("cleaning");
    setGithubRepoUrl(null);

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

      const cleanedFiles = await cleanFiles(session);

      setProgress(60);
      setStatus("github");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-to-github`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            repoName: repoName.trim(),
            description: repoDescription,
            isPrivate,
            files: cleanedFiles 
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'export GitHub");
      }

      setProgress(100);
      setStatus("complete");
      setGithubRepoUrl(data.repoUrl);

      toast({
        title: "Dépôt créé",
        description: `${data.filesCount} fichiers exportés vers GitHub`,
      });

      onComplete?.();
    } catch (error) {
      console.error("GitHub export error:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de l'export GitHub",
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
    setGithubRepoUrl(null);
    setEnvExampleUrl(null);
    setDetectedEnvVars([]);
    setCleanedFilesCount(0);
    setShowAssistant(false);
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
      case "github":
        return "Création du dépôt GitHub...";
      case "complete":
        return "Export terminé !";
      default:
        return "Prêt à exporter";
    }
  };

  const downloadEnvExample = () => {
    if (!envExampleUrl) return;
    const blob = new Blob([envExampleUrl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env.example';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({
      title: "Téléchargé",
      description: "Le fichier .env.example a été téléchargé",
    });
  };

  const getVercelDeployUrl = () => {
    if (!githubRepoUrl) return null;
    return `https://vercel.com/new/clone?repository-url=${encodeURIComponent(githubRepoUrl)}`;
  };

  const getNetlifyDeployUrl = () => {
    if (!githubRepoUrl) return null;
    return `https://app.netlify.com/start/deploy?repository=${encodeURIComponent(githubRepoUrl)}`;
  };

  const getRailwayDeployUrl = () => {
    if (!githubRepoUrl) return null;
    return `https://railway.app/template?code=${encodeURIComponent(githubRepoUrl)}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Exporter le projet autonome
          </DialogTitle>
          <DialogDescription>
            Générer une archive ZIP ou créer un nouveau dépôt GitHub
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {status === "idle" ? (
            <Tabs value={exportType} onValueChange={(v) => setExportType(v as "zip" | "github")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="zip" className="gap-2">
                  <Package className="h-4 w-4" />
                  Archive ZIP
                </TabsTrigger>
                <TabsTrigger value="github" className="gap-2">
                  <Github className="h-4 w-4" />
                  GitHub
                </TabsTrigger>
              </TabsList>

              <TabsContent value="zip" className="mt-4">
                <Card className="border-dashed">
                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
                      <Package className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Télécharger en ZIP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        Code nettoyé des dépendances propriétaires
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        Dockerfile + nginx.conf inclus
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        Workflows CI/CD (Vercel, Railway, Docker)
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        Fichier .env.example généré automatiquement
                      </li>
                    </ul>
                    <Button onClick={handleExportZip} className="w-full glow-sm" size="lg">
                      <Package className="mr-2 h-5 w-5" />
                      Générer l'archive
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="github" className="mt-4">
                <Card className="border-dashed">
                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
                      <Github className="h-7 w-7 text-primary" />
                    </div>
                    <CardTitle className="text-lg">Exporter vers GitHub</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="repoName">Nom du dépôt</Label>
                      <Input
                        id="repoName"
                        value={repoName}
                        onChange={(e) => setRepoName(e.target.value)}
                        placeholder="mon-projet-autonome"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="repoDesc">Description (optionnelle)</Label>
                      <Input
                        id="repoDesc"
                        value={repoDescription}
                        onChange={(e) => setRepoDescription(e.target.value)}
                        placeholder="Description du projet"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="private">Dépôt privé</Label>
                      <Switch
                        id="private"
                        checked={isPrivate}
                        onCheckedChange={setIsPrivate}
                      />
                    </div>
                    <Button onClick={handleExportGithub} className="w-full glow-sm" size="lg">
                      <Github className="mr-2 h-5 w-5" />
                      Créer le dépôt GitHub
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : status === "complete" ? (
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5 overflow-hidden">
              <CardContent className="pt-8 text-center relative">
                {/* Confetti effect */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-4 left-8 text-2xl animate-bounce delay-100">🎉</div>
                  <div className="absolute top-8 right-12 text-xl animate-bounce delay-200">✨</div>
                  <div className="absolute top-6 left-1/3 text-lg animate-bounce delay-300">🚀</div>
                </div>

                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary mb-6 animate-pulse-glow">
                  <PartyPopper className="h-10 w-10 text-primary-foreground" />
                </div>
                
                <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Félicitations ! 🎊
                </h2>
                <p className="text-lg font-medium mb-2">
                  Votre projet est désormais
                </p>
                <p className="text-3xl font-bold text-primary mb-4">
                  100% Indépendant
                </p>
                <p className="text-muted-foreground mb-6 text-sm">
                  {cleanedFilesCount} fichier{cleanedFilesCount > 1 ? 's' : ''} nettoyé{cleanedFilesCount > 1 ? 's' : ''} • 
                  Prêt pour le déploiement
                </p>

                <div className="space-y-3">
                  {downloadUrl && (
                    <>
                      <Button asChild className="w-full" size="lg">
                        <a href={downloadUrl} download>
                          <Download className="mr-2 h-5 w-5" />
                          Télécharger l'archive
                        </a>
                      </Button>
                      {envExampleUrl && (
                        <Button variant="outline" onClick={downloadEnvExample} className="w-full gap-2" size="lg">
                          <Download className="h-4 w-4" />
                          Télécharger .env.example
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Le lien expire dans 1 heure
                      </p>
                    </>
                  )}
                  
                  {githubRepoUrl && (
                    <>
                      <Button asChild className="w-full" size="lg">
                        <a href={githubRepoUrl} target="_blank" rel="noopener noreferrer">
                          <Github className="mr-2 h-5 w-5" />
                          Ouvrir le dépôt GitHub
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                      
                      {/* One-click deployment buttons */}
                      <div className="mt-6 p-4 rounded-lg bg-muted/50 text-left">
                        <h4 className="font-semibold flex items-center gap-2 mb-3">
                          <Rocket className="h-4 w-4 text-primary" />
                          Déploiement en 1 clic
                        </h4>
                        <div className="space-y-2">
                          <Button 
                            variant="outline" 
                            onClick={() => window.open(getVercelDeployUrl()!, '_blank')} 
                            className="w-full gap-2 justify-start"
                          >
                            <Zap className="h-4 w-4 text-black" />
                            Déployer sur Vercel
                            <ExternalLink className="ml-auto h-3 w-3" />
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => window.open(getNetlifyDeployUrl()!, '_blank')} 
                            className="w-full gap-2 justify-start"
                          >
                            <Cloud className="h-4 w-4 text-teal-500" />
                            Déployer sur Netlify
                            <ExternalLink className="ml-auto h-3 w-3" />
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => window.open(getRailwayDeployUrl()!, '_blank')} 
                            className="w-full gap-2 justify-start"
                          >
                            <Rocket className="h-4 w-4 text-purple-500" />
                            Déployer sur Railway
                            <ExternalLink className="ml-auto h-3 w-3" />
                          </Button>
                        </div>
                        
                        {/* Configuration Assistant Button */}
                        <Button 
                          variant="secondary" 
                          onClick={() => setShowAssistant(true)} 
                          className="w-full gap-2 mt-3"
                        >
                          <Settings className="h-4 w-4" />
                          Assistant de configuration
                        </Button>
                      </div>
                    </>
                  )}
                </div>
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

        {/* Post-deployment assistant modal */}
        <PostDeploymentAssistant 
          isOpen={showAssistant}
          onClose={() => setShowAssistant(false)}
          githubRepoUrl={githubRepoUrl || undefined}
          detectedEnvVars={detectedEnvVars}
          projectName={projectName}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ProjectExporter;
