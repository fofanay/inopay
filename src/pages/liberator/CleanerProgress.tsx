import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  CheckCircle2,
  FileCode,
  ArrowRight,
  Zap,
  RefreshCw,
  Eye,
  Terminal,
  Clock,
  FileCheck,
  FileMinus,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CleaningStep {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed";
  filesProcessed?: number;
}

interface ModifiedFile {
  path: string;
  linesRemoved: number;
  patternsRemoved: string[];
  before: string;
  after: string;
}

const mockSteps: CleaningStep[] = [
  { id: "scan", label: "Analyse des fichiers", status: "completed", filesProcessed: 156 },
  { id: "detect", label: "Détection des patterns", status: "completed", filesProcessed: 24 },
  { id: "clean", label: "Nettoyage du code", status: "in_progress", filesProcessed: 18 },
  { id: "validate", label: "Validation TypeScript", status: "pending" },
  { id: "optimize", label: "Optimisation finale", status: "pending" },
];

const mockModifiedFiles: ModifiedFile[] = [
  {
    path: "src/integrations/supabase/client.ts",
    linesRemoved: 12,
    patternsRemoved: ["lovable-tagger", "GPTEngineer tracking"],
    before: `import { lovableTagging } from 'lovable-tagger';\n\n// Lovable auto-generated code\nconst client = createClient(...);\nlovableTagging.init();`,
    after: `const client = createClient(...);\n\n// Sovereign version - no tracking`,
  },
  {
    path: "src/App.tsx",
    linesRemoved: 8,
    patternsRemoved: ["analytics tracking", "telemetry"],
    before: `import { Analytics } from '@lovable/analytics';\n\nfunction App() {\n  useEffect(() => {\n    Analytics.track('page_view');\n  }, []);\n}`,
    after: `function App() {\n  // Clean sovereign version\n}`,
  },
  {
    path: "package.json",
    linesRemoved: 4,
    patternsRemoved: ["lovable-tagger", "@lovable/ui"],
    before: `"dependencies": {\n  "lovable-tagger": "^1.0.0",\n  "@lovable/ui": "^2.0.0"\n}`,
    after: `"dependencies": {\n  // Proprietary packages removed\n}`,
  },
];

export default function CleanerProgress() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("id");
  
  const [steps, setSteps] = useState(mockSteps);
  const [progress, setProgress] = useState(45);
  const [modifiedFiles, setModifiedFiles] = useState<ModifiedFile[]>(mockModifiedFiles);
  const [logs, setLogs] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Simulate cleaning progress
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setCompleted(true);
          return 100;
        }
        return prev + Math.random() * 5;
      });

      setElapsedTime(prev => prev + 1);

      // Add random logs
      const logMessages = [
        "Analysing src/components/...",
        "Removing proprietary patterns...",
        "Cleaning imports...",
        "Validating TypeScript...",
        "Optimizing bundle...",
      ];
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${logMessages[Math.floor(Math.random() * logMessages.length)]}`]);
    }, 800);

    return () => clearInterval(interval);
  }, []);

  // Update steps based on progress
  useEffect(() => {
    setSteps(prev => prev.map((step, index) => {
      const thresholds = [20, 40, 60, 80, 100];
      if (progress >= thresholds[index]) {
        return { ...step, status: "completed" };
      } else if (progress >= thresholds[index] - 20) {
        return { ...step, status: "in_progress" };
      }
      return { ...step, status: "pending" };
    }));
  }, [progress]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepIcon = (status: CleaningStep["status"]) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-5 w-5 text-primary" />;
      case "in_progress": return <RefreshCw className="h-5 w-5 text-amber-500 animate-spin" />;
      default: return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Nettoyage en cours
          </h1>
          <p className="text-muted-foreground mt-1">
            Suppression des patterns propriétaires
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(elapsedTime)}
          </Badge>
          {completed && (
            <Badge className="gap-1 bg-primary">
              <CheckCircle2 className="h-3 w-3" />
              Terminé
            </Badge>
          )}
        </div>
      </div>

      {/* Main Progress Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Progression globale</CardTitle>
              <CardDescription>
                {Math.round(progress)}% complété
              </CardDescription>
            </div>
            <div className="text-3xl font-bold text-primary">
              {Math.round(progress)}%
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-3 mb-6" />
          
          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-lg transition-colors",
                  step.status === "in_progress" && "bg-amber-500/5 border border-amber-500/20",
                  step.status === "completed" && "bg-primary/5"
                )}
              >
                {getStepIcon(step.status)}
                <div className="flex-1">
                  <div className="font-medium">{step.label}</div>
                  {step.filesProcessed && (
                    <div className="text-sm text-muted-foreground">
                      {step.filesProcessed} fichiers traités
                    </div>
                  )}
                </div>
                {step.status === "completed" && (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                )}
                {step.status === "in_progress" && (
                  <Badge variant="outline" className="text-amber-500">
                    En cours
                  </Badge>
                )}
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Modified Files */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Fichiers modifiés
                </CardTitle>
                <CardDescription>
                  {modifiedFiles.length} fichiers nettoyés
                </CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Eye className="h-4 w-4" />
                    Voir les changements
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Changements détaillés</DialogTitle>
                  </DialogHeader>
                  <Tabs defaultValue={modifiedFiles[0]?.path} className="mt-4">
                    <TabsList className="w-full justify-start overflow-x-auto">
                      {modifiedFiles.map(file => (
                        <TabsTrigger key={file.path} value={file.path} className="text-xs">
                          {file.path.split('/').pop()}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {modifiedFiles.map(file => (
                      <TabsContent key={file.path} value={file.path}>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium text-destructive mb-2">Avant</div>
                            <pre className="p-4 bg-destructive/5 rounded-lg text-xs overflow-auto max-h-64">
                              {file.before}
                            </pre>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-primary mb-2">Après</div>
                            <pre className="p-4 bg-primary/5 rounded-lg text-xs overflow-auto max-h-64">
                              {file.after}
                            </pre>
                          </div>
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {modifiedFiles.map((file, index) => (
                  <motion.div
                    key={file.path}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCode className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-sm truncate">{file.path}</span>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        <FileMinus className="h-3 w-3 mr-1" />
                        -{file.linesRemoved}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {file.patternsRemoved.map(pattern => (
                        <Badge key={pattern} variant="secondary" className="text-xs">
                          {pattern}
                        </Badge>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Real-time Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              Logs temps réel
            </CardTitle>
            <CardDescription>
              Suivi détaillé des opérations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 bg-card border rounded-lg p-3">
              <div className="font-mono text-xs space-y-1">
                {logs.slice(-20).map((log, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground"
                  >
                    {log}
                  </motion.div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
              <CardContent className="py-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                      <Shield className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Nettoyage terminé!</h3>
                      <p className="text-sm text-muted-foreground">
                        {modifiedFiles.length} fichiers nettoyés • {modifiedFiles.reduce((acc, f) => acc + f.linesRemoved, 0)} lignes supprimées
                      </p>
                    </div>
                  </div>
                  <Button size="lg" onClick={() => navigate(`/liberator/rebuild?id=${jobId}`)} className="gap-2">
                    Continuer vers la reconstruction
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
