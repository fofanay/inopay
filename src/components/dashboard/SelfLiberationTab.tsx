import { useState } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LiberationWizard } from './LiberationWizard';
import { LiberationPackHub } from './LiberationPackHub';
import { Rocket } from 'lucide-react';

// Configuration passée du Wizard au PackHub
interface WizardConfig {
  sourceToken: string;
  sourceUrl: string;
  destinationToken: string;
  destinationUsername: string;
  isPrivateRepo: boolean;
  createNewRepo: boolean;
  existingRepoName?: string;
}

interface SelfLiberationTabProps {
  onNavigate?: (tab: string) => void;
}

export function SelfLiberationTab({ onNavigate }: SelfLiberationTabProps) {
  const [wizardComplete, setWizardComplete] = useState(false);
  const [wizardConfig, setWizardConfig] = useState<WizardConfig | null>(null);

  const handleWizardComplete = (config: WizardConfig) => {
    setWizardConfig(config);
    setWizardComplete(true);
  };

  const handleSkipWizard = () => {
    // Si on skip, on passe quand même au PackHub qui chargera les settings existants
    setWizardComplete(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/20">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Libération</CardTitle>
              <CardDescription className="text-base">
                Libérez votre projet vers votre infrastructure souveraine
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Wizard or Pack Hub */}
      {!wizardComplete ? (
        <LiberationWizard 
          onComplete={handleWizardComplete} 
          onSkip={handleSkipWizard}
        />
      ) : (
        <LiberationPackHub initialConfig={wizardConfig} />
      )}
    </div>
  );
}
