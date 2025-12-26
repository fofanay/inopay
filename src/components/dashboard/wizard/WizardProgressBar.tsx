import { Check, FolderInput, Key, Wand2, Server, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useWizard, WizardStep, StepStatus } from "@/contexts/WizardContext";

const steps: { id: WizardStep; label: string; icon: React.ElementType; description: string }[] = [
  { id: "source", label: "Source", icon: FolderInput, description: "Connexion GitHub" },
  { id: "secrets", label: "Secrets", icon: Key, description: "Mapping des clés" },
  { id: "cleaning", label: "Nettoyage", icon: Wand2, description: "Purification IA" },
  { id: "destination", label: "Destination", icon: Server, description: "Configuration cible" },
  { id: "launch", label: "Lancement", icon: Rocket, description: "Déploiement final" },
];

export function WizardProgressBar() {
  const { state, goToStep, getStepNumber } = useWizard();
  const currentStepNum = getStepNumber(state.currentStep);

  const getStepStatus = (stepId: WizardStep): StepStatus => {
    return state.stepStatuses[stepId];
  };

  const canNavigateToStep = (stepIndex: number): boolean => {
    // Can always go back to completed steps
    // Can only go forward if previous step is completed
    if (stepIndex < currentStepNum - 1) return true;
    if (stepIndex === currentStepNum - 1) return true;
    
    // Check if all previous steps are completed
    for (let i = 0; i < stepIndex; i++) {
      if (state.stepStatuses[steps[i].id] !== "completed") {
        return false;
      }
    }
    return true;
  };

  return (
    <div className="w-full mb-8 bg-card border border-border rounded-xl p-6 shadow-sm">
      {/* Security badge */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1.5">
          <Check className="h-3 w-3" />
          Zero-Knowledge
        </Badge>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
          Étape {currentStepNum}/5
        </Badge>
      </div>

      <div className="flex items-center justify-between relative">
        {/* Progress line background */}
        <div className="absolute left-[10%] right-[10%] top-6 h-1 bg-border rounded-full" />
        
        {/* Progress line filled */}
        <div 
          className="absolute left-[10%] top-6 h-1 bg-gradient-to-r from-primary via-success to-success rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${Math.max(0, ((currentStepNum - 1) / (steps.length - 1)) * 80)}%` 
          }}
        />
        
        {steps.map((step, index) => {
          const Icon = step.icon;
          const status = getStepStatus(step.id);
          const isCompleted = status === "completed";
          const isCurrent = step.id === state.currentStep;
          const isError = status === "error";
          const canClick = canNavigateToStep(index);
          
          return (
            <div 
              key={step.id} 
              className={cn(
                "flex flex-col items-center relative z-10 flex-1",
                canClick && "cursor-pointer"
              )}
              onClick={() => canClick && goToStep(step.id)}
            >
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300 bg-card",
                  isCompleted && "bg-gradient-to-br from-primary to-success border-transparent text-primary-foreground shadow-lg shadow-success/20",
                  isCurrent && "border-primary bg-primary/10 text-primary ring-4 ring-primary/20",
                  isError && "border-destructive bg-destructive/10 text-destructive",
                  !isCompleted && !isCurrent && !isError && "border-border bg-muted text-muted-foreground",
                  canClick && !isCurrent && "hover:scale-105"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 animate-in zoom-in duration-300" />
                ) : (
                  <Icon className={cn("h-5 w-5", isCurrent && "animate-pulse")} />
                )}
              </div>
              <div className="mt-3 flex flex-col items-center">
                <span className={cn(
                  "text-xs font-medium uppercase tracking-wide transition-colors",
                  isCompleted && "text-success",
                  isCurrent && "text-primary font-semibold",
                  isError && "text-destructive",
                  !isCompleted && !isCurrent && !isError && "text-muted-foreground"
                )}>
                  Étape {index + 1}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium transition-colors mt-0.5",
                    isCompleted && "text-foreground",
                    isCurrent && "text-foreground font-semibold",
                    !isCompleted && !isCurrent && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                <span className={cn(
                  "text-xs mt-0.5 text-muted-foreground transition-opacity duration-300",
                  isCurrent ? "opacity-100" : "opacity-0"
                )}>
                  {step.description}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
