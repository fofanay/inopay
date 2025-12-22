import { useState, useEffect } from "react";
import { 
  Github, 
  Database, 
  Server,
  Key, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Shield,
  ExternalLink,
  TestTube,
  ChevronRight,
  ChevronLeft,
  Rocket,
  Lock,
  Copy,
  Check,
  Zap,
  HelpCircle,
  Sparkles,
  X
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type WizardStep = "github" | "supabase" | "vps";

interface ConnectionStatus {
  github: "connected" | "disconnected" | "testing";
  supabase: "connected" | "disconnected" | "testing";
  vps: "connected" | "disconnected" | "testing";
}

interface SovereigntyWizardProps {
  onComplete?: () => void;
  projectName?: string;
  extractedFiles?: Map<string, string>;
}

function StatusIndicator({ 
  label, 
  status, 
  icon: Icon 
}: { 
  label: string; 
  status: "connected" | "disconnected" | "testing";
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`
        relative w-3 h-3 rounded-full
        ${status === "connected" ? "bg-success" : ""}
        ${status === "disconnected" ? "bg-destructive" : ""}
        ${status === "testing" ? "bg-warning animate-pulse" : ""}
      `}>
        {status === "connected" && (
          <div className="absolute inset-0 rounded-full bg-success animate-ping opacity-25" />
        )}
      </div>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
      <Badge 
        variant="outline" 
        className={`text-xs ${
          status === "connected" ? "border-success text-success" : 
          status === "testing" ? "border-warning text-warning" : 
          "border-destructive text-destructive"
        }`}
      >
        {status === "connected" ? "Connecté" : status === "testing" ? "Test..." : "Déconnecté"}
      </Badge>
    </div>
  );
}

function GitHubGuideModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Guide de création du token
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Comment créer un Personal Access Token GitHub
          </DialogTitle>
          <DialogDescription>
            Suivez ces étapes pour générer un token avec les permissions requises
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              1
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Accédez aux paramètres développeur</h4>
              <p className="text-sm text-muted-foreground">
                Connectez-vous à GitHub → Cliquez sur votre avatar → <strong>Settings</strong>
              </p>
              <div className="bg-muted p-3 rounded-lg text-sm">
                <code>github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)</code>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              2
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Générez un nouveau token</h4>
              <p className="text-sm text-muted-foreground">
                Cliquez sur <strong>"Generate new token (classic)"</strong>
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              3
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Configurez les permissions (scopes)</h4>
              <p className="text-sm text-muted-foreground">
                Cochez les scopes suivants pour permettre à Inopay de créer et gérer vos dépôts :
              </p>
              <div className="grid grid-cols-1 gap-2 mt-2">
                <div className="flex items-center gap-2 p-2 bg-success/10 border border-success/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="font-mono text-sm">repo</span>
                  <span className="text-xs text-muted-foreground">- Contrôle total des dépôts privés</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-success/10 border border-success/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="font-mono text-sm">admin:repo_hook</span>
                  <span className="text-xs text-muted-foreground">- Gestion des webhooks</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-success/10 border border-success/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="font-mono text-sm">workflow</span>
                  <span className="text-xs text-muted-foreground">- Actions GitHub (optionnel)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
              4
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold">Copiez votre token</h4>
              <p className="text-sm text-muted-foreground">
                <strong>Important :</strong> Le token ne sera affiché qu'une seule fois. Copiez-le immédiatement et collez-le dans Inopay.
              </p>
              <Alert className="border-warning/50 bg-warning/5">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-sm">
                  Gardez ce token secret. Ne le partagez jamais et ne le commitez pas dans votre code.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <Separator />

          <div className="flex justify-center">
            <Button asChild className="gap-2">
              <a 
                href="https://github.com/settings/tokens/new?scopes=repo,admin:repo_hook,workflow&description=Inopay%20Sovereignty" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                Créer mon token maintenant
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SovereigntyWizard({ 
  onComplete,
  projectName,
  extractedFiles 
}: SovereigntyWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>("github");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    github: "disconnected",
    supabase: "disconnected",
    vps: "disconnected",
  });
  
  const [githubToken, setGithubToken] = useState("");
  const [githubUsername, setGithubUsername] = useState("");
  const [showGithubToken, setShowGithubToken] = useState(false);
  
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseServiceKey, setSupabaseServiceKey] = useState("");
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  
  const [isFullDeploying, setIsFullDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployStatus, setDeployStatus] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      checkAllConnections();
    }
  }, [user]);

  const checkAllConnections = async () => {
    if (!user) return;
    
    // Check GitHub
    const { data: settings } = await supabase
      .from("user_settings")
      .select("github_token")
      .eq("user_id", user.id)
      .maybeSingle();
      
    if (settings?.github_token) {
      setConnectionStatus(prev => ({ ...prev, github: "connected" }));
    }
    
    // Check Supabase & VPS from user_servers
    const { data: server } = await supabase
      .from("user_servers")
      .select("service_role_key, anon_key, db_url, coolify_token, coolify_url, status, ip_address")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
      
    if (server?.service_role_key) {
      setConnectionStatus(prev => ({ ...prev, supabase: "connected" }));
    }
    
    if (server?.coolify_token && server?.status === "active") {
      setConnectionStatus(prev => ({ ...prev, vps: "connected" }));
    }
  };

  const testGitHubConnection = async () => {
    if (!githubToken) {
      toast({
        title: "Token requis",
        description: "Veuillez entrer votre GitHub Personal Access Token",
        variant: "destructive",
      });
      return;
    }
    
    setConnectionStatus(prev => ({ ...prev, github: "testing" }));
    
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setGithubUsername(userData.login);
        setConnectionStatus(prev => ({ ...prev, github: "connected" }));
        
        // Save token
        await supabase
          .from("user_settings")
          .upsert({
            user_id: user!.id,
            github_token: githubToken,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        
        toast({
          title: "Connexion GitHub réussie!",
          description: `Bienvenue ${userData.login}. Votre coffre-fort est prêt.`,
        });
        
        // Move to next step
        setCurrentStep("supabase");
      } else {
        throw new Error("Token invalide");
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, github: "disconnected" }));
      toast({
        title: "Échec de connexion",
        description: "Token invalide ou permissions insuffisantes. Vérifiez les scopes repo et admin:repo_hook.",
        variant: "destructive",
      });
    }
  };

  const testSupabaseConnection = async () => {
    if (!supabaseUrl || !supabaseServiceKey) {
      toast({
        title: "Informations requises",
        description: "Veuillez entrer l'URL et la Service Role Key",
        variant: "destructive",
      });
      return;
    }
    
    setConnectionStatus(prev => ({ ...prev, supabase: "testing" }));
    
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      });
      
      if (response.ok || response.status === 200) {
        setConnectionStatus(prev => ({ ...prev, supabase: "connected" }));
        
        // Save to user_servers
        const { data: existingServer } = await supabase
          .from("user_servers")
          .select("id")
          .eq("user_id", user!.id)
          .limit(1)
          .maybeSingle();
          
        if (existingServer) {
          await supabase
            .from("user_servers")
            .update({
              service_role_key: supabaseServiceKey,
              db_url: supabaseUrl,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingServer.id);
        }
        
        toast({
          title: "Connexion Supabase réussie!",
          description: "Votre mémoire souveraine est configurée.",
        });
        
        // Move to next step
        setCurrentStep("vps");
      } else {
        throw new Error("Connexion échouée");
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, supabase: "disconnected" }));
      toast({
        title: "Échec de connexion",
        description: "Vérifiez l'URL et la Service Role Key",
        variant: "destructive",
      });
    }
  };

  const testVPSConnection = async () => {
    setConnectionStatus(prev => ({ ...prev, vps: "testing" }));
    
    try {
      const { data: server } = await supabase
        .from("user_servers")
        .select("coolify_token, coolify_url, ip_address")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
        
      if (!server?.coolify_token || !server?.coolify_url) {
        throw new Error("VPS non configuré");
      }
      
      // Test Coolify API
      const response = await fetch(`${server.coolify_url}/api/v1/servers`, {
        headers: {
          Authorization: `Bearer ${server.coolify_token}`,
          Accept: "application/json",
        },
      });
      
      if (response.ok) {
        setConnectionStatus(prev => ({ ...prev, vps: "connected" }));
        
        await supabase
          .from("user_servers")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("user_id", user!.id);
        
        toast({
          title: "VPS IONOS connecté!",
          description: `Coolify opérationnel sur ${server.ip_address}`,
        });
      } else {
        throw new Error("API Coolify inaccessible");
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, vps: "disconnected" }));
      toast({
        title: "Échec de connexion VPS",
        description: "Vérifiez la configuration Coolify sur votre serveur",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allConnected = connectionStatus.github === "connected" && 
                       connectionStatus.supabase === "connected" && 
                       connectionStatus.vps === "connected";

  const handleFullAutoDeploy = async () => {
    if (!allConnected) {
      toast({
        title: "Prérequis manquants",
        description: "Connectez tous les services avant de déployer",
        variant: "destructive",
      });
      return;
    }
    
    if (!extractedFiles || !projectName) {
      toast({
        title: "Projet requis",
        description: "Analysez d'abord un projet ZIP pour continuer",
        variant: "destructive",
      });
      return;
    }
    
    setIsFullDeploying(true);
    setDeployProgress(0);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data: settings } = await supabase
        .from("user_settings")
        .select("github_token")
        .eq("user_id", user!.id)
        .maybeSingle();
        
      if (!settings?.github_token) throw new Error("Token GitHub non trouvé");
      
      // Step 1: Clean Code
      setDeployStatus("🧹 Nettoyage du code propriétaire...");
      setDeployProgress(10);
      await new Promise(r => setTimeout(r, 800));
      
      // Step 2: Create Repo
      setDeployStatus("📦 Création du dépôt souverain sur votre GitHub...");
      setDeployProgress(25);
      
      const filesObj: Record<string, string> = {};
      extractedFiles.forEach((content, path) => {
        filesObj[path] = content;
      });
      
      const { data: exportResult, error: exportError } = await supabase.functions.invoke(
        "export-to-github",
        {
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
          body: {
            repoName: `${projectName}-sovereign`,
            description: `Projet souverain - 100% autonome - Inovaq Canada Inc.`,
            files: filesObj,
            isPrivate: true,
            github_token: settings.github_token,
          },
        }
      );
      
      if (exportError) throw exportError;
      
      // Step 3: Push Code
      setDeployStatus("📤 Code poussé vers votre dépôt privé...");
      setDeployProgress(50);
      await new Promise(r => setTimeout(r, 500));
      
      // Step 4: Migrate DB Schema
      setDeployStatus("🗄️ Migration du schéma vers votre Supabase...");
      setDeployProgress(65);
      
      if (connectionStatus.supabase === "connected") {
        await supabase.functions.invoke("migrate-db-schema", {
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
          body: { action: "migrate" },
        });
      }
      
      // Step 5: Trigger Coolify
      setDeployStatus("🚀 Déclenchement du déploiement Coolify...");
      setDeployProgress(85);
      
      const { data: server } = await supabase
        .from("user_servers")
        .select("id, coolify_token")
        .eq("user_id", user!.id)
        .not("coolify_token", "is", null)
        .limit(1)
        .maybeSingle();
        
      if (server?.coolify_token && exportResult?.repoUrl) {
        await supabase.functions.invoke("deploy-coolify", {
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
          body: {
            serverId: server.id,
            projectName: `${projectName}-sovereign`,
            githubRepoUrl: exportResult.repoUrl,
          },
        });
      }
      
      setDeployProgress(100);
      setDeployStatus("✅ Déploiement souverain terminé!");
      
      toast({
        title: "🎉 Souveraineté totale atteinte!",
        description: "Votre projet est maintenant 100% sur votre infrastructure.",
      });
      
      onComplete?.();
      
    } catch (error) {
      console.error("Full deploy error:", error);
      toast({
        title: "Erreur de déploiement",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsFullDeploying(false);
    }
  };

  const steps: { id: WizardStep; label: string; icon: React.ElementType }[] = [
    { id: "github", label: "GitHub", icon: Github },
    { id: "supabase", label: "Supabase", icon: Database },
    { id: "vps", label: "VPS IONOS", icon: Server },
  ];

  return (
    <div className="space-y-6">
      {/* Status Indicators Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-muted/30 to-muted/10">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8">
            <StatusIndicator 
              label="GitHub" 
              status={connectionStatus.github} 
              icon={Github}
            />
            <Separator orientation="vertical" className="hidden md:block h-8" />
            <StatusIndicator 
              label="Supabase" 
              status={connectionStatus.supabase} 
              icon={Database}
            />
            <Separator orientation="vertical" className="hidden md:block h-8" />
            <StatusIndicator 
              label="VPS IONOS" 
              status={connectionStatus.vps} 
              icon={Server}
            />
          </div>
        </CardContent>
      </Card>
      
      {/* Full Auto-Deploy Button */}
      {allConnected && (
        <Card className="border-success/50 bg-gradient-to-r from-success/5 to-primary/5">
          <CardContent className="pt-6">
            {isFullDeploying ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                  <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                  Déploiement souverain en cours
                </div>
                <Progress value={deployProgress} className="h-3" />
                <p className="text-center text-sm text-muted-foreground">{deployStatus}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="text-lg font-semibold">Tous les services sont connectés!</span>
                </div>
                <Button 
                  size="lg" 
                  onClick={handleFullAutoDeploy}
                  disabled={!extractedFiles}
                  className="gap-2 bg-gradient-to-r from-primary to-success hover:opacity-90 text-primary-foreground shadow-lg"
                >
                  <Zap className="h-5 w-5" />
                  Full Auto-Deploy
                  <Rocket className="h-5 w-5" />
                </Button>
                {!extractedFiles && (
                  <p className="text-sm text-muted-foreground">Analysez d'abord un projet pour activer le déploiement</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Step Navigation */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                ${currentStep === step.id ? "bg-primary border-primary text-primary-foreground scale-110" : ""}
                ${connectionStatus[step.id] === "connected" && currentStep !== step.id ? "bg-success border-success text-success-foreground" : ""}
                ${currentStep !== step.id && connectionStatus[step.id] !== "connected" ? "border-muted-foreground/30 text-muted-foreground hover:border-primary/50" : ""}
              `}
            >
              {connectionStatus[step.id] === "connected" ? (
                <Check className="h-5 w-5" />
              ) : (
                <step.icon className="h-4 w-4" />
              )}
            </button>
            {index < steps.length - 1 && (
              <div className={`w-8 md:w-16 h-0.5 mx-1 ${connectionStatus[step.id] === "connected" ? "bg-success" : "bg-muted-foreground/30"}`} />
            )}
          </div>
        ))}
      </div>
      
      {/* Step: GitHub */}
      {currentStep === "github" && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <Github className="h-10 w-10 text-primary" />
            </div>
            <Badge className="mx-auto mb-2 bg-primary/10 text-primary border-primary/20">
              <Lock className="h-3 w-3 mr-1" />
              Étape 1 - Le Coffre-fort
            </Badge>
            <CardTitle className="text-2xl">Devenez propriétaire de votre code</CardTitle>
            <CardDescription className="max-w-lg mx-auto">
              Votre code sera stocké sur <strong>votre compte GitHub personnel</strong>. Vous en gardez le contrôle total, pour toujours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-primary/30 bg-primary/5">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Inopay crée un dépôt privé sur votre compte GitHub et y pousse le code nettoyé. Vous restez propriétaire à 100%.
              </AlertDescription>
            </Alert>

            {/* Guide Modal */}
            <div className="flex justify-center">
              <GitHubGuideModal />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="github-token">Personal Access Token (Classic)</Label>
                <div className="relative">
                  <Input
                    id="github-token"
                    type={showGithubToken ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowGithubToken(!showGithubToken)}
                  >
                    {showGithubToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Scopes requis: <code className="bg-muted px-1 rounded">repo</code>, <code className="bg-muted px-1 rounded">admin:repo_hook</code>
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={testGitHubConnection}
                  disabled={connectionStatus.github === "testing" || !githubToken}
                  className="flex-1 gap-2"
                >
                  {connectionStatus.github === "testing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  Tester la connexion
                </Button>
                {connectionStatus.github === "connected" && (
                  <Button variant="outline" onClick={() => setCurrentStep("supabase")} className="gap-1">
                    Suivant <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {githubUsername && (
                <div className="flex items-center justify-center gap-2 text-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Connecté en tant que <strong>@{githubUsername}</strong></span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Step: Supabase */}
      {currentStep === "supabase" && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <Database className="h-10 w-10 text-primary" />
            </div>
            <Badge className="mx-auto mb-2 bg-primary/10 text-primary border-primary/20">
              <Lock className="h-3 w-3 mr-1" />
              Étape 2 - La Mémoire
            </Badge>
            <CardTitle className="text-2xl">Vos données restent chez vous</CardTitle>
            <CardDescription className="max-w-lg mx-auto">
              Connectez votre propre instance Supabase. Vos données ne passent jamais par nos serveurs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-success/30 bg-success/5">
              <Shield className="h-4 w-4 text-success" />
              <AlertDescription className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="underline decoration-dotted cursor-help">
                      Vos clés sont cryptées (AES-256)
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Vos credentials sont chiffrés côté serveur et ne servent qu'à l'injection initiale de votre base de données. Ils ne sont jamais exposés dans le code frontend.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                et vos données restent sur votre infrastructure.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supabase-url">URL du projet Supabase</Label>
                <Input
                  id="supabase-url"
                  type="url"
                  placeholder="https://xxxxx.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supabase-key" className="flex items-center gap-2">
                  Service Role Key
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Trouvez cette clé dans Settings → API de votre projet Supabase</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <div className="relative">
                  <Input
                    id="supabase-key"
                    type={showSupabaseKey ? "text" : "password"}
                    placeholder="eyJhbGciOiJIUzI1NiIs..."
                    value={supabaseServiceKey}
                    onChange={(e) => setSupabaseServiceKey(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                  >
                    {showSupabaseKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep("github")} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Retour
                </Button>
                <Button 
                  onClick={testSupabaseConnection}
                  disabled={connectionStatus.supabase === "testing" || !supabaseUrl || !supabaseServiceKey}
                  className="flex-1 gap-2"
                >
                  {connectionStatus.supabase === "testing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  Tester la connexion
                </Button>
                {connectionStatus.supabase === "connected" && (
                  <Button variant="outline" onClick={() => setCurrentStep("vps")} className="gap-1">
                    Suivant <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Step: VPS */}
      {currentStep === "vps" && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <Server className="h-10 w-10 text-primary" />
            </div>
            <Badge className="mx-auto mb-2 bg-primary/10 text-primary border-primary/20">
              <Lock className="h-3 w-3 mr-1" />
              Étape 3 - L'Infrastructure
            </Badge>
            <CardTitle className="text-2xl">Votre serveur, votre royaume</CardTitle>
            <CardDescription className="max-w-lg mx-auto">
              Vérification de la connexion avec Coolify sur votre VPS IONOS (209.46.125.157)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-primary/30 bg-primary/5">
              <Server className="h-4 w-4" />
              <AlertDescription>
                Coolify gère le déploiement continu depuis votre dépôt GitHub vers votre VPS. Chaque push déclenche un build automatique.
              </AlertDescription>
            </Alert>

            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IP Serveur:</span>
                <code className="bg-background px-2 py-0.5 rounded">209.46.125.157</code>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Plateforme:</span>
                <span>Coolify v4</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Provider:</span>
                <span>IONOS</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep("supabase")} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Retour
              </Button>
              <Button 
                onClick={testVPSConnection}
                disabled={connectionStatus.vps === "testing"}
                className="flex-1 gap-2"
              >
                {connectionStatus.vps === "testing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                Vérifier la connexion Coolify
              </Button>
            </div>

            {connectionStatus.vps === "connected" && (
              <div className="flex flex-col items-center gap-3 pt-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-6 w-6" />
                  <span className="font-semibold">Infrastructure prête!</span>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Vous pouvez maintenant utiliser le bouton <strong>Full Auto-Deploy</strong> ci-dessus pour déployer votre projet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
