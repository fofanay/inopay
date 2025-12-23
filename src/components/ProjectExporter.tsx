import { useState, useEffect } from "react";
import { Loader2, Package, Download, CheckCircle2, ExternalLink, Github, PartyPopper, Rocket, Zap, Cloud, Settings, AlertTriangle, RefreshCw, Save, Server, Shield, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import PostDeploymentAssistant from "./PostDeploymentAssistant";
import { DirectDeployment } from "./dashboard/DirectDeployment";
import { CleaningCostEstimator } from "./dashboard/CleaningCostEstimator";
import { SecurityAuditReport } from "./dashboard/SecurityAuditReport";
import { BuildValidator, BuildValidationReport } from "./dashboard/BuildValidator";

type DeployPlatform = "vercel" | "netlify" | "railway" | "none";
type ExportType = "zip" | "github" | "vps";

interface ProjectExporterProps {
  projectId?: string;
  projectName: string;
  extractedFiles: Map<string, string>;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const PLATFORM_INFO: Record<DeployPlatform, { name: string; icon: React.ReactNode; color: string }> = {
  vercel: { name: "Vercel", icon: <Zap className="h-4 w-4" />, color: "text-foreground" },
  netlify: { name: "Netlify", icon: <Cloud className="h-4 w-4" />, color: "text-teal-500" },
  railway: { name: "Railway", icon: <Rocket className="h-4 w-4" />, color: "text-purple-500" },
  none: { name: "Aucun", icon: null, color: "text-muted-foreground" },
};

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
  const [exportType, setExportType] = useState<ExportType>("zip");
  const [showVPSSetup, setShowVPSSetup] = useState(false);
  const [vpsCleanedFiles, setVpsCleanedFiles] = useState<Record<string, string> | null>(null);
  const [preparingVPS, setPreparingVPS] = useState(false);
  const [repoName, setRepoName] = useState(projectName.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase());
  const [repoDescription, setRepoDescription] = useState("Projet exporté depuis InoPay Cleaner - 100% autonome");
  const [isPrivate, setIsPrivate] = useState(true);
  const [githubRepoUrl, setGithubRepoUrl] = useState<string | null>(null);
  const [envExampleUrl, setEnvExampleUrl] = useState<string | null>(null);
  const [detectedEnvVars, setDetectedEnvVars] = useState<string[]>([]);
  const [showAssistant, setShowAssistant] = useState(false);
  
  // GitHub token verification
  const [hasGitHubToken, setHasGitHubToken] = useState<boolean | null>(null);
  const [checkingToken, setCheckingToken] = useState(false);
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  
  // Deployment preferences
  const [deployPlatform, setDeployPlatform] = useState<DeployPlatform>("vercel");
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  
  // Cost estimation
  const [showEstimator, setShowEstimator] = useState(true);
  const [estimationApproved, setEstimationApproved] = useState(false);
  
  // Security audit
  const [showSecurityAudit, setShowSecurityAudit] = useState(false);
  const [securityAuditComplete, setSecurityAuditComplete] = useState(false);
  const [auditedFiles, setAuditedFiles] = useState<{ path: string; content: string }[] | null>(null);
  const [securityCertification, setSecurityCertification] = useState<string | null>(null);
  const [estimationData, setEstimationData] = useState<any>(null);
  
  // Build validation (sovereignty check)
  const [showBuildValidator, setShowBuildValidator] = useState(false);
  const [buildValidationComplete, setBuildValidationComplete] = useState(false);
  const [buildValidationReport, setBuildValidationReport] = useState<BuildValidationReport | null>(null);

  // Load user preferences on mount
  useEffect(() => {
    if (isOpen) {
      loadUserPreferences();
    }
  }, [isOpen]);

  // Check GitHub token when dialog opens for github export
  useEffect(() => {
    if (isOpen && exportType === "github") {
      checkGitHubToken();
    }
  }, [isOpen, exportType]);

  const loadUserPreferences = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('user_settings')
        .select('preferred_deploy_platform, default_repo_private')
        .eq('user_id', session.user.id)
        .single();

      if (data && !error) {
        setDeployPlatform((data.preferred_deploy_platform as DeployPlatform) || 'vercel');
        setIsPrivate(data.default_repo_private ?? true);
      }
      setPreferencesLoaded(true);
    } catch (error) {
      console.error("Error loading preferences:", error);
      setPreferencesLoaded(true);
    }
  };

  const saveUserPreferences = async () => {
    setSavingPreferences(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: session.user.id,
          preferred_deploy_platform: deployPlatform,
          default_repo_private: isPrivate,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Préférences sauvegardées",
        description: "Vos paramètres de déploiement ont été enregistrés",
      });
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les préférences",
        variant: "destructive",
      });
    } finally {
      setSavingPreferences(false);
    }
  };

  const checkGitHubToken = async () => {
    setCheckingToken(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.provider_token;
      
      if (!token) {
        setHasGitHubToken(false);
        setGithubUsername(null);
        setCheckingToken(false);
        return;
      }

      // Verify token is valid by calling GitHub API
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setHasGitHubToken(true);
        setGithubUsername(userData.login);
      } else {
        setHasGitHubToken(false);
        setGithubUsername(null);
      }
    } catch (error) {
      console.error("Error checking GitHub token:", error);
      setHasGitHubToken(false);
      setGithubUsername(null);
    } finally {
      setCheckingToken(false);
    }
  };

  const handleReconnectGitHub = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          scopes: 'repo',
          redirectTo: window.location.href,
        }
      });
      
      if (error) {
        toast({
          title: "Erreur de connexion",
          description: error.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("GitHub reconnect error:", error);
    }
  };

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

      // Récupérer le token GitHub de l'utilisateur (provider_token)
      const githubToken = session.provider_token;

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
            files: cleanedFiles,
            github_token: githubToken // Envoyer le token utilisateur
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

      // Auto-deploy to selected platform if enabled
      if (deployPlatform !== "none" && data.repoUrl) {
        const platformName = PLATFORM_INFO[deployPlatform].name;
        let deployUrl: string | null = null;
        
        switch (deployPlatform) {
          case "vercel":
            deployUrl = `https://vercel.com/new/clone?repository-url=${encodeURIComponent(data.repoUrl)}`;
            break;
          case "netlify":
            deployUrl = `https://app.netlify.com/start/deploy?repository=${encodeURIComponent(data.repoUrl)}`;
            break;
          case "railway":
            deployUrl = `https://railway.app/template?code=${encodeURIComponent(data.repoUrl)}`;
            break;
        }

        if (deployUrl) {
          toast({
            title: `Redirection vers ${platformName}`,
            description: "Ouverture du déploiement automatique...",
          });
          setTimeout(() => {
            window.open(deployUrl!, '_blank');
          }, 1500);
        }
      }

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

  const prepareVPSDeployment = async () => {
    if (vpsCleanedFiles) return; // Already prepared
    
    setPreparingVPS(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Non connecté",
          description: "Veuillez vous connecter pour utiliser cette fonctionnalité",
          variant: "destructive",
        });
        return;
      }

      const cleanedFiles = await cleanFiles(session);
      setVpsCleanedFiles(cleanedFiles);
    } catch (error) {
      console.error("VPS preparation error:", error);
      toast({
        title: "Erreur",
        description: "Erreur lors de la préparation des fichiers",
        variant: "destructive",
      });
    } finally {
      setPreparingVPS(false);
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
    setVpsCleanedFiles(null);
    setShowVPSSetup(false);
    // Reset pipeline steps
    setShowEstimator(true);
    setEstimationApproved(false);
    setShowSecurityAudit(false);
    setSecurityAuditComplete(false);
    setAuditedFiles(null);
    setSecurityCertification(null);
    setShowBuildValidator(false);
    setBuildValidationComplete(false);
    setBuildValidationReport(null);
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
            Générer une archive ZIP, exporter vers GitHub, ou déployer directement sur votre VPS
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Pipeline Progress Indicator */}
          {status === "idle" && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`flex items-center gap-1 text-xs ${!estimationApproved ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${!estimationApproved ? 'bg-primary text-primary-foreground' : 'bg-green-500 text-white'}`}>
                  {estimationApproved ? '✓' : '1'}
                </span>
                Estimation
              </div>
              <div className="w-8 h-px bg-border" />
              <div className={`flex items-center gap-1 text-xs ${estimationApproved && !securityAuditComplete ? 'text-primary font-medium' : estimationApproved ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${securityAuditComplete ? 'bg-green-500 text-white' : estimationApproved ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {securityAuditComplete ? '✓' : '2'}
                </span>
                Sécurité
              </div>
              <div className="w-8 h-px bg-border" />
              <div className={`flex items-center gap-1 text-xs ${securityAuditComplete && !buildValidationComplete ? 'text-primary font-medium' : securityAuditComplete ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${buildValidationComplete ? 'bg-green-500 text-white' : securityAuditComplete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {buildValidationComplete ? '✓' : '3'}
                </span>
                Build
              </div>
              <div className="w-8 h-px bg-border" />
              <div className={`flex items-center gap-1 text-xs ${buildValidationComplete ? 'text-primary font-medium' : 'text-muted-foreground/50'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${buildValidationComplete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  4
                </span>
                Export
              </div>
            </div>
          )}

          {/* Step 1: Cost Estimation */}
          {showEstimator && !estimationApproved && status === "idle" && (
            <div className="space-y-4">
              <CleaningCostEstimator
                files={Array.from(extractedFiles.entries()).map(([path, content]) => ({ path, content }))}
                projectName={projectName}
                onEstimationComplete={(data) => {
                  setEstimationData(data);
                  if (!data.requiresAdminApproval) {
                    // Auto-approve if margin is good
                  }
                }}
                onProceed={() => {
                  setEstimationApproved(true);
                  setShowEstimator(false);
                  setShowSecurityAudit(true); // Move to security audit step
                }}
              />
            </div>
          )}

          {/* Step 2: Security Audit (Zero Shadow Door) */}
          {showSecurityAudit && !securityAuditComplete && status === "idle" && (
            <div className="space-y-4">
              <SecurityAuditReport
                files={Array.from(extractedFiles.entries()).map(([path, content]) => ({ path, content }))}
                projectName={projectName}
                onAuditComplete={(result, cleanedFiles) => {
                  setSecurityAuditComplete(true);
                  setShowSecurityAudit(false);
                  setAuditedFiles(cleanedFiles);
                  setSecurityCertification(result.certificationMessage);
                  setShowBuildValidator(true); // Move to build validation step
                }}
                onSkip={() => {
                  setSecurityAuditComplete(true);
                  setShowSecurityAudit(false);
                  setShowBuildValidator(true); // Move to build validation step
                }}
              />
            </div>
          )}

          {/* Step 3: Build Validation (Sovereignty Check) */}
          {showBuildValidator && !buildValidationComplete && status === "idle" && (
            <div className="space-y-4">
              <BuildValidator
                files={extractedFiles}
                projectName={projectName}
                onValidationComplete={(isValid, report) => {
                  setBuildValidationComplete(true);
                  setShowBuildValidator(false);
                  setBuildValidationReport(report);
                }}
                onSkip={() => {
                  setBuildValidationComplete(true);
                  setShowBuildValidator(false);
                }}
              />
            </div>
          )}

          {/* Step 4: Export Options - shown after build validation is complete */}
          {buildValidationComplete && status === "idle" ? (
            <Tabs 
              value={exportType} 
              onValueChange={(v) => {
                setExportType(v as ExportType);
                // Prepare files when switching to VPS tab
                if (v === "vps") {
                  prepareVPSDeployment();
                }
              }}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="zip" className="gap-2">
                  <Package className="h-4 w-4" />
                  ZIP
                </TabsTrigger>
                <TabsTrigger value="github" className="gap-2">
                  <Github className="h-4 w-4" />
                  GitHub
                </TabsTrigger>
                <TabsTrigger value="vps" className="gap-2">
                  <Server className="h-4 w-4" />
                  VPS Direct
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
                    {/* GitHub Token Status */}
                    {checkingToken ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Vérification de la connexion GitHub...
                      </div>
                    ) : hasGitHubToken === false ? (
                      <Alert variant="destructive" className="mb-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Connexion GitHub requise</AlertTitle>
                        <AlertDescription className="mt-2">
                          <p className="mb-3">
                            Pour exporter vers votre compte GitHub, vous devez vous connecter avec GitHub.
                          </p>
                          <Button 
                            onClick={handleReconnectGitHub}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <Github className="h-4 w-4" />
                            Se connecter avec GitHub
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : hasGitHubToken === true && githubUsername ? (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-success/10 border border-success/20">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="text-sm">
                            Connecté à GitHub en tant que <strong>@{githubUsername}</strong>
                          </span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={checkGitHubToken}
                          className="gap-1 text-xs"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Actualiser
                        </Button>
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label htmlFor="repoName">Nom du dépôt</Label>
                      <Input
                        id="repoName"
                        value={repoName}
                        onChange={(e) => setRepoName(e.target.value)}
                        placeholder="mon-projet-autonome"
                        disabled={!hasGitHubToken}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="repoDesc">Description (optionnelle)</Label>
                      <Input
                        id="repoDesc"
                        value={repoDescription}
                        onChange={(e) => setRepoDescription(e.target.value)}
                        placeholder="Description du projet"
                        disabled={!hasGitHubToken}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="private">Dépôt privé</Label>
                      <Switch
                        id="private"
                        checked={isPrivate}
                        onCheckedChange={setIsPrivate}
                        disabled={!hasGitHubToken}
                      />
                    </div>

                    {/* Platform selection */}
                    <div className="space-y-3 p-4 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">Déploiement automatique après export</Label>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={saveUserPreferences}
                          disabled={savingPreferences}
                          className="gap-1 text-xs h-7"
                        >
                          {savingPreferences ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Sauvegarder
                        </Button>
                      </div>
                      <RadioGroup 
                        value={deployPlatform} 
                        onValueChange={(v) => setDeployPlatform(v as DeployPlatform)}
                        className="grid grid-cols-2 gap-2"
                        disabled={!hasGitHubToken}
                      >
                        {(Object.keys(PLATFORM_INFO) as DeployPlatform[]).map((platform) => (
                          <div key={platform} className="flex items-center space-x-2">
                            <RadioGroupItem 
                              value={platform} 
                              id={`platform-${platform}`}
                              disabled={!hasGitHubToken}
                            />
                            <Label 
                              htmlFor={`platform-${platform}`} 
                              className={`flex items-center gap-1.5 cursor-pointer ${PLATFORM_INFO[platform].color}`}
                            >
                              {PLATFORM_INFO[platform].icon}
                              {PLATFORM_INFO[platform].name}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      <p className="text-xs text-muted-foreground">
                        {deployPlatform !== "none" 
                          ? `Après l'export, vous serez redirigé vers ${PLATFORM_INFO[deployPlatform].name}`
                          : "Le dépôt sera créé sans déploiement automatique"
                        }
                      </p>
                    </div>

                    <Button 
                      onClick={handleExportGithub} 
                      className="w-full glow-sm" 
                      size="lg"
                      disabled={!hasGitHubToken || exporting}
                    >
                      <Github className="mr-2 h-5 w-5" />
                      {deployPlatform !== "none" 
                        ? `Exporter + Déployer sur ${PLATFORM_INFO[deployPlatform].name}` 
                        : "Créer le dépôt GitHub"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="vps" className="mt-4">
                {preparingVPS ? (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Nettoyage et préparation des fichiers...
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {cleanedFilesCount} fichier(s) nettoyé(s)
                      </p>
                    </CardContent>
                  </Card>
                ) : vpsCleanedFiles ? (
                  <DirectDeployment
                    projectName={projectName}
                    cleanedFiles={vpsCleanedFiles}
                    onDeploymentComplete={(url) => {
                      setStatus("complete");
                      onComplete?.();
                    }}
                    onNeedSetup={() => {
                      setShowVPSSetup(true);
                      handleClose();
                    }}
                  />
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <Server className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="mt-2 text-sm text-muted-foreground">
                        Cliquez sur cet onglet pour préparer le déploiement VPS
                      </p>
                    </CardContent>
                  </Card>
                )}
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
