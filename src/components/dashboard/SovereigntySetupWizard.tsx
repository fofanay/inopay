import { useState, useEffect } from "react";
import { 
  Github, 
  Database, 
  Server,
  Key, 
  Eye, 
  EyeOff, 
  Save, 
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
  Info,
  Copy,
  Check,
  Zap,
  HelpCircle,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type WizardStep = "github" | "supabase" | "vps" | "ready";

interface ConnectionStatus {
  github: "connected" | "disconnected" | "testing";
  supabase: "connected" | "disconnected" | "testing";
  vps: "connected" | "disconnected" | "testing";
}

interface SovereigntySetupWizardProps {
  onComplete?: () => void;
  projectName?: string;
  extractedFiles?: Map<string, string>;
}

export function SovereigntySetupWizard({ 
  onComplete,
  projectName,
  extractedFiles 
}: SovereigntySetupWizardProps) {
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
  
  const [saving, setSaving] = useState(false);
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
      .select("service_role_key, anon_key, db_url, coolify_token, status")
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allConnected = connectionStatus.github === "connected" && 
                       connectionStatus.supabase === "connected" && 
                       connectionStatus.vps === "connected";

  const handleFullAutoDeploy = async () => {
    if (!allConnected || !extractedFiles || !projectName) {
      toast({
        title: "Prérequis manquants",
        description: "Connectez tous les services et analysez un projet",
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
      setDeployStatus("Nettoyage du code propriétaire...");
      setDeployProgress(10);
      await new Promise(r => setTimeout(r, 500));
      
      // Step 2: Create Repo
      setDeployStatus("Création du dépôt souverain sur votre GitHub...");
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
      setDeployStatus("Code poussé vers votre dépôt privé...");
      setDeployProgress(50);
      
      // Step 4: Link DB
      setDeployStatus("Liaison de la base de données...");
      setDeployProgress(65);
      
      if (connectionStatus.supabase === "connected") {
        await supabase.functions.invoke("migrate-db-schema", {
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
          body: { action: "migrate" },
        });
      }
      
      // Step 5: Trigger Coolify
      setDeployStatus("Déclenchement du déploiement Coolify...");
      setDeployProgress(80);
      
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
      setDeployStatus("Déploiement souverain terminé!");
      
      toast({
        title: "🎉 Souveraineté totale atteinte!",
        description: "Votre projet est maintenant sur votre infrastructure.",
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

  const getStepNumber = (step: WizardStep) => {
    const steps: WizardStep[] = ["github", "supabase", "vps", "ready"];
    return steps.indexOf(step) + 1;
  };

  return (
    <div className="space-y-6">
      {/* Status Indicators Banner */}
      <div className="flex items-center justify-center gap-6 p-4 bg-muted/50 rounded-xl border">
        <StatusIndicator 
          label="GitHub" 
          status={connectionStatus.github} 
          icon={Github}
        />
        <Separator orientation="vertical" className="h-8" />
        <StatusIndicator 
          label="Supabase" 
          status={connectionStatus.supabase} 
          icon={Database}
        />
        <Separator orientation="vertical" className="h-8" />
        <StatusIndicator 
          label="VPS IONOS" 
          status={connectionStatus.vps} 
          icon={Server}
        />
      </div>
      
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
                  className="gap-2 bg-gradient-to-r from-primary to-success hover:from-primary/90 hover:to-success/90 text-primary-foreground shadow-lg"
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
      <div className="flex items-center justify-center gap-2 mb-6">
        {(["github", "supabase", "vps"] as WizardStep[]).map((step, index) => (
          <div key={step} className="flex items-center">
            <button
              onClick={() => setCurrentStep(step)}
              className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all
                ${currentStep === step ? "bg-primary border-primary text-primary-foreground scale-110" : ""}
                ${connectionStatus[step] === "connected" ? "bg-success border-success text-success-foreground" : ""}
                ${currentStep !== step && connectionStatus[step] !== "connected" ? "border-muted-foreground/30 text-muted-foreground hover:border-primary/50" : ""}
              `}
            >
              {connectionStatus[step] === "connected" ? (
                <Check className="h-5 w-5" />
              ) : (
                <span className="text-sm font-bold">{index + 1}</span>
              )}
            </button>
            {index < 2 && (
              <div className={`w-12 h-0.5 mx-1 ${connectionStatus[step] === "connected" ? "bg-success" : "bg-muted-foreground/30"}`} />
            )}
          </div>
        ))}
      </div>
      
      {/* Step: GitHub - Le Coffre-fort */}
      {currentStep === "github" && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <Github className="h-10 w-10 text-primary" />
            </div>
            <Badge className="mx-auto mb-2 bg-primary/10 text-primary border-primary/20">
              <Lock className="h-3 w-3 mr-1" />
              Le Coffre-fort
            </Badge>
            <CardTitle className="text-2xl">Devenez propriétaire de votre code</CardTitle>
            <CardDescription className="max-w-lg mx-auto">
              Votre code sera stocké sur votre compte GitHub personnel. Vous en gardez le contrôle total, pour toujours.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Tutorial Accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="tutorial">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4" />
                    Comment créer un Personal Access Token?
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</div>
                      <div>
                        <p className="font-medium">Accédez aux paramètres GitHub</p>
                        <p className="text-sm text-muted-foreground">Settings → Developer settings → Personal access tokens → Tokens (classic)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</div>
                      <div>
                        <p className="font-medium">Générez un nouveau token</p>
                        <p className="text-sm text-muted-foreground">Cliquez sur "Generate new token (classic)"</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</div>
                      <div>
                        <p className="font-medium">Sélectionnez les permissions</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary" className="font-mono">repo</Badge>
                          <Badge variant="secondary" className="font-mono">admin:repo_hook</Badge>
                          <Badge variant="secondary" className="font-mono">workflow</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">4</div>
                      <div>
                        <p className="font-medium">Copiez le token généré</p>
                        <p className="text-sm text-muted-foreground">Il ne sera affiché qu'une seule fois!</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild className="mt-4">
                      <a href="https://github.com/settings/tokens/new?scopes=repo,admin:repo_hook,workflow&description=Inopay%20Sovereign%20Export" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Créer un token maintenant
                      </a>
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            {/* Token Input */}
            <div className="space-y-3">
              <Label htmlFor="github-token" className="text-base font-medium">Personal Access Token (Classic)</Label>
              <div className="relative">
                <Input
                  id="github-token"
                  type={showGithubToken ? "text" : "password"}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  className="pr-20 font-mono"
                />
                <div className="absolute right-0 top-0 h-full flex items-center gap-1 pr-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowGithubToken(!showGithubToken)}
                  >
                    {showGithubToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            
            {connectionStatus.github === "connected" && githubUsername && (
              <Alert className="border-success/50 bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertTitle className="text-success">Coffre-fort activé!</AlertTitle>
                <AlertDescription>
                  Connecté en tant que <strong>@{githubUsername}</strong>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={testGitHubConnection}
                disabled={connectionStatus.github === "testing" || !githubToken}
              >
                {connectionStatus.github === "testing" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Tester la connexion
              </Button>
              
              <Button 
                onClick={() => setCurrentStep("supabase")}
                disabled={connectionStatus.github !== "connected"}
              >
                Continuer
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Step: Supabase - La Mémoire */}
      {currentStep === "supabase" && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <Database className="h-10 w-10 text-primary" />
            </div>
            <Badge className="mx-auto mb-2 bg-primary/10 text-primary border-primary/20">
              <Shield className="h-3 w-3 mr-1" />
              La Mémoire
            </Badge>
            <CardTitle className="text-2xl">Vos données restent chez vous</CardTitle>
            <CardDescription className="max-w-lg mx-auto">
              Connectez votre propre instance Supabase. Nous n'y accédons que pour l'injection initiale du schéma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-600">Pourquoi votre propre Supabase?</AlertTitle>
              <AlertDescription className="text-amber-700/80">
                Avec votre propre instance, vous contrôlez vos données, vos backups, et vos coûts. Pas de vendor lock-in.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supabase-url" className="text-base font-medium">Project URL</Label>
                <Input
                  id="supabase-url"
                  type="url"
                  placeholder="https://xxxxx.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Trouvez-la dans Settings → API de votre projet Supabase
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="supabase-key" className="text-base font-medium">Service Role Key</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Cette clé est cryptée et ne sert qu'à l'injection initiale de votre base de données. Elle n'est jamais exposée côté client.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="relative">
                  <Input
                    id="supabase-key"
                    type={showSupabaseKey ? "text" : "password"}
                    placeholder="eyJhbGciOiJIUzI1NiIs..."
                    value={supabaseServiceKey}
                    onChange={(e) => setSupabaseServiceKey(e.target.value)}
                    className="pr-10 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                  >
                    {showSupabaseKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            
            {connectionStatus.supabase === "connected" && (
              <Alert className="border-success/50 bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertTitle className="text-success">Mémoire configurée!</AlertTitle>
                <AlertDescription>
                  Votre instance Supabase est prête pour la migration.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep("github")}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={testSupabaseConnection}
                  disabled={connectionStatus.supabase === "testing" || !supabaseUrl || !supabaseServiceKey}
                >
                  {connectionStatus.supabase === "testing" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4 mr-2" />
                  )}
                  Tester
                </Button>
                
                <Button 
                  onClick={() => setCurrentStep("vps")}
                >
                  {connectionStatus.supabase === "connected" ? "Continuer" : "Passer"}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Step: VPS - L'Infrastructure */}
      {currentStep === "vps" && (
        <Card className="border-2 border-primary/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
              <Server className="h-10 w-10 text-primary" />
            </div>
            <Badge className="mx-auto mb-2 bg-primary/10 text-primary border-primary/20">
              <Rocket className="h-3 w-3 mr-1" />
              L'Infrastructure
            </Badge>
            <CardTitle className="text-2xl">Votre serveur, votre contrôle</CardTitle>
            <CardDescription className="max-w-lg mx-auto">
              Connectez un VPS IONOS avec Coolify pour un déploiement automatique et souverain.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {connectionStatus.vps === "connected" ? (
              <Alert className="border-success/50 bg-success/10">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertTitle className="text-success">VPS connecté!</AlertTitle>
                <AlertDescription>
                  Votre serveur est prêt pour le déploiement.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <Server className="h-4 w-4" />
                <AlertTitle>Configuration VPS requise</AlertTitle>
                <AlertDescription>
                  Configurez d'abord un serveur dans l'onglet "Mes Serveurs" avec Coolify installé.
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep("supabase")}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              
              <Button 
                onClick={() => {
                  if (allConnected) {
                    toast({
                      title: "Prêt pour le déploiement!",
                      description: "Utilisez le bouton Full Auto-Deploy ci-dessus.",
                    });
                  }
                }}
              >
                Terminer la configuration
                <Check className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Status Indicator Component
function StatusIndicator({ 
  label, 
  status, 
  icon: Icon 
}: { 
  label: string; 
  status: "connected" | "disconnected" | "testing";
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`
        relative flex items-center justify-center w-8 h-8 rounded-full
        ${status === "connected" ? "bg-success/20" : ""}
        ${status === "testing" ? "bg-amber-500/20" : ""}
        ${status === "disconnected" ? "bg-muted" : ""}
      `}>
        <Icon className={`h-4 w-4 ${
          status === "connected" ? "text-success" : 
          status === "testing" ? "text-amber-500" : 
          "text-muted-foreground"
        }`} />
        {/* Pulsing indicator */}
        <span className={`
          absolute top-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background
          ${status === "connected" ? "bg-success" : ""}
          ${status === "testing" ? "bg-amber-500 animate-pulse" : ""}
          ${status === "disconnected" ? "bg-muted-foreground" : ""}
        `} />
      </div>
      <div className="text-sm">
        <span className="font-medium">{label}</span>
        <span className={`ml-2 text-xs ${
          status === "connected" ? "text-success" : 
          status === "testing" ? "text-amber-500" : 
          "text-muted-foreground"
        }`}>
          {status === "connected" ? "Connecté" : status === "testing" ? "Test..." : "Déconnecté"}
        </span>
      </div>
    </div>
  );
}
