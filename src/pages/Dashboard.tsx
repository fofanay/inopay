import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  Upload, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  FileWarning, 
  Sparkles, 
  Settings, 
  Package, 
  Github, 
  Rocket, 
  Shield, 
  Lock, 
  Crown, 
  Cloud, 
  FolderOpen,
  BarChart3,
  LogOut,
  Home,
  History,
  Server,
  Zap,
  Layers,
  LayoutGrid,
  Flame,
  Database
} from "lucide-react";
import { SovereignExport } from "@/components/SovereignExport";
import FofyChat from "@/components/FofyChat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SheetClose } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RoleIndicator } from "@/components/ui/role-indicator";
import { analyzeZipFile, analyzeFromGitHub, RealAnalysisResult, DependencyItem, AnalysisIssue } from "@/lib/zipAnalyzer";
import CodeCleaner from "@/components/CodeCleaner";
import CostSavingsReport from "@/components/dashboard/CostSavingsReport";
import ProjectExporter from "@/components/ProjectExporter";
import StepperProgress from "@/components/dashboard/StepperProgress";
import AnalysisProgressSteps, { AnalysisStep } from "@/components/dashboard/AnalysisProgressSteps";
import GitHubRepoSelector from "@/components/dashboard/GitHubRepoSelector";
import GitHubConnectButton from "@/components/dashboard/GitHubConnectButton";
import DeploymentAssistant from "@/components/dashboard/DeploymentAssistant";
import DatabaseConfigAssistant from "@/components/dashboard/DatabaseConfigAssistant";
import { DeploymentHistory } from "@/components/dashboard/DeploymentHistory";
import { ServerDeploymentsManager } from "@/components/dashboard/ServerDeploymentsManager";
import { AnalyzedProjects } from "@/components/dashboard/AnalyzedProjects";
import EnhancedOverview from "@/components/dashboard/EnhancedOverview";
import UserPurchases from "@/components/dashboard/UserPurchases";
import { ServerManagement } from "@/components/dashboard/ServerManagement";
import { MigrationWizard } from "@/components/dashboard/MigrationWizard";
import { UserMigrationTools } from "@/components/dashboard/UserMigrationTools";
import { UserExportsHistory } from "@/components/dashboard/UserExportsHistory";
import { UserSecurityStatus } from "@/components/dashboard/UserSecurityStatus";
import { UserWidgetStatus } from "@/components/dashboard/UserWidgetStatus";
import { UserDashboardOverview } from "@/components/dashboard/UserDashboardOverview";
import { DeploymentChoice, DeploymentOption } from "@/components/dashboard/DeploymentChoice";
import { OnboardingHebergeur } from "@/components/dashboard/OnboardingHebergeur";
import { SyncMirror } from "@/components/dashboard/SyncMirror";
import { SovereignDeploymentWizard } from "@/components/dashboard/SovereignDeploymentWizard";
import { SovereigntySetupWizard } from "@/components/dashboard/SovereigntySetupWizard";
import { SovereigntyWizard } from "@/components/dashboard/SovereigntyWizard";
import GitHubMultiRepoSelector, { GitHubRepo as MultiRepoGitHubRepo } from "@/components/dashboard/GitHubMultiRepoSelector";
import BatchAnalysisProgress, { BatchAnalysisResult } from "@/components/dashboard/BatchAnalysisProgress";
import { MyPersonalFleet } from "@/components/dashboard/MyPersonalFleet";
import { MobileSidebar } from "@/components/dashboard/MobileSidebar";
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import { MobilePaginationDots } from "@/components/dashboard/MobilePaginationDots";
import { MobileBottomNav } from "@/components/dashboard/MobileBottomNav";
import { LiberationPipeline } from "@/components/dashboard/LiberationPipeline";
import { LiberationWizard } from "@/components/dashboard/LiberationWizard";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useDeploymentNotifications } from "@/hooks/useDeploymentNotifications";
import inopayLogo from "@/assets/inopay-logo-admin.png";

type AnalysisState = "idle" | "uploading" | "analyzing" | "complete";
type ImportMethod = "github-oauth" | "zip" | "github-url";
type DashboardTab = "overview" | "liberation" | "import" | "batch-import" | "fleet" | "projects" | "deployments" | "services" | "servers" | "security" | "migration" | "deploy-choice" | "sovereign-deploy" | "sync-mirror" | "exports";

const DASHBOARD_TABS: DashboardTab[] = ["overview", "liberation", "fleet", "import", "batch-import", "projects", "deploy-choice", "sovereign-deploy", "sync-mirror", "deployments", "servers", "security", "migration", "services", "exports"];

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  updated_at: string;
  stargazers_count: number;
  default_branch: string;
  language: string | null;
}

interface HistoryItem {
  id: string;
  project_name: string;
  file_name: string;
  portability_score: number;
  status: string;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  // Enable realtime deployment notifications
  useDeploymentNotifications();
  const { user, loading: authLoading, subscription, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  
  const [state, setState] = useState<AnalysisState>("idle");
  const [analysisStep, setAnalysisStep] = useState<AnalysisStep>("connecting");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<(RealAnalysisResult & { id?: string }) | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [extractedFiles, setExtractedFiles] = useState<Map<string, string>>(new Map());
  const [cleanerOpen, setCleanerOpen] = useState(false);
  const [selectedFileForCleaning, setSelectedFileForCleaning] = useState<{ name: string; content: string } | null>(null);
  const [exporterOpen, setExporterOpen] = useState(false);
  const [githubUrl, setGithubUrl] = useState("");
  const [importMethod, setImportMethod] = useState<ImportMethod>("github-url");
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [isImportingRepo, setIsImportingRepo] = useState(false);
  const [showDbConfig, setShowDbConfig] = useState(false);
  const [dbConfigComplete, setDbConfigComplete] = useState(false);
  const [sovereignExportOpen, setSovereignExportOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  
  // Batch import states
  const [batchRepos, setBatchRepos] = useState<MultiRepoGitHubRepo[]>([]);
  const [batchResults, setBatchResults] = useState<BatchAnalysisResult[]>([]);
  const [isBatchAnalyzing, setIsBatchAnalyzing] = useState(false);

  // Swipe navigation for mobile - must be called unconditionally before any early returns
  const swipeHandlers = useSwipeNavigation(
    DASHBOARD_TABS,
    activeTab,
    (tab) => setActiveTab(tab),
    { threshold: 80, allowedTime: 400 }
  );

  // Keyboard shortcut for Sovereign Export (Ctrl+Shift+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setSovereignExportOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getCurrentStep = () => {
    if (!isGitHubConnected && importMethod === "github-oauth") return 1;
    if (state === "idle" && isGitHubConnected) return 2;
    if (state === "analyzing" || state === "uploading") return 3;
    if (state === "complete") return 4;
    return 1;
  };

  // Check if user is connected via GitHub OAuth
  useEffect(() => {
    const checkGitHubConnection = async () => {
      if (user) {
        const githubIdentity = user.identities?.find(i => i.provider === "github");
        setIsGitHubConnected(!!githubIdentity);
      }
    };
    checkGitHubConnection();
  }, [user]);

  // Redirect if not authenticated or if admin
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
    // Redirect admin to admin dashboard
    if (!authLoading && user && isAdmin) {
      navigate("/admin-dashboard");
    }
  }, [user, authLoading, isAdmin, navigate]);

  // Fetch user's analysis history
  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from("projects_analysis")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching history:", error);
    } else {
      setHistory(data || []);
    }
    setLoadingHistory(false);
  };

  const saveAnalysis = async (projectName: string, analysisResult: RealAnalysisResult) => {
    if (!user) return;

    const detectedIssues = [
      ...analysisResult.issues.map(issue => ({
        name: issue.pattern,
        type: "Import",
        status: issue.severity === "critical" ? "incompatible" : "warning",
        note: `${issue.file}${issue.line ? `:${issue.line}` : ""} - ${issue.description}`,
      })),
      ...analysisResult.dependencies.filter(d => d.status !== "compatible"),
    ];

    const { data, error } = await supabase
      .from("projects_analysis")
      .insert([{
        user_id: user.id,
        project_name: projectName,
        file_name: fileName,
        portability_score: analysisResult.score,
        detected_issues: JSON.parse(JSON.stringify(detectedIssues)),
        recommendations: JSON.parse(JSON.stringify(analysisResult.recommendations)),
        status: "analyzed" as const,
      }])
      .select()
      .single();

    if (error) {
      console.error("Error saving analysis:", error);
      toast({
        title: t("common.error"),
        description: t("dashboard.toast.unableToSave"),
        variant: "destructive",
      });
    } else {
      setResult({ ...analysisResult, id: data.id });
      fetchHistory();
      toast({
        title: t("dashboard.toast.analysisComplete"),
        description: `${t("dashboard.portabilityScore")}: ${analysisResult.score}/100`,
      });
    }
  };

  const runRealAnalysis = useCallback(async (file: File, projectName: string) => {
    setState("uploading");
    setProgress(0);

    try {
      const analysisResult = await analyzeZipFile(file, (progress, message) => {
        setProgress(progress);
        setProgressMessage(message);
        if (progress > 20) {
          setState("analyzing");
        }
      });

      setState("complete");
      setResult(analysisResult);
      setExtractedFiles(analysisResult.extractedFiles);
      await saveAnalysis(projectName, analysisResult);
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: t("dashboard.toast.analysisError"),
        description: t("dashboard.toast.unableToAnalyze"),
        variant: "destructive",
      });
      setState("idle");
    }
  }, [user, fileName, toast, t]);

  const runGitHubAnalysis = useCallback(async (url: string, isRetry = false) => {
    if (!user) return;
    
    setState("uploading");
    setProgress(0);
    setAnalysisStep("connecting");
    setProgressMessage(isRetry ? t("dashboard.messages.retrying") : t("dashboard.messages.connecting"));

    const startTime = Date.now();
    const updateElapsedTime = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      if (elapsed > 10 && state !== "complete") {
        setProgressMessage(prev => {
          if (prev.includes("Téléchargement") || prev.includes("cours")) {
            return `Téléchargement en cours... (${elapsed}s)`;
          }
          return prev;
        });
      }
    }, 1000);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      setProgress(5);
      setAnalysisStep("downloading");
      setProgressMessage(t("dashboard.messages.downloading"));
      setProgress(10);
      
      const response = await supabase.functions.invoke("fetch-github-repo", {
        body: { url },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      clearInterval(updateElapsedTime);

      if (response.error) {
        throw new Error(response.error.message || "Erreur lors de la récupération du dépôt");
      }

      if (response.data?.error) {
        const errorData = response.data;
        
        if (errorData.timeout) {
          throw new Error(`⏱️ Timeout: L'opération a pris trop de temps (${errorData.elapsedSeconds}s). Le dépôt est peut-être trop volumineux. Essayez avec un dépôt plus petit.`);
        }
        
        if (errorData.repoTooLarge) {
          throw new Error(`📦 Dépôt trop volumineux: ${Math.round(errorData.repoSize / 1024)}MB (limite: ${Math.round(errorData.maxSize / 1024)}MB). Essayez avec un dépôt plus petit.`);
        }
        
        if (errorData.rateLimited) {
          throw new Error("⚠️ Limite d'API GitHub atteinte. Veuillez réessayer dans quelques minutes.");
        }
        
        throw new Error(errorData.error);
      }

      const { repository, files, totalFilesInRepo, isPartialAnalysis, partialReason, planType, planLimit } = response.data;
      
      if (!files || files.length === 0) {
        throw new Error(t("dashboard.messages.noFilesFound"));
      }

      setAnalysisStep("extracting");
      setProgressMessage(`${t("dashboard.messages.extracting")} ${files.length} ${t("dashboard.messages.files")}`);
      setProgress(25);
      setFileName(repository.name);
      
      if (isPartialAnalysis) {
        toast({
          title: t("dashboard.toast.partialAnalysis"),
          description: `${files.length} ${t("dashboard.toast.partialAnalysisDesc")} ${planLimit})`,
          variant: "default",
        });
      }
      
      setState("analyzing");
      setAnalysisStep("analyzing");
      setProgressMessage(t("dashboard.messages.detecting"));

      const analysisResult = await analyzeFromGitHub(files, repository.name, (progress, message) => {
        setProgress(25 + (progress * 0.75));
        setProgressMessage(message);
      });

      if (isPartialAnalysis) {
        analysisResult.recommendations.unshift(
          `⚠️ Analyse partielle: ${files.length}/${totalFilesInRepo} fichiers analysés (limite ${planType}: ${planLimit} fichiers)`
        );
      }

      setState("complete");
      setResult(analysisResult);
      setExtractedFiles(analysisResult.extractedFiles);
      await saveAnalysis(repository.name, analysisResult);
    } catch (error) {
      clearInterval(updateElapsedTime);
      console.error("GitHub analysis error:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Impossible de récupérer le dépôt GitHub";
      const isTimeout = errorMessage.includes("Timeout") || errorMessage.includes("timeout");
      const isTooLarge = errorMessage.includes("volumineux") || errorMessage.includes("trop");
      
      toast({
        title: isTimeout ? t("dashboard.toast.timeoutTitle") : isTooLarge ? t("dashboard.toast.tooLargeTitle") : t("dashboard.toast.importError"),
        description: errorMessage,
        variant: "destructive",
        action: isTimeout ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => runGitHubAnalysis(url, true)}
            className="ml-2"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            {t("dashboard.messages.retry")}
          </Button>
        ) : undefined,
      });
      setState("idle");
    }
  }, [user, toast, state, t]);

  const handleGitHubImport = () => {
    if (!githubUrl.trim()) {
      toast({
        title: t("dashboard.import.urlRequired"),
        description: t("dashboard.import.enterUrl"),
        variant: "destructive",
      });
      return;
    }
    runGitHubAnalysis(githubUrl);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFileName(file.name);
      const projectName = file.name.replace(".zip", "");
      runRealAnalysis(file, projectName);
    }
  }, [runRealAnalysis]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/zip": [".zip"],
    },
    maxFiles: 1,
  });

  const resetAnalysis = () => {
    setState("idle");
    setAnalysisStep("connecting");
    setProgress(0);
    setProgressMessage("");
    setFileName("");
    setResult(null);
    setExtractedFiles(new Map());
    setGithubUrl("");
    setDbConfigComplete(false);
  };

  const loadProjectForDeployment = async (project: {
    id: string;
    project_name: string;
    file_name: string | null;
    portability_score: number | null;
    detected_issues: any;
    recommendations: any;
  }) => {
    setLoadingProjectId(project.id);
    
    try {
      const detectedIssues = Array.isArray(project.detected_issues) ? project.detected_issues : [];
      const recommendations = Array.isArray(project.recommendations) ? project.recommendations : [];
      
      const issues: AnalysisIssue[] = detectedIssues
        .filter((item: any) => item.pattern || item.file)
        .map((item: any) => ({
          file: item.file || item.note?.split(':')[0] || 'unknown',
          line: item.line,
          pattern: item.pattern || item.name || 'unknown',
          severity: item.status === 'incompatible' ? 'critical' as const : 
                   item.status === 'warning' ? 'warning' as const : 'info' as const,
          description: item.note || item.description || '',
        }));

      const dependencies: DependencyItem[] = detectedIssues
        .filter((item: any) => item.type && !item.pattern)
        .map((item: any) => ({
          name: item.name || 'unknown',
          type: item.type || 'dependency',
          status: (item.status as DependencyItem['status']) || 'compatible',
          note: item.note || '',
        }));

      const loadedResult: RealAnalysisResult & { id: string } = {
        id: project.id,
        score: project.portability_score || 0,
        platform: null,
        totalFiles: 0,
        analyzedFiles: 0,
        issues,
        dependencies,
        recommendations: recommendations.map((r: any) => typeof r === 'string' ? r : r.message || ''),
        extractedFiles: new Map(),
      };

      setFileName(project.file_name || project.project_name);
      setResult(loadedResult);
      setState("complete");
      setActiveTab("import");
      setDbConfigComplete(true);
      
      toast({
        title: t("dashboard.toast.projectLoaded"),
        description: `${project.project_name} ${t("dashboard.toast.readyForDeployment")}`,
      });
    } catch (error) {
      console.error("Error loading project:", error);
      toast({
        title: t("common.error"),
        description: t("dashboard.toast.unableToLoad"),
        variant: "destructive",
      });
    } finally {
      setLoadingProjectId(null);
    }
  };

  const handleCleanFile = (filePath: string) => {
    const content = extractedFiles.get(filePath);
    if (content) {
      setSelectedFileForCleaning({ name: filePath, content });
      setCleanerOpen(true);
    } else {
      toast({
        title: t("dashboard.toast.fileUnavailable"),
        description: t("dashboard.toast.fileUnavailableDesc"),
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: DependencyItem["status"]) => {
    switch (status) {
      case "compatible":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "incompatible":
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusBadge = (status: DependencyItem["status"]) => {
    switch (status) {
      case "compatible":
        return <Badge className="bg-success/20 text-success border-success/30">{t("dashboard.status.compatible")}</Badge>;
      case "warning":
        return <Badge className="bg-warning/20 text-warning border-warning/30">{t("dashboard.status.toModify")}</Badge>;
      case "incompatible":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{t("dashboard.status.incompatible")}</Badge>;
    }
  };

  const getSeverityBadge = (severity: AnalysisIssue["severity"]) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{t("dashboard.cleaning.critical")}</Badge>;
      case "warning":
        return <Badge className="bg-warning/20 text-warning border-warning/30">{t("dashboard.cleaning.warning")}</Badge>;
      case "info":
        return <Badge className="bg-primary/20 text-primary border-primary/30">{t("dashboard.cleaning.info")}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getScoreMessage = (score: number) => {
    if (score >= 80) return t("dashboard.analysis.easyPortable");
    if (score >= 60) return t("dashboard.analysis.migrationPossible");
    return t("dashboard.analysis.complexMigration");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleRepoSelect = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setIsImportingRepo(true);
    await runGitHubAnalysis(repo.html_url);
    setIsImportingRepo(false);
  };

  const menuItems = [
    { id: "overview", label: t("dashboard.overview"), icon: BarChart3, section: "espace" },
    { id: "fleet", label: t("dashboard.fleet"), icon: LayoutGrid, badge: t("dashboard.menu.myProjects"), section: "espace" },
    { id: "liberation", label: t("dashboard.liberation"), icon: Flame, badge: t("dashboard.menu.pipeline"), section: "liberer" },
    { id: "import", label: t("dashboard.importTab"), icon: Upload, section: "importer" },
    { id: "batch-import", label: t("dashboard.batchImport"), icon: Layers, badge: t("dashboard.menu.new"), section: "importer" },
    { id: "projects", label: t("dashboard.projects"), icon: Package, section: "espace" },
    { id: "deploy-choice", label: t("dashboard.deployChoice"), icon: Cloud, section: "liberer" },
    { id: "sync-mirror", label: t("dashboard.syncMirror"), icon: Zap, section: "liberer" },
    { id: "deployments", label: t("dashboard.deployments"), icon: History, section: "espace" },
    { id: "servers", label: t("dashboard.servers"), icon: Server, section: "gestion" },
    { id: "migration", label: t("dashboard.migration"), icon: Database, section: "gestion" },
    { id: "services", label: t("dashboard.services"), icon: Crown, section: "gestion" },
  ];

  const getPageTitle = () => {
    const item = menuItems.find(m => m.id === activeTab);
    return item?.label || t("dashboard.title");
  };

  const getPageDescription = () => {
    const descKey = `dashboard.descriptions.${activeTab}`;
    return t(descKey, { defaultValue: "" });
  };

  // Batch analysis handler
  const handleBatchAnalysis = async (repos: MultiRepoGitHubRepo[]) => {
    setBatchRepos(repos);
    setIsBatchAnalyzing(true);
    
    // Initialize results
    const initialResults: BatchAnalysisResult[] = repos.map(repo => ({
      repo,
      status: "pending"
    }));
    setBatchResults(initialResults);

    // Analyze repos in parallel (max 3 at a time)
    const batchSize = 3;
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize);
      await Promise.all(batch.map(async (repo, batchIndex) => {
        const globalIndex = i + batchIndex;
        
        // Update status to analyzing
        setBatchResults(prev => prev.map((r, idx) => 
          idx === globalIndex ? { ...r, status: "analyzing" } : r
        ));

        try {
          const { data: sessionData } = await supabase.auth.getSession();
          
          const response = await supabase.functions.invoke("fetch-github-repo", {
            body: { url: repo.html_url },
            headers: {
              Authorization: `Bearer ${sessionData.session?.access_token}`,
            },
          });

          if (response.error || response.data?.error) {
            throw new Error(response.error?.message || response.data?.error || "Erreur d'analyse");
          }

          const { repository, files } = response.data;
          
          if (!files || files.length === 0) {
            throw new Error("Aucun fichier trouvé");
          }

          const analysisResult = await analyzeFromGitHub(files, repository.name, () => {});
          
          // Save to database
          if (user) {
            const detectedIssues = [
              ...analysisResult.issues.map(issue => ({
                name: issue.pattern,
                type: "Import",
                status: issue.severity === "critical" ? "incompatible" : "warning",
                note: `${issue.file}${issue.line ? `:${issue.line}` : ""} - ${issue.description}`,
              })),
              ...analysisResult.dependencies.filter(d => d.status !== "compatible"),
            ];

            const { data } = await supabase
              .from("projects_analysis")
              .insert([{
                user_id: user.id,
                project_name: repository.name,
                file_name: repository.name,
                portability_score: analysisResult.score,
                detected_issues: JSON.parse(JSON.stringify(detectedIssues)),
                recommendations: JSON.parse(JSON.stringify(analysisResult.recommendations)),
                status: "analyzed",
              }])
              .select()
              .single();

            setBatchResults(prev => prev.map((r, idx) => 
              idx === globalIndex ? { 
                ...r, 
                status: "complete", 
                score: analysisResult.score,
                analysisId: data?.id 
              } : r
            ));
          }
        } catch (error) {
          console.error(`Error analyzing ${repo.name}:`, error);
          setBatchResults(prev => prev.map((r, idx) => 
            idx === globalIndex ? { 
              ...r, 
              status: "error", 
              error: error instanceof Error ? error.message : "Erreur inconnue" 
            } : r
          ));
        }
      }));
    }

    setIsBatchAnalyzing(false);
    fetchHistory();
  };

  const resetBatchAnalysis = () => {
    setBatchRepos([]);
    setBatchResults([]);
    setIsBatchAnalyzing(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Client Context - No banner needed, just the sidebar indicator */}
      <div className="flex flex-1">
      {/* Mobile Sidebar */}
      <MobileSidebar
        menuItems={menuItems}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as DashboardTab)}
        logo={<img src={inopayLogo} alt="Inopay" className="h-10 object-contain" />}
        planBadge={
          <Badge className={`${
            subscription.subscribed 
              ? "bg-primary/20 text-primary-foreground border-primary/30" 
              : "bg-muted/20 text-secondary-foreground/70 border-muted/30"
          }`}>
            {subscription.subscribed ? (subscription.planType === "pro" ? "Pro" : "Pack Liberté") : "Gratuit"}
          </Badge>
        }
        bottomActions={
          <>
            <SheetClose asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11 text-secondary-foreground/80"
                onClick={() => navigate("/settings")}
              >
                <Settings className="h-4 w-4" />
                Paramètres
              </Button>
            </SheetClose>
            <SheetClose asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11 text-secondary-foreground/80"
                onClick={() => navigate("/")}
              >
                <Home className="h-4 w-4" />
                Accueil
              </Button>
            </SheetClose>
            <SheetClose asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11 text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </Button>
            </SheetClose>
          </>
        }
      />

      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-72 bg-secondary flex-col">
        {/* Logo Header */}
        <div className="p-6 border-b border-secondary/50">
          <div className="flex items-center justify-center mb-3">
            <img src={inopayLogo} alt="Inopay" className="h-12 object-contain" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <RoleIndicator role="client" size="md" />
            <Badge className={`${
              subscription.subscribed 
                ? "bg-primary/20 text-primary-foreground border-primary/30" 
                : "bg-muted/20 text-secondary-foreground/70 border-muted/30"
            }`}>
              {subscription.subscribed ? (subscription.planType === "pro" ? "Pro" : "Pack Liberté") : "Gratuit"}
            </Badge>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={`w-full justify-start gap-3 text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10 ${
                activeTab === item.id 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" 
                  : ""
              }`}
              onClick={() => setActiveTab(item.id as DashboardTab)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {"badge" in item && item.badge && (
                <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-4 border-accent/50 text-accent">
                  {item.badge}
                </Badge>
              )}
            </Button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-secondary/50 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10"
            onClick={() => navigate("/settings")}
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10"
            onClick={() => navigate("/")}
          >
            <Home className="h-4 w-4" />
            Accueil
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <MobileHeader 
          title={getPageTitle()} 
          description={getPageDescription()} 
        />

        {/* Content Area - with swipe navigation on mobile */}
        <div 
          className="p-4 md:p-8"
          onTouchStart={swipeHandlers.onTouchStart}
          onTouchEnd={swipeHandlers.onTouchEnd}
        >
          <div className="max-w-6xl mx-auto">
            
            {/* Tab: Overview */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <UserDashboardOverview />
                <EnhancedOverview onNavigate={(tab) => setActiveTab(tab as DashboardTab)} />
              </div>
            )}

            {/* Tab: Mon Portfolio Personnel */}
            {activeTab === "fleet" && (
              <MyPersonalFleet 
                onSelectProject={(project) => {
                  // Load project for deployment
                  loadProjectForDeployment(project);
                }}
                onNavigate={(tab) => setActiveTab(tab as DashboardTab)}
              />
            )}

            {/* Tab: Liberation Pipeline */}
            {activeTab === "liberation" && (
              <div className="space-y-6">
                {/* Liberation Wizard - Assistant guidé */}
                <LiberationWizard />
                
                {/* Pipeline avancé si fichiers déjà chargés */}
                {extractedFiles.size > 0 && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">{t("dashboard.messages.orUseAdvancedPipeline")}</span>
                      </div>
                    </div>
                    
                    <LiberationPipeline
                      files={extractedFiles}
                      projectName={fileName || "Projet"}
                      projectId={result?.id}
                      onComplete={(liberationResult) => {
                        if (liberationResult.success) {
                          toast({
                            title: t("dashboard.toast.liberationSuccess"),
                            description: t("dashboard.toast.liberationSuccessDesc"),
                          });
                          fetchHistory();
                        }
                      }}
                    />
                  </>
                )}
              </div>
            )}

            {/* Tab: Import */}
            {activeTab === "import" && (
              <div className="space-y-6">
                {/* Stepper Progress */}
                <StepperProgress currentStep={getCurrentStep()} />

                {/* Step 1: GitHub URL Input */}
                {state === "idle" && importMethod === "github-url" && (
                  <div className="space-y-6 animate-fade-in">
                    <GitHubConnectButton 
                      onSwitchToZip={() => setImportMethod("zip")}
                      onGitHubImport={handleGitHubImport}
                      githubUrl={githubUrl}
                      onGithubUrlChange={setGithubUrl}
                      isLoading={state !== "idle"}
                    />
                  </div>
                )}

                {/* Step 2: Repo Selection (GitHub OAuth) */}
                {state === "idle" && isGitHubConnected && importMethod === "github-oauth" && (
                  <div className="space-y-6 animate-fade-in">
                    <GitHubRepoSelector 
                      onSelectRepo={handleRepoSelect}
                      isLoading={isImportingRepo}
                    />
                    
                    <div className="text-center">
                      <Button 
                        variant="link" 
                        onClick={() => setImportMethod("github-url")}
                        className="text-muted-foreground hover:text-foreground gap-2"
                      >
                        Retour à l'import par URL
                      </Button>
                    </div>
                  </div>
                )}

                {/* Alternative: ZIP Upload */}
                {state === "idle" && importMethod === "zip" && (
                  <div className="space-y-6 animate-fade-in">
                    <Card className="card-shadow border border-dashed border-border hover:border-primary/50 transition-colors">
                      <CardContent className="p-0">
                        <div
                          {...getRootProps()}
                          className={`flex flex-col items-center justify-center py-16 px-8 cursor-pointer transition-all rounded-lg ${
                            isDragActive ? "bg-primary/10" : "bg-card hover:bg-muted/50"
                          }`}
                        >
                          <input {...getInputProps()} />
                          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl mb-6 transition-all ${
                            isDragActive ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground"
                          }`}>
                            <Upload className="h-8 w-8" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2 text-foreground">
                            {isDragActive ? t("dashboard.import.dropHere") : t("dashboard.import.zipTitle")}
                          </h3>
                          <p className="text-muted-foreground mb-4">
                            {t("dashboard.import.clickToSelect")}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {t("dashboard.import.format")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    <div className="text-center">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setImportMethod("github-url")}
                        className="gap-2"
                      >
                        <Github className="h-4 w-4" />
                        {t("dashboard.import.backToUrl")}
                      </Button>
                    </div>
                  </div>
                )}

                {state === "idle" && loadingHistory && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}

                {/* Analysis Progress */}
                {(state === "uploading" || state === "analyzing") && (
                  <Card className="animate-fade-in card-shadow border border-border status-border-blue">
                    <CardHeader className="text-center pb-2">
                      <Badge className="mx-auto mb-4 bg-info/10 text-info border-info/20">
                        {t("dashboard.analysis.inProgress")}
                      </Badge>
                      <CardTitle className="text-xl text-foreground">{t("dashboard.analysis.portabilityAnalysis")}</CardTitle>
                      <CardDescription className="max-w-md mx-auto">
                        {t("dashboard.analysis.scanningCode")}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="py-8 px-8">
                      <AnalysisProgressSteps
                        currentStep={analysisStep}
                        progress={progress}
                        progressMessage={progressMessage}
                        fileName={fileName}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Results */}
                {state === "complete" && result && (
                  <div className="space-y-8 animate-fade-in">
                    {/* Score Card */}
                    <Card className="overflow-hidden card-shadow-lg border border-border status-border-green">
                      <CardHeader className="text-center pb-2 bg-muted/30">
                        <Badge className="mx-auto mb-2 bg-success/10 text-success border-success/20 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {t("dashboard.analysis.completed")}
                        </Badge>
                        <CardTitle className="text-xl text-foreground">{t("dashboard.analysis.portabilityAnalysis")}</CardTitle>
                        <CardDescription>
                          {t("dashboard.analysis.scanComplete")}
                        </CardDescription>
                      </CardHeader>
                      <div className="grid md:grid-cols-2">
                        {/* Score */}
                        <div className="flex flex-col items-center justify-center py-12 px-8 bg-muted/50">
                          <div className="relative">
                            <svg className="w-40 h-40 transform -rotate-90">
                              <circle
                                cx="80"
                                cy="80"
                                r="70"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="none"
                                className="text-border"
                              />
                              <circle
                                cx="80"
                                cy="80"
                                r="70"
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 70 * (result.score / 100)} ${2 * Math.PI * 70}`}
                                className="text-primary transition-all duration-1000"
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className={`text-5xl font-bold ${getScoreColor(result.score)}`}>
                                {result.score}
                              </span>
                              <span className="text-muted-foreground">/100</span>
                            </div>
                          </div>
                          <p className="text-lg font-medium mt-4 text-foreground">{t("dashboard.analysis.freedomScore")}</p>
                          <p className={`text-sm mt-1 ${getScoreColor(result.score)}`}>
                            {getScoreMessage(result.score)}
                          </p>
                        </div>

                        {/* Info */}
                        <CardContent className="flex flex-col justify-center py-8 bg-card">
                          <h3 className="text-2xl font-bold mb-4 text-foreground">{t("dashboard.analysis.projectAnalyzed")}</h3>
                          <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-border">
                              <span className="text-muted-foreground">{t("dashboard.analysis.file")}</span>
                              <span className="font-medium text-foreground">{fileName}</span>
                            </div>
                            {result.platform && (
                              <div className="flex justify-between items-center py-2 border-b border-border">
                                <span className="text-muted-foreground">{t("dashboard.analysis.detectedPlatform")}</span>
                                <Badge className="bg-accent/10 text-accent border-0">{result.platform}</Badge>
                              </div>
                            )}
                            <div className="flex justify-between items-center py-2 border-b border-border">
                              <span className="text-muted-foreground">{t("dashboard.analysis.totalFiles")}</span>
                              <span className="font-medium text-foreground">{result.totalFiles}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border">
                              <span className="text-muted-foreground">{t("dashboard.analysis.analyzedFiles")}</span>
                              <span className="font-medium text-foreground">{result.analyzedFiles}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                              <span className="text-muted-foreground">{t("dashboard.analysis.dependencies")}</span>
                              <span className="font-medium text-foreground">{result.dependencies.length}</span>
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    </Card>

                    {/* Issues Table */}
                    {result.issues.length > 0 && (
                      <Card className="card-shadow border border-border status-border-yellow relative">
                        {!subscription.subscribed && (
                          <div className="absolute inset-0 bg-card/90 backdrop-blur-sm z-10 rounded-lg flex flex-col items-center justify-center p-8">
                            <div className="h-16 w-16 rounded-2xl bg-warning/10 flex items-center justify-center mb-4">
                              <Lock className="h-8 w-8 text-warning" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">{t("dashboard.cleaning.premiumFeature")}</h3>
                            <p className="text-muted-foreground text-center mb-6 max-w-md">
                              {t("dashboard.cleaning.premiumDesc")}
                            </p>
                            <Link to="/tarifs">
                              <Button className="gap-2 rounded-lg shadow-lg">
                                <Crown className="h-4 w-4" />
                                {t("dashboard.cleaning.viewPricing")}
                              </Button>
                            </Link>
                          </div>
                        )}
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-foreground">
                                <Sparkles className="h-5 w-5 text-warning" />
                                {t("dashboard.cleaning.title")}
                              </CardTitle>
                              <CardDescription className="mt-1">
                                {t("dashboard.cleaning.subtitle")}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-muted/50 rounded-lg p-4 mb-6 border border-border">
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <Shield className="h-4 w-4 text-success" />
                              {t("dashboard.cleaning.codeUnchanged")}
                            </p>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">{t("dashboard.analysis.file")}</TableHead>
                                <TableHead className="text-muted-foreground">{t("dashboard.cleaning.line")}</TableHead>
                                <TableHead className="text-muted-foreground">{t("dashboard.cleaning.pattern")}</TableHead>
                                <TableHead className="text-muted-foreground">{t("dashboard.cleaning.severity")}</TableHead>
                                <TableHead className="text-muted-foreground">{t("dashboard.cleaning.action")}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.issues.map((issue, index) => (
                                <TableRow key={index} className="border-border hover:bg-muted/50">
                                  <TableCell className="font-mono text-sm max-w-[200px] truncate text-foreground" title={issue.file}>
                                    {issue.file}
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {issue.line || "-"}
                                  </TableCell>
                                  <TableCell className="font-mono text-sm text-foreground">
                                    {issue.pattern}
                                  </TableCell>
                                  <TableCell>
                                    {getSeverityBadge(issue.severity)}
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      onClick={() => handleCleanFile(issue.file)}
                                      className="gap-1 rounded-lg bg-warning/10 text-warning hover:bg-warning/20 border-0"
                                      disabled={!subscription.subscribed}
                                    >
                                      <Sparkles className="h-3 w-3" />
                                      {t("dashboard.cleaning.cleanWithAI")}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}

                    {/* Cost Savings Report - Conseiller en Économies */}
                    {result.costAnalysis && result.costAnalysis.detectedServices.length > 0 && (
                      <CostSavingsReport 
                        costAnalysis={result.costAnalysis}
                        projectName={fileName.replace('.zip', '')}
                        extractedFiles={extractedFiles}
                        onMigrationComplete={(migratedFiles) => {
                          toast({
                            title: "Migration terminée",
                            description: `${migratedFiles.size} fichiers migrés vers Open Source`,
                          });
                        }}
                      />
                    )}

                    {/* Dependencies Table */}
                    <Card className="border-0 shadow-md">
                      <CardHeader>
                        <CardTitle>Analyse des dépendances</CardTitle>
                        <CardDescription>
                          {result.dependencies.length} dépendances analysées
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Package</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Statut</TableHead>
                              <TableHead>Note</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.dependencies.map((dep, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-mono text-sm">{dep.name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline">{dep.type}</Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(dep.status)}
                                    {getStatusBadge(dep.status)}
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {dep.note}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>

                    {/* Database Configuration */}
                    {!dbConfigComplete && (
                      <Card className="card-shadow border border-border status-border-blue relative">
                        {!subscription.subscribed && (
                          <div className="absolute inset-0 bg-card/90 backdrop-blur-sm z-10 rounded-lg flex flex-col items-center justify-center p-8">
                            <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                              <Lock className="h-8 w-8 text-accent" />
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">{t("dashboard.dbConfig.advancedConfig")}</h3>
                            <p className="text-muted-foreground text-center mb-6 max-w-md">
                              {t("dashboard.dbConfig.advancedConfigDesc")}
                            </p>
                            <Link to="/tarifs">
                              <Button className="gap-2 rounded-lg shadow-lg">
                                <Crown className="h-4 w-4" />
                                {t("dashboard.cleaning.viewPricing")}
                              </Button>
                            </Link>
                          </div>
                        )}
                        <CardHeader className="text-center border-b border-border">
                          <Badge className="mx-auto mb-2 bg-accent/10 text-accent border-accent/20 gap-1">
                            <Cloud className="h-3 w-3" />
                            {t("dashboard.dbConfig.title")}
                          </Badge>
                          <CardTitle className="text-xl text-foreground">{t("dashboard.dbConfig.step")}</CardTitle>
                          <CardDescription className="max-w-md mx-auto">
                            {t("dashboard.dbConfig.subtitle")}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 pb-8">
                          <DatabaseConfigAssistant
                            projectName={fileName.replace('.zip', '')}
                            extractedFiles={extractedFiles}
                            onConfigComplete={(config) => {
                              setDbConfigComplete(true);
                              toast({
                                title: t("dashboard.dbConfig.configComplete"),
                                description: config.type === "keep" ? t("dashboard.dbConfig.keepCurrent") : t("dashboard.dbConfig.newDbConfigured"),
                              });
                            }}
                            onSkip={() => setDbConfigComplete(true)}
                            disabled={!subscription.subscribed}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {/* Deployment Assistant */}
                    <Card className="card-shadow border border-border status-border-green relative">
                      {!subscription.subscribed && (
                        <div className="absolute inset-0 bg-card/90 backdrop-blur-sm z-10 rounded-lg flex flex-col items-center justify-center p-8">
                          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                            <Lock className="h-8 w-8 text-primary" />
                          </div>
                          <h3 className="text-xl font-bold text-foreground mb-2">{t("dashboard.deployment.unlockExport")}</h3>
                          <p className="text-muted-foreground text-center mb-6 max-w-md">
                            {t("dashboard.deployment.unlockExportDesc")}
                          </p>
                          <Link to="/tarifs">
                            <Button className="gap-2 rounded-lg shadow-lg">
                              <Crown className="h-4 w-4" />
                              {t("dashboard.cleaning.viewPricing")}
                            </Button>
                          </Link>
                        </div>
                      )}
                      <CardHeader className="text-center border-b border-border">
                        <Badge className="mx-auto mb-2 bg-success/10 text-success border-success/20 gap-1">
                          <Rocket className="h-3 w-3" />
                          {t("dashboard.deployment.readyForDeployment")}
                        </Badge>
                        <CardTitle className="text-xl text-foreground">{t("dashboard.deployment.step")}</CardTitle>
                        <CardDescription className="max-w-md mx-auto">
                          {t("dashboard.deployment.subtitle")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6 pb-8">
                        <DeploymentAssistant
                          projectName={fileName.replace('.zip', '')}
                          extractedFiles={extractedFiles}
                          onDownload={() => setExporterOpen(true)}
                          onGitHubPush={() => setExporterOpen(true)}
                          onBack={resetAnalysis}
                          disabled={!subscription.subscribed}
                          isSubscribed={subscription.subscribed}
                        />
                        
                        <div className="text-center mt-6 pt-6 border-t border-border">
                          <Button 
                            variant="link" 
                            className="text-muted-foreground hover:text-foreground" 
                            onClick={resetAnalysis}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            {t("dashboard.deployment.analyzeAnother")}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Batch Import */}
            {activeTab === "batch-import" && (
              <div className="space-y-6">
                {batchRepos.length === 0 ? (
                  <GitHubMultiRepoSelector
                    onSelectRepos={handleBatchAnalysis}
                    isLoading={isBatchAnalyzing}
                    maxSelection={subscription.planType === "pro" ? 50 : 10}
                  />
                ) : (
                  <BatchAnalysisProgress
                    repos={batchRepos}
                    results={batchResults}
                    onComplete={() => {
                      toast({
                        title: t("dashboard.batch.complete"),
                        description: `${batchResults.filter(r => r.status === "complete").length} ${t("dashboard.batch.projectsAnalyzed")}`,
                      });
                    }}
                    onReset={resetBatchAnalysis}
                  />
                )}
              </div>
            )}

            {/* Tab: Projects */}
            {activeTab === "projects" && (
              <div className="space-y-6">
                <Card className="bg-muted/30 border-dashed mb-4 border-0 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      {t("dashboard.messages.selectProjectForDeploy")}
                    </p>
                  </CardContent>
                </Card>
                <AnalyzedProjects 
                  onSelectProject={loadProjectForDeployment}
                  onRefresh={fetchHistory}
                  loadingProjectId={loadingProjectId}
                />
              </div>
            )}

            {/* Tab: Deploy Choice */}
            {activeTab === "deploy-choice" && (
              <DeploymentChoice 
                onSelect={(option: DeploymentOption) => {
                  if (option === 'zip') {
                    setActiveTab('import');
                    toast({
                      title: t("dashboard.toast.exportZip"),
                      description: t("dashboard.toast.exportZipDesc"),
                    });
                  } else if (option === 'ftp') {
                    toast({
                      title: t("dashboard.toast.ftpHosting"),
                      description: t("dashboard.toast.ftpHostingDesc"),
                    });
                    setActiveTab('import');
                  } else if (option === 'vps') {
                    setActiveTab('servers');
                  }
                }}
              />
            )}

            {/* Tab: Deployments */}
            {activeTab === "deployments" && (
              <div className="space-y-6">
                <ServerDeploymentsManager />
                <DeploymentHistory />
              </div>
            )}

            {/* Tab: Servers */}
            {activeTab === "servers" && (
              <ServerManagement />
            )}

            {/* Tab: Migration Tools (User) */}
            {activeTab === "migration" && (
              <UserMigrationTools />
            )}

            {/* Tab: Sync Mirror */}
            {activeTab === "sync-mirror" && (
              <div className="space-y-6">
                <UserWidgetStatus />
                <SyncMirror />
              </div>
            )}

            {/* Tab: Sovereign Deployment */}
            {activeTab === "sovereign-deploy" && (
              <div className="space-y-8">
                <SovereigntySetupWizard
                  projectName={fileName.replace('.zip', '')}
                  extractedFiles={extractedFiles}
                  onComplete={() => {
                    toast({
                      title: t("dashboard.toast.sovereignComplete"),
                      description: t("dashboard.toast.sovereignCompleteDesc"),
                    });
                    fetchHistory();
                  }}
                />
              </div>
            )}

            {/* Tab: Services */}
            {activeTab === "services" && (
              <div className="space-y-6">
                <UserPurchases />
                <UserExportsHistory />
              </div>
            )}

            {/* Tab: Security */}
            {activeTab === "security" && (
              <UserSecurityStatus />
            )}

            {/* Tab: Exports */}
            {activeTab === "exports" && (
              <UserExportsHistory />
            )}
          </div>
          {/* Padding for mobile pagination dots */}
          <div className="h-20 md:hidden" />
        </div>
      </main>

      {/* Code Cleaner Modal */}
      {selectedFileForCleaning && (
        <CodeCleaner
          fileName={selectedFileForCleaning.name}
          originalCode={selectedFileForCleaning.content}
          isOpen={cleanerOpen}
          onClose={() => {
            setCleanerOpen(false);
            setSelectedFileForCleaning(null);
          }}
        />
      )}

      {/* Project Exporter Modal */}
      {result && (
        <ProjectExporter
          projectId={result.id}
          projectName={fileName.replace('.zip', '')}
          extractedFiles={extractedFiles}
          isOpen={exporterOpen}
          onClose={() => setExporterOpen(false)}
          onComplete={fetchHistory}
        />
      )}

      {/* Sovereign Export Modal (Ctrl+Shift+S) */}
      <SovereignExport
        isOpen={sovereignExportOpen}
        onClose={() => setSovereignExportOpen(false)}
      />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
      />
      </div>
      <FofyChat />
    </div>
  );
};

export default Dashboard;
