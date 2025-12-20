import { Check, Plug, Radar, Wand2, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepperProgressProps {
  currentStep: number;
}

const steps = [
  { id: 1, label: "Connexion", icon: Plug, color: "text-info" },
  { id: 2, label: "Choix du projet", icon: Radar, color: "text-accent" },
  { id: 3, label: "Nettoyage IA", icon: Wand2, color: "text-warning" },
  { id: 4, label: "Liberté", icon: Rocket, color: "text-success" },
];

const StepperProgress = ({ currentStep }: StepperProgressProps) => {
  return (
    <div className="w-full mb-10 px-4">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute left-0 top-6 w-full h-0.5 bg-border">
          <div 
            className="h-full bg-primary transition-all duration-500 ease-out"
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
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-300 bg-card",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-primary bg-primary/10",
                  !isCompleted && !isCurrent && "border-border text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Icon className={cn("h-5 w-5", isCurrent ? step.color : "")} />
                )}
              </div>
              <span
                className={cn(
                  "mt-3 text-sm font-medium transition-colors text-center",
                  isCompleted && "text-primary",
                  isCurrent && "text-foreground font-semibold",
                  !isCompleted && !isCurrent && "text-muted-foreground"
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
