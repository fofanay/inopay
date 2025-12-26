import { motion } from "framer-motion";
import { Shield, Zap, Lock, Award, CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWizard } from "@/contexts/WizardContext";
import { cn } from "@/lib/utils";

const steps = [
  { id: "source", label: "Source", icon: Circle, description: "GitHub" },
  { id: "secrets", label: "Secrets", icon: Lock, description: "Configuration" },
  { id: "cleaning", label: "Nettoyage", icon: Shield, description: "IA" },
  { id: "destination", label: "Infrastructure", icon: Zap, description: "DB & Serveur" },
  { id: "launch", label: "Lancement", icon: Award, description: "Déploiement" },
] as const;

export function LibertyProgressBar() {
  const { state, goToStep, getStepNumber } = useWizard();
  
  const getStepStatus = (stepId: string) => state.stepStatuses[stepId as keyof typeof state.stepStatuses];
  
  const canNavigateToStep = (stepIndex: number) => {
    if (stepIndex === 0) return true;
    const prevStep = steps[stepIndex - 1];
    return getStepStatus(prevStep.id) === "completed";
  };
  
  const currentStepIndex = steps.findIndex(s => s.id === state.currentStep);
  const progressPercent = Math.min(((currentStepIndex + 1) / steps.length) * 100, 100);

  // Calculate liberty score based on completed steps
  const completedSteps = steps.filter(s => getStepStatus(s.id) === "completed").length;
  const libertyScore = Math.round((completedSteps / steps.length) * 100);

  return (
    <div className="space-y-4">
      {/* Header badges */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 bg-primary/10 text-primary border-primary/30">
            <Shield className="h-3 w-3" />
            Niveau de Liberté
          </Badge>
          <motion.span 
            key={libertyScore}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-xl font-bold text-primary"
          >
            {libertyScore}%
          </motion.span>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          Étape {getStepNumber(state.currentStep)} / {steps.length}
        </Badge>
      </div>

      {/* Progress bar with glow effect */}
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-50" />
        <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary to-success rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-border -z-10" />
        
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const isActive = state.currentStep === step.id;
          const isCompleted = status === "completed";
          const isError = status === "error";
          const isAccessible = canNavigateToStep(index);
          
          const Icon = step.icon;
          
          return (
            <motion.button
              key={step.id}
              onClick={() => isAccessible && goToStep(step.id)}
              disabled={!isAccessible}
              className={cn(
                "flex flex-col items-center gap-1.5 relative group",
                isAccessible ? "cursor-pointer" : "cursor-not-allowed opacity-50"
              )}
              whileHover={isAccessible ? { scale: 1.05 } : {}}
              whileTap={isAccessible ? { scale: 0.95 } : {}}
            >
              {/* Step circle */}
              <motion.div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  isCompleted && "bg-success border-success text-success-foreground",
                  isActive && !isCompleted && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/30",
                  isError && "bg-destructive border-destructive text-destructive-foreground",
                  !isCompleted && !isActive && !isError && "bg-background border-muted-foreground/30"
                )}
                animate={isActive ? { 
                  boxShadow: ["0 0 0 0 hsl(var(--primary) / 0.3)", "0 0 0 12px hsl(var(--primary) / 0)", "0 0 0 0 hsl(var(--primary) / 0.3)"]
                } : {}}
                transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isError ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </motion.div>
              
              {/* Label */}
              <div className="flex flex-col items-center">
                <span className={cn(
                  "text-xs font-medium transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {step.label}
                </span>
                <span className="text-[10px] text-muted-foreground/70 hidden md:block">
                  {step.description}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
