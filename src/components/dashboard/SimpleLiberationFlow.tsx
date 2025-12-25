import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import {
  Upload,
  Download,
  Github,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FileCode,
  Package,
  RefreshCw,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { analyzeZipFile, analyzeFromGitHub, RealAnalysisResult } from "@/lib/zipAnalyzer";
import JSZip from "jszip";

type FlowStep = "upload" | "analyzing" | "results" | "download";

interface CleanedFile {
  path: string;
  content: string;
  cleaned: boolean;
}

/**
 * SimpleLiberationFlow - Composant épuré pour libérer un projet
 * 
 * Workflow simple en 3 étapes:
 * 1. UPLOAD - Importer depuis GitHub URL ou fichier ZIP
 * 2. ANALYSE - Détection des dépendances propriétaires
 * 3. DOWNLOAD - Télécharger le ZIP nettoyé prêt à déployer
 */
export function SimpleLiberationFlow() {
  const { t } = useTranslation();
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
  
  // Cleaning state
  const [cleanedFiles, setCleanedFiles] = useState<CleanedFile[]>([]);
  const [cleaningProgress, setCleaningProgress] = useState({ done: 0, total: 0 });
  const [isGeneratingArchive, setIsGeneratingArchive] = useState(false);

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
    setCleanedFiles([]);
    setCleaningProgress({ done: 0, total: 0 });
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
      setStep("results");
      
      toast.success(`Analyse terminée: score ${result.score}/100`);
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
    
    // Parse URL to get repo name
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
        setProgress(30 + prog * 0.7);
        setProgressMessage(msg);
      });
      
      setAnalysisResult(result);
      setExtractedFiles(result.extractedFiles);
      setStep("results");
      
      toast.success(`Analyse terminée: score ${result.score}/100`);
    } catch (error: any) {
      console.error("GitHub import error:", error);
      toast.error(error.message || "Erreur lors de l'import GitHub");
      setStep("upload");
    } finally {
      setLoading(false);
    }
  };

  // Clean files and generate archive
  const handleCleanAndDownload = async () => {
    if (extractedFiles.size === 0) {
      toast.error("Aucun fichier à nettoyer");
      return;
    }
    
    setStep("download");
    setLoading(true);
    
    // Identify files that need cleaning
    const filesToClean = Array.from(extractedFiles.entries())
      .filter(([path]) => /\.(ts|tsx|js|jsx)$/.test(path))
      .map(([path, content]) => ({ path, content }));
    
    const otherFiles = Array.from(extractedFiles.entries())
      .filter(([path]) => !/\.(ts|tsx|js|jsx)$/.test(path))
      .map(([path, content]) => ({ path, content, cleaned: false }));
    
    setCleaningProgress({ done: 0, total: filesToClean.length });
    
    const cleaned: CleanedFile[] = [...otherFiles];
    
    try {
      // Clean each file
      for (let i = 0; i < filesToClean.length; i++) {
        const file = filesToClean[i];
        setCleaningProgress({ done: i, total: filesToClean.length });
        setProgressMessage(`Nettoyage: ${file.path}`);
        
        try {
          const { data, error } = await supabase.functions.invoke("clean-code", {
            body: { code: file.content, fileName: file.path }
          });
          
          if (!error && data?.cleanedCode) {
            cleaned.push({
              path: file.path,
              content: data.cleanedCode,
              cleaned: data.cleanedCode !== file.content
            });
          } else {
            cleaned.push({ path: file.path, content: file.content, cleaned: false });
          }
        } catch {
          cleaned.push({ path: file.path, content: file.content, cleaned: false });
        }
        
        // Small delay to avoid rate limiting
        if (i < filesToClean.length - 1) {
          await new Promise(r => setTimeout(r, 150));
        }
      }
      
      setCleanedFiles(cleaned);
      setCleaningProgress({ done: filesToClean.length, total: filesToClean.length });
      setProgressMessage("Nettoyage terminé!");
      
      toast.success(`${cleaned.filter(f => f.cleaned).length} fichiers nettoyés`);
    } catch (error) {
      console.error("Cleaning error:", error);
      toast.error("Erreur lors du nettoyage");
    } finally {
      setLoading(false);
    }
  };

  // Generate and download ZIP
  const downloadArchive = async () => {
    if (cleanedFiles.length === 0) {
      toast.error("Aucun fichier à télécharger");
      return;
    }
    
    setIsGeneratingArchive(true);
    
    try {
      const zip = new JSZip();
      const projectFolder = zip.folder(projectName);
      
      if (!projectFolder) throw new Error("Failed to create folder");
      
      // Add all cleaned files
      for (const file of cleanedFiles) {
        projectFolder.file(file.path, file.content);
      }
      
      // Add Dockerfile
      const dockerfile = `# Dockerfile généré par Inopay
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
      projectFolder.file("Dockerfile", dockerfile);
      
      // Add nginx.conf
      const nginxConf = `events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    sendfile        on;
    keepalive_timeout  65;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        gzip on;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    }
}
`;
      projectFolder.file("nginx.conf", nginxConf);
      
      // Add README
      const readme = `# ${projectName} - Projet Libéré

Ce projet a été nettoyé par **Inopay** pour supprimer les dépendances propriétaires.

## Déploiement rapide

### Option 1: Docker (recommandé)

\`\`\`bash
docker build -t ${projectName} .
docker run -p 80:80 ${projectName}
\`\`\`

### Option 2: Docker Compose

\`\`\`yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
\`\`\`

### Option 3: Coolify (manuel)

1. Connectez-vous à votre instance Coolify
2. Créez un nouveau projet → Application
3. Choisissez "Docker" comme type de build
4. Entrez l'URL de votre dépôt GitHub
5. Configurez le domaine souhaité
6. Cliquez sur "Deploy"

### Option 4: VPS nu

\`\`\`bash
npm install
npm run build
# Servir le dossier dist/ avec nginx ou un autre serveur
\`\`\`

## Support

- Documentation: https://docs.inopay.app
- Email: support@inopay.app

---
Libéré avec ❤️ par Inopay
`;
      projectFolder.file("README_INOPAY.md", readme);
      
      // Generate and download
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}-libre.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success("Archive téléchargée avec succès!");
      
      // Save to history
      if (user && analysisResult) {
        try {
          await supabase.from("deployment_history").insert({
            user_id: user.id,
            project_name: projectName,
            provider: "download",
            deployment_type: "liberation",
            status: "success",
            files_uploaded: cleanedFiles.length,
            portability_score_before: analysisResult.score,
            portability_score_after: 100
          });
        } catch (e) {
          console.warn("Failed to save to history:", e);
        }
      }
    } catch (error) {
      console.error("Archive generation error:", error);
      toast.error("Erreur lors de la génération de l'archive");
    } finally {
      setIsGeneratingArchive(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
          <Sparkles className="h-8 w-8 text-primary" />
          Libération de Projet
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Importez votre projet Lovable/Bolt, nous le nettoyons et vous téléchargez un ZIP prêt à déployer n'importe où.
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-4 mb-8">
        {[
          { id: "upload", label: "Import", icon: Upload },
          { id: "analyzing", label: "Analyse", icon: FileCode },
          { id: "results", label: "Résultats", icon: CheckCircle2 },
          { id: "download", label: "Télécharger", icon: Download }
        ].map((s, idx) => {
          const isActive = step === s.id;
          const isPast = ["upload", "analyzing", "results", "download"].indexOf(step) > idx;
          
          return (
            <div key={s.id} className="flex items-center gap-2">
              {idx > 0 && <ArrowRight className={`h-4 w-4 ${isPast ? "text-primary" : "text-muted-foreground/30"}`} />}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                isActive ? "bg-primary text-primary-foreground" :
                isPast ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
                <s.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="space-y-6 animate-fade-in">
          {/* GitHub URL Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                Importer depuis GitHub
              </CardTitle>
              <CardDescription>
                Collez l'URL de votre dépôt GitHub Lovable ou Bolt
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
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyser"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          {/* ZIP Upload */}
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
                  ou cliquez pour sélectionner un fichier
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step: Analyzing */}
      {step === "analyzing" && (
        <Card className="animate-fade-in">
          <CardContent className="py-16 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
            <h3 className="text-xl font-semibold mb-2">Analyse en cours...</h3>
            <p className="text-muted-foreground mb-6">{progressMessage || "Veuillez patienter"}</p>
            <Progress value={progress} className="max-w-md mx-auto" />
          </CardContent>
        </Card>
      )}

      {/* Step: Results */}
      {step === "results" && analysisResult && (
        <div className="space-y-6 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Résultats de l'analyse: {projectName}</span>
                <Badge variant={analysisResult.score >= 80 ? "default" : analysisResult.score >= 50 ? "secondary" : "destructive"}>
                  Score: {analysisResult.score}/100
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-foreground">{extractedFiles.size}</div>
                  <div className="text-sm text-muted-foreground">Fichiers</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-destructive">{analysisResult.issues.filter(i => i.severity === "critical").length}</div>
                  <div className="text-sm text-muted-foreground">Critiques</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-warning">{analysisResult.issues.filter(i => i.severity === "warning").length}</div>
                  <div className="text-sm text-muted-foreground">Avertissements</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">{analysisResult.dependencies.filter(d => d.status === "incompatible").length}</div>
                  <div className="text-sm text-muted-foreground">Dépendances à remplacer</div>
                </div>
              </div>

              {analysisResult.platform && (
                <Alert>
                  <Package className="h-4 w-4" />
                  <AlertDescription>
                    Plateforme détectée: <strong>{analysisResult.platform}</strong>
                  </AlertDescription>
                </Alert>
              )}

              {analysisResult.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Recommandations:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {analysisResult.recommendations.slice(0, 5).map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={reset}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Nouveau projet
                </Button>
                <Button onClick={handleCleanAndDownload} className="flex-1">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Nettoyer et préparer le téléchargement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step: Download */}
      {step === "download" && (
        <div className="space-y-6 animate-fade-in">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Téléchargement prêt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">{progressMessage}</p>
                  <Progress 
                    value={(cleaningProgress.done / Math.max(cleaningProgress.total, 1)) * 100} 
                    className="max-w-md mx-auto mt-4"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {cleaningProgress.done}/{cleaningProgress.total} fichiers
                  </p>
                </div>
              ) : (
                <>
                  <Alert className="bg-success/10 border-success">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <AlertDescription>
                      <strong>{cleanedFiles.filter(f => f.cleaned).length}</strong> fichiers nettoyés sur {cleanedFiles.length} total.
                      Votre projet est prêt à être téléchargé!
                    </AlertDescription>
                  </Alert>

                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <h4 className="font-medium">Contenu du ZIP:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✓ Code source nettoyé</li>
                      <li>✓ Dockerfile optimisé</li>
                      <li>✓ nginx.conf configuré</li>
                      <li>✓ README avec instructions de déploiement</li>
                    </ul>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button variant="outline" onClick={reset}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Nouveau projet
                    </Button>
                    <Button 
                      onClick={downloadArchive} 
                      className="flex-1"
                      disabled={isGeneratingArchive}
                    >
                      {isGeneratingArchive ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Télécharger {projectName}-libre.zip
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Deployment Guide */}
          {!loading && cleanedFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Prochaines étapes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">🐳 Docker</h4>
                    <code className="text-xs bg-muted p-2 rounded block">
                      docker build -t app .<br/>
                      docker run -p 80:80 app
                    </code>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">☁️ Coolify</h4>
                    <p className="text-sm text-muted-foreground">
                      Import GitHub → Docker Build → Deploy
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">🖥️ VPS</h4>
                    <code className="text-xs bg-muted p-2 rounded block">
                      npm install && npm run build
                    </code>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Consultez le fichier README_INOPAY.md dans le ZIP pour plus de détails.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
