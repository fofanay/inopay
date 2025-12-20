import { Check, Cloud, FolderOpen, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export type AnalysisStep = "connecting" | "downloading" | "extracting" | "analyzing" | "complete";

interface AnalysisProgressStepsProps {
  currentStep: AnalysisStep;
  progress: number;
  progressMessage: string;
  fileName: string;
}

const steps = [
  { 
    id: "connecting" as const, 
    label: "Connexion", 
    description: "Connexion au dépôt GitHub...",
    icon: Cloud 
  },
  { 
    id: "downloading" as const, 
    label: "Téléchargement", 
    description: "Récupération des fichiers...",
    icon: Cloud 
  },
  { 
    id: "extracting" as const, 
    label: "Extraction", 
    description: "Extraction des fichiers source...",
    icon: FolderOpen 
  },
  { 
    id: "analyzing" as const, 
    label: "Analyse", 
    description: "Détection des dépendances propriétaires...",
    icon: Search 
  },
];

const stepOrder: AnalysisStep[] = ["connecting", "downloading", "extracting", "analyzing", "complete"];

const getStepIndex = (step: AnalysisStep): number => {
  return stepOrder.indexOf(step);
};

const AnalysisProgressSteps = ({ 
  currentStep, 
  progress, 
  progressMessage,
  fileName 
}: AnalysisProgressStepsProps) => {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="w-full space-y-6">
      {/* Steps indicator */}
      <div className="grid grid-cols-4 gap-2">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const stepIndex = getStepIndex(step.id);
          const isCompleted = stepIndex < currentIndex;
          const isCurrent = step.id === currentStep;
          
          return (
            <div 
              key={step.id}
              className={cn(
                "flex flex-col items-center p-3 rounded-lg transition-all duration-300",
                isCompleted && "bg-success/10",
                isCurrent && "bg-primary/10 ring-2 ring-primary/20",
                !isCompleted && !isCurrent && "bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300",
                  isCompleted && "bg-success text-success-foreground",
                  isCurrent && "bg-primary text-primary-foreground",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : isCurrent ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium mt-2 text-center",
                  isCompleted && "text-success",
                  isCurrent && "text-primary font-semibold",
                  !isCompleted && !isCurrent && "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current step details */}
      <div className="text-center space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground">
            {steps.find(s => s.id === currentStep)?.description || "Traitement en cours..."}
          </h3>
          <p className="text-sm text-muted-foreground">
            {progressMessage || fileName}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-md mx-auto space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progression</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
      </div>

      {/* Estimated time */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <span>Temps estimé : quelques secondes</span>
      </div>
    </div>
  );
};

export default AnalysisProgressSteps;
