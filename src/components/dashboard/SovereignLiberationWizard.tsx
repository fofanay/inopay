import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { X, Shield, Zap, Lock, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { WizardProvider, useWizard } from "@/contexts/WizardContext";
import { WizardProgressBar } from "./wizard/WizardProgressBar";
import { StepSource } from "./wizard/StepSource";
import { CleaningConsole } from "./wizard/CleaningConsole";
import { StepDestination } from "./wizard/StepDestination";
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
      case "cleaning":
        return <CleaningConsole />;
      case "destination":
        return <StepDestination />;
      case "launch":
        return <StepLaunch />;
      default:
        return <StepSource />;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Wizard de Libération
          </h1>
          <p className="text-muted-foreground">
            Du prototype à la production souveraine en 4 étapes
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

      {/* Progress bar */}
      <WizardProgressBar />

      {/* Current step content */}
      <div className="min-h-[400px]">
        {renderStep()}
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
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
      </div>
    </div>
  );
}

export function SovereignLiberationWizard({ onClose }: SovereignLiberationWizardProps) {
  return (
    <WizardProvider>
      <WizardContent onClose={onClose} />
    </WizardProvider>
  );
}
