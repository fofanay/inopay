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
  Sparkles,
  Shield,
  Trash2
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
import {
  shouldRemoveFile,
  cleanPackageJson,
  cleanViteConfig,
  cleanIndexHtml,
  cleanSourceFile,
  checkProprietaryCDN,
  detectNeededPolyfills,
  generateEnvExample,
  HOOK_POLYFILLS,
  PROPRIETARY_FILES,
} from "@/lib/clientProprietaryPatterns";
import JSZip from "jszip";
import { PostLiberationOffers } from "./PostLiberationOffers";

type FlowStep = "upload" | "analyzing" | "results" | "download";


interface CleanedFile {
  path: string;
  content: string;
  cleaned: boolean;
  changes?: string[];
}

interface CleaningStats {
  filesRemoved: number;
  filesCleanedByAI: number;
  filesCleanedLocally: number;
  packagesRemoved: number;
  polyfillsGenerated: number;
  cdnUrlsReplaced: number;
}

/**
 * SimpleLiberationFlow - Composant complet pour libérer un projet
 * 
 * Workflow en 4 étapes:
 * 1. UPLOAD - Importer depuis GitHub URL ou fichier ZIP
 * 2. ANALYSE - Détection des dépendances propriétaires
 * 3. RÉSULTATS - Affichage du score et des problèmes
 * 4. TÉLÉCHARGER - Télécharger le ZIP nettoyé prêt à déployer
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
  const [cleaningStats, setCleaningStats] = useState<CleaningStats>({
    filesRemoved: 0,
    filesCleanedByAI: 0,
    filesCleanedLocally: 0,
    packagesRemoved: 0,
    polyfillsGenerated: 0,
    cdnUrlsReplaced: 0,
  });
  const [isGeneratingArchive, setIsGeneratingArchive] = useState(false);
  const [showOffers, setShowOffers] = useState(false);

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
    setCleaningStats({
      filesRemoved: 0,
      filesCleanedByAI: 0,
      filesCleanedLocally: 0,
      packagesRemoved: 0,
      polyfillsGenerated: 0,
      cdnUrlsReplaced: 0,
    });
    setShowOffers(false);
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

  // Complete cleaning process
  const handleCleanAndDownload = async () => {
    if (extractedFiles.size === 0) {
      toast.error("Aucun fichier à nettoyer");
      return;
    }
    
    setStep("download");
    setLoading(true);
    
    const stats: CleaningStats = {
      filesRemoved: 0,
      filesCleanedByAI: 0,
      filesCleanedLocally: 0,
      packagesRemoved: 0,
      polyfillsGenerated: 0,
      cdnUrlsReplaced: 0,
    };
    
    // Phase 1: Filter out proprietary files
    const filteredFiles = new Map<string, string>();
    for (const [path, content] of extractedFiles) {
      if (shouldRemoveFile(path)) {
        stats.filesRemoved++;
        console.log(`[CLEAN] Fichier supprimé: ${path}`);
      } else {
        filteredFiles.set(path, content);
      }
    }
    
    // Also remove from filesToRemove list
    if (analysisResult?.filesToRemove) {
      for (const path of analysisResult.filesToRemove) {
        if (filteredFiles.has(path)) {
          filteredFiles.delete(path);
          stats.filesRemoved++;
        }
      }
    }
    
    setProgressMessage(`Phase 1: ${stats.filesRemoved} fichiers propriétaires supprimés`);
    
    // Phase 2: Detect needed polyfills BEFORE cleaning
    const neededPolyfills = detectNeededPolyfills(filteredFiles);
    
    // Phase 3: Clean files locally and via AI
    const filesToProcess = Array.from(filteredFiles.entries());
    const cleaned: CleanedFile[] = [];
    
    setCleaningProgress({ done: 0, total: filesToProcess.length });
    
    for (let i = 0; i < filesToProcess.length; i++) {
      const [path, content] = filesToProcess[i];
      setCleaningProgress({ done: i, total: filesToProcess.length });
      setProgressMessage(`Phase 2: Nettoyage ${path}`);
      
      let finalContent = content;
      let wasChanged = false;
      const allChanges: string[] = [];
      
      // Local cleaning first (fast)
      const fileName = path.split('/').pop() || '';
      
      // Clean package.json
      if (fileName === 'package.json') {
        const result = cleanPackageJson(content);
        if (result.changes.length > 0) {
          finalContent = result.cleaned;
          allChanges.push(...result.changes);
          stats.packagesRemoved += result.changes.filter(c => c.includes('Dépendance')).length;
          wasChanged = true;
        }
      }
      // Clean vite.config.ts
      else if (fileName === 'vite.config.ts' || fileName === 'vite.config.js') {
        const result = cleanViteConfig(content);
        if (result.changes.length > 0) {
          finalContent = result.cleaned;
          allChanges.push(...result.changes);
          wasChanged = true;
          stats.filesCleanedLocally++;
        }
      }
      // Clean index.html
      else if (fileName === 'index.html') {
        const result = cleanIndexHtml(content);
        if (result.changes.length > 0) {
          finalContent = result.cleaned;
          allChanges.push(...result.changes);
          wasChanged = true;
          stats.filesCleanedLocally++;
        }
      }
      // Clean source files
      else if (/\.(ts|tsx|js|jsx)$/.test(path)) {
        // First local cleaning
        const localResult = cleanSourceFile(content);
        if (localResult.changes.length > 0) {
          finalContent = localResult.cleaned;
          allChanges.push(...localResult.changes);
          wasChanged = true;
          stats.filesCleanedLocally++;
        }
        
        // Check for proprietary CDN
        const cdnCheck = checkProprietaryCDN(finalContent);
        if (cdnCheck.found) {
          stats.cdnUrlsReplaced += cdnCheck.urls.length;
          allChanges.push(`CDN propriétaires détectés: ${cdnCheck.urls.length}`);
        }
        
        // Then AI cleaning for complex cases
        try {
          const { data, error } = await supabase.functions.invoke("clean-code", {
            body: { code: finalContent, fileName: path }
          });
          
          if (!error && data?.cleanedCode && data.cleanedCode !== finalContent) {
            finalContent = data.cleanedCode;
            wasChanged = true;
            stats.filesCleanedByAI++;
            allChanges.push("Nettoyage AI effectué");
          }
        } catch (e) {
          console.warn(`AI cleaning failed for ${path}:`, e);
        }
        
        // Small delay to avoid rate limiting
        if (i < filesToProcess.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
      
      cleaned.push({
        path,
        content: finalContent,
        cleaned: wasChanged,
        changes: allChanges.length > 0 ? allChanges : undefined,
      });
    }
    
    // Phase 4: Generate polyfills
    setProgressMessage("Phase 3: Génération des polyfills...");
    
    for (const hookName of neededPolyfills) {
      const polyfill = HOOK_POLYFILLS[hookName];
      if (polyfill) {
        cleaned.push({
          path: `src/lib/inopay-compat/${polyfill.filename}`,
          content: polyfill.content,
          cleaned: true,
          changes: ["Polyfill généré"],
        });
        stats.polyfillsGenerated++;
      }
    }
    
    // Generate index.ts for polyfills if any were created
    if (stats.polyfillsGenerated > 0) {
      const exports = neededPolyfills
        .map(name => `export * from './${HOOK_POLYFILLS[name]?.filename.replace('.ts', '')}';`)
        .join('\n');
      
      cleaned.push({
        path: 'src/lib/inopay-compat/index.ts',
        content: `/**
 * Inopay Compatibility Layer
 * Auto-generated polyfills for removed proprietary hooks
 * Generated on: ${new Date().toISOString()}
 */

${exports}
`,
        cleaned: true,
        changes: ["Index polyfills généré"],
      });
    }
    
    setCleanedFiles(cleaned);
    setCleaningStats(stats);
    setCleaningProgress({ done: filesToProcess.length, total: filesToProcess.length });
    setProgressMessage("Nettoyage terminé!");
    
    const totalCleaned = stats.filesCleanedByAI + stats.filesCleanedLocally;
    toast.success(`${totalCleaned} fichiers nettoyés, ${stats.filesRemoved} supprimés`);
    
    setLoading(false);
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
      const dockerfile = `# Dockerfile généré par Inopay - Projet Libéré
# Build: docker build -t ${projectName} .
# Run: docker run -p 80:80 ${projectName}

FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --silent

# Copy source code
COPY . .

# Build for production
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

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

        # SPA routing
        location / {
            try_files $uri $uri/ /index.html;
        }

        # Cache static assets
        location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Gzip compression
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
}
`;
      projectFolder.file("nginx.conf", nginxConf);
      
      // Generate .env.example
      const envExample = generateEnvExample(new Map(cleanedFiles.map(f => [f.path, f.content])));
      projectFolder.file(".env.example", envExample);
      
      // Add README
      const readme = `# ${projectName} - Projet Libéré par Inopay

Ce projet a été **complètement nettoyé** des dépendances propriétaires et est prêt pour un déploiement souverain.

## 📊 Rapport de Nettoyage

| Métrique | Valeur |
|----------|--------|
| Fichiers supprimés | ${cleaningStats.filesRemoved} |
| Fichiers nettoyés (AI) | ${cleaningStats.filesCleanedByAI} |
| Fichiers nettoyés (local) | ${cleaningStats.filesCleanedLocally} |
| Packages supprimés | ${cleaningStats.packagesRemoved} |
| Polyfills générés | ${cleaningStats.polyfillsGenerated} |
| Score initial | ${analysisResult?.score || 0}/100 |
| Score final | 100/100 |

## 🚀 Déploiement Rapide

### Option 1: Docker (Recommandé)

\`\`\`bash
# Build
docker build -t ${projectName} .

# Run
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
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
\`\`\`

### Option 3: Coolify

1. Créez un nouveau projet dans Coolify
2. Choisissez "Docker" comme source
3. Pointez vers votre dépôt GitHub (si vous l'avez poussé)
4. Configurez le domaine
5. Cliquez sur "Deploy"

### Option 4: VPS Manuel

\`\`\`bash
# Installation des dépendances
npm install

# Build de production
npm run build

# Le dossier dist/ contient votre application
# Servez-le avec nginx, caddy, ou un autre serveur web
\`\`\`

## ⚙️ Configuration

Copiez le fichier \`.env.example\` vers \`.env\` et remplissez les valeurs:

\`\`\`bash
cp .env.example .env
\`\`\`

## 🔧 Polyfills Générés

${cleaningStats.polyfillsGenerated > 0 ? `
Les hooks propriétaires ont été remplacés par des polyfills dans \`src/lib/inopay-compat/\`:

\`\`\`typescript
import { useIsMobile } from '@/lib/inopay-compat/use-mobile';
import { useToast } from '@/lib/inopay-compat/use-toast';
\`\`\`
` : 'Aucun polyfill nécessaire.'}

## 📚 Support

- Documentation: https://docs.inopay.app
- Email: support@inopay.app

---

**Libéré avec ❤️ par Inopay** - Votre code, votre serveur, votre liberté.
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
      
      // Show offers after download
      setShowOffers(true);
      
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
            portability_score_after: 100,
            cleaned_dependencies: Array.from(new Set(
              cleanedFiles
                .filter(f => f.changes)
                .flatMap(f => f.changes || [])
                .filter(c => c.includes('Dépendance'))
                .map(c => c.replace('Dépendance supprimée: ', ''))
            )),
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
          Importez votre projet Lovable/Bolt/v0, nous le nettoyons complètement et vous téléchargez un ZIP prêt à déployer.
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
                Collez l'URL de votre dépôt GitHub (Lovable, Bolt, v0, Cursor, Replit)
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                  <div className="text-sm text-muted-foreground">Packages</div>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-destructive">{analysisResult.filesToRemove.length}</div>
                  <div className="text-sm text-muted-foreground">À supprimer</div>
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
              
              {analysisResult.filesToRemove.length > 0 && (
                <Alert variant="destructive">
                  <Trash2 className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{analysisResult.filesToRemove.length}</strong> fichier(s) propriétaire(s) seront supprimés: {analysisResult.filesToRemove.slice(0, 3).join(', ')}
                    {analysisResult.filesToRemove.length > 3 && ` et ${analysisResult.filesToRemove.length - 3} autre(s)`}
                  </AlertDescription>
                </Alert>
              )}
              
              {analysisResult.proprietaryCDNs.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{analysisResult.proprietaryCDNs.length}</strong> CDN propriétaire(s) détecté(s) - les URLs seront nettoyées
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
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5 text-green-500" />}
                {loading ? "Nettoyage en cours..." : "Projet Libéré"}
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
                  <Alert className="bg-green-500/10 border-green-500">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription>
                      Votre projet est maintenant <strong>100% libéré</strong> et prêt à être téléchargé!
                    </AlertDescription>
                  </Alert>
                  
                  {/* Cleaning Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-xl font-bold text-destructive">{cleaningStats.filesRemoved}</div>
                      <div className="text-xs text-muted-foreground">Fichiers supprimés</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-xl font-bold text-primary">{cleaningStats.filesCleanedByAI + cleaningStats.filesCleanedLocally}</div>
                      <div className="text-xs text-muted-foreground">Fichiers nettoyés</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-xl font-bold text-orange-500">{cleaningStats.packagesRemoved}</div>
                      <div className="text-xs text-muted-foreground">Packages supprimés</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-xl font-bold text-blue-500">{cleaningStats.polyfillsGenerated}</div>
                      <div className="text-xs text-muted-foreground">Polyfills générés</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-xl font-bold text-yellow-500">{analysisResult?.score || 0}</div>
                      <div className="text-xs text-muted-foreground">Score initial</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-xl font-bold text-green-500">100</div>
                      <div className="text-xs text-muted-foreground">Score final</div>
                    </div>
                  </div>

                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <h4 className="font-medium">Contenu du ZIP:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>✓ Code source nettoyé ({cleanedFiles.length} fichiers)</li>
                      <li>✓ Dockerfile optimisé avec healthcheck</li>
                      <li>✓ nginx.conf configuré (gzip, cache, SPA)</li>
                      <li>✓ .env.example avec variables détectées</li>
                      <li>✓ README_INOPAY.md avec instructions complètes</li>
                      {cleaningStats.polyfillsGenerated > 0 && (
                        <li>✓ Polyfills de compatibilité (src/lib/inopay-compat/)</li>
                      )}
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

          {/* Post-Liberation Offers - shown after download */}
          {showOffers && !loading && (
            <PostLiberationOffers
              projectName={projectName}
              filesCount={cleanedFiles.length}
              onDismiss={() => setShowOffers(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
