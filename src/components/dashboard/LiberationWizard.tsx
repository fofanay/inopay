import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
      toast({ title: t("liberationWizard.toast.urlRequired"), description: t("liberationWizard.toast.enterLovableUrl"), variant: "destructive" });
      return;
    }
    
    setLoading(true);
    setStepStatus(prev => ({ ...prev, source: "in_progress" }));
    
    try {
      const parsed = parseGitHubUrl(migrationData.sourceUrl);
      if (!parsed) throw new Error(t("liberationWizard.errors.invalidUrl"));
      
      console.log("[LiberationWizard] Fetching repo:", migrationData.sourceUrl);
      
      const { data, error } = await supabase.functions.invoke("fetch-github-repo", {
        body: { 
          repoUrl: migrationData.sourceUrl,
          token: sourceToken || undefined
        }
      });
      
      if (error) throw new Error(error.message);
      if (!data?.files || data.files.length === 0) throw new Error(t("liberationWizard.errors.noFilesFound"));
      
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
        title: t("liberationWizard.toast.sourceValidated"), 
        description: t("liberationWizard.toast.filesFetched", { count: data.files.length, owner: parsed.owner, repo: parsed.repo })
      });
    } catch (error: any) {
      console.error("[LiberationWizard] Source error:", error);
      setStepStatus(prev => ({ ...prev, source: "error" }));
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const validateDestination = async () => {
    if (!destinationToken) {
      toast({ title: t("liberationWizard.toast.tokenRequired"), description: t("liberationWizard.toast.enterPAT"), variant: "destructive" });
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
        toast({ title: t("liberationWizard.toast.destinationConnected"), description: t("liberationWizard.toast.readyToExport", { username: userData.login }) });
      } else {
        throw new Error(t("liberationWizard.errors.invalidToken"));
      }
    } catch (error: any) {
      setStepStatus(prev => ({ ...prev, destination: "error" }));
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const validateAPIKey = async () => {
    if (!aiConfig.apiKey) {
      toast({ title: t("liberationWizard.toast.keyRequired"), description: t("liberationWizard.toast.enterApiKey"), variant: "destructive" });
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
          title: t("liberationWizard.toast.keyValidated"), 
          description: `${data.provider} connecté - ${data.model}` 
        });
      } else {
        throw new Error(data?.error || "Clé invalide");
      }
    } catch (error: any) {
      console.error("[LiberationWizard] API key validation error:", error);
      toast({ title: t("liberationWizard.toast.invalidKey"), description: error.message, variant: "destructive" });
    } finally {
      setValidatingKey(false);
    }
  };

  const skipAIConfig = () => {
    setAIConfig(prev => ({ ...prev, mode: "inopay", isValidated: true }));
    setStepStatus(prev => ({ ...prev, ai: "completed" }));
    setCurrentStep(4);
    toast({ title: t("liberationWizard.toast.inopaySelected"), description: t("liberationWizard.toast.deepseekUsed") });
  };

  const confirmBYOK = () => {
    if (!aiConfig.isValidated) {
      toast({ title: t("liberationWizard.toast.validationRequired"), description: t("liberationWizard.toast.testKeyFirst"), variant: "destructive" });
      return;
    }
    setCurrentStep(4);
  };

  const startCleaning = async () => {
    if (fetchedFiles.length === 0) {
      toast({ title: t("common.error"), description: t("liberationWizard.errors.noFilesToClean"), variant: "destructive" });
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
        title: t("liberationWizard.toast.cleaningComplete"), 
        description: t("liberationWizard.toast.filesModified", { changed: changesCount, total: filesToClean.length })
      });
    } catch (error: any) {
      console.error("[LiberationWizard] Cleaning error:", error);
      setStepStatus(prev => ({ ...prev, cleaning: "error" }));
      toast({ title: t("liberationWizard.toast.cleaningError"), description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const startExport = async () => {
    if (Object.keys(cleanedFiles).length === 0) {
      toast({ title: t("common.error"), description: t("liberationWizard.errors.noFilesToExport"), variant: "destructive" });
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
      if (!data?.success) throw new Error(data?.error || t("liberationWizard.errors.exportFailed"));
      
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
        title: t("liberationWizard.toast.liberationSuccess"), 
        description: t("liberationWizard.toast.codeExported", { repo: data.repoFullName })
      });
    } catch (error: any) {
      console.error("[LiberationWizard] Export error:", error);
      setStepStatus(prev => ({ ...prev, export: "error" }));
      toast({ title: t("liberationWizard.toast.exportError"), description: error.message, variant: "destructive" });
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
    { num: 1, key: "source", label: t("liberationWizard.steps.source"), icon: Download, color: "text-orange-500" },
    { num: 2, key: "destination", label: t("liberationWizard.steps.destination"), icon: Upload, color: "text-success" },
    { num: 3, key: "ai", label: t("liberationWizard.steps.aiEngine"), icon: Cpu, color: "text-amber-500" },
    { num: 4, key: "cleaning", label: t("liberationWizard.steps.cleaning"), icon: Sparkles, color: "text-primary" },
    { num: 5, key: "export", label: t("liberationWizard.steps.export"), icon: Rocket, color: "text-purple-500" },
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
                {t("liberation.title")}
              </CardTitle>
              <CardDescription>
                {t("liberation.description")}
              </CardDescription>
            </div>
            {completedSteps === 5 && (
              <Button variant="outline" size="sm" onClick={resetWizard}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("liberation.restart")}
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
                    <Badge variant="secondary" className="text-xs">{fetchedFiles.length} {t("liberation.files")}</Badge>
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
                      <Badge variant="default" className="text-xs">{cleaningStats.changesCount} {t("liberation.modified")}</Badge>
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
                    : t("liberation.yourAccount")}
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
                <h3 className="text-lg font-semibold">{t("liberationWizard.step1.title")}</h3>
              </div>
              
              <Alert>
                <Github className="h-4 w-4" />
                <AlertDescription>
                  {t("liberationWizard.step1.description")}
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label>{t("liberationWizard.step1.urlLabel")}</Label>
                <Input
                  placeholder={t("liberationWizard.step1.urlPlaceholder")}
                  value={migrationData.sourceUrl}
                  onChange={(e) => handleSourceUrlChange(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>{t("liberationWizard.step1.tokenLabel")}</Label>
                <div className="relative">
                  <Input
                    type={showTokens.source ? "text" : "password"}
                    placeholder={t("liberationWizard.step1.tokenPlaceholder")}
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
                {t("liberationWizard.step1.fetchFiles")}
              </Button>
            </div>
          )}

          {/* Step 2: Destination */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="h-5 w-5 text-success" />
                <h3 className="text-lg font-semibold">{t("liberationWizard.step2.title")}</h3>
              </div>
              
              <Alert className="border-success/50 bg-success/5">
                <Github className="h-4 w-4" />
                <AlertDescription dangerouslySetInnerHTML={{ __html: t("liberationWizard.step2.description") }}>
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label>{t("liberationWizard.step2.patLabel")}</Label>
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
                  {t("liberationWizard.step2.createToken")}
                </a>
              </div>
              
              <div className="space-y-2">
                <Label>{t("liberationWizard.step2.repoNameLabel")}</Label>
                <Input
                  value={migrationData.destinationRepo}
                  onChange={(e) => setMigrationData(prev => ({ ...prev, destinationRepo: e.target.value }))}
                  placeholder={t("liberationWizard.step2.repoNamePlaceholder")}
                />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>{t("liberationWizard.back")}</Button>
                <Button onClick={validateDestination} disabled={loading || !destinationToken}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  {t("liberationWizard.step2.connectAccount")}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: AI Configuration */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Cpu className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-semibold">{t("liberationWizard.step3.title")}</h3>
              </div>
              
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <Cpu className="h-4 w-4 text-amber-500" />
                <AlertDescription>
                  {t("liberationWizard.step3.description")}
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
                        <span className="font-semibold">{t("liberationWizard.step3.inopayEngine")}</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{t("settings.recommended")}</Badge>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("liberationWizard.step3.inopayDesc")}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3" />
                        <span>{t("liberationWizard.step3.fallbackInfo")}</span>
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
                        <span className="font-semibold">{t("liberationWizard.step3.byokTitle")}</span>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30">-30%</Badge>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("liberationWizard.step3.byokDesc")}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-amber-400">
                        <Sparkles className="h-3 w-3" />
                        <span>{t("liberationWizard.step3.byokDiscount")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </RadioGroup>

              {/* BYOK Configuration */}
              {aiConfig.mode === "byok" && (
                <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-amber-500/20">
                  <div className="space-y-3">
                    <Label>{t("settings.provider")}</Label>
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
                    <Label>{t("liberationWizard.step3.apiKeyLabel")}</Label>
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
                            {t("liberationWizard.step3.validated")}
                          </>
                        ) : (
                          t("liberationWizard.step3.test")
                        )}
                      </Button>
                    </div>
                    {hasExistingKey && !aiConfig.apiKey && (
                      <p className="text-xs text-success flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {t("liberationWizard.step3.existingKey")}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>{t("liberationWizard.back")}</Button>
                {aiConfig.mode === "inopay" ? (
                  <Button onClick={skipAIConfig}>
                    <Zap className="h-4 w-4 mr-2" />
                    {t("liberationWizard.step3.useInopay")}
                  </Button>
                ) : (
                  <Button 
                    onClick={confirmBYOK} 
                    disabled={!aiConfig.isValidated && !hasExistingKey}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Key className="h-4 w-4 mr-2" />
                    {t("liberationWizard.step3.continueWithKey")}
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
                <h3 className="text-lg font-semibold">{t("liberationWizard.step4.title")}</h3>
              </div>
              
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  {t("liberationWizard.step4.description", { count: fetchedFiles.filter(f => f.path.match(/\.(tsx?|jsx?)$/)).length })}
                  {aiConfig.mode === "byok" && hasExistingKey && (
                    <span className="block mt-1 text-amber-400">
                      {t("liberationWizard.step4.byokUsed", { provider: aiConfig.provider.toUpperCase() })}
                    </span>
                  )}
                </AlertDescription>
              </Alert>
              
              {stepStatus.cleaning === "in_progress" && cleaningProgress.total > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{t("liberationWizard.step4.cleaningInProgress")}</span>
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
                <p>✓ {t("liberationWizard.step4.task1")}</p>
                <p>✓ {t("liberationWizard.step4.task2")}</p>
                <p>✓ {t("liberationWizard.step4.task3")}</p>
                <p>✓ {t("liberationWizard.step4.task4")}</p>
                <p>✓ {t("liberationWizard.step4.task5")}</p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>{t("liberationWizard.back")}</Button>
                <Button onClick={startCleaning} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("liberationWizard.step4.cleaningInProgress")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {t("liberationWizard.step4.startCleaning")}
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
                <h3 className="text-lg font-semibold">{t("liberationWizard.step5.title")}</h3>
              </div>
              
              <Alert className="border-purple-500/50 bg-purple-500/5">
                <Rocket className="h-4 w-4" />
                <AlertDescription dangerouslySetInnerHTML={{ __html: t("liberationWizard.step5.description", { count: Object.keys(cleanedFiles).length, username: migrationData.destinationUsername, repo: migrationData.destinationRepo }) }}>
                </AlertDescription>
              </Alert>
              
              {cleaningStats.changesCount > 0 && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm">
                  <p className="font-medium text-success">✓ {t("liberationWizard.step5.filesOptimized", { count: cleaningStats.changesCount })}</p>
                  <p className="text-muted-foreground">{t("liberationWizard.step5.codeCleaned")}</p>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(4)}>{t("liberationWizard.back")}</Button>
                <Button onClick={startExport} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("liberationWizard.step5.exportInProgress")}
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      {t("liberationWizard.step5.exportNow")}
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
                <h3 className="text-2xl font-bold text-success mb-2">{t("liberationWizard.success.title")}</h3>
                <p className="text-muted-foreground">
                  {t("liberationWizard.success.description")}
                </p>
              </div>
              
              <div className="bg-muted rounded-lg p-4 max-w-md mx-auto space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("liberationWizard.success.filesExported")}:</span>
                  <Badge>{Object.keys(cleanedFiles).length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("liberationWizard.success.filesModified")}:</span>
                  <Badge variant="secondary">{cleaningStats.changesCount}</Badge>
                </div>
                {aiConfig.mode === "byok" && hasExistingKey && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{t("liberationWizard.success.mode")}:</span>
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
                    {t("liberationWizard.success.viewOnGithub")}
                  </a>
                </Button>
                <Button onClick={resetWizard}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t("liberationWizard.success.newProject")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
