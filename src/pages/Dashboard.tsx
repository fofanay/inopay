import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate, Link } from "react-router-dom";
import { Upload, FileArchive, Loader2, CheckCircle2, AlertTriangle, XCircle, Download, RefreshCw, History, FileWarning, Sparkles, Settings, Package, Github, HelpCircle } from "lucide-react";
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
type AnalysisState = "idle" | "uploading" | "analyzing" | "complete";

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
  const { user, loading: authLoading } = useAuth();
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
  const [importMethod, setImportMethod] = useState<"zip" | "github">("zip");

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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Analyseur de Portabilité
            </h1>
            <p className="text-lg text-muted-foreground">
              Uploadez votre projet exporté pour obtenir un rapport détaillé
            </p>
          </div>

          {/* Import Zone */}
          {state === "idle" && (
            <>
              <Card className="animate-fade-in mb-8">
                <CardContent className="p-6">
                  <Tabs value={importMethod} onValueChange={(v) => setImportMethod(v as "zip" | "github")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="zip" className="gap-2">
                        <Upload className="h-4 w-4" />
                        Fichier ZIP
                      </TabsTrigger>
                      <TabsTrigger value="github" className="gap-2">
                        <Github className="h-4 w-4" />
                        Dépôt GitHub
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="zip" className="mt-0">
                      <div
                        {...getRootProps()}
                        className={`flex flex-col items-center justify-center py-16 px-8 cursor-pointer transition-colors rounded-lg border-2 border-dashed ${
                          isDragActive ? "bg-primary/10 border-primary" : "bg-card hover:bg-muted/30 border-border"
                        }`}
                      >
                        <input {...getInputProps()} />
                        <div className={`flex h-16 w-16 items-center justify-center rounded-2xl mb-6 transition-all ${
                          isDragActive ? "bg-primary text-primary-foreground glow-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          <Upload className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">
                          {isDragActive ? "Déposez le fichier ici" : "Glissez-déposez votre fichier .zip"}
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          ou cliquez pour sélectionner un fichier
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Format accepté : .zip (max 50MB)
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="github" className="mt-0">
                      <div className="flex flex-col items-center py-8 px-8">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-6">
                          <Github className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">
                          Importer depuis GitHub
                        </h3>
                        <div className="flex items-center gap-2 mb-4">
                          <p className="text-muted-foreground">
                            Collez l'URL du dépôt GitHub de votre projet
                          </p>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>Vous trouverez cette URL dans les paramètres de votre projet Lovable sous l'onglet GitHub.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="w-full max-w-lg space-y-4">
                          <Input
                            type="url"
                            placeholder="https://github.com/username/repository"
                            value={githubUrl}
                            onChange={(e) => setGithubUrl(e.target.value)}
                            className="w-full"
                          />
                          <Button 
                            onClick={handleGitHubImport} 
                            className="w-full gap-2"
                            disabled={!githubUrl.trim()}
                          >
                            <Github className="h-4 w-4" />
                            Analyser le dépôt
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* History */}
              {history.length > 0 && (
                <Card className="animate-fade-in">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      Historique des analyses
                    </CardTitle>
                    <CardDescription>Vos dernières analyses de projets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Projet</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {history.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.project_name}</TableCell>
                            <TableCell>
                              <span className={getScoreColor(item.portability_score)}>
                                {item.portability_score}/100
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {item.status === "analyzed" ? "Analysé" : item.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(item.created_at).toLocaleDateString("fr-FR")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {loadingHistory && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </>
          )}

          {/* Analysis Progress */}
          {(state === "uploading" || state === "analyzing") && (
            <Card className="animate-fade-in">
              <CardContent className="py-16 px-8">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6 animate-pulse-glow">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <FileArchive className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{fileName}</span>
                  </div>

                  <h3 className="text-xl font-semibold mb-2">
                    {state === "uploading" ? "Extraction en cours..." : "Analyse en cours..."}
                  </h3>
                  <p className="text-muted-foreground mb-6">{progressMessage}</p>

                  <div className="w-full max-w-md">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground mt-2">{Math.round(progress)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {state === "complete" && result && (
            <div className="space-y-8 animate-fade-in">
              {/* Score Card */}
              <Card className="overflow-hidden">
                <div className="grid md:grid-cols-2">
                  {/* Score */}
                  <div className="flex flex-col items-center justify-center py-12 px-8 bg-gradient-to-br from-primary/10 to-secondary/10">
                    <div className="relative">
                      <svg className="w-40 h-40 transform -rotate-90">
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="currentColor"
                          strokeWidth="8"
                          fill="none"
                          className="text-muted"
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
                    <p className="text-lg font-medium mt-4">Score de Portabilité</p>
                    <p className={`text-sm mt-1 ${getScoreColor(result.score)}`}>
                      {getScoreMessage(result.score)}
                    </p>
                  </div>

                  {/* Info */}
                  <CardContent className="flex flex-col justify-center py-8">
                    <h3 className="text-2xl font-bold mb-4">Projet analysé</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Fichier</span>
                        <span className="font-medium">{fileName}</span>
                      </div>
                      {result.platform && (
                        <div className="flex justify-between items-center py-2 border-b border-border/50">
                          <span className="text-muted-foreground">Plateforme détectée</span>
                          <Badge variant="secondary">{result.platform}</Badge>
                        </div>
                      )}
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Fichiers totaux</span>
                        <span className="font-medium">{result.totalFiles}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Fichiers analysés</span>
                        <span className="font-medium">{result.analyzedFiles}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground">Dépendances</span>
                        <span className="font-medium">{result.dependencies.length}</span>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>

              {/* Issues Table */}
              {result.issues.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileWarning className="h-5 w-5 text-destructive" />
                      Fichiers à risque
                    </CardTitle>
                    <CardDescription>
                      {result.issues.length} problème{result.issues.length > 1 ? "s" : ""} détecté{result.issues.length > 1 ? "s" : ""} dans le code source
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fichier</TableHead>
                          <TableHead>Ligne</TableHead>
                          <TableHead>Pattern</TableHead>
                          <TableHead>Sévérité</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.issues.map((issue, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-sm max-w-[200px] truncate" title={issue.file}>
                              {issue.file}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {issue.line || "-"}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {issue.pattern}
                            </TableCell>
                            <TableCell>
                              {getSeverityBadge(issue.severity)}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCleanFile(issue.file)}
                                className="gap-1"
                              >
                                <Sparkles className="h-3 w-3" />
                                Nettoyer
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

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommandations</CardTitle>
                  <CardDescription>
                    Étapes suggérées pour une migration réussie
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {result.recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                          {index + 1}
                        </div>
                        <span className="text-muted-foreground">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="glow-sm" onClick={() => setExporterOpen(true)}>
                  <Package className="mr-2 h-5 w-5" />
                  Exporter le projet autonome
                </Button>
                <Button size="lg" variant="outline" onClick={resetAnalysis}>
                  <RefreshCw className="mr-2 h-5 w-5" />
                  Analyser un autre projet
                </Button>
              </div>
            </div>
          )}
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
    </Layout>
  );
};

export default Dashboard;
