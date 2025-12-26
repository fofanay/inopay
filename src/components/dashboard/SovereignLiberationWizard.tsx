import { motion, AnimatePresence } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { X, Shield, Zap, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { WizardProvider, useWizard } from "@/contexts/WizardContext";
import { LibertyProgressBar } from "./wizard/LibertyProgressBar";
import { StepSource } from "./wizard/StepSource";
import { StepSecrets } from "./wizard/StepSecrets";
import { CleaningConsole } from "./wizard/CleaningConsole";
import { InfrastructureStep } from "./wizard/InfrastructureStep";
import { StepLaunch } from "./wizard/StepLaunch";

interface SovereignLiberationWizardProps {
  onClose?: () => void;
}

function WizardContent({ onClose }: SovereignLiberationWizardProps) {
  const { state, reset } = useWizard();

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const renderStep = () => {
    switch (state.currentStep) {
      case "source":
        return <StepSource />;
      case "secrets":
        return <StepSecrets />;
      case "cleaning":
        return <CleaningConsole />;
      case "destination":
        return <InfrastructureStep />;
      case "launch":
        return <StepLaunch />;
      default:
        return <StepSource />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      {/* Header - Dark theme styling */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Wizard de Libération Souveraine
          </h1>
          <p className="text-muted-foreground">
            Du prototype à la production 100% souveraine en 5 étapes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 bg-success/10 text-success border-success/30">
            <Lock className="h-3 w-3" />
            Zero-Knowledge
          </Badge>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar with Liberty Score */}
      <LibertyProgressBar />

      {/* Current step content with animations */}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="min-h-[400px]"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* Footer info */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-center gap-6 text-sm text-muted-foreground"
      >
        <div className="flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-success" />
          <span>Vos données restent locales</span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-primary" />
          <span>Aucune dépendance Inopay</span>
        </div>
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-1.5">
          <Lock className="h-4 w-4 text-info" />
          <span>100% souverain</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function SovereignLiberationWizard({ onClose }: SovereignLiberationWizardProps) {
  return (
    <WizardProvider>
      <WizardContent onClose={onClose} />
    </WizardProvider>
  );
}
