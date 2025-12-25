import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Zap,
  Key,
  FileCode,
  Download
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

interface MigrationProgress {
  currentFile: number;
  totalFiles: number;
  fileName: string;
  status: string;
}

interface SovereignLiberationPipelineProps {
  files?: Map<string, string>;
  projectName?: string;
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
  const [targetSupabaseUrl, setTargetSupabaseUrl] = useState('');
  const [targetSupabaseServiceKey, setTargetSupabaseServiceKey] = useState('');
  const [targetAnonKey, setTargetAnonKey] = useState('');
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [phases, setPhases] = useState<PhaseConfig[]>([
    { 
      id: 'github', 
      label: t('sovereignPipeline.phase1Label'),
      description: t('sovereignPipeline.phase1Desc'),
      icon: <Github className="h-5 w-5" />, 
      status: 'pending' 
    },
    { 
      id: 'supabase', 
      label: t('sovereignPipeline.phase2Label'),
      description: t('sovereignPipeline.phase2Desc'),
      icon: <Database className="h-5 w-5" />, 
      status: 'pending' 
    },
    { 
      id: 'coolify', 
      label: t('sovereignPipeline.phase3Label'),
      description: t('sovereignPipeline.phase3Desc'),
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
      throw new Error(t('sovereignPipeline.sessionExpired'));
    }

    // Build request body based on phase
    const requestBody: Record<string, unknown> = {
      phase: phaseId,
      projectName,
      repoName: 'inopay-sovereign-core',
      serverId,
    };

    if (phaseId === 'github') {
      requestBody.files = filesArray;
    }

    // Add Supabase credentials for phase 2
    if (phaseId === 'supabase') {
      requestBody.targetSupabaseUrl = targetSupabaseUrl;
      requestBody.targetSupabaseServiceKey = targetSupabaseServiceKey;
      requestBody.targetAnonKey = targetAnonKey;
      requestBody.files = filesArray; // Include migration files
      requestBody.secretsToSync = [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'RESEND_API_KEY',
        'DEEPSEEK_API_KEY',
        'GITHUB_PERSONAL_ACCESS_TOKEN'
      ];
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sovereign-liberation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
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
      return { success: false, error: t('sovereignPipeline.invalidResponse'), data: { duration } };
    }

    // Update migration progress for supabase phase
    if (phaseId === 'supabase' && phaseResult.data?.migrations) {
      const migrations = phaseResult.data.migrations as { executed: number; total: number; current: string };
      setMigrationProgress({
        currentFile: migrations.executed,
        totalFiles: migrations.total,
        fileName: migrations.current || '',
        status: 'running'
      });
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

    const filesArray = files ? Array.from(files.entries()).map(([path, content]) => ({ path, content })) : [];
    const pipelineStart = Date.now();

    try {
      // ==================== PHASE 1: GITHUB ====================
      setCurrentPhase(0);
      updatePhase('github', { 
        status: 'running', 
        message: t('sovereignPipeline.cleaningAndPush')
      });

      const githubResult = await runPhase('github', filesArray);
      
      updatePhase('github', {
        status: githubResult.success ? 'success' : 'error',
        message: githubResult.success 
          ? `${t('sovereignPipeline.repoCreated')} (${githubResult.data?.filesCount || 0} files)`
          : githubResult.error,
        data: githubResult.data,
        duration: githubResult.data?.duration as number,
        httpStatus: githubResult.data?.httpStatus as number,
      });

      if (!githubResult.success) {
        setPipelineError(`${t('sovereignPipeline.phase1Failed')}: ${githubResult.error}`);
        toast.error(t('sovereignPipeline.phase1Failed'), { description: githubResult.error });
        setIsRunning(false);
        return;
      }

      toast.success(t('sovereignPipeline.phase1Complete'), { 
        description: `${t('sovereignPipeline.githubRepoCreated')} - HTTP ${githubResult.data?.httpStatus}` 
      });

      // Wait for confirmation before Phase 2
      await new Promise(r => setTimeout(r, 500));

      // ==================== PHASE 2: SUPABASE ====================
      setCurrentPhase(1);
      setMigrationProgress(null);
      
      // Validate credentials
      if (!targetSupabaseUrl || !targetSupabaseServiceKey) {
        setPipelineError(t('sovereignPipeline.credentialsRequiredDesc'));
        toast.error(t('sovereignPipeline.credentialsRequired'), { 
          description: t('sovereignPipeline.credentialsRequiredDesc') 
        });
        setIsRunning(false);
        return;
      }
      
      updatePhase('supabase', { 
        status: 'running', 
        message: t('sovereignPipeline.runningMigrations')
      });

      const supabaseResult = await runPhase('supabase', filesArray);
      
      // Build success message with migration details
      let successMessage = t('sovereignPipeline.supabaseOperational');
      if (supabaseResult.data?.migrations) {
        const m = supabaseResult.data.migrations as { executed: number; skipped: number; failed: number };
        successMessage = `${t('sovereignPipeline.migrationComplete')} - ${t('sovereignPipeline.migrationsExecuted', { executed: m.executed })}`;
        if (m.skipped > 0) {
          successMessage += `, ${t('sovereignPipeline.migrationsSkipped', { skipped: m.skipped })}`;
        }
      }
      
      updatePhase('supabase', {
        status: supabaseResult.success ? 'success' : 'error',
        message: supabaseResult.success 
          ? successMessage
          : supabaseResult.error,
        data: supabaseResult.data,
        duration: supabaseResult.data?.duration as number,
        httpStatus: supabaseResult.data?.httpStatus as number,
      });

      if (!supabaseResult.success) {
        setPipelineError(`${t('sovereignPipeline.phase2Failed')}: ${supabaseResult.error}`);
        toast.error(t('sovereignPipeline.phase2Failed'), { description: supabaseResult.error });
        setIsRunning(false);
        setMigrationProgress(null);
        return;
      }

      setMigrationProgress(null);
      toast.success(t('sovereignPipeline.phase2Complete'), { 
        description: successMessage
      });

      // Wait for confirmation before Phase 3
      await new Promise(r => setTimeout(r, 500));

      // ==================== PHASE 3: COOLIFY ====================
      setCurrentPhase(2);
      updatePhase('coolify', { 
        status: 'running', 
        message: t('sovereignPipeline.deployingVPS')
      });

      const coolifyResult = await runPhase('coolify', []);
      
      updatePhase('coolify', {
        status: coolifyResult.success ? 'success' : 'error',
        message: coolifyResult.success 
          ? coolifyResult.data?.deploymentTriggered 
            ? t('sovereignPipeline.buildTriggered')
            : t('sovereignPipeline.appCreatedManual')
          : coolifyResult.error,
        data: coolifyResult.data,
        duration: coolifyResult.data?.duration as number,
        httpStatus: coolifyResult.data?.httpStatus as number,
      });

      if (!coolifyResult.success) {
        // Phase 3 failure is not blocking - we still have GitHub + Supabase
        toast.warning(t('sovereignPipeline.phase3Partial'), { description: coolifyResult.error });
      } else {
        toast.success(t('sovereignPipeline.phase3Complete'), { 
          description: `${t('sovereignPipeline.coolifyDeployment')} - HTTP ${coolifyResult.data?.httpStatus}` 
        });
      }

      // Pipeline complete
      const totalTime = Date.now() - pipelineStart;
      setTotalDuration(totalTime);

      toast.success(`🎉 ${t('sovereignPipeline.pipelineComplete')}`, {
        description: t('sovereignPipeline.phasesInSeconds', { seconds: (totalTime / 1000).toFixed(1) }),
      });

      onComplete?.(phases);

    } catch (err) {
      const message = err instanceof Error ? err.message : t('sovereignPipeline.unknownError');
      setPipelineError(message);
      toast.error(t('sovereignPipeline.pipelineError'), { description: message });
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
                {t('sovereignPipeline.title')}
                <Badge variant="outline" className="ml-2 border-primary/30">
                  <Shield className="h-3 w-3 mr-1" />
                  3 {t('sovereignPipeline.phases')}
                </Badge>
              </CardTitle>
              <CardDescription>
                {t('sovereignPipeline.description')}
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
        {/* Supabase Credentials Configuration */}
        <div className="p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <div>
                <h4 className="font-semibold">{t('sovereignPipeline.targetSupabaseConfig')}</h4>
                <p className="text-sm text-muted-foreground">{t('sovereignPipeline.targetSupabaseConfigDesc')}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const link = document.createElement('a');
                link.href = '/MASTER_MIGRATION_INOPAY.sql';
                link.download = 'MASTER_MIGRATION_INOPAY.sql';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(t('sovereignPipeline.sqlScriptDownloaded'));
              }}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {t('sovereignPipeline.downloadSqlScript')}
            </Button>
          </div>

          <Alert className="bg-muted/50 border-muted-foreground/20">
            <Database className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {t('sovereignPipeline.sqlScriptInstructions')}
            </AlertDescription>
          </Alert>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="targetSupabaseUrl">{t('sovereignPipeline.targetSupabaseUrl')}</Label>
              <Input
                id="targetSupabaseUrl"
                placeholder={t('sovereignPipeline.targetSupabaseUrlPlaceholder')}
                value={targetSupabaseUrl}
                onChange={(e) => setTargetSupabaseUrl(e.target.value)}
                disabled={isRunning}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetAnonKey">{t('sovereignPipeline.targetAnonKey')}</Label>
              <Input
                id="targetAnonKey"
                type="password"
                placeholder={t('sovereignPipeline.targetAnonKeyPlaceholder')}
                value={targetAnonKey}
                onChange={(e) => setTargetAnonKey(e.target.value)}
                disabled={isRunning}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="targetSupabaseServiceKey">{t('sovereignPipeline.targetSupabaseServiceKey')}</Label>
            <Input
              id="targetSupabaseServiceKey"
              type="password"
              placeholder={t('sovereignPipeline.targetSupabaseServiceKeyPlaceholder')}
              value={targetSupabaseServiceKey}
              onChange={(e) => setTargetSupabaseServiceKey(e.target.value)}
              disabled={isRunning}
            />
          </div>
        </div>

        <Separator />

        {/* Migration Progress Bar (visible during Supabase phase) */}
        {migrationProgress && currentPhase === 1 && (
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary animate-pulse" />
              <span className="font-medium">
                {t('sovereignPipeline.migrationProgress', { 
                  current: migrationProgress.currentFile, 
                  total: migrationProgress.totalFiles 
                })}
              </span>
            </div>
            <Progress 
              value={(migrationProgress.currentFile / migrationProgress.totalFiles) * 100} 
              className="h-2" 
            />
            {migrationProgress.fileName && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('sovereignPipeline.executingMigration', { file: migrationProgress.fileName })}
              </p>
            )}
          </div>
        )}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Play className="h-4 w-4" />
              {t('sovereignPipeline.overallProgress')}
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
                        {t('sovereignPipeline.validated')}
                      </Badge>
                    )}
                    {phase.status === 'error' && (
                      <Badge variant="destructive">{t('sovereignPipeline.failed')}</Badge>
                    )}
                    {phase.status === 'running' && (
                      <Badge variant="secondary" className="animate-pulse">
                        {t('sovereignPipeline.inProgress')}
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
                        {t('sovereignPipeline.view')}
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
            <AlertTitle>{t('sovereignPipeline.pipelineInterrupted')}</AlertTitle>
            <AlertDescription>
              {pipelineError}
              <br />
              <span className="text-sm mt-2 block opacity-80">
                {t('sovereignPipeline.fixAndRelaunch')}
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
                  🎉 {t('sovereignPipeline.sovereignInfraComplete')}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t('sovereignPipeline.phasesSuccessIn', { seconds: (totalDuration / 1000).toFixed(1) })}
                </p>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="p-2 bg-background/50 rounded-lg">
                <Github className="h-4 w-4 mx-auto mb-1" />
                <p className="text-xs font-medium">GitHub</p>
                <p className="text-xs text-muted-foreground">{t('sovereignPipeline.repoCreated')}</p>
              </div>
              <div className="p-2 bg-background/50 rounded-lg">
                <Database className="h-4 w-4 mx-auto mb-1" />
                <p className="text-xs font-medium">Supabase</p>
                <p className="text-xs text-muted-foreground">{t('sovereignPipeline.connected')}</p>
              </div>
              <div className="p-2 bg-background/50 rounded-lg">
                <Server className="h-4 w-4 mx-auto mb-1" />
                <p className="text-xs font-medium">Coolify</p>
                <p className="text-xs text-muted-foreground">{t('sovereignPipeline.deployed')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Standalone mode - no project selected */}
        {!files && (
          <Alert className="border-primary/30 bg-primary/5">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <AlertTitle>{t('sovereignPipeline.noProjectSelected')}</AlertTitle>
            <AlertDescription>
              {t('sovereignPipeline.noProjectSelectedDesc')}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <Button 
            onClick={runPipeline} 
            disabled={isRunning || !files || files.size === 0}
            className="flex-1"
            size="lg"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('sovereignPipeline.phaseProgress', { current: currentPhase + 1 })}
              </>
            ) : phases.some(p => p.status === 'success') ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('sovereignPipeline.relaunchPipeline')}
              </>
            ) : (
              <>
                <Rocket className="h-4 w-4 mr-2" />
                {t('sovereignPipeline.launchPhases')}
              </>
            )}
          </Button>
          
          {onClose && (
            <Button variant="outline" onClick={onClose} disabled={isRunning}>
              {t('sovereignPipeline.close')}
            </Button>
          )}
        </div>

        {/* Info Footer */}
        <p className="text-xs text-muted-foreground text-center pt-2">
          {t('sovereignPipeline.footerInfo')}
        </p>
      </CardContent>
    </Card>
  );
}
