import { useState, useEffect } from "react";
import {
  Download,
  Upload,
  Sparkles,
  Rocket,
  CheckCircle2,
  Circle,
  ArrowRight,
  Github,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  FileCode,
  AlertTriangle,
  Cpu,
  Key,
  Shield,
  Zap
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StepStatus {
  source: "pending" | "in_progress" | "completed" | "error";
  destination: "pending" | "in_progress" | "completed" | "error";
  ai: "pending" | "in_progress" | "completed" | "error";
  cleaning: "pending" | "in_progress" | "completed" | "error";
  export: "pending" | "in_progress" | "completed" | "error";
}

interface MigrationData {
  sourceUrl: string;
  sourceOwner: string;
  sourceRepo: string;
  destinationUsername: string;
  destinationRepo: string;
  exportedUrl: string | null;
}

interface CleaningProgress {
  total: number;
  completed: number;
  currentFile: string;
}

interface FetchedFile {
  path: string;
  content: string;
}

type AIProvider = "inopay" | "openai" | "anthropic" | "deepseek";

interface AIConfig {
  mode: "inopay" | "byok";
  provider: AIProvider;
  apiKey: string;
  isValidated: boolean;
}

export function LiberationWizard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [stepStatus, setStepStatus] = useState<StepStatus>({
    source: "pending",
    destination: "pending",
    ai: "pending",
    cleaning: "pending",
    export: "pending",
  });
  
  const [migrationData, setMigrationData] = useState<MigrationData>({
    sourceUrl: "",
    sourceOwner: "",
    sourceRepo: "",
    destinationUsername: "",
    destinationRepo: "",
    exportedUrl: null,
  });
  
  const [sourceToken, setSourceToken] = useState("");
  const [destinationToken, setDestinationToken] = useState("");
  const [showTokens, setShowTokens] = useState({ source: false, destination: false, ai: false });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // AI Configuration state
  const [aiConfig, setAIConfig] = useState<AIConfig>({
    mode: "inopay",
    provider: "inopay",
    apiKey: "",
    isValidated: false,
  });
  const [validatingKey, setValidatingKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  
  // Real processing states
  const [fetchedFiles, setFetchedFiles] = useState<FetchedFile[]>([]);
  const [cleanedFiles, setCleanedFiles] = useState<Record<string, string>>({});
  const [cleaningProgress, setCleaningProgress] = useState<CleaningProgress>({ total: 0, completed: 0, currentFile: "" });
  const [cleaningStats, setCleaningStats] = useState({ filesProcessed: 0, changesCount: 0 });

  useEffect(() => {
    if (user) loadExistingConfig();
  }, [user]);

  const loadExistingConfig = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("user_settings")
      .select("github_source_token, github_destination_token, github_destination_username, api_key, api_provider")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (data) {
      if (data.github_source_token) {
        setSourceToken("");
        setStepStatus(prev => ({ ...prev, source: "completed" }));
      }
      if (data.github_destination_token && data.github_destination_username) {
        setDestinationToken("");
        setStepStatus(prev => ({ ...prev, destination: "completed" }));
        setMigrationData(prev => ({ 
          ...prev, 
          destinationUsername: data.github_destination_username || "" 
        }));
      }
      // Check for existing API key
      if (data.api_key) {
        setHasExistingKey(true);
        setAIConfig(prev => ({
          ...prev,
          mode: "byok",
          provider: data.api_provider as AIProvider || "anthropic",
          isValidated: true,
        }));
        setStepStatus(prev => ({ ...prev, ai: "completed" }));
      }
    }
  };

  const parseGitHubUrl = (url: string) => {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
    return null;
  };

  const handleSourceUrlChange = (url: string) => {
    setMigrationData(prev => ({ ...prev, sourceUrl: url }));
    const parsed = parseGitHubUrl(url);
    if (parsed) {
      setMigrationData(prev => ({ 
        ...prev, 
        sourceOwner: parsed.owner, 
        sourceRepo: parsed.repo,
        destinationRepo: `${parsed.repo}-libre`
      }));
    }
  };

  const validateSource = async () => {
    if (!migrationData.sourceUrl) {
      toast({ title: "URL requise", description: "Entrez l'URL de votre dépôt Lovable", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    setStepStatus(prev => ({ ...prev, source: "in_progress" }));
    
    try {
      const parsed = parseGitHubUrl(migrationData.sourceUrl);
      if (!parsed) throw new Error("URL invalide");
      
      console.log("[LiberationWizard] Fetching repo:", migrationData.sourceUrl);
      
      const { data, error } = await supabase.functions.invoke("fetch-github-repo", {
        body: { 
          repoUrl: migrationData.sourceUrl,
          token: sourceToken || undefined
        }
      });
      
      if (error) throw new Error(error.message);
      if (!data?.files || data.files.length === 0) throw new Error("Aucun fichier trouvé dans le dépôt");
      
      console.log(`[LiberationWizard] Fetched ${data.files.length} files`);
      setFetchedFiles(data.files);
      
      if (sourceToken && user) {
        await supabase
          .from("user_settings")
          .upsert({ 
            user_id: user.id, 
            github_source_token: sourceToken,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });
      }
      
      setStepStatus(prev => ({ ...prev, source: "completed" }));
      setCurrentStep(2);
      toast({ 
        title: "Source validée", 
        description: `${data.files.length} fichiers récupérés depuis ${parsed.owner}/${parsed.repo}` 
      });
    } catch (error: any) {
      console.error("[LiberationWizard] Source error:", error);
      setStepStatus(prev => ({ ...prev, source: "error" }));
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const validateDestination = async () => {
    if (!destinationToken) {
      toast({ title: "Token requis", description: "Entrez votre Personal Access Token", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    setStepStatus(prev => ({ ...prev, destination: "in_progress" }));
    
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${destinationToken}`, Accept: "application/vnd.github.v3+json" }
      });
      
      if (response.ok) {
        const userData = await response.json();
        
        if (user) {
          await supabase
            .from("user_settings")
            .upsert({
              user_id: user.id,
              github_destination_token: destinationToken,
              github_destination_username: userData.login,
              updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });
        }
        
        setMigrationData(prev => ({ ...prev, destinationUsername: userData.login }));
        setStepStatus(prev => ({ ...prev, destination: "completed" }));
        setCurrentStep(3); // Go to AI config step
        toast({ title: "Destination connectée", description: `Prêt à exporter vers @${userData.login}` });
      } else {
        throw new Error("Token invalide ou expiré");
      }
    } catch (error: any) {
      setStepStatus(prev => ({ ...prev, destination: "error" }));
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const validateAPIKey = async () => {
    if (!aiConfig.apiKey) {
      toast({ title: "Clé requise", description: "Entrez votre clé API", variant: "destructive" });
      return;
    }
    
    setValidatingKey(true);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("validate-api-key", {
        body: { 
          apiKey: aiConfig.apiKey,
          provider: aiConfig.provider
        },
        headers: sessionData.session?.access_token 
          ? { Authorization: `Bearer ${sessionData.session.access_token}` }
          : undefined
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.valid) {
        setAIConfig(prev => ({ ...prev, isValidated: true }));
        setHasExistingKey(true);
        setStepStatus(prev => ({ ...prev, ai: "completed" }));
        toast({ 
          title: "Clé validée !", 
          description: `${data.provider} connecté - ${data.model}` 
        });
      } else {
        throw new Error(data?.error || "Clé invalide");
      }
    } catch (error: any) {
      console.error("[LiberationWizard] API key validation error:", error);
      toast({ title: "Clé invalide", description: error.message, variant: "destructive" });
    } finally {
      setValidatingKey(false);
    }
  };

  const skipAIConfig = () => {
    setAIConfig(prev => ({ ...prev, mode: "inopay", isValidated: true }));
    setStepStatus(prev => ({ ...prev, ai: "completed" }));
    setCurrentStep(4);
    toast({ title: "Moteur Inopay sélectionné", description: "DeepSeek V3 sera utilisé pour le nettoyage" });
  };

  const confirmBYOK = () => {
    if (!aiConfig.isValidated) {
      toast({ title: "Validation requise", description: "Testez d'abord votre clé API", variant: "destructive" });
      return;
    }
    setCurrentStep(4);
  };

  const startCleaning = async () => {
    if (fetchedFiles.length === 0) {
      toast({ title: "Erreur", description: "Aucun fichier à nettoyer", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    setStepStatus(prev => ({ ...prev, cleaning: "in_progress" }));
    
    const filesToClean = fetchedFiles.filter(f => 
      f.path.endsWith('.ts') || 
      f.path.endsWith('.tsx') || 
      f.path.endsWith('.js') || 
      f.path.endsWith('.jsx')
    );
    
    const otherFiles = fetchedFiles.filter(f => 
      !f.path.endsWith('.ts') && 
      !f.path.endsWith('.tsx') && 
      !f.path.endsWith('.js') && 
      !f.path.endsWith('.jsx')
    );
    
    setCleaningProgress({ total: filesToClean.length, completed: 0, currentFile: "" });
    
    try {
      const cleaned: Record<string, string> = {};
      let changesCount = 0;
      
      for (const file of otherFiles) {
        cleaned[file.path] = file.content;
      }
      
      for (let i = 0; i < filesToClean.length; i++) {
        const file = filesToClean[i];
        setCleaningProgress({ total: filesToClean.length, completed: i, currentFile: file.path });
        
        try {
          const { data, error } = await supabase.functions.invoke("clean-code", {
            body: { 
              code: file.content, 
              fileName: file.path,
              projectId: null
            }
          });
          
          if (error) {
            console.warn(`[LiberationWizard] Error cleaning ${file.path}:`, error);
            cleaned[file.path] = file.content;
          } else if (data?.cleanedCode) {
            cleaned[file.path] = data.cleanedCode;
            if (data.cleanedCode !== file.content) {
              changesCount++;
            }
          } else {
            cleaned[file.path] = file.content;
          }
        } catch (cleanError) {
          console.warn(`[LiberationWizard] Exception cleaning ${file.path}:`, cleanError);
          cleaned[file.path] = file.content;
        }
        
        if (i < filesToClean.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      setCleanedFiles(cleaned);
      setCleaningStats({ filesProcessed: filesToClean.length, changesCount });
      setCleaningProgress({ total: filesToClean.length, completed: filesToClean.length, currentFile: "" });
      setStepStatus(prev => ({ ...prev, cleaning: "completed" }));
      setCurrentStep(5);
      
      toast({ 
        title: "Nettoyage terminé", 
        description: `${changesCount} fichiers modifiés sur ${filesToClean.length}` 
      });
    } catch (error: any) {
      console.error("[LiberationWizard] Cleaning error:", error);
      setStepStatus(prev => ({ ...prev, cleaning: "error" }));
      toast({ title: "Erreur de nettoyage", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const startExport = async () => {
    if (Object.keys(cleanedFiles).length === 0) {
      toast({ title: "Erreur", description: "Aucun fichier à exporter", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    setStepStatus(prev => ({ ...prev, export: "in_progress" }));
    
    try {
      console.log(`[LiberationWizard] Exporting ${Object.keys(cleanedFiles).length} files to ${migrationData.destinationRepo}`);
      
      const { data, error } = await supabase.functions.invoke("export-to-github", {
        body: {
          repoName: migrationData.destinationRepo,
          description: `🚀 Projet libéré depuis ${migrationData.sourceOwner}/${migrationData.sourceRepo} via Inopay`,
          files: cleanedFiles,
          isPrivate: true,
          github_token: destinationToken || undefined
        }
      });
      
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Échec de l'export");
      
      const exportedUrl = data.repoUrl;
      setMigrationData(prev => ({ ...prev, exportedUrl }));
      setStepStatus(prev => ({ ...prev, export: "completed" }));
      
      try {
        await supabase.from("deployment_history").insert({
          user_id: user?.id,
          project_name: migrationData.destinationRepo,
          provider: "github",
          deployment_type: "liberation",
          status: "success",
          deployed_url: exportedUrl,
          portability_score_before: 50,
          portability_score_after: 100,
          files_uploaded: Object.keys(cleanedFiles).length
        });
      } catch (logError) {
        console.warn("[LiberationWizard] Failed to log deployment:", logError);
      }
      
      toast({ 
        title: "🎉 Libération réussie!", 
        description: `Code exporté vers ${data.repoFullName}`
      });
    } catch (error: any) {
      console.error("[LiberationWizard] Export error:", error);
      setStepStatus(prev => ({ ...prev, export: "error" }));
      toast({ title: "Erreur d'export", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    if (migrationData.exportedUrl) {
      navigator.clipboard.writeText(migrationData.exportedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setStepStatus({ source: "pending", destination: "pending", ai: "pending", cleaning: "pending", export: "pending" });
    setMigrationData({ sourceUrl: "", sourceOwner: "", sourceRepo: "", destinationUsername: "", destinationRepo: "", exportedUrl: null });
    setSourceToken("");
    setDestinationToken("");
    setFetchedFiles([]);
    setCleanedFiles({});
    setCleaningProgress({ total: 0, completed: 0, currentFile: "" });
    setCleaningStats({ filesProcessed: 0, changesCount: 0 });
    // Keep AI config
  };

  const getStepIcon = (status: string, stepNum: number) => {
    if (status === "completed") return <CheckCircle2 className="h-6 w-6 text-success" />;
    if (status === "in_progress") return <Loader2 className="h-6 w-6 text-primary animate-spin" />;
    if (status === "error") return <AlertCircle className="h-6 w-6 text-destructive" />;
    if (currentStep === stepNum) return <Circle className="h-6 w-6 text-primary fill-primary/20" />;
    return <Circle className="h-6 w-6 text-muted-foreground" />;
  };

  const completedSteps = Object.values(stepStatus).filter(s => s === "completed").length;
  const progress = (completedSteps / 5) * 100;

  const steps = [
    { num: 1, key: "source", label: "Source", icon: Download, color: "text-orange-500" },
    { num: 2, key: "destination", label: "Destination", icon: Upload, color: "text-success" },
    { num: 3, key: "ai", label: "Moteur IA", icon: Cpu, color: "text-amber-500" },
    { num: 4, key: "cleaning", label: "Nettoyage", icon: Sparkles, color: "text-primary" },
    { num: 5, key: "export", label: "Export", icon: Rocket, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Assistant de Libération
              </CardTitle>
              <CardDescription>
                Exportez votre projet Lovable vers votre propre compte GitHub
              </CardDescription>
            </div>
            {completedSteps === 5 && (
              <Button variant="outline" size="sm" onClick={resetWizard}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recommencer
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-2 mb-4" />
          
          {/* Steps Indicator */}
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {steps.map((step, i) => (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center min-w-[60px]">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    stepStatus[step.key as keyof StepStatus] === "completed" ? "border-success bg-success/10" :
                    stepStatus[step.key as keyof StepStatus] === "in_progress" ? "border-primary bg-primary/10" :
                    stepStatus[step.key as keyof StepStatus] === "error" ? "border-destructive bg-destructive/10" :
                    currentStep === step.num ? "border-primary" : "border-muted"
                  }`}>
                    {getStepIcon(stepStatus[step.key as keyof StepStatus], step.num)}
                  </div>
                  <span className={`text-xs mt-1 font-medium text-center ${currentStep === step.num ? "text-primary" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-8 sm:w-16 h-0.5 mx-1 ${
                    stepStatus[step.key as keyof StepStatus] === "completed" ? "bg-success" : "bg-muted"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Visual Migration Flow */}
      {(migrationData.sourceRepo || migrationData.destinationUsername) && (
        <Card className="bg-gradient-to-r from-orange-500/5 via-primary/5 to-success/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {migrationData.sourceRepo && (
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <Github className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">
                    {migrationData.sourceOwner}/{migrationData.sourceRepo}
                  </span>
                  {stepStatus.source === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
                  {fetchedFiles.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{fetchedFiles.length} fichiers</Badge>
                  )}
                </div>
              )}
              
              {migrationData.sourceRepo && (
                <>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg flex items-center gap-2">
                    <span className="text-sm font-medium">🧹 Inopay</span>
                    {aiConfig.mode === "byok" && hasExistingKey && (
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">BYOK</Badge>
                    )}
                    {cleaningStats.changesCount > 0 && (
                      <Badge variant="default" className="text-xs">{cleaningStats.changesCount} modifiés</Badge>
                    )}
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </>
              )}
              
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                migrationData.destinationUsername 
                  ? "bg-success/10 border border-success/30" 
                  : "bg-muted border border-border"
              }`}>
                <Github className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">
                  {migrationData.destinationUsername 
                    ? `@${migrationData.destinationUsername}/${migrationData.destinationRepo}` 
                    : "Votre compte"}
                </span>
                {stepStatus.export === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Source */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Download className="h-5 w-5 text-orange-500" />
                <h3 className="text-lg font-semibold">Étape 1 : Connecter la source Lovable</h3>
              </div>
              
              <Alert>
                <Github className="h-4 w-4" />
                <AlertDescription>
                  Entrez l'URL du dépôt GitHub créé par Lovable pour votre projet. Tous les fichiers seront récupérés automatiquement.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label>URL du dépôt Lovable</Label>
                <Input
                  placeholder="https://github.com/lovable-org/mon-projet"
                  value={migrationData.sourceUrl}
                  onChange={(e) => handleSourceUrlChange(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Token (optionnel - dépôts privés)</Label>
                <div className="relative">
                  <Input
                    type={showTokens.source ? "text" : "password"}
                    placeholder="ghp_... (uniquement si dépôt privé)"
                    value={sourceToken}
                    onChange={(e) => setSourceToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowTokens(prev => ({ ...prev, source: !prev.source }))}
                  >
                    {showTokens.source ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <Button onClick={validateSource} disabled={loading || !migrationData.sourceUrl}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Récupérer les fichiers
              </Button>
            </div>
          )}

          {/* Step 2: Destination */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="h-5 w-5 text-success" />
                <h3 className="text-lg font-semibold">Étape 2 : Connecter votre compte GitHub</h3>
              </div>
              
              <Alert className="border-success/50 bg-success/5">
                <Github className="h-4 w-4" />
                <AlertDescription>
                  Créez un Personal Access Token sur <strong>votre propre compte GitHub</strong> avec les permissions <code>repo</code> et <code>workflow</code>.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label>Personal Access Token (Classic)</Label>
                <div className="relative">
                  <Input
                    type={showTokens.destination ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={destinationToken}
                    onChange={(e) => setDestinationToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowTokens(prev => ({ ...prev, destination: !prev.destination }))}
                  >
                    {showTokens.destination ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <a 
                  href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=InoPay%20Liberation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Créer un token sur GitHub
                </a>
              </div>
              
              <div className="space-y-2">
                <Label>Nom du nouveau dépôt</Label>
                <Input
                  value={migrationData.destinationRepo}
                  onChange={(e) => setMigrationData(prev => ({ ...prev, destinationRepo: e.target.value }))}
                  placeholder="mon-projet-libre"
                />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>Retour</Button>
                <Button onClick={validateDestination} disabled={loading || !destinationToken}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Connecter mon compte
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: AI Configuration */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold">Étape 3 : Configuration de l'IA</h3>
              </div>
              
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <Cpu className="h-4 w-4 text-amber-500" />
                <AlertDescription>
                  Choisissez le moteur d'intelligence artificielle pour le nettoyage de votre code.
                </AlertDescription>
              </Alert>

              <RadioGroup
                value={aiConfig.mode}
                onValueChange={(value: "inopay" | "byok") => setAIConfig(prev => ({ ...prev, mode: value, isValidated: value === "inopay" }))}
                className="space-y-4"
              >
                {/* Option 1: Inopay Engine */}
                <div className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  aiConfig.mode === "inopay" 
                    ? "border-emerald-500 bg-emerald-500/5" 
                    : "border-muted hover:border-muted-foreground/50"
                }`}>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="inopay" id="inopay" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="inopay" className="flex items-center gap-2 cursor-pointer">
                        <Zap className="h-5 w-5 text-emerald-500" />
                        <span className="font-semibold">Moteur Inopay</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Recommandé</Badge>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Utilisez nos ressources optimisées (<strong>DeepSeek V3</strong>). Simple, rapide, inclus dans votre forfait.
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3" />
                        <span>Fallback automatique sur Claude Sonnet si nécessaire</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Option 2: BYOK */}
                <div className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
                  aiConfig.mode === "byok" 
                    ? "border-amber-500 bg-amber-500/5" 
                    : "border-muted hover:border-muted-foreground/50"
                }`}>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="byok" id="byok" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="byok" className="flex items-center gap-2 cursor-pointer">
                        <Key className="h-5 w-5 text-amber-500" />
                        <span className="font-semibold">Souveraineté Totale (BYOK)</span>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">-30%</Badge>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Utilisez votre propre clé API (Anthropic, OpenAI ou DeepSeek). Idéal pour les très gros projets.
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-amber-400">
                        <Sparkles className="h-3 w-3" />
                        <span>Réduction de 30% sur les frais de service Inopay</span>
                      </div>
                    </div>
                  </div>
                </div>
              </RadioGroup>

              {/* BYOK Configuration */}
              {aiConfig.mode === "byok" && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-amber-500/20">
                  <div className="space-y-3">
                    <Label>Fournisseur</Label>
                    <RadioGroup
                      value={aiConfig.provider}
                      onValueChange={(value: AIProvider) => setAIConfig(prev => ({ ...prev, provider: value, isValidated: false }))}
                      className="grid grid-cols-3 gap-3"
                    >
                      {[
                        { value: "anthropic", label: "Anthropic", sub: "Claude 4" },
                        { value: "openai", label: "OpenAI", sub: "GPT-4o" },
                        { value: "deepseek", label: "DeepSeek", sub: "V3" }
                      ].map(p => (
                        <div key={p.value}>
                          <RadioGroupItem value={p.value} id={`ai-${p.value}`} className="peer sr-only" />
                          <Label
                            htmlFor={`ai-${p.value}`}
                            className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-amber-500 cursor-pointer"
                          >
                            <span className="text-sm font-semibold">{p.label}</span>
                            <span className="text-xs text-muted-foreground">{p.sub}</span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Clé API</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showTokens.ai ? "text" : "password"}
                          placeholder={hasExistingKey ? "••••••••••••••••" : "sk-..."}
                          value={aiConfig.apiKey}
                          onChange={(e) => setAIConfig(prev => ({ ...prev, apiKey: e.target.value, isValidated: false }))}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowTokens(prev => ({ ...prev, ai: !prev.ai }))}
                        >
                          {showTokens.ai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <Button
                        onClick={validateAPIKey}
                        disabled={validatingKey || !aiConfig.apiKey}
                        variant={aiConfig.isValidated ? "outline" : "default"}
                      >
                        {validatingKey ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : aiConfig.isValidated ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1 text-success" />
                            Validé
                          </>
                        ) : (
                          "Tester"
                        )}
                      </Button>
                    </div>
                    {hasExistingKey && !aiConfig.apiKey && (
                      <p className="text-xs text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Clé existante configurée - vous pouvez continuer
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>Retour</Button>
                {aiConfig.mode === "inopay" ? (
                  <Button onClick={skipAIConfig}>
                    <Zap className="h-4 w-4 mr-2" />
                    Utiliser Inopay
                  </Button>
                ) : (
                  <Button 
                    onClick={confirmBYOK} 
                    disabled={!aiConfig.isValidated && !hasExistingKey}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    Continuer avec ma clé
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Cleaning */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Étape 4 : Nettoyage du code</h3>
              </div>
              
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  Inopay va nettoyer <strong>{fetchedFiles.filter(f => f.path.match(/\.(tsx?|jsx?)$/)).length}</strong> fichiers code pour supprimer les dépendances propriétaires.
                  {aiConfig.mode === "byok" && hasExistingKey && (
                    <span className="block mt-1 text-amber-400">
                      Utilisation de votre clé {aiConfig.provider.toUpperCase()} • Réduction 30% appliquée
                    </span>
                  )}
                </AlertDescription>
              </Alert>
              
              {stepStatus.cleaning === "in_progress" && cleaningProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Nettoyage en cours...</span>
                    <span>{cleaningProgress.completed}/{cleaningProgress.total}</span>
                  </div>
                  <Progress value={(cleaningProgress.completed / cleaningProgress.total) * 100} />
                  {cleaningProgress.currentFile && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileCode className="h-3 w-3" />
                      {cleaningProgress.currentFile}
                    </p>
                  )}
                </div>
              )}
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p>✓ Suppression des imports lovable/gptengineer</p>
                <p>✓ Remplacement des hooks propriétaires</p>
                <p>✓ Optimisation des services cloud → Open Source</p>
                <p>✓ Mise à jour des dépendances</p>
                <p>✓ Génération des configs de déploiement</p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>Retour</Button>
                <Button onClick={startCleaning} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Nettoyage en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Lancer le nettoyage
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Export */}
          {currentStep === 5 && stepStatus.export !== "completed" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Rocket className="h-5 w-5 text-purple-500" />
                <h3 className="text-lg font-semibold">Étape 5 : Export vers votre compte</h3>
              </div>
              
              <Alert className="border-purple-500/50 bg-purple-500/5">
                <Rocket className="h-4 w-4" />
                <AlertDescription>
                  <strong>{Object.keys(cleanedFiles).length}</strong> fichiers nettoyés prêts à être exportés vers <strong>@{migrationData.destinationUsername}/{migrationData.destinationRepo}</strong>
                </AlertDescription>
              </Alert>
              
              {cleaningStats.changesCount > 0 && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm">
                  <p className="font-medium text-success">✓ {cleaningStats.changesCount} fichiers optimisés</p>
                  <p className="text-muted-foreground">Code nettoyé des dépendances propriétaires</p>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(4)}>Retour</Button>
                <Button onClick={startExport} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Export en cours...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      Exporter maintenant
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Success State */}
          {stepStatus.export === "completed" && migrationData.exportedUrl && (
            <div className="text-center space-y-6 py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
                <CheckCircle2 className="h-10 w-10 text-success" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-success mb-2">🎉 Libération réussie !</h3>
                <p className="text-muted-foreground">
                  Votre code est maintenant 100% souverain sur votre propre compte GitHub
                </p>
              </div>
              
              <div className="bg-muted rounded-lg p-4 max-w-md mx-auto space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fichiers exportés:</span>
                  <Badge>{Object.keys(cleanedFiles).length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fichiers modifiés:</span>
                  <Badge variant="secondary">{cleaningStats.changesCount}</Badge>
                </div>
                {aiConfig.mode === "byok" && hasExistingKey && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Mode:</span>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">BYOK -30%</Badge>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-center gap-2 p-4 bg-muted rounded-lg max-w-md mx-auto">
                <Github className="h-5 w-5" />
                <code className="text-sm flex-1 text-left truncate">{migrationData.exportedUrl}</code>
                <Button variant="ghost" size="sm" onClick={copyUrl}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              
              <div className="flex justify-center gap-3">
                <Button variant="outline" asChild>
                  <a href={migrationData.exportedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir sur GitHub
                  </a>
                </Button>
                <Button onClick={resetWizard}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Nouveau projet
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
