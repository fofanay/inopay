import { Check, Github, Search, Sparkles, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProgressProps {
  currentStep: number;
}

const steps = [
  { id: 1, label: "Connexion", icon: Github },
  { id: 2, label: "Choix du projet", icon: Search },
  { id: 3, label: "Nettoyage IA", icon: Sparkles },
  { id: 4, label: "Liberté", icon: Rocket },
];

const StepperProgress = ({ currentStep }: StepperProgressProps) => {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted rounded-full">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>
        
        {steps.map((step) => {
          const Icon = step.icon;
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          
          return (
            <div key={step.id} className="flex flex-col items-center relative z-10">
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "bg-primary/20 border-primary text-primary animate-pulse",
                  !isCompleted && !isCurrent && "bg-muted border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={cn(
                  "mt-2 text-sm font-medium transition-colors",
                  (isCompleted || isCurrent) ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepperProgress;
