import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Box,
  CheckCircle2,
  ArrowRight,
  Monitor,
  Server,
  FileCode,
  Package,
  Shield,
  Zap,
  RefreshCw,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BuildStep {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "pending" | "in_progress" | "completed";
  duration?: string;
}

const initialSteps: BuildStep[] = [
  {
    id: "frontend",
    label: "Frontend",
    description: "Compilation React + Vite",
    icon: Monitor,
    status: "pending",
  },
  {
    id: "backend",
    label: "Backend",
    description: "Génération des Edge Functions",
    icon: Server,
    status: "pending",
  },
  {
    id: "dockerfile",
    label: "Dockerfile",
    description: "Création du conteneur optimisé",
    icon: FileCode,
    status: "pending",
  },
  {
    id: "package",
    label: "Package souverain",
    description: "Finalisation de l'archive",
    icon: Package,
    status: "pending",
  },
];

export default function RebuildView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("id");
  
  const [steps, setSteps] = useState<BuildStep[]>(initialSteps);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Simulate build progress
  useEffect(() => {
    const stepDurations = [3000, 4000, 2500, 3500];
    let totalElapsed = 0;

    const runStep = (stepIndex: number) => {
      if (stepIndex >= steps.length) {
        setCompleted(true);
        return;
      }

      setCurrentStep(stepIndex);
      setSteps(prev => prev.map((step, i) => ({
        ...step,
        status: i === stepIndex ? "in_progress" : i < stepIndex ? "completed" : "pending"
      })));

      // Progress animation
      const startProgress = (stepIndex / steps.length) * 100;
      const endProgress = ((stepIndex + 1) / steps.length) * 100;
      const duration = stepDurations[stepIndex];
      const startTime = Date.now();

      const progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const stepProgress = Math.min(elapsed / duration, 1);
        setProgress(startProgress + (endProgress - startProgress) * stepProgress);

        if (elapsed >= duration) {
          clearInterval(progressInterval);
          setSteps(prev => prev.map((step, i) => ({
            ...step,
            status: i <= stepIndex ? "completed" : step.status,
            duration: i === stepIndex ? `${(duration / 1000).toFixed(1)}s` : step.duration
          })));
          runStep(stepIndex + 1);
        }
      }, 50);
    };

    // Start elapsed time counter
    const timeInterval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    // Start build after a short delay
    const timeout = setTimeout(() => runStep(0), 500);

    return () => {
      clearTimeout(timeout);
      clearInterval(timeInterval);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepStatus = (step: BuildStep, index: number) => {
    if (step.status === "completed") {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center"
        >
          <CheckCircle2 className="h-5 w-5 text-primary-foreground" />
        </motion.div>
      );
    }
    if (step.status === "in_progress") {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 text-amber-500 animate-spin" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
        <step.icon className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Box className="h-7 w-7 text-primary" />
            Reconstruction
          </h1>
          <p className="text-muted-foreground mt-1">
            Génération du package souverain
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

      {/* Global Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Progression de la reconstruction</CardTitle>
          <CardDescription>
            Étape {Math.min(currentStep + 1, steps.length)} sur {steps.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {completed ? "Reconstruction terminée" : steps[currentStep]?.label}
            </span>
            <span className="font-bold text-primary">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </CardContent>
      </Card>

      {/* Stepper */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Étapes de reconstruction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "absolute left-5 top-12 w-0.5 h-8 transition-colors duration-500",
                      index < currentStep ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}

                <div
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl transition-all duration-300",
                    step.status === "in_progress" && "bg-amber-500/5 border border-amber-500/20",
                    step.status === "completed" && "bg-primary/5",
                    step.status === "pending" && "opacity-50"
                  )}
                >
                  {getStepStatus(step, index)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{step.label}</span>
                      {step.duration && (
                        <Badge variant="outline" className="text-xs">
                          {step.duration}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </div>

                  {step.status === "completed" && (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  )}
                  {step.status === "in_progress" && (
                    <Badge className="bg-amber-500 text-white">
                      En cours
                    </Badge>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Build Info */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <Monitor className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold mb-1">Frontend optimisé</h3>
            <p className="text-sm text-muted-foreground">
              React 18 + Vite + Tree-shaking
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <Server className="h-8 w-8 text-amber-500 mb-3" />
            <h3 className="font-semibold mb-1">Backend portable</h3>
            <p className="text-sm text-muted-foreground">
              Edge Functions → Express/Fastify
            </p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <Shield className="h-8 w-8 text-emerald-500 mb-3" />
            <h3 className="font-semibold mb-1">100% Souverain</h3>
            <p className="text-sm text-muted-foreground">
              Aucune dépendance externe
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Completion CTA */}
      {completed && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="py-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                    <Package className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Package souverain prêt!</h3>
                    <p className="text-sm text-muted-foreground">
                      Votre projet est maintenant 100% autonome
                    </p>
                  </div>
                </div>
                <Button size="lg" onClick={() => navigate(`/liberator/download?id=${jobId}`)} className="gap-2">
                  Télécharger le package
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
