import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Download,
  Github,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Package,
  RefreshCw,
  Sparkles,
  Shield,
  Server,
  Database,
  FileCode,
  FolderArchive,
  Rocket,
  ExternalLink,
  AlertTriangle,
  Eye,
  ShieldCheck
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { analyzeZipFile, analyzeFromGitHub, RealAnalysisResult } from "@/lib/zipAnalyzer";
import {
  shouldRemoveFile,
  cleanPackageJson,
  cleanViteConfig,
  cleanIndexHtml,
  deepCleanSourceFile,
  checkProprietaryCDN,
  detectNeededPolyfills,
  calculateSovereigntyScore,
  HOOK_POLYFILLS,
  PROPRIETARY_PATHS,
} from "@/lib/clientProprietaryPatterns";

type FlowStep = "upload" | "analyzing" | "cleaning" | "ready";

interface CleanedFile {
  path: string;
  content: string;
  cleaned: boolean;
}

interface CleaningStats {
  filesRemoved: number;
  filesCleaned: number;
  filesVerified: number;
  packagesRemoved: number;
  polyfillsGenerated: number;
  suspiciousPatterns: string[];
  sovereigntyScore: number;
}

/**
 * LiberationPackHub - Centre de génération de packs de libération autonomes
 * 
 * VERSION 2.0: Deep cleaning pour 100% de souveraineté
 * 
 * Permet aux utilisateurs de:
 * 1. Importer un projet (GitHub ou ZIP)
 * 2. Analyser et nettoyer EN PROFONDEUR
 * 3. Générer un Liberation Pack complet (frontend + backend + DB + docker-compose)
 * 4. Télécharger le pack prêt à déployer sur n'importe quel VPS
 */
export function LiberationPackHub() {
  const { user } = useAuth();
  
  // Flow state
  const [step, setStep] = useState<FlowStep>("upload");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  
  // Project data
  const [projectName, setProjectName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [analysisResult, setAnalysisResult] = useState<RealAnalysisResult | null>(null);
  const [extractedFiles, setExtractedFiles] = useState<Map<string, string>>(new Map());
  
  // Cleaned files
  const [cleanedFiles, setCleanedFiles] = useState<Record<string, string>>({});
  const [edgeFunctions, setEdgeFunctions] = useState<Array<{ name: string; content: string }>>([]);
  const [sqlSchema, setSqlSchema] = useState<string | null>(null);
  const [cleaningStats, setCleaningStats] = useState<CleaningStats>({
    filesRemoved: 0,
    filesCleaned: 0,
    filesVerified: 0,
    packagesRemoved: 0,
    polyfillsGenerated: 0,
    suspiciousPatterns: [],
    sovereigntyScore: 0,
  });
  
  // Pack options
  const [includeBackend, setIncludeBackend] = useState(true);
  const [includeDatabase, setIncludeDatabase] = useState(true);
  const [isGeneratingPack, setIsGeneratingPack] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Reset flow
  const reset = () => {
    setStep("upload");
    setLoading(false);
    setProgress(0);
    setProgressMessage("");
    setProjectName("");
    setGithubUrl("");
    setAnalysisResult(null);
    setExtractedFiles(new Map());
    setCleanedFiles({});
    setEdgeFunctions([]);
    setSqlSchema(null);
    setCleaningStats({ 
      filesRemoved: 0, 
      filesCleaned: 0, 
      filesVerified: 0,
      packagesRemoved: 0, 
      polyfillsGenerated: 0,
      suspiciousPatterns: [],
      sovereigntyScore: 0,
    });
    setDownloadUrl(null);
  };

  // Handle ZIP file drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0];
    const name = file.name.replace(/\.zip$/i, "");
    setProjectName(name);
    setLoading(true);
    setStep("analyzing");
    
    try {
      const result = await analyzeZipFile(file, (prog, msg) => {
        setProgress(prog);
        setProgressMessage(msg);
      });
      
      setAnalysisResult(result);
      setExtractedFiles(result.extractedFiles);
      
      // Auto-start deep cleaning
      await processAndDeepClean(result.extractedFiles, result);
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Erreur lors de l'analyse du fichier");
      setStep("upload");
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/zip": [".zip"] },
    maxFiles: 1,
    disabled: loading
  });

  // Handle GitHub URL import
  const handleGitHubImport = async () => {
    if (!githubUrl.trim()) {
      toast.error("Veuillez entrer une URL GitHub");
      return;
    }
    
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (!match) {
      toast.error("URL GitHub invalide");
      return;
    }
    
    const repoName = match[2].replace(/\.git$/, "");
    setProjectName(repoName);
    setLoading(true);
    setStep("analyzing");
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      setProgress(10);
      setProgressMessage("Téléchargement du dépôt...");
      
      const response = await supabase.functions.invoke("fetch-github-repo", {
        body: { url: githubUrl },
        headers: session.session?.access_token 
          ? { Authorization: `Bearer ${session.session.access_token}` }
          : undefined
      });
      
      if (response.error) throw new Error(response.error.message);
      if (response.data?.error) throw new Error(response.data.error);
      
      const { files, repository } = response.data;
      
      if (!files || files.length === 0) {
        throw new Error("Aucun fichier trouvé dans le dépôt");
      }
      
      setProgress(30);
      setProgressMessage("Analyse en cours...");
      
      const result = await analyzeFromGitHub(files, repository.name, (prog, msg) => {
        setProgress(30 + prog * 0.4);
        setProgressMessage(msg);
      });
      
      setAnalysisResult(result);
      setExtractedFiles(result.extractedFiles);
      
      // Auto-start deep cleaning
      await processAndDeepClean(result.extractedFiles, result);
    } catch (error: any) {
      console.error("GitHub import error:", error);
      toast.error(error.message || "Erreur lors de l'import GitHub");
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  // DEEP CLEAN: Process and clean ALL files comprehensively
  const processAndDeepClean = async (files: Map<string, string>, analysis: RealAnalysisResult) => {
    setStep("cleaning");
    setProgress(0);
    setProgressMessage("Nettoyage en profondeur...");
    
    const stats: CleaningStats = {
      filesRemoved: 0,
      filesCleaned: 0,
      filesVerified: 0,
      packagesRemoved: 0,
      polyfillsGenerated: 0,
      suspiciousPatterns: [],
      sovereigntyScore: 0,
    };
    
    const cleaned: Record<string, string> = {};
    const edgeFuncs: Array<{ name: string; content: string }> = [];
    let schema: string | null = null;
    
    // Step 1: Filter out proprietary files and paths
    const filteredFiles = new Map<string, string>();
    
    for (const [path, content] of files) {
      // Check if file should be completely removed
      if (shouldRemoveFile(path)) {
        stats.filesRemoved++;
        continue;
      }
      
      // Check if file is in a proprietary path
      let isProprietaryPath = false;
      for (const propPath of PROPRIETARY_PATHS) {
        if (path.includes(propPath)) {
          isProprietaryPath = true;
          stats.filesRemoved++;
          break;
        }
      }
      
      if (isProprietaryPath) continue;
      
      // Check if analysis flagged this file
      if (analysis.filesToRemove.includes(path)) {
        stats.filesRemoved++;
        continue;
      }
      
      filteredFiles.set(path, content);
    }
    
    setProgress(20);
    setProgressMessage(`${stats.filesRemoved} fichiers propriétaires supprimés`);
    
    // Step 2: Detect needed polyfills BEFORE cleaning
    const neededPolyfills = detectNeededPolyfills(filteredFiles);
    
    // Step 3: Process and deep clean each file
    const filesToProcess = Array.from(filteredFiles.entries());
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const [path, content] = filesToProcess[i];
      const fileName = path.split('/').pop() || '';
      
      const progressPercent = 20 + Math.round((i / filesToProcess.length) * 60);
      setProgress(progressPercent);
      
      // Extract edge functions (keep for conversion)
      if (path.startsWith('supabase/functions/') && path.endsWith('/index.ts')) {
        const funcName = path.split('/')[2];
        if (funcName && funcName !== '_shared') {
          edgeFuncs.push({ name: funcName, content });
        }
        continue;
      }
      
      // Skip supabase config
      if (path.includes('supabase/config.toml')) {
        stats.filesRemoved++;
        continue;
      }
      
      // Extract SQL schema
      if (path.endsWith('.sql') || path.includes('migrations/')) {
        if (!schema) schema = content;
        else schema += '\n\n' + content;
        continue;
      }
      
      let finalContent = content;
      let wasModified = false;
      
      // === DEEP CLEAN based on file type ===
      
      // Clean package.json
      if (fileName === 'package.json') {
        const result = cleanPackageJson(content);
        finalContent = result.cleaned;
        stats.packagesRemoved += result.changes.filter(c => c.includes('Dépendance')).length;
        if (result.changes.length > 0) {
          stats.filesCleaned++;
          wasModified = true;
        }
      }
      // Clean vite.config
      else if (fileName === 'vite.config.ts' || fileName === 'vite.config.js') {
        const result = cleanViteConfig(content);
        finalContent = result.cleaned;
        if (result.changes.length > 0) {
          stats.filesCleaned++;
          wasModified = true;
        }
      }
      // Clean index.html
      else if (fileName === 'index.html') {
        const result = cleanIndexHtml(content);
        finalContent = result.cleaned;
        if (result.changes.length > 0) {
          stats.filesCleaned++;
          wasModified = true;
        }
      }
      // DEEP CLEAN all source files (.ts, .tsx, .js, .jsx)
      else if (/\.(ts|tsx|js|jsx)$/.test(path)) {
        const result = deepCleanSourceFile(content, path);
        finalContent = result.cleaned;
        
        if (result.wasModified) {
          stats.filesCleaned++;
          wasModified = true;
        }
        
        // Track suspicious patterns
        if (result.suspiciousPatterns.length > 0) {
          stats.suspiciousPatterns.push(...result.suspiciousPatterns);
        }
      }
      // Check CSS/SCSS for CDN references
      else if (/\.(css|scss|sass)$/.test(path)) {
        const cdnCheck = checkProprietaryCDN(content);
        if (cdnCheck.found) {
          // Remove CDN URLs
          let cleanedCss = content;
          for (const url of cdnCheck.urls) {
            cleanedCss = cleanedCss.replace(url, '');
          }
          finalContent = cleanedCss;
          stats.filesCleaned++;
          wasModified = true;
        }
      }
      
      // Track verified clean files
      if (!wasModified) {
        stats.filesVerified++;
      }
      
      cleaned[path] = finalContent;
    }
    
    setProgress(85);
    setProgressMessage("Génération des polyfills...");
    
    // Step 4: Generate polyfills
    for (const hookName of neededPolyfills) {
      const polyfill = HOOK_POLYFILLS[hookName];
      if (polyfill) {
        cleaned[`src/lib/inopay-compat/${polyfill.filename}`] = polyfill.content;
        stats.polyfillsGenerated++;
      }
    }
    
    // Generate polyfill index
    if (stats.polyfillsGenerated > 0) {
      const exports = neededPolyfills
        .map(name => `export * from './${HOOK_POLYFILLS[name]?.filename.replace('.ts', '')}';`)
        .join('\n');
      cleaned['src/lib/inopay-compat/index.ts'] = `// Inopay Compatibility Layer\n// Auto-generated polyfills for sovereign code\n${exports}\n`;
    }
    
    // Step 5: Generate Supabase types placeholder
    cleaned['src/lib/supabase-types.ts'] = `// Supabase Types - Généré par Inopay Liberation
// Remplacez ces types par ceux de votre propre projet Supabase
// Utilisez: npx supabase gen types typescript --project-id="votre-project-id"

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      // Vos tables ici
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
`;
    
    setProgress(95);
    setProgressMessage("Vérification de la souveraineté...");
    
    // Step 6: Calculate sovereignty score
    const sovereigntyCheck = calculateSovereigntyScore(files, cleaned);
    stats.sovereigntyScore = sovereigntyCheck.score;
    
    if (sovereigntyCheck.details.length > 0) {
      stats.suspiciousPatterns.push(...sovereigntyCheck.details);
    }
    
    setProgress(100);
    setCleanedFiles(cleaned);
    setEdgeFunctions(edgeFuncs);
    setSqlSchema(schema);
    setCleaningStats(stats);
    setIncludeBackend(edgeFuncs.length > 0);
    setIncludeDatabase(!!schema);
    
    const totalProcessed = stats.filesCleaned + stats.filesVerified;
    toast.success(`Nettoyage complet: ${totalProcessed} fichiers traités, score ${stats.sovereigntyScore}%`);
    setStep("ready");
  };

  // Generate Liberation Pack
  const handleGeneratePack = async () => {
    setIsGeneratingPack(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-liberation-pack', {
        body: {
          projectName,
          cleanedFiles,
          edgeFunctions: includeBackend ? edgeFunctions : [],
          sqlSchema: includeDatabase ? sqlSchema : null,
          includeBackend,
          includeDatabase,
          sovereigntyScore: cleaningStats.sovereigntyScore
        }
      });

      if (error) throw error;

      if (data?.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
        toast.success(`Pack généré: ${data.summary?.frontendFiles || 0} fichiers frontend, ${data.summary?.backendRoutes || 0} routes backend`);
      }
    } catch (error) {
      console.error('Error generating pack:', error);
      toast.error(error instanceof Error ? error.message : "Erreur de génération");
    } finally {
      setIsGeneratingPack(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const frontendFilesCount = Object.keys(cleanedFiles).filter(p => !p.startsWith('supabase/')).length;
  const totalProcessedFiles = cleaningStats.filesCleaned + cleaningStats.filesVerified;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FolderArchive className="h-6 w-6 text-primary" />
            Liberation Pack Generator
          </h2>
          <p className="text-muted-foreground">
            Générez un pack autonome 100% souverain prêt à déployer
          </p>
        </div>
        {step !== "upload" && (
          <Button variant="outline" onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Nouveau projet
          </Button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between px-4">
        {[
          { id: "upload", label: "Import", icon: Upload },
          { id: "analyzing", label: "Analyse", icon: Sparkles },
          { id: "cleaning", label: "Deep Clean", icon: Shield },
          { id: "ready", label: "Pack", icon: Package },
        ].map((s, i) => {
          const Icon = s.icon;
          const isCurrent = step === s.id;
          const isPast = ["upload", "analyzing", "cleaning", "ready"].indexOf(step) > i;
          
          return (
            <div key={s.id} className="flex items-center">
              <div className={`flex flex-col items-center ${isCurrent ? "text-primary" : isPast ? "text-success" : "text-muted-foreground"}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                  isCurrent ? "border-primary bg-primary/10" : isPast ? "border-success bg-success/10" : "border-muted"
                }`}>
                  {isPast ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span className="text-xs mt-1">{s.label}</span>
              </div>
              {i < 3 && (
                <div className={`w-16 md:w-24 h-0.5 mx-2 ${isPast ? "bg-success" : "bg-muted"}`} />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* Step: Upload */}
        {step === "upload" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <Tabs defaultValue="github" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="github" className="gap-2">
                  <Github className="h-4 w-4" />
                  GitHub
                </TabsTrigger>
                <TabsTrigger value="zip" className="gap-2">
                  <Upload className="h-4 w-4" />
                  Fichier ZIP
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="github" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Importer depuis GitHub</CardTitle>
                    <CardDescription>
                      Collez l'URL de votre dépôt (Lovable, Bolt, v0, Cursor, Replit)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://github.com/utilisateur/projet"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        className="flex-1"
                        disabled={loading}
                      />
                      <Button 
                        onClick={handleGitHubImport}
                        disabled={loading || !githubUrl.trim()}
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="zip" className="mt-4">
                <Card>
                  <CardContent className="p-0">
                    <div
                      {...getRootProps()}
                      className={`flex flex-col items-center justify-center py-16 px-8 cursor-pointer transition-all rounded-lg border-2 border-dashed ${
                        isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                      }`}
                    >
                      <input {...getInputProps()} />
                      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl mb-6 ${
                        isDragActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <Upload className="h-8 w-8" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">
                        {isDragActive ? "Déposez le fichier ici" : "Glissez votre fichier ZIP"}
                      </h3>
                      <p className="text-muted-foreground text-center">
                        ou cliquez pour sélectionner
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Features Preview */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
                <CardContent className="pt-6">
                  <FileCode className="h-8 w-8 text-blue-500 mb-3" />
                  <h4 className="font-semibold mb-1">Frontend 100% propre</h4>
                  <p className="text-sm text-muted-foreground">
                    Deep clean de TOUS les fichiers + Dockerfile
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
                <CardContent className="pt-6">
                  <Server className="h-8 w-8 text-green-500 mb-3" />
                  <h4 className="font-semibold mb-1">Backend Express</h4>
                  <p className="text-sm text-muted-foreground">
                    Edge Functions converties en API Express.js
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-purple-500/10 to-transparent border-purple-500/20">
                <CardContent className="pt-6">
                  <Database className="h-8 w-8 text-purple-500 mb-3" />
                  <h4 className="font-semibold mb-1">Base de données</h4>
                  <p className="text-sm text-muted-foreground">
                    Schéma SQL avec migrations et politiques RLS
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Step: Analyzing/Cleaning */}
        {(step === "analyzing" || step === "cleaning") && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <Card>
              <CardContent className="py-16 text-center">
                <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-2">
                  {step === "analyzing" ? "Analyse en cours..." : "Nettoyage en profondeur..."}
                </h3>
                <p className="text-muted-foreground mb-6">{progressMessage || "Veuillez patienter"}</p>
                <Progress value={progress} className="max-w-md mx-auto" />
                {step === "cleaning" && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Suppression des imports propriétaires, télémétrie, et génération des polyfills
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step: Ready */}
        {step === "ready" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Sovereignty Score */}
            <Card className={`border-2 ${cleaningStats.sovereigntyScore >= 95 ? 'border-success/50 bg-success/5' : cleaningStats.sovereigntyScore >= 80 ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-destructive/50 bg-destructive/5'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className={`h-5 w-5 ${cleaningStats.sovereigntyScore >= 95 ? 'text-success' : cleaningStats.sovereigntyScore >= 80 ? 'text-yellow-500' : 'text-destructive'}`} />
                    Score de Souveraineté
                  </CardTitle>
                  <div className={`text-3xl font-bold ${cleaningStats.sovereigntyScore >= 95 ? 'text-success' : cleaningStats.sovereigntyScore >= 80 ? 'text-yellow-500' : 'text-destructive'}`}>
                    {cleaningStats.sovereigntyScore}%
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={cleaningStats.sovereigntyScore} 
                  className="h-3 mb-3"
                />
                <p className="text-sm text-muted-foreground">
                  {cleaningStats.sovereigntyScore >= 95 
                    ? "✅ Excellent ! Votre code est 100% souverain et prêt à déployer."
                    : cleaningStats.sovereigntyScore >= 80
                    ? "⚠️ Bon score. Quelques éléments mineurs pourraient être améliorés."
                    : "❌ Des éléments propriétaires subsistent. Vérification manuelle recommandée."}
                </p>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  Projet "{projectName}" nettoyé
                </CardTitle>
                <CardDescription>
                  {analysisResult?.score || 0}% → {cleaningStats.sovereigntyScore}% de souveraineté
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-3 bg-background rounded-lg border">
                    <div className="text-2xl font-bold">{frontendFilesCount}</div>
                    <div className="text-xs text-muted-foreground">Total fichiers</div>
                  </div>
                  <div className="text-center p-3 bg-success/10 rounded-lg border border-success/20">
                    <div className="text-2xl font-bold text-success">{cleaningStats.filesVerified}</div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Eye className="h-3 w-3" /> Vérifiés
                    </div>
                  </div>
                  <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="text-2xl font-bold text-primary">{cleaningStats.filesCleaned}</div>
                    <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Shield className="h-3 w-3" /> Nettoyés
                    </div>
                  </div>
                  <div className="text-center p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                    <div className="text-2xl font-bold text-destructive">{cleaningStats.filesRemoved}</div>
                    <div className="text-xs text-muted-foreground">Supprimés</div>
                  </div>
                  <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-2xl font-bold text-blue-500">{edgeFunctions.length}</div>
                    <div className="text-xs text-muted-foreground">Edge Funcs</div>
                  </div>
                </div>

                {/* Suspicious patterns warning */}
                {cleaningStats.suspiciousPatterns.length > 0 && (
                  <Alert className="mt-4" variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{cleaningStats.suspiciousPatterns.length} avertissements détectés :</strong>
                      <ul className="list-disc list-inside mt-1 text-sm">
                        {cleaningStats.suspiciousPatterns.slice(0, 3).map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                        {cleaningStats.suspiciousPatterns.length > 3 && (
                          <li>... et {cleaningStats.suspiciousPatterns.length - 3} autres</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Pack Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Configuration du Pack
                </CardTitle>
                <CardDescription>
                  Choisissez les composants à inclure dans votre Liberation Pack
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Backend option */}
                  <div className={`p-4 rounded-lg border ${includeBackend ? 'bg-card border-green-500/30' : 'bg-muted/50 border-muted'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Server className="h-5 w-5 text-green-500" />
                        <span className="font-medium">Backend API</span>
                        {edgeFunctions.length > 0 && (
                          <Badge variant="outline">{edgeFunctions.length} routes</Badge>
                        )}
                      </div>
                      <Switch 
                        checked={includeBackend} 
                        onCheckedChange={setIncludeBackend}
                        disabled={edgeFunctions.length === 0}
                      />
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Edge Functions → Express.js</li>
                      <li>• Middleware d'authentification</li>
                      <li>• Health checks intégrés</li>
                    </ul>
                  </div>
                  
                  {/* Database option */}
                  <div className={`p-4 rounded-lg border ${includeDatabase ? 'bg-card border-purple-500/30' : 'bg-muted/50 border-muted'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Database className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">Base de données</span>
                      </div>
                      <Switch 
                        checked={includeDatabase} 
                        onCheckedChange={setIncludeDatabase}
                        disabled={!sqlSchema}
                      />
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Schéma SQL complet</li>
                      <li>• Politiques RLS</li>
                      <li>• Scripts de migration</li>
                    </ul>
                  </div>
                </div>

                {/* What's included */}
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-primary" />
                    Contenu du pack
                  </h4>
                  <div className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <div>• docker-compose.yml complet</div>
                    <div>• Dockerfile optimisé</div>
                    <div>• .env.example pré-rempli</div>
                    <div>• Script quick-deploy.sh</div>
                    <div>• Guide interactif HTML</div>
                    <div>• Polyfills de compatibilité</div>
                  </div>
                </div>

                {/* Generate button */}
                {downloadUrl ? (
                  <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-success/10 border border-success/20">
                    <CheckCircle2 className="h-12 w-12 text-success" />
                    <div className="text-center">
                      <h4 className="font-semibold text-lg">Pack prêt !</h4>
                      <p className="text-sm text-muted-foreground">
                        Votre Liberation Pack souverain est prêt à être téléchargé
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleDownload} size="lg" className="gap-2">
                        <Download className="h-5 w-5" />
                        Télécharger le pack
                      </Button>
                      <Button variant="outline" size="lg" asChild>
                        <a href="https://docs.inopay.fr/liberation-pack" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Guide
                        </a>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={handleGeneratePack} 
                    disabled={isGeneratingPack}
                    size="lg"
                    className="w-full gap-2"
                  >
                    {isGeneratingPack ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Génération en cours...
                      </>
                    ) : (
                      <>
                        <FolderArchive className="h-5 w-5" />
                        Générer le Liberation Pack
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
