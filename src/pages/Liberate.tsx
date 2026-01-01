import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Icons
import {
  Upload,
  Github,
  FileArchive,
  Shield,
  Zap,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  FileCode,
  Package,
  Server,
  Terminal,
  ExternalLink,
  RefreshCw,
  Eye
} from 'lucide-react';

// Liberation scanner
import { LovablePatternScanner, type ScanResult, type ScanIssue } from '@/lib/lovablePatternScanner';
import JSZip from 'jszip';

// Layout
import Layout from '@/components/layout/Layout';

type LiberationStep = 'upload' | 'scanning' | 'report' | 'liberating' | 'complete';

interface LiberationState {
  step: LiberationStep;
  progress: number;
  scanResult: ScanResult | null;
  liberationId: string | null;
  downloadUrl: string | null;
  error: string | null;
}

export default function Liberate() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [state, setState] = useState<LiberationState>({
    step: 'upload',
    progress: 0,
    scanResult: null,
    liberationId: null,
    downloadUrl: null,
    error: null
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [files, setFiles] = useState<Record<string, string>>({});

  // Handle ZIP file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.zip')) {
      toast.error('Veuillez uploader un fichier ZIP');
      return;
    }
    
    setState(prev => ({ ...prev, step: 'scanning', progress: 10 }));
    
    try {
      const zip = await JSZip.loadAsync(file);
      const extractedFiles: Record<string, string> = {};
      
      const filePromises: Promise<void>[] = [];
      let processed = 0;
      const totalFiles = Object.keys(zip.files).length;
      
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          const promise = zipEntry.async('string').then(content => {
            extractedFiles[relativePath] = content;
            processed++;
            setState(prev => ({ 
              ...prev, 
              progress: 10 + Math.round((processed / totalFiles) * 40) 
            }));
          }).catch(() => {
            // Binary file, skip
          });
          filePromises.push(promise);
        }
      });
      
      await Promise.all(filePromises);
      setFiles(extractedFiles);
      
      // Run scanner
      setState(prev => ({ ...prev, progress: 60 }));
      const scanner = new LovablePatternScanner();
      const result = scanner.scanProject(extractedFiles);
      
      setState(prev => ({ 
        ...prev, 
        step: 'report', 
        progress: 100, 
        scanResult: result 
      }));
      
    } catch (err) {
      console.error('Error processing ZIP:', err);
      setState(prev => ({ 
        ...prev, 
        step: 'upload', 
        error: 'Erreur lors du traitement du fichier ZIP' 
      }));
      toast.error('Erreur lors du traitement du fichier');
    }
  }, []);

  // Handle GitHub URL
  const handleGitHubImport = useCallback(async () => {
    if (!githubUrl) {
      toast.error('Veuillez entrer une URL GitHub');
      return;
    }
    
    setState(prev => ({ ...prev, step: 'scanning', progress: 5 }));
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-github-repo', {
        body: { repoUrl: githubUrl }
      });
      
      if (error) throw error;
      
      if (data?.files) {
        setFiles(data.files);
        
        setState(prev => ({ ...prev, progress: 60 }));
        const scanner = new LovablePatternScanner();
        const result = scanner.scanProject(data.files);
        
        setState(prev => ({ 
          ...prev, 
          step: 'report', 
          progress: 100, 
          scanResult: result 
        }));
      }
    } catch (err) {
      console.error('GitHub import error:', err);
      setState(prev => ({ 
        ...prev, 
        step: 'upload', 
        error: 'Erreur lors de l\'import GitHub' 
      }));
      toast.error('Erreur lors de l\'import GitHub');
    }
  }, [githubUrl]);

  // Start liberation process
  const startLiberation = useCallback(async () => {
    if (!state.scanResult || Object.keys(files).length === 0) return;
    
    setState(prev => ({ ...prev, step: 'liberating', progress: 0 }));
    
    try {
      const { data, error } = await supabase.functions.invoke('liberate', {
        body: { 
          source: 'files',
          files,
          options: { 
            cleanCode: true,
            generateDocker: true,
            replaceAI: true
          }
        }
      });
      
      if (error) throw error;
      
      setState(prev => ({ 
        ...prev, 
        liberationId: data.liberationId,
        progress: 10
      }));
      
      // Poll for completion
      pollLiberationStatus(data.liberationId);
      
    } catch (err) {
      console.error('Liberation error:', err);
      setState(prev => ({ 
        ...prev, 
        step: 'report', 
        error: 'Erreur lors de la libération' 
      }));
      toast.error('Erreur lors de la libération');
    }
  }, [state.scanResult, files]);

  // Poll liberation status
  const pollLiberationStatus = useCallback(async (liberationId: string) => {
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('audit', {
          body: { id: liberationId }
        });
        
        if (error) throw error;
        
        if (data.status === 'completed') {
          setState(prev => ({ 
            ...prev, 
            step: 'complete', 
            progress: 100,
            downloadUrl: data.downloadUrl
          }));
          toast.success('Libération terminée !');
        } else if (data.status === 'failed') {
          throw new Error(data.error || 'Liberation failed');
        } else {
          setState(prev => ({ 
            ...prev, 
            progress: Math.min(90, prev.progress + 10)
          }));
          setTimeout(checkStatus, 2000);
        }
      } catch {
        setState(prev => ({ 
          ...prev, 
          step: 'report', 
          error: 'Erreur lors de la libération'
        }));
      }
    };
    
    checkStatus();
  }, []);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => setIsDragging(false);
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  // Reset to start
  const resetLiberation = () => {
    setState({
      step: 'upload',
      progress: 0,
      scanResult: null,
      liberationId: null,
      downloadUrl: null,
      error: null
    });
    setFiles({});
    setGithubUrl('');
  };

  // Severity icon helper
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'major': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'minor': return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
      default: return null;
    }
  };

  // Grade color helper  
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'text-success';
      case 'B': return 'text-primary';
      case 'C': return 'text-warning';
      case 'D': return 'text-orange-500';
      case 'F': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">
              Inopay Liberator
            </h1>
            <p className="text-muted-foreground">
              Libérez votre projet Lovable en un clic
            </p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 px-4">
          {['Upload', 'Analyse', 'Rapport', 'Libération', 'Terminé'].map((label, idx) => {
            const steps: LiberationStep[] = ['upload', 'scanning', 'report', 'liberating', 'complete'];
            const currentIdx = steps.indexOf(state.step);
            const isActive = idx === currentIdx;
            const isDone = idx < currentIdx;
            
            return (
              <div key={label} className="flex items-center">
                <div className={`
                  flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                  ${isDone ? 'bg-primary border-primary text-primary-foreground' : ''}
                  ${isActive ? 'border-primary text-primary' : ''}
                  ${!isDone && !isActive ? 'border-muted text-muted-foreground' : ''}
                `}>
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{idx + 1}</span>
                  )}
                </div>
                <span className={`ml-2 text-sm hidden sm:inline ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
                  {label}
                </span>
                {idx < 4 && (
                  <div className={`w-12 h-0.5 mx-2 ${isDone ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {state.step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Tabs defaultValue="zip" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="zip" className="gap-2">
                    <FileArchive className="h-4 w-4" />
                    Upload ZIP
                  </TabsTrigger>
                  <TabsTrigger value="github" className="gap-2">
                    <Github className="h-4 w-4" />
                    Import GitHub
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="zip">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        Upload votre projet
                      </CardTitle>
                      <CardDescription>
                        Exportez votre projet depuis Lovable et uploadez le fichier ZIP
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`
                          relative border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer
                          ${isDragging ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'}
                        `}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('file-input')?.click()}
                      >
                        <input
                          id="file-input"
                          type="file"
                          accept=".zip"
                          className="hidden"
                          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                        />
                        <FileArchive className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium mb-2">
                          Glissez-déposez votre fichier ZIP ici
                        </p>
                        <p className="text-sm text-muted-foreground">
                          ou cliquez pour sélectionner
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="github">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Github className="h-5 w-5 text-primary" />
                        Import depuis GitHub
                      </CardTitle>
                      <CardDescription>
                        Entrez l'URL de votre repository GitHub
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="github-url">URL du repository</Label>
                        <Input
                          id="github-url"
                          placeholder="https://github.com/username/repo"
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                        />
                      </div>
                      <Button 
                        onClick={handleGitHubImport}
                        disabled={!githubUrl}
                        className="w-full"
                      >
                        <Github className="h-4 w-4 mr-2" />
                        Importer le repository
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
              
              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                <Card className="bg-card/50">
                  <CardContent className="pt-6">
                    <Shield className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold mb-1">Détection Exhaustive</h3>
                    <p className="text-sm text-muted-foreground">
                      Scan complet de tous les patterns Lovable, API et dépendances
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-card/50">
                  <CardContent className="pt-6">
                    <Zap className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold mb-1">Nettoyage Automatique</h3>
                    <p className="text-sm text-muted-foreground">
                      Remplacement intelligent par des alternatives open-source
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-card/50">
                  <CardContent className="pt-6">
                    <Package className="h-8 w-8 text-primary mb-3" />
                    <h3 className="font-semibold mb-1">Package Souverain</h3>
                    <p className="text-sm text-muted-foreground">
                      Docker, scripts de déploiement, 100% auto-hébergeable
                    </p>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {/* Step 2: Scanning */}
          {state.step === 'scanning' && (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center py-12"
            >
              <Loader2 className="h-16 w-16 animate-spin text-primary mb-6" />
              <h2 className="text-2xl font-bold mb-2">Analyse en cours...</h2>
              <p className="text-muted-foreground mb-6">
                Détection des patterns Lovable dans votre projet
              </p>
              <div className="w-full max-w-md">
                <Progress value={state.progress} className="h-2" />
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {state.progress}%
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 3: Report */}
          {state.step === 'report' && state.scanResult && (
            <motion.div
              key="report"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Score Card */}
              <Card className="overflow-hidden">
                <div className="gradient-primary p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-1">Rapport d'Audit</h2>
                      <p className="opacity-90">
                        {state.scanResult.filesScanned} fichiers analysés
                      </p>
                    </div>
                    <div className="text-center">
                      <div className={`text-6xl font-black ${getGradeColor(state.scanResult.grade)}`}>
                        {state.scanResult.grade}
                      </div>
                      <div className="text-sm opacity-90">
                        {state.scanResult.score}/100
                      </div>
                    </div>
                  </div>
                </div>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 rounded-lg bg-destructive/10">
                      <XCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                      <div className="text-2xl font-bold text-destructive">
                        {state.scanResult.summary.critical}
                      </div>
                      <div className="text-sm text-muted-foreground">Critiques</div>
                    </div>
                    <div className="p-4 rounded-lg bg-warning/10">
                      <AlertTriangle className="h-6 w-6 text-warning mx-auto mb-2" />
                      <div className="text-2xl font-bold text-warning">
                        {state.scanResult.summary.major}
                      </div>
                      <div className="text-sm text-muted-foreground">Majeures</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <AlertCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                      <div className="text-2xl font-bold">
                        {state.scanResult.summary.minor}
                      </div>
                      <div className="text-sm text-muted-foreground">Mineures</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Issues List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Détails des problèmes ({state.scanResult.issues.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3">
                      {state.scanResult.issues.map((issue, idx) => (
                        <div 
                          key={issue.id || idx}
                          className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                        >
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                {issue.file}:{issue.line}
                              </code>
                              <Badge variant="outline" className="text-xs">
                                {issue.category}
                              </Badge>
                              {issue.autoFixable && (
                                <Badge variant="secondary" className="text-xs">
                                  Auto-fix
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium truncate">
                              {issue.matchedText}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              💡 {issue.suggestion}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {state.scanResult.issues.length === 0 && (
                        <div className="text-center py-12">
                          <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
                          <p className="font-medium">Aucun pattern Lovable détecté !</p>
                          <p className="text-sm text-muted-foreground">
                            Votre projet est déjà souverain
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-4">
                <Button variant="outline" onClick={resetLiberation}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recommencer
                </Button>
                <Button 
                  className="flex-1"
                  onClick={startLiberation}
                  disabled={state.scanResult.issues.length === 0}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Lancer la Libération
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 4: Liberating */}
          {state.step === 'liberating' && (
            <motion.div
              key="liberating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center py-12"
            >
              <div className="relative mb-6">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <Shield className="h-8 w-8 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Libération en cours...</h2>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Nettoyage du code, remplacement des patterns propriétaires, génération du package souverain
              </p>
              <div className="w-full max-w-md">
                <Progress value={state.progress} className="h-2" />
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {state.progress}%
                </p>
              </div>
              
              {/* Progress steps */}
              <div className="mt-8 space-y-2 text-sm">
                {[
                  { label: 'Suppression patterns Lovable', done: state.progress > 20 },
                  { label: 'Remplacement imports propriétaires', done: state.progress > 40 },
                  { label: 'Génération adaptateur IA', done: state.progress > 60 },
                  { label: 'Création Dockerfile', done: state.progress > 80 },
                  { label: 'Packaging final', done: state.progress === 100 }
                ].map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted" />
                    )}
                    <span className={step.done ? 'text-foreground' : 'text-muted-foreground'}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 5: Complete */}
          {state.step === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="overflow-hidden">
                <div className="bg-success/10 p-8 text-center">
                  <CheckCircle2 className="h-20 w-20 text-success mx-auto mb-4" />
                  <h2 className="text-3xl font-bold mb-2">Libération Terminée !</h2>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Votre projet est maintenant 100% souverain et prêt à être auto-hébergé
                  </p>
                </div>
                <CardContent className="pt-6">
                  {/* Package contents */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <FileCode className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <div className="text-sm font-medium">Code Source</div>
                      <div className="text-xs text-muted-foreground">Nettoyé</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <div className="text-sm font-medium">Dockerfile</div>
                      <div className="text-xs text-muted-foreground">Prêt</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <Server className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <div className="text-sm font-medium">Docker Compose</div>
                      <div className="text-xs text-muted-foreground">Inclus</div>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-muted/50">
                      <Terminal className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <div className="text-sm font-medium">Scripts</div>
                      <div className="text-xs text-muted-foreground">Déploiement</div>
                    </div>
                  </div>
                  
                  {/* Download button */}
                  <div className="flex gap-4">
                    <Button 
                      variant="outline" 
                      onClick={resetLiberation}
                      className="flex-1"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Nouveau projet
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={() => {
                        if (state.downloadUrl) {
                          window.open(state.downloadUrl, '_blank');
                        } else if (state.liberationId) {
                          // Fallback: call download endpoint
                          window.open(
                            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-liberation?id=${state.liberationId}`,
                            '_blank'
                          );
                        }
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger le Package
                    </Button>
                  </div>
                  
                  {/* Next steps */}
                  <div className="mt-6 p-4 rounded-lg border bg-accent/5">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Prochaines étapes
                    </h3>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Décompressez l'archive sur votre serveur</li>
                      <li>Exécutez <code className="bg-muted px-1 rounded">docker-compose up -d</code></li>
                      <li>Configurez vos variables d'environnement</li>
                      <li>Votre app est en ligne ! 🎉</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Display */}
        {state.error && (
          <Card className="mt-6 border-destructive bg-destructive/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-destructive" />
                <p className="text-destructive font-medium">{state.error}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
