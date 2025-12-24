import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Sparkles,
  Github,
  Server,
  Globe,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Rocket,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PipelineStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  result?: any;
}

interface LiberationPipelineProps {
  files: Map<string, string>;
  projectName: string;
  projectId?: string;
  onComplete?: (result: LiberationResult) => void;
  onClose?: () => void;
}

interface LiberationResult {
  success: boolean;
  phases: {
    cleaning: {
      success: boolean;
      filesProcessed: number;
      filesCleaned: number;
      totalChanges: number;
    };
    github: {
      success: boolean;
      repoUrl?: string;
      error?: string;
    };
    coolify: {
      success: boolean;
      deploymentUrl?: string;
      error?: string;
    };
  };
}

export function LiberationPipeline({ 
  files, 
  projectName, 
  projectId,
  onComplete,
  onClose 
}: LiberationPipelineProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<PipelineStep[]>([
    { 
      id: 'cleaning', 
      label: 'Nettoyage IA', 
      icon: <Sparkles className="h-5 w-5" />, 
      status: 'pending' 
    },
    { 
      id: 'github', 
      label: 'Push vers GitHub Personnel', 
      icon: <Github className="h-5 w-5" />, 
      status: 'pending' 
    },
    { 
      id: 'build', 
      label: 'Build sur votre VPS', 
      icon: <Server className="h-5 w-5" />, 
      status: 'pending' 
    },
    { 
      id: 'deploy', 
      label: 'Déploiement en ligne', 
      icon: <Globe className="h-5 w-5" />, 
      status: 'pending' 
    },
  ]);
  const [result, setResult] = useState<LiberationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateStepStatus = (stepId: string, status: PipelineStep['status'], message?: string, result?: any) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, message, result } : step
    ));
  };

  const runPipeline = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);

    // Reset all steps
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending', message: undefined })));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session expirée, veuillez vous reconnecter');
      }

      // Step 1: Cleaning
      setCurrentStep(0);
      updateStepStatus('cleaning', 'running', 'Analyse et nettoyage du code...');

      const filesArray = Array.from(files.entries()).map(([path, content]) => ({ path, content }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-project-liberation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            files: filesArray,
            projectName,
            projectId,
            userId: session.user.id,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la libération');
      }

      const data = await response.json() as LiberationResult;
      setResult(data);

      // Update cleaning step
      if (data.phases.cleaning.success) {
        updateStepStatus(
          'cleaning', 
          'success', 
          `${data.phases.cleaning.filesCleaned} fichiers nettoyés, ${data.phases.cleaning.totalChanges} modifications`,
          data.phases.cleaning
        );
      } else {
        updateStepStatus('cleaning', 'error', 'Erreur lors du nettoyage');
        throw new Error('Échec du nettoyage');
      }

      // Step 2: GitHub
      setCurrentStep(1);
      updateStepStatus('github', 'running', 'Push vers votre dépôt GitHub...');
      
      // Simulate a small delay for UX
      await new Promise(resolve => setTimeout(resolve, 500));

      if (data.phases.github.success) {
        updateStepStatus(
          'github', 
          'success', 
          'Code poussé avec succès',
          data.phases.github
        );
      } else {
        updateStepStatus(
          'github', 
          'error', 
          data.phases.github.error || 'Erreur GitHub'
        );
        // Don't throw, continue to show partial results
      }

      // Step 3: Build
      setCurrentStep(2);
      
      if (data.phases.github.success) {
        updateStepStatus('build', 'running', 'Déclenchement du build sur Coolify...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (data.phases.coolify.success) {
          updateStepStatus('build', 'success', 'Build déclenché avec succès');
        } else {
          updateStepStatus('build', 'error', data.phases.coolify.error || 'Erreur de build');
        }
      } else {
        updateStepStatus('build', 'pending', 'En attente de GitHub');
      }

      // Step 4: Deploy
      setCurrentStep(3);
      
      if (data.phases.coolify.success && data.phases.coolify.deploymentUrl) {
        updateStepStatus('deploy', 'running', 'Finalisation du déploiement...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateStepStatus(
          'deploy', 
          'success', 
          'Application en ligne !',
          { url: data.phases.coolify.deploymentUrl }
        );
      } else if (data.phases.github.success) {
        updateStepStatus(
          'deploy', 
          'success', 
          'Prêt pour déploiement manuel',
          { manual: true }
        );
      } else {
        updateStepStatus('deploy', 'pending', 'En attente des étapes précédentes');
      }

      toast.success('Libération terminée !', {
        description: data.phases.github.success 
          ? 'Votre code est maintenant sur votre GitHub personnel'
          : 'Le nettoyage est terminé',
      });

      onComplete?.(data);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(message);
      toast.error('Erreur de libération', { description: message });
      
      // Mark current step as error
      const currentStepId = steps[currentStep]?.id;
      if (currentStepId) {
        updateStepStatus(currentStepId, 'error', message);
      }
    } finally {
      setIsRunning(false);
    }
  };

  const getOverallProgress = () => {
    const completedSteps = steps.filter(s => s.status === 'success').length;
    return (completedSteps / steps.length) * 100;
  };

  const getStepIcon = (step: PipelineStep) => {
    switch (step.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return step.icon;
    }
  };

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Pipeline de Libération
                <Badge variant="secondary" className="ml-2">
                  <Shield className="h-3 w-3 mr-1" />
                  100% Souverain
                </Badge>
              </CardTitle>
              <CardDescription>
                Nettoyage, synchronisation GitHub et déploiement automatisé
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progression globale</span>
            <span className="font-medium">{Math.round(getOverallProgress())}%</span>
          </div>
          <Progress value={getOverallProgress()} className="h-2" />
        </div>

        {/* Pipeline Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                step.status === 'running' ? 'border-primary bg-primary/5' :
                step.status === 'success' ? 'border-green-500/30 bg-green-500/5' :
                step.status === 'error' ? 'border-red-500/30 bg-red-500/5' :
                'border-border bg-muted/30'
              }`}
            >
              <div className={`p-2 rounded-full ${
                step.status === 'running' ? 'bg-primary/20' :
                step.status === 'success' ? 'bg-green-500/20' :
                step.status === 'error' ? 'bg-red-500/20' :
                'bg-muted'
              }`}>
                {getStepIcon(step)}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${
                    step.status === 'pending' ? 'text-muted-foreground' : ''
                  }`}>
                    {step.label}
                  </span>
                  {step.status === 'success' && (
                    <Badge variant="outline" className="text-green-600 border-green-500/30">
                      Terminé
                    </Badge>
                  )}
                  {step.status === 'error' && (
                    <Badge variant="destructive">Erreur</Badge>
                  )}
                </div>
                {step.message && (
                  <p className={`text-sm mt-1 ${
                    step.status === 'error' ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                    {step.message}
                  </p>
                )}
              </div>

              {/* Step result actions */}
              {step.status === 'success' && step.result && (
                <div className="flex items-center gap-2">
                  {step.id === 'github' && step.result.repoUrl && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.open(step.result.repoUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Voir
                    </Button>
                  )}
                  {step.id === 'deploy' && step.result.url && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.open(step.result.url, '_blank')}
                    >
                      <Globe className="h-4 w-4 mr-1" />
                      Ouvrir
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>
              {error}
              <br />
              <span className="text-sm mt-2 block">
                Solution: Vérifiez votre token GitHub dans les paramètres.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Summary */}
        {result && !isRunning && result.phases.cleaning.success && (
          <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <div>
                <h4 className="font-semibold text-green-600">Libération Réussie</h4>
                <p className="text-sm text-muted-foreground">
                  {result.phases.cleaning.filesCleaned} fichiers nettoyés, {result.phases.cleaning.totalChanges} modifications
                </p>
              </div>
            </div>
            
            {result.phases.github.repoUrl && (
              <div className="flex items-center gap-2 mt-3">
                <Github className="h-4 w-4" />
                <a 
                  href={result.phases.github.repoUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  {result.phases.github.repoUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            onClick={runPipeline} 
            disabled={isRunning}
            className="flex-1"
            size="lg"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Libération en cours...
              </>
            ) : result ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Relancer la libération
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Libérer et Déployer
              </>
            )}
          </Button>
          
          {onClose && (
            <Button variant="outline" onClick={onClose} disabled={isRunning}>
              Fermer
            </Button>
          )}
        </div>

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center">
          Ce pipeline nettoie le code, le pousse sur votre GitHub personnel, et déclenche le déploiement sur votre VPS.
          <br />
          Inovaq Canada Inc. - Code 100% Souverain
        </p>
      </CardContent>
    </Card>
  );
}
