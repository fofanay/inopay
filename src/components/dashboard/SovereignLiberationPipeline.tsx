import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Github,
  Database,
  Server,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Rocket,
  Shield,
  Play,
  Clock,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface PhaseConfig {
  id: 'github' | 'supabase' | 'coolify';
  label: string;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  message?: string;
  httpStatus?: number;
  data?: Record<string, unknown>;
  duration?: number;
}

interface SovereignLiberationPipelineProps {
  files: Map<string, string>;
  projectName: string;
  projectId?: string;
  serverId?: string;
  onComplete?: (results: PhaseConfig[]) => void;
  onClose?: () => void;
}

export function SovereignLiberationPipeline({ 
  files, 
  projectName, 
  projectId,
  serverId,
  onComplete,
  onClose 
}: SovereignLiberationPipelineProps) {
  const { t } = useTranslation();
  const [isRunning, setIsRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<number>(-1);
  const [phases, setPhases] = useState<PhaseConfig[]>([
    { 
      id: 'github', 
      label: 'Phase 1 : GitHub',
      description: 'Création du dépôt inopay-sovereign-core',
      icon: <Github className="h-5 w-5" />, 
      status: 'pending' 
    },
    { 
      id: 'supabase', 
      label: 'Phase 2 : Supabase',
      description: 'Connexion et migration du schéma',
      icon: <Database className="h-5 w-5" />, 
      status: 'pending' 
    },
    { 
      id: 'coolify', 
      label: 'Phase 3 : Coolify',
      description: 'Déploiement sur VPS IONOS',
      icon: <Server className="h-5 w-5" />, 
      status: 'pending' 
    },
  ]);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [totalDuration, setTotalDuration] = useState<number>(0);

  const updatePhase = useCallback((
    phaseId: string, 
    updates: Partial<PhaseConfig>
  ) => {
    setPhases(prev => prev.map(phase => 
      phase.id === phaseId ? { ...phase, ...updates } : phase
    ));
  }, []);

  const runPhase = async (
    phaseId: 'github' | 'supabase' | 'coolify',
    filesArray: { path: string; content: string }[]
  ): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> => {
    const startTime = Date.now();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Session expirée');
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sovereign-liberation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          phase: phaseId,
          files: phaseId === 'github' ? filesArray : undefined,
          projectName,
          repoName: 'inopay-sovereign-core',
          serverId,
        }),
      }
    );

    const duration = Date.now() - startTime;
    const result = await response.json();

    if (!response.ok) {
      return { 
        success: false, 
        error: result.error || `HTTP ${response.status}`,
        data: { duration, httpStatus: response.status }
      };
    }

    const phaseResult = result.results?.[0];
    if (!phaseResult) {
      return { success: false, error: 'Réponse invalide', data: { duration } };
    }

    return {
      success: phaseResult.success,
      data: { ...phaseResult.data, duration, httpStatus: phaseResult.httpStatus },
      error: phaseResult.error,
    };
  };

  const runPipeline = async () => {
    setIsRunning(true);
    setPipelineError(null);
    setTotalDuration(0);

    // Reset all phases
    setPhases(prev => prev.map(phase => ({ 
      ...phase, 
      status: 'pending', 
      message: undefined,
      data: undefined,
      duration: undefined,
      httpStatus: undefined,
    })));

    const filesArray = Array.from(files.entries()).map(([path, content]) => ({ path, content }));
    const pipelineStart = Date.now();

    try {
      // ==================== PHASE 1: GITHUB ====================
      setCurrentPhase(0);
      updatePhase('github', { 
        status: 'running', 
        message: 'Nettoyage et push vers GitHub...' 
      });

      const githubResult = await runPhase('github', filesArray);
      
      updatePhase('github', {
        status: githubResult.success ? 'success' : 'error',
        message: githubResult.success 
          ? `Dépôt créé avec ${githubResult.data?.filesCount || 0} fichiers`
          : githubResult.error,
        data: githubResult.data,
        duration: githubResult.data?.duration as number,
        httpStatus: githubResult.data?.httpStatus as number,
      });

      if (!githubResult.success) {
        setPipelineError(`Phase 1 échouée: ${githubResult.error}`);
        toast.error('Phase 1 échouée', { description: githubResult.error });
        setIsRunning(false);
        return;
      }

      toast.success('Phase 1 terminée', { 
        description: `Dépôt GitHub créé - HTTP ${githubResult.data?.httpStatus}` 
      });

      // Wait for confirmation before Phase 2
      await new Promise(r => setTimeout(r, 500));

      // ==================== PHASE 2: SUPABASE ====================
      setCurrentPhase(1);
      updatePhase('supabase', { 
        status: 'running', 
        message: 'Connexion et validation Supabase...' 
      });

      const supabaseResult = await runPhase('supabase', []);
      
      updatePhase('supabase', {
        status: supabaseResult.success ? 'success' : 'error',
        message: supabaseResult.success 
          ? 'Instance Supabase opérationnelle'
          : supabaseResult.error,
        data: supabaseResult.data,
        duration: supabaseResult.data?.duration as number,
        httpStatus: supabaseResult.data?.httpStatus as number,
      });

      if (!supabaseResult.success) {
        setPipelineError(`Phase 2 échouée: ${supabaseResult.error}`);
        toast.error('Phase 2 échouée', { description: supabaseResult.error });
        setIsRunning(false);
        return;
      }

      toast.success('Phase 2 terminée', { 
        description: `Supabase connecté - HTTP ${supabaseResult.data?.httpStatus}` 
      });

      // Wait for confirmation before Phase 3
      await new Promise(r => setTimeout(r, 500));

      // ==================== PHASE 3: COOLIFY ====================
      setCurrentPhase(2);
      updatePhase('coolify', { 
        status: 'running', 
        message: 'Déploiement sur VPS via Coolify...' 
      });

      const coolifyResult = await runPhase('coolify', []);
      
      updatePhase('coolify', {
        status: coolifyResult.success ? 'success' : 'error',
        message: coolifyResult.success 
          ? coolifyResult.data?.deploymentTriggered 
            ? 'Build déclenché sur Coolify'
            : 'Application créée (déploiement manuel)'
          : coolifyResult.error,
        data: coolifyResult.data,
        duration: coolifyResult.data?.duration as number,
        httpStatus: coolifyResult.data?.httpStatus as number,
      });

      if (!coolifyResult.success) {
        // Phase 3 failure is not blocking - we still have GitHub + Supabase
        toast.warning('Phase 3 partielle', { description: coolifyResult.error });
      } else {
        toast.success('Phase 3 terminée', { 
          description: `Déploiement Coolify - HTTP ${coolifyResult.data?.httpStatus}` 
        });
      }

      // Pipeline complete
      const totalTime = Date.now() - pipelineStart;
      setTotalDuration(totalTime);

      toast.success('🎉 Pipeline complet !', {
        description: `3 phases en ${(totalTime / 1000).toFixed(1)}s`,
      });

      onComplete?.(phases);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setPipelineError(message);
      toast.error('Erreur pipeline', { description: message });
    } finally {
      setIsRunning(false);
      setCurrentPhase(-1);
    }
  };

  const getOverallProgress = () => {
    const completed = phases.filter(p => p.status === 'success').length;
    return (completed / phases.length) * 100;
  };

  const getPhaseIcon = (phase: PhaseConfig) => {
    switch (phase.status) {
      case 'running':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'skipped':
        return <Clock className="h-5 w-5 text-muted-foreground" />;
      default:
        return phase.icon;
    }
  };

  const getHttpStatusBadge = (status?: number) => {
    if (!status) return null;
    
    const variant = status >= 200 && status < 300 ? 'default' : 'destructive';
    return (
      <Badge variant={variant} className="text-xs ml-2">
        HTTP {status}
      </Badge>
    );
  };

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-b from-background to-muted/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                Pipeline de Libération Souveraine
                <Badge variant="outline" className="ml-2 border-primary/30">
                  <Shield className="h-3 w-3 mr-1" />
                  3 Phases
                </Badge>
              </CardTitle>
              <CardDescription>
                GitHub → Supabase → Coolify | Exécution séquentielle avec validation
              </CardDescription>
            </div>
          </div>
          {totalDuration > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {(totalDuration / 1000).toFixed(1)}s
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Play className="h-4 w-4" />
              Progression globale
            </span>
            <span className="font-medium">{Math.round(getOverallProgress())}%</span>
          </div>
          <Progress value={getOverallProgress()} className="h-3" />
        </div>

        <Separator />

        {/* Phases */}
        <div className="space-y-4">
          {phases.map((phase, index) => (
            <div 
              key={phase.id}
              className={`relative p-4 rounded-xl border-2 transition-all duration-300 ${
                phase.status === 'running' 
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' 
                  : phase.status === 'success' 
                  ? 'border-green-500/50 bg-green-500/5' 
                  : phase.status === 'error' 
                  ? 'border-destructive/50 bg-destructive/5' 
                  : 'border-border bg-muted/20'
              }`}
            >
              {/* Phase number indicator */}
              <div className={`absolute -left-3 -top-3 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                phase.status === 'success' 
                  ? 'bg-green-500 text-white' 
                  : phase.status === 'error'
                  ? 'bg-destructive text-destructive-foreground'
                  : phase.status === 'running'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {index + 1}
              </div>

              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-lg ${
                  phase.status === 'running' ? 'bg-primary/20' :
                  phase.status === 'success' ? 'bg-green-500/20' :
                  phase.status === 'error' ? 'bg-destructive/20' :
                  'bg-muted'
                }`}>
                  {getPhaseIcon(phase)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold ${
                      phase.status === 'pending' ? 'text-muted-foreground' : ''
                    }`}>
                      {phase.label}
                    </span>
                    {phase.status === 'success' && (
                      <Badge variant="outline" className="text-green-600 border-green-500/30">
                        Validé
                      </Badge>
                    )}
                    {phase.status === 'error' && (
                      <Badge variant="destructive">Échec</Badge>
                    )}
                    {phase.status === 'running' && (
                      <Badge variant="secondary" className="animate-pulse">
                        En cours...
                      </Badge>
                    )}
                    {getHttpStatusBadge(phase.httpStatus)}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {phase.description}
                  </p>
                  
                  {phase.message && (
                    <p className={`text-sm mt-2 ${
                      phase.status === 'error' ? 'text-destructive' : 'text-foreground'
                    }`}>
                      {phase.message}
                    </p>
                  )}

                  {phase.duration && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ⏱ {(phase.duration / 1000).toFixed(2)}s
                    </p>
                  )}
                </div>

                {/* Action buttons for completed phases */}
                {phase.status === 'success' && phase.data && (
                  <div className="flex items-center gap-2">
                    {phase.id === 'github' && phase.data.repoUrl && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.open(phase.data?.repoUrl as string, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Voir
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {pipelineError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Pipeline interrompu</AlertTitle>
            <AlertDescription>
              {pipelineError}
              <br />
              <span className="text-sm mt-2 block opacity-80">
                Corrigez l'erreur et relancez le pipeline.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Summary */}
        {!isRunning && phases.every(p => p.status === 'success') && (
          <div className="bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border border-green-500/30 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <h4 className="font-semibold text-green-600">
                  🎉 Infrastructure Souveraine Complète
                </h4>
                <p className="text-sm text-muted-foreground">
                  Les 3 phases ont été exécutées avec succès en {(totalDuration / 1000).toFixed(1)}s
                </p>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="p-2 bg-background/50 rounded-lg">
                <Github className="h-4 w-4 mx-auto mb-1" />
                <p className="text-xs font-medium">GitHub</p>
                <p className="text-xs text-muted-foreground">Dépôt créé</p>
              </div>
              <div className="p-2 bg-background/50 rounded-lg">
                <Database className="h-4 w-4 mx-auto mb-1" />
                <p className="text-xs font-medium">Supabase</p>
                <p className="text-xs text-muted-foreground">Connecté</p>
              </div>
              <div className="p-2 bg-background/50 rounded-lg">
                <Server className="h-4 w-4 mx-auto mb-1" />
                <p className="text-xs font-medium">Coolify</p>
                <p className="text-xs text-muted-foreground">Déployé</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button 
            onClick={runPipeline} 
            disabled={isRunning || files.size === 0}
            className="flex-1"
            size="lg"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Phase {currentPhase + 1}/3 en cours...
              </>
            ) : phases.some(p => p.status === 'success') ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Relancer le pipeline
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                Lancer les 3 phases
              </>
            )}
          </Button>
          
          {onClose && (
            <Button variant="outline" onClick={onClose} disabled={isRunning}>
              Fermer
            </Button>
          )}
        </div>

        {/* Info Footer */}
        <p className="text-xs text-muted-foreground text-center pt-2">
          Exécution séquentielle isolée • Arrêt automatique en cas d'erreur • 
          Validation HTTP 200/201 requise
        </p>
      </CardContent>
    </Card>
  );
}
