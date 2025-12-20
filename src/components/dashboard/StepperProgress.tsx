import { Check, FolderInput, Search, Wand2, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProgressProps {
  currentStep: number;
}

const steps = [
  { id: 1, label: "Source", icon: FolderInput },
  { id: 2, label: "Analyse", icon: Search },
  { id: 3, label: "Nettoyage", icon: Wand2 },
  { id: 4, label: "Export", icon: Download },
];

const StepperProgress = ({ currentStep }: StepperProgressProps) => {
  return (
    <div className="w-full mb-10 bg-card border border-border rounded-xl p-6 card-shadow">
      <div className="flex items-center justify-between relative">
        {/* Progress line background */}
        <div className="absolute left-[10%] right-[10%] top-6 h-1 bg-border rounded-full" />
        
        {/* Progress line filled */}
        <div 
          className="absolute left-[10%] top-6 h-1 bg-info rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${Math.max(0, ((currentStep - 1) / (steps.length - 1)) * 80)}%` 
          }}
        />
        
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          
          return (
            <div key={step.id} className="flex flex-col items-center relative z-10 flex-1">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300 bg-card",
                  isCompleted && "bg-info border-info text-info-foreground",
                  isCurrent && "border-info bg-info/10 text-info",
                  !isCompleted && !isCurrent && "border-border bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div className="mt-3 flex flex-col items-center">
                <span className={cn(
                  "text-xs font-medium uppercase tracking-wide",
                  isCompleted && "text-info",
                  isCurrent && "text-info font-semibold",
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepperProgress;
