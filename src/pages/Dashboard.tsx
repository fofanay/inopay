import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { Upload, FileArchive, Loader2, CheckCircle2, AlertTriangle, XCircle, Download, RefreshCw, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type AnalysisState = "idle" | "uploading" | "analyzing" | "complete";

interface DependencyItem {
  name: string;
  type: string;
  status: "compatible" | "warning" | "incompatible";
  note: string;
}

interface AnalysisResult {
  id?: string;
  score: number;
  platform: string;
  totalFiles: number;
  dependencies: DependencyItem[];
  recommendations: string[];
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
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [state, setState] = useState<AnalysisState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

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

  // Simulated analysis data
  const generateMockResult = (projectName: string): AnalysisResult => ({
    score: Math.floor(Math.random() * 20) + 75, // 75-95 range
    platform: ["Lovable", "Bolt", "v0", "Cursor"][Math.floor(Math.random() * 4)],
    totalFiles: Math.floor(Math.random() * 50) + 20,
    dependencies: [
      { name: "react", type: "Package", status: "compatible", note: "Standard React - aucun changement requis" },
      { name: "react-router-dom", type: "Package", status: "compatible", note: "Compatible avec tout environnement" },
      { name: "@tanstack/react-query", type: "Package", status: "compatible", note: "Librairie standard" },
      { name: "tailwindcss", type: "Style", status: "compatible", note: "Configuration portable" },
      { name: "@/components/ui/*", type: "Import path", status: "warning", note: "Alias @ à configurer dans votre projet" },
      { name: "supabase", type: "Backend", status: "warning", note: "Remplacer par votre propre backend ou garder Supabase" },
      { name: "lovable-tagger", type: "Package", status: "incompatible", note: "Spécifique à Lovable - à supprimer" },
      { name: "GPTEngineer", type: "Config", status: "incompatible", note: "Fichiers de configuration Lovable - à supprimer" },
    ],
    recommendations: [
      "Supprimer les dépendances spécifiques à la plateforme",
      "Configurer les alias de chemin (@/) dans votre bundler (Vite/Webpack)",
      "Exporter et migrer les données si vous utilisez un backend cloud",
      "Mettre à jour les variables d'environnement selon votre hébergeur",
      "Tester l'application localement avec npm run dev avant déploiement",
    ],
  });

  const saveAnalysis = async (projectName: string, analysisResult: AnalysisResult) => {
    if (!user) return;

    const { data, error } = await supabase
      .from("projects_analysis")
      .insert([{
        user_id: user.id,
        project_name: projectName,
        file_name: fileName,
        portability_score: analysisResult.score,
        detected_issues: JSON.parse(JSON.stringify(analysisResult.dependencies.filter(d => d.status !== "compatible"))),
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
    }
  };

  const simulateAnalysis = useCallback((projectName: string) => {
    setState("uploading");
    setProgress(0);

    const messages = [
      "Extraction de l'archive...",
      "Analyse de la structure du projet...",
      "Détection des dépendances...",
      "Vérification des imports...",
      "Analyse des configurations...",
      "Génération du rapport...",
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      const newProgress = Math.min((currentStep / messages.length) * 100, 100);
      setProgress(newProgress);
      setProgressMessage(messages[Math.min(currentStep - 1, messages.length - 1)]);

      if (currentStep === 2) {
        setState("analyzing");
      }

      if (currentStep >= messages.length) {
        clearInterval(interval);
        setTimeout(() => {
          const mockResult = generateMockResult(projectName);
          setState("complete");
          saveAnalysis(projectName, mockResult);
        }, 500);
      }
    }, 1000);
  }, [user, fileName]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFileName(file.name);
      const projectName = file.name.replace(".zip", "");
      simulateAnalysis(projectName);
    }
  }, [simulateAnalysis]);

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

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
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

          {/* Upload Zone */}
          {state === "idle" && (
            <>
              <Card className="border-dashed border-2 hover:border-primary/50 transition-colors animate-fade-in mb-8">
                <CardContent className="p-0">
                  <div
                    {...getRootProps()}
                    className={`flex flex-col items-center justify-center py-20 px-8 cursor-pointer transition-colors ${
                      isDragActive ? "bg-primary/10" : "bg-card hover:bg-muted/30"
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className={`flex h-20 w-20 items-center justify-center rounded-2xl mb-6 transition-all ${
                      isDragActive ? "bg-primary text-primary-foreground glow-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      <Upload className="h-10 w-10" />
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
                    {state === "uploading" ? "Téléchargement en cours..." : "Analyse en cours..."}
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
                  </div>

                  {/* Info */}
                  <CardContent className="flex flex-col justify-center py-8">
                    <h3 className="text-2xl font-bold mb-4">Projet analysé</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Fichier</span>
                        <span className="font-medium">{fileName}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Plateforme détectée</span>
                        <Badge variant="secondary">{result.platform}</Badge>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground">Fichiers analysés</span>
                        <span className="font-medium">{result.totalFiles}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-muted-foreground">Dépendances</span>
                        <span className="font-medium">{result.dependencies.length}</span>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>

              {/* Dependencies Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Analyse des dépendances</CardTitle>
                  <CardDescription>
                    Liste des éléments détectés et leur compatibilité pour la migration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Élément</TableHead>
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
                <Button size="lg" className="glow-sm">
                  <Download className="mr-2 h-5 w-5" />
                  Télécharger le rapport PDF
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
    </Layout>
  );
};

export default Dashboard;
