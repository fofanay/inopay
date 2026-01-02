import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Upload,
  FileArchive,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  Shield,
  Zap,
  FileCode,
  AlertTriangle,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LogEntry {
  timestamp: Date;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export default function UploadProject() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "ready" | "error">("idle");
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (level: LogEntry["level"], message: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), level, message }]);
  };

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Poll for job status
  useEffect(() => {
    if (!jobId || status === "ready" || status === "error") return;

    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from("liberation_jobs")
          .select("*")
          .eq("id", jobId)
          .single();

        if (error) throw error;

        setProgress(data.progress || 0);

        if (data.status === "audit_ready" || data.status === "completed") {
          addLog("success", "Audit terminé! Redirection...");
          setStatus("ready");
          clearInterval(pollInterval);
          
          setTimeout(() => {
            navigate(`/liberator/audit?id=${jobId}`);
          }, 1500);
        } else if (data.status === "failed") {
          addLog("error", data.error_message || "Une erreur s'est produite");
          setStatus("error");
          clearInterval(pollInterval);
        } else if (data.status === "auditing") {
          addLog("info", `Analyse en cours... ${data.progress}%`);
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId, status, navigate]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const zipFile = acceptedFiles[0];
    if (zipFile) {
      if (!zipFile.name.endsWith('.zip')) {
        toast({
          title: "Format invalide",
          description: "Seuls les fichiers .zip sont acceptés",
          variant: "destructive",
        });
        return;
      }
      setFile(zipFile);
      setLogs([]);
      setStatus("idle");
      setProgress(0);
      addLog("info", `Fichier sélectionné: ${zipFile.name} (${(zipFile.size / 1024 / 1024).toFixed(2)} MB)`);
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/zip': ['.zip'] },
    multiple: false,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  const startLiberation = async () => {
    if (!file) return;

    setUploading(true);
    setStatus("uploading");
    setProgress(0);

    try {
      addLog("info", "Préparation de l'upload...");

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        
        addLog("info", "Envoi vers le serveur...");
        setProgress(20);

        try {
          const { data, error } = await supabase.functions.invoke('process-project-liberation', {
            body: {
              source: 'zip',
              data: base64,
              projectName: file.name.replace('.zip', ''),
            }
          });

          if (error) throw error;

          setJobId(data.jobId);
          setStatus("processing");
          setProgress(40);
          addLog("success", "Upload réussi! Démarrage de l'analyse...");
          addLog("info", `Job ID: ${data.jobId}`);

        } catch (err: any) {
          addLog("error", `Erreur: ${err.message}`);
          setStatus("error");
          toast({
            title: "Erreur",
            description: err.message,
            variant: "destructive",
          });
        }
      };

      reader.readAsDataURL(file);

    } catch (err: any) {
      addLog("error", `Erreur: ${err.message}`);
      setStatus("error");
    } finally {
      setUploading(false);
    }
  };

  const getLogIcon = (level: LogEntry["level"]) => {
    switch (level) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case "error": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Zap className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Libérer un projet</h1>
        <p className="text-muted-foreground mt-1">
          Uploadez votre projet pour démarrer la libération
        </p>
      </div>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload du projet
          </CardTitle>
          <CardDescription>
            Glissez-déposez votre fichier .zip ou cliquez pour parcourir
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 md:p-12 text-center cursor-pointer transition-all",
              isDragActive 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50 hover:bg-muted/50",
              file && "border-primary/50 bg-primary/5"
            )}
          >
            <input {...getInputProps()} />
            
            <AnimatePresence mode="wait">
              {file ? (
                <motion.div
                  key="file"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <FileArchive className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Prêt pour la libération
                  </Badge>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex flex-col items-center gap-4"
                >
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-lg">
                      {isDragActive ? "Déposez le fichier ici" : "Glissez-déposez votre projet"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Format accepté: .zip (max 100MB)
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Action Button */}
          <div className="mt-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>Vos fichiers sont traités localement et ne sont jamais stockés</span>
            </div>
            
            <Button
              size="lg"
              disabled={!file || uploading || status === "processing"}
              onClick={startLiberation}
              className="gap-2 w-full sm:w-auto"
            >
              {uploading || status === "processing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {status === "processing" ? "Analyse en cours..." : "Upload..."}
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Commencer la libération
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress & Logs */}
      <AnimatePresence>
        {logs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-primary" />
                    <CardTitle>Logs de libération</CardTitle>
                  </div>
                  {status === "processing" && (
                    <Badge variant="outline" className="gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      En cours
                    </Badge>
                  )}
                  {status === "ready" && (
                    <Badge variant="default" className="gap-1 bg-primary">
                      <CheckCircle2 className="h-3 w-3" />
                      Terminé
                    </Badge>
                  )}
                </div>
                
                {(status === "uploading" || status === "processing") && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progression</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64 rounded-lg bg-muted/50 p-4">
                  <div className="space-y-2 font-mono text-sm">
                    {logs.map((log, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2"
                      >
                        {getLogIcon(log.level)}
                        <span className="text-muted-foreground">
                          [{log.timestamp.toLocaleTimeString()}]
                        </span>
                        <span className={cn(
                          log.level === "error" && "text-destructive",
                          log.level === "success" && "text-primary",
                          log.level === "warning" && "text-amber-500"
                        )}>
                          {log.message}
                        </span>
                      </motion.div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </ScrollArea>

                {status === "ready" && (
                  <Button
                    className="w-full mt-4 gap-2"
                    onClick={() => navigate(`/liberator/audit?id=${jobId}`)}
                  >
                    Voir les résultats d'audit
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}

                {status === "error" && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => {
                      setFile(null);
                      setLogs([]);
                      setStatus("idle");
                    }}
                  >
                    Réessayer avec un autre fichier
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <FileCode className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Sources compatibles</h3>
            <p className="text-sm text-muted-foreground">
              Lovable, Bolt, Cursor, v0, Replit
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <Zap className="h-8 w-8 text-amber-500 mb-3" />
            <h3 className="font-semibold mb-1">Analyse rapide</h3>
            <p className="text-sm text-muted-foreground">
              ~30 secondes pour un projet moyen
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <Shield className="h-8 w-8 text-emerald-500 mb-3" />
            <h3 className="font-semibold mb-1">100% Souverain</h3>
            <p className="text-sm text-muted-foreground">
              Traitement local, aucune donnée conservée
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
