import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate, Link } from "react-router-dom";
import { Upload, FileArchive, Loader2, CheckCircle2, AlertTriangle, XCircle, Download, RefreshCw, History, FileWarning, Sparkles, Settings, Package, Github, HelpCircle, Rocket, Shield, Lock, Crown, Cloud, FolderOpen } from "lucide-react";
import { SovereignExport } from "@/components/SovereignExport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { analyzeZipFile, analyzeFromGitHub, RealAnalysisResult, DependencyItem, AnalysisIssue } from "@/lib/zipAnalyzer";
import CodeCleaner from "@/components/CodeCleaner";
import ProjectExporter from "@/components/ProjectExporter";
import StepperProgress from "@/components/dashboard/StepperProgress";
import GitHubRepoSelector from "@/components/dashboard/GitHubRepoSelector";
import GitHubConnectButton from "@/components/dashboard/GitHubConnectButton";
import DeploymentAssistant from "@/components/dashboard/DeploymentAssistant";
import DatabaseConfigAssistant from "@/components/dashboard/DatabaseConfigAssistant";
import { DeploymentHistory } from "@/components/dashboard/DeploymentHistory";
import { AnalyzedProjects } from "@/components/dashboard/AnalyzedProjects";

type AnalysisState = "idle" | "uploading" | "analyzing" | "complete";
type ImportMethod = "github-oauth" | "zip" | "github-url";
type DashboardTab = "import" | "projects" | "deployments";

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
  const { user, loading: authLoading, subscription } = useAuth();
  const { toast } = useToast();
  
  const [state, setState] = useState<AnalysisState>("idle");
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
  const [activeTab, setActiveTab] = useState<DashboardTab>("import");
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);

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

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

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

    // Convertir les issues en format compatible avec detected_issues
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
        title: "Erreur",
        description: "Impossible de sauvegarder l'analyse",
        variant: "destructive",
      });
    } else {
      setResult({ ...analysisResult, id: data.id });
      fetchHistory();
      toast({
        title: "Analyse terminée",
        description: `Score de portabilité: ${analysisResult.score}/100`,
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
        title: "Erreur d'analyse",
        description: "Impossible d'analyser le fichier ZIP",
        variant: "destructive",
      });
      setState("idle");
    }
  }, [user, fileName, toast]);

  const runGitHubAnalysis = useCallback(async (url: string) => {
    if (!user) return;
    
    setState("uploading");
    setProgress(0);
    setProgressMessage("Connexion au dépôt GitHub...");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("fetch-github-repo", {
        body: { url },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erreur lors de la récupération du dépôt");
      }

      const { repository, files } = response.data;
      
      if (!files || files.length === 0) {
        throw new Error("Aucun fichier trouvé dans le dépôt");
      }

      setFileName(repository.name);
      setProgress(25);
      setProgressMessage(`Dépôt récupéré: ${repository.fullName} (${files.length} fichiers)`);
      setState("analyzing");

      const analysisResult = await analyzeFromGitHub(files, repository.name, (progress, message) => {
        setProgress(25 + (progress * 0.75));
        setProgressMessage(message);
      });

      setState("complete");
      setResult(analysisResult);
      setExtractedFiles(analysisResult.extractedFiles);
      await saveAnalysis(repository.name, analysisResult);
    } catch (error) {
      console.error("GitHub analysis error:", error);
      toast({
        title: "Erreur d'importation",
        description: error instanceof Error ? error.message : "Impossible de récupérer le dépôt GitHub",
        variant: "destructive",
      });
      setState("idle");
    }
  }, [user, toast]);

  const handleGitHubImport = () => {
    if (!githubUrl.trim()) {
      toast({
        title: "URL requise",
        description: "Veuillez entrer l'URL de votre dépôt GitHub",
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
    setProgress(0);
    setProgressMessage("");
    setFileName("");
    setResult(null);
    setExtractedFiles(new Map());
    setGithubUrl("");
    setDbConfigComplete(false);
  };

  // Load a project from history for deployment
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
      // Parse the detected issues to extract issues and dependencies
      const detectedIssues = Array.isArray(project.detected_issues) ? project.detected_issues : [];
      const recommendations = Array.isArray(project.recommendations) ? project.recommendations : [];
      
      // Separate issues from dependencies based on structure
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

      // Create the result object
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
      setDbConfigComplete(true); // Skip DB config for reloaded projects
      
      toast({
        title: "Projet chargé",
        description: `${project.project_name} est prêt pour le déploiement`,
      });
    } catch (error) {
      console.error("Error loading project:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le projet",
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
        title: "Fichier non disponible",
        description: "Le contenu de ce fichier n'est pas disponible pour le nettoyage",
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
        return <Badge className="bg-success/20 text-success border-success/30">Compatible</Badge>;
      case "warning":
        return <Badge className="bg-warning/20 text-warning border-warning/30">À modifier</Badge>;
      case "incompatible":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Incompatible</Badge>;
    }
  };

  const getSeverityBadge = (severity: AnalysisIssue["severity"]) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Critique</Badge>;
      case "warning":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Attention</Badge>;
      case "info":
        return <Badge className="bg-primary/20 text-primary border-primary/30">Info</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getScoreMessage = (score: number) => {
    if (score >= 80) return "Projet facilement portable";
    if (score >= 60) return "Migration possible avec modifications";
    return "Migration complexe requise";
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Handler for selecting a repo from the list
  const handleRepoSelect = async (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setIsImportingRepo(true);
    await runGitHubAnalysis(repo.html_url);
    setIsImportingRepo(false);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Libérez votre code
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Transformez vos applications générées par IA en projets 100% autonomes et portables
            </p>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)} className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="import" className="gap-2">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Importer</span>
              </TabsTrigger>
              <TabsTrigger value="projects" className="gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Projets</span>
              </TabsTrigger>
              <TabsTrigger value="deployments" className="gap-2">
                <Rocket className="h-4 w-4" />
                <span className="hidden sm:inline">Déploiements</span>
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Import */}
            <TabsContent value="import" className="space-y-6">
              {/* Stepper Progress */}
              <StepperProgress currentStep={getCurrentStep()} />

              {/* Step 1: GitHub URL Input (Primary method) */}
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

              {/* Step 2: Repo Selection (when connected via GitHub OAuth - future feature) */}
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
                          {isDragActive ? "Déposez le fichier ici" : "Glissez-déposez votre fichier .zip"}
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          ou cliquez pour sélectionner un fichier
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Format accepté : .zip (max 50MB)
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
                      Retour à l'import par URL
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
                      En cours
                    </Badge>
                    <CardTitle className="text-xl text-foreground">Étape 2 : Analyse de portabilité</CardTitle>
                    <CardDescription className="max-w-md mx-auto">
                      Nous scannons votre code pour identifier les dépendances propriétaires et les verrous technologiques.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="py-12 px-8">
                    <div className="flex flex-col items-center text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 mb-6 animate-pulse-soft">
                        <Loader2 className="h-8 w-8 text-accent animate-spin" />
                      </div>
                      
                      <div className="flex items-center gap-2 mb-4">
                        <FileArchive className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium text-foreground">{fileName}</span>
                      </div>

                      <h3 className="text-lg font-semibold mb-2 text-foreground">
                        Analyse de la structure en cours...
                      </h3>
                      <p className="text-muted-foreground mb-6">{progressMessage}</p>

                      <div className="w-full max-w-md">
                        <Progress value={progress} className="h-2 bg-muted" />
                        <p className="text-sm text-muted-foreground mt-2">Score de liberté actuel : {Math.round(progress)}%</p>
                      </div>
                    </div>
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
                        Complété
                      </Badge>
                      <CardTitle className="text-xl text-foreground">Étape 2 : Analyse de portabilité</CardTitle>
                      <CardDescription>
                        Scan terminé – voici le diagnostic de votre projet
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
                        <p className="text-lg font-medium mt-4 text-foreground">Score de liberté</p>
                        <p className={`text-sm mt-1 ${getScoreColor(result.score)}`}>
                          {getScoreMessage(result.score)}
                        </p>
                      </div>

                      {/* Info */}
                      <CardContent className="flex flex-col justify-center py-8 bg-card">
                        <h3 className="text-2xl font-bold mb-4 text-foreground">Projet analysé</h3>
                        <div className="space-y-4">
                          <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">Fichier</span>
                            <span className="font-medium text-foreground">{fileName}</span>
                          </div>
                          {result.platform && (
                            <div className="flex justify-between items-center py-2 border-b border-border">
                              <span className="text-muted-foreground">Plateforme détectée</span>
                              <Badge className="bg-accent/10 text-accent border-0">{result.platform}</Badge>
                            </div>
                          )}
                          <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">Fichiers totaux</span>
                            <span className="font-medium text-foreground">{result.totalFiles}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-border">
                            <span className="text-muted-foreground">Fichiers analysés</span>
                            <span className="font-medium text-foreground">{result.analyzedFiles}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-muted-foreground">Dépendances</span>
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
                          <h3 className="text-xl font-bold text-foreground mb-2">Fonctionnalité Premium</h3>
                          <p className="text-muted-foreground text-center mb-6 max-w-md">
                            Le nettoyage IA nécessite un abonnement. Débloquez cette fonctionnalité pour libérer votre code.
                          </p>
                          <Link to="/tarifs">
                            <Button className="gap-2 rounded-lg shadow-lg">
                              <Crown className="h-4 w-4" />
                              Voir les tarifs
                            </Button>
                          </Link>
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-foreground">
                              <Sparkles className="h-5 w-5 text-warning" />
                              Étape 3 : Nettoyage Intelligent
                            </CardTitle>
                            <CardDescription className="mt-1">
                              Notre IA remplace les composants verrouillés par des standards Open Source universels.
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-muted/50 rounded-lg p-4 mb-6 border border-border">
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Shield className="h-4 w-4 text-success" />
                            Votre code original reste inchangé sur GitHub, nous créons une version optimisée.
                          </p>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                              <TableHead className="text-muted-foreground">Fichier</TableHead>
                              <TableHead className="text-muted-foreground">Ligne</TableHead>
                              <TableHead className="text-muted-foreground">Pattern</TableHead>
                              <TableHead className="text-muted-foreground">Sévérité</TableHead>
                              <TableHead className="text-muted-foreground">Action</TableHead>
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
                                    Démarrer la libération
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Dependencies Table */}
                  <Card>
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
                          <h3 className="text-xl font-bold text-foreground mb-2">Configuration avancée</h3>
                          <p className="text-muted-foreground text-center mb-6 max-w-md">
                            Configurez votre base de données avec un abonnement.
                          </p>
                          <Link to="/tarifs">
                            <Button className="gap-2 rounded-lg shadow-lg">
                              <Crown className="h-4 w-4" />
                              Voir les tarifs
                            </Button>
                          </Link>
                        </div>
                      )}
                      <CardHeader className="text-center border-b border-border">
                        <Badge className="mx-auto mb-2 bg-accent/10 text-accent border-accent/20 gap-1">
                          <Cloud className="h-3 w-3" />
                          Configuration Base de Données
                        </Badge>
                        <CardTitle className="text-xl text-foreground">Étape 3.5 : Assistant Base de Données</CardTitle>
                        <CardDescription className="max-w-md mx-auto">
                          Configurez votre base de données pour votre nouvel hébergeur
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-6 pb-8">
                        <DatabaseConfigAssistant
                          projectName={fileName.replace('.zip', '')}
                          extractedFiles={extractedFiles}
                          onConfigComplete={(config) => {
                            setDbConfigComplete(true);
                            toast({
                              title: "Configuration terminée",
                              description: config.type === "keep" ? "Base de données actuelle conservée" : "Nouvelle base de données configurée",
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
                        <h3 className="text-xl font-bold text-foreground mb-2">Débloquez l'export</h3>
                        <p className="text-muted-foreground text-center mb-6 max-w-md">
                          Téléchargez votre projet 100% autonome avec un abonnement Pro ou un Pack Liberté.
                        </p>
                        <Link to="/tarifs">
                          <Button className="gap-2 rounded-lg shadow-lg">
                            <Crown className="h-4 w-4" />
                            Voir les tarifs
                          </Button>
                        </Link>
                      </div>
                    )}
                    <CardHeader className="text-center border-b border-border">
                      <Badge className="mx-auto mb-2 bg-success/10 text-success border-success/20 gap-1">
                        <Rocket className="h-3 w-3" />
                        Prêt pour le déploiement
                      </Badge>
                      <CardTitle className="text-xl text-foreground">Étape 4 : Assistant de Déploiement Intelligent</CardTitle>
                      <CardDescription className="max-w-md mx-auto">
                        Choisissez comment et où déployer votre projet libéré
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
                          Analyser un autre projet
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            {/* Tab 2: Analyzed Projects */}
            <TabsContent value="projects" className="space-y-6">
              <Card className="bg-muted/30 border-dashed mb-4">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Sélectionnez un projet pour accéder directement aux options de déploiement
                  </p>
                </CardContent>
              </Card>
              <AnalyzedProjects 
                onSelectProject={loadProjectForDeployment}
                onRefresh={fetchHistory}
                loadingProjectId={loadingProjectId}
              />
            </TabsContent>

            {/* Tab 3: Deployment History */}
            <TabsContent value="deployments" className="space-y-6">
              <DeploymentHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>

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
    </Layout>
  );
};

export default Dashboard;
