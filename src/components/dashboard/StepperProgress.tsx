import { Check, FolderInput, Search, Wand2, Download, Shield, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StepperProgressProps {
  currentStep: number;
  isSecureMode?: boolean;
}

const steps = [
  { id: 1, label: "Source", icon: FolderInput, description: "Import du projet" },
  { id: 2, label: "Analyse", icon: Search, description: "Détection patterns" },
  { id: 3, label: "Nettoyage", icon: Wand2, description: "Code souverain" },
  { id: 4, label: "Export", icon: Download, description: "Déploiement" },
];

const StepperProgress = ({ currentStep, isSecureMode = true }: StepperProgressProps) => {
  return (
    <div className="w-full mb-10 bg-card border border-border rounded-xl p-6 card-shadow">
      {/* Security badges */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1.5">
          <Shield className="h-3 w-3" />
          Zero-Knowledge
        </Badge>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1.5">
          <Zap className="h-3 w-3" />
          Ultra-Rapide
        </Badge>
      </div>

      <div className="flex items-center justify-between relative">
        {/* Progress line background */}
        <div className="absolute left-[10%] right-[10%] top-6 h-1 bg-border rounded-full" />
        
        {/* Progress line filled with animation */}
        <div 
          className="absolute left-[10%] top-6 h-1 bg-gradient-to-r from-info via-primary to-success rounded-full transition-all duration-700 ease-out"
          style={{ 
            width: `${Math.max(0, ((currentStep - 1) / (steps.length - 1)) * 80)}%` 
          }}
        />
        
        {/* Animated glow effect */}
        {currentStep > 1 && currentStep <= steps.length && (
          <div 
            className="absolute top-6 h-1 bg-primary/50 rounded-full blur-sm animate-pulse"
            style={{ 
              left: `${10 + ((currentStep - 2) / (steps.length - 1)) * 80}%`,
              width: `${80 / (steps.length - 1)}%`
            }}
          />
        )}
        
        {steps.map((step) => {
          const Icon = step.icon;
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          
          return (
            <div key={step.id} className="flex flex-col items-center relative z-10 flex-1">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-500 bg-card",
                  isCompleted && "bg-gradient-to-br from-info to-success border-transparent text-white shadow-lg shadow-success/20",
                  isCurrent && "border-primary bg-primary/10 text-primary animate-pulse shadow-lg shadow-primary/20",
                  !isCompleted && !isCurrent && "border-border bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 animate-in zoom-in duration-300" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="mt-3 flex flex-col items-center">
                <span className={cn(
                  "text-xs font-medium uppercase tracking-wide transition-colors duration-300",
                  isCompleted && "text-success",
                  isCurrent && "text-primary font-semibold",
                  !isCompleted && !isCurrent && "text-muted-foreground"
                )}>
                  Étape {step.id}
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
                  "text-xs mt-0.5 transition-opacity duration-300",
                  isCurrent ? "text-muted-foreground opacity-100" : "opacity-0"
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
};

export default StepperProgress;
