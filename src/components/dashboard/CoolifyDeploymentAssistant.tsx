import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  Server, 
  GitBranch, 
  Settings, 
  Rocket,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  Play,
  XCircle,
  Clock,
  Terminal,
  FileCode,
  Eye,
  Trash2,
  Bug,
  GitCompare
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { CoolifyDeploymentErrorHandler } from './CoolifyDeploymentErrorHandler';

interface Server {
  id: string;
  name: string;
  ip_address: string;
  coolify_url: string | null;
  coolify_token: string | null;
  status: string;
}

interface DeploymentStep {
  step: string;
  status: 'success' | 'error' | 'pending';
  message: string;
}

interface PreDeployCheck {
  ready: boolean;
  actions_taken: string[];
  commit_sha: string;
  branch: string;
  warnings: string[];
  blocking_errors: string[];
  dockerfile_status: string;
  dockerfile_proof?: {
    raw_content?: string;
    copy_package_line?: number;
    npm_install_line?: number;
    is_valid: boolean;
  };
  github_info?: {
    owner: string;
    repo: string;
    has_write_permission: boolean;
    permission_level?: string;
    dockerfile_fetched: boolean;
    dockerfile_raw?: string;
  };
  checks: {
    coolify_connection: boolean;
    github_access: boolean;
    github_write_permission?: boolean;
    package_json: boolean;
    dockerfile: boolean;
    dockerfile_verified?: boolean;
    env_vars: boolean;
  };
}

interface DeploymentStatus {
  status: 'queued' | 'in_progress' | 'building' | 'finished' | 'failed' | 'unknown';
  logs: string;
  deployed_url: string | null;
  duration_seconds: number | null;
  error_message: string | null;
}

type WizardStep = 'server' | 'preflight' | 'repo' | 'config' | 'deploy';

interface CoolifyDeploymentAssistantProps {
  onComplete?: (deploymentId: string) => void;
}

export function CoolifyDeploymentAssistant({ onComplete }: CoolifyDeploymentAssistantProps) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState<WizardStep>('server');
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionTested, setConnectionTested] = useState(false);
  
  // Repo config
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [domain, setDomain] = useState('');
  const [gitBranch, setGitBranch] = useState('');
  
  // Pre-flight check state
  const [preflightCheck, setPreflightCheck] = useState<PreDeployCheck | null>(null);
  const [isRunningPreflight, setIsRunningPreflight] = useState(false);
  
  // Supabase env vars
  const [supabaseUrl, setSupabaseUrl] = useState(import.meta.env.VITE_SUPABASE_URL || '');
  const [supabaseKey, setSupabaseKey] = useState(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '');
  
  // Deployment state
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([]);
  const [deploymentResult, setDeploymentResult] = useState<{
    app_uuid?: string;
    deployment_uuid?: string;
    deployment_id?: string;
  } | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showDockerfile, setShowDockerfile] = useState(false);
  const [forceNoCache, setForceNoCache] = useState(true);
  
  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);
  const [apiLogs, setApiLogs] = useState<{ timestamp: string; method: string; url: string; status?: number; duration?: number }[]>([]);
  const [isPurgingCache, setIsPurgingCache] = useState(false);
  const [dockerfileComparison, setDockerfileComparison] = useState<{
    github_content: string | null;
    coolify_content: string | null;
    is_synced: boolean;
    differences: string[];
  } | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [skipDockerfileFix, setSkipDockerfileFix] = useState(false);
  // Load servers on mount
  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_servers')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'ready');

      if (error) throw error;
      setServers(data || []);
    } catch (error) {
      console.error('Error loading servers:', error);
      toast.error('Erreur lors du chargement des serveurs');
    }
  };

  const testCoolifyConnection = async () => {
    if (!selectedServer) return;
    
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      const response = await supabase.functions.invoke('test-coolify-connection', {
        body: {
          coolify_url: selectedServer.coolify_url,
          coolify_token: selectedServer.coolify_token
        }
      });

      if (response.error) throw response.error;
      
      if (response.data?.success) {
        setConnectionTested(true);
        toast.success(`Connexion Coolify OK - ${response.data.app_count || 0} apps`);
      } else {
        throw new Error(response.data?.error || 'Connexion échouée');
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      toast.error(`Connexion échouée: ${error instanceof Error ? error.message : 'Erreur'}`);
      setConnectionTested(false);
    } finally {
      setIsLoading(false);
    }
  };

  const extractProjectName = (url: string): string => {
    const match = url.match(/github\.com\/[^/]+\/([^/.#?]+)/i);
    return match ? match[1] : '';
  };

  const handleRepoUrlChange = (url: string) => {
    setGithubRepoUrl(url);
    setPreflightCheck(null);
    if (!projectName) {
      setProjectName(extractProjectName(url));
    }
  };

  // Run pre-flight checks
  const runPreflightCheck = async () => {
    if (!selectedServer || !githubRepoUrl) {
      toast.error('Serveur et URL GitHub requis');
      return;
    }

    setIsRunningPreflight(true);
    setPreflightCheck(null);

    try {
      const response = await supabase.functions.invoke('pre-deploy-check', {
        body: {
          server_id: selectedServer.id,
          github_repo_url: githubRepoUrl,
          project_name: projectName,
          auto_fix: true,
          skip_dockerfile_fix: skipDockerfileFix
        }
      });

      if (response.error) throw response.error;

      const data = response.data as PreDeployCheck;
      setPreflightCheck(data);
      
      if (data.branch) {
        setGitBranch(data.branch);
      }

      if (data.ready) {
        toast.success('Vérifications passées avec succès!');
        if (data.actions_taken.length > 0) {
          toast.info(`Actions effectuées: ${data.actions_taken.join(', ')}`);
        }
      } else {
        toast.error(`Problèmes détectés: ${data.blocking_errors.length} erreurs bloquantes`);
      }
    } catch (error) {
      console.error('Preflight check error:', error);
      toast.error('Erreur lors des vérifications');
      setPreflightCheck({
        ready: false,
        actions_taken: [],
        commit_sha: '',
        branch: 'main',
        warnings: [],
        blocking_errors: [error instanceof Error ? error.message : 'Erreur inconnue'],
        dockerfile_status: 'missing',
        checks: {
          coolify_connection: false,
          github_access: false,
          package_json: false,
          dockerfile: false,
          env_vars: false
        }
      });
    } finally {
      setIsRunningPreflight(false);
    }
  };

  // Compare Dockerfiles between GitHub and Coolify
  const compareDockerfiles = async () => {
    if (!selectedServer || !githubRepoUrl) {
      toast.error('Serveur et URL GitHub requis');
      return;
    }

    setIsComparing(true);
    try {
      const startTime = Date.now();
      const response = await supabase.functions.invoke('compare-dockerfile', {
        body: {
          server_id: selectedServer.id,
          github_repo_url: githubRepoUrl,
          coolify_app_uuid: deploymentResult?.app_uuid
        }
      });

      if (debugMode) {
        setApiLogs(prev => [...prev, {
          timestamp: new Date().toISOString(),
          method: 'POST',
          url: '/functions/v1/compare-dockerfile',
          status: response.error ? 500 : 200,
          duration: Date.now() - startTime
        }]);
      }

      if (response.error) throw response.error;

      setDockerfileComparison(response.data);
      
      if (response.data.is_synced) {
        toast.success('Dockerfiles synchronisés ✓');
      } else {
        toast.warning('Désynchronisation détectée!');
      }
    } catch (error) {
      console.error('Compare error:', error);
      toast.error('Erreur lors de la comparaison');
    } finally {
      setIsComparing(false);
    }
  };

  // Purge Coolify cache
  const purgeCoolifyCache = async () => {
    if (!selectedServer) {
      toast.error('Serveur requis');
      return;
    }

    setIsPurgingCache(true);
    try {
      const startTime = Date.now();
      const response = await supabase.functions.invoke('purge-coolify-cache', {
        body: {
          server_id: selectedServer.id,
          coolify_app_uuid: deploymentResult?.app_uuid
        }
      });

      if (debugMode) {
        setApiLogs(prev => [...prev, {
          timestamp: new Date().toISOString(),
          method: 'POST',
          url: '/functions/v1/purge-coolify-cache',
          status: response.error ? 500 : 200,
          duration: Date.now() - startTime
        }]);
      }

      if (response.error) throw response.error;

      const data = response.data;
      if (data.actions_taken?.length > 0) {
        toast.success(`Cache purgé: ${data.actions_taken.join(', ')}`);
      } else {
        toast.info('Purge manuelle requise. Commandes SSH affichées.');
      }

      // Show manual commands
      if (data.manual_commands) {
        console.log('Commandes SSH pour purge manuelle:', data.manual_commands);
      }
    } catch (error) {
      console.error('Purge error:', error);
      toast.error('Erreur lors de la purge du cache');
    } finally {
      setIsPurgingCache(false);
    }
  };

  // Poll deployment status
  const pollDeploymentStatus = useCallback(async (appUuid: string, deploymentUuid?: string) => {
    if (!selectedServer) return;

    try {
      const response = await supabase.functions.invoke('check-deployment-status', {
        body: {
          server_id: selectedServer.id,
          app_uuid: appUuid,
          deployment_uuid: deploymentUuid
        }
      });

      if (response.error) throw response.error;

      const status = response.data as DeploymentStatus;
      setDeploymentStatus(status);

      // Continue polling if not finished
      if (status.status === 'queued' || status.status === 'in_progress' || status.status === 'building') {
        setTimeout(() => pollDeploymentStatus(appUuid, deploymentUuid), 5000);
      } else {
        setIsPolling(false);
        if (status.status === 'finished') {
          toast.success('Déploiement terminé avec succès!');
        } else if (status.status === 'failed') {
          toast.error('Déploiement échoué');
        }
      }
    } catch (error) {
      console.error('Status polling error:', error);
      setIsPolling(false);
    }
  }, [selectedServer]);

  const startDeployment = async () => {
    if (!selectedServer || !githubRepoUrl || !projectName) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    if (!preflightCheck?.ready) {
      toast.error('Veuillez effectuer les vérifications pré-déploiement');
      return;
    }

    setIsLoading(true);
    setDeploymentError(null);
    setDeploymentSteps([]);
    setDeploymentStatus(null);
    setCurrentStep('deploy');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      // Build env vars
      const envVars: Record<string, string> = {};
      if (supabaseUrl) envVars['VITE_SUPABASE_URL'] = supabaseUrl;
      if (supabaseKey) {
        envVars['VITE_SUPABASE_PUBLISHABLE_KEY'] = supabaseKey;
        envVars['VITE_SUPABASE_ANON_KEY'] = supabaseKey;
      }
      envVars['NODE_ENV'] = 'production';

      const response = await supabase.functions.invoke('auto-configure-coolify-app', {
        body: {
          server_id: selectedServer.id,
          project_name: projectName,
          github_repo_url: githubRepoUrl,
          git_branch: preflightCheck.branch || gitBranch || 'main',
          git_commit_sha: preflightCheck.commit_sha || undefined,
          domain: domain || null,
          env_vars: envVars,
          auto_deploy: true,
          force_rebuild: true,
          force_no_cache: forceNoCache,
          skip_pre_check: true
        }
      });

      if (response.error) throw response.error;

      const data = response.data;
      
      if (data.steps) {
        setDeploymentSteps(data.steps);
      }

      if (data.success) {
        setDeploymentResult({
          app_uuid: data.app_uuid,
          deployment_uuid: data.deployment_uuid,
          deployment_id: data.deployment_id
        });
        toast.success('Déploiement lancé avec succès!');
        
        // Start polling for status
        if (data.app_uuid) {
          setIsPolling(true);
          pollDeploymentStatus(data.app_uuid, data.deployment_uuid);
        }
        
        if (data.deployment_id && onComplete) {
          onComplete(data.deployment_id);
        }
      } else {
        throw new Error(data.error || 'Déploiement échoué');
      }
    } catch (error) {
      console.error('Deployment error:', error);
      setDeploymentError(error instanceof Error ? error.message : 'Erreur inconnue');
      toast.error('Erreur lors du déploiement');
    } finally {
      setIsLoading(false);
    }
  };

  const wizardSteps = [
    { id: 'server' as WizardStep, label: 'Serveur', icon: Server },
    { id: 'preflight' as WizardStep, label: 'Vérifications', icon: ShieldCheck },
    { id: 'repo' as WizardStep, label: 'Repository', icon: GitBranch },
    { id: 'config' as WizardStep, label: 'Config', icon: Settings },
    { id: 'deploy' as WizardStep, label: 'Déploiement', icon: Rocket }
  ];

  const getStepIndex = (step: WizardStep) => wizardSteps.findIndex(s => s.id === step);
  const currentStepIndex = getStepIndex(currentStep);
  const progress = ((currentStepIndex + 1) / wizardSteps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 'server':
        return selectedServer && connectionTested;
      case 'preflight':
        return preflightCheck?.ready;
      case 'repo':
        return githubRepoUrl && projectName;
      case 'config':
        return true;
      default:
        return false;
    }
  };

  const nextStep = () => {
    const idx = currentStepIndex;
    if (idx < wizardSteps.length - 1) {
      setCurrentStep(wizardSteps[idx + 1].id);
    }
  };

  const prevStep = () => {
    const idx = currentStepIndex;
    if (idx > 0) {
      setCurrentStep(wizardSteps[idx - 1].id);
    }
  };

  const getStatusIcon = (status: DeploymentStatus['status']) => {
    switch (status) {
      case 'queued': return <Clock className="h-5 w-5 text-muted-foreground animate-pulse" />;
      case 'in_progress':
      case 'building': return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'finished': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'failed': return <XCircle className="h-5 w-5 text-destructive" />;
      default: return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: DeploymentStatus['status']) => {
    switch (status) {
      case 'queued': return 'En file d\'attente';
      case 'in_progress': return 'En cours';
      case 'building': return 'Construction';
      case 'finished': return 'Terminé';
      case 'failed': return 'Échoué';
      default: return 'Inconnu';
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Assistant de Déploiement Coolify
        </CardTitle>
        <CardDescription>
          Déployez automatiquement votre application avec vérifications complètes
        </CardDescription>
        
        {/* Progress bar */}
        <div className="mt-4">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2">
            {wizardSteps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = step.id === currentStep;
              const isComplete = idx < currentStepIndex;
              
              return (
                <div key={step.id} className="flex flex-col items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${isComplete ? 'bg-primary text-primary-foreground' : 
                      isActive ? 'bg-primary/20 text-primary border-2 border-primary' : 
                      'bg-muted text-muted-foreground'}
                  `}>
                    {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Server Selection */}
        {currentStep === 'server' && (
          <div className="space-y-4">
            <h3 className="font-medium">Sélectionnez votre serveur Coolify</h3>
            
            {servers.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Aucun serveur configuré. Ajoutez d'abord un serveur dans "Ma Flotte".
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {servers.map(server => (
                  <div 
                    key={server.id}
                    className={`
                      p-4 rounded-lg border cursor-pointer transition-all
                      ${selectedServer?.id === server.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'}
                    `}
                    onClick={() => {
                      setSelectedServer(server);
                      setConnectionTested(false);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Server className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{server.name}</p>
                          <p className="text-sm text-muted-foreground">{server.ip_address}</p>
                        </div>
                      </div>
                      {selectedServer?.id === server.id && (
                        <Badge variant={connectionTested ? 'default' : 'secondary'}>
                          {connectionTested ? 'Connecté' : 'Sélectionné'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedServer && (
              <Button 
                onClick={testCoolifyConnection} 
                disabled={isLoading}
                variant={connectionTested ? 'outline' : 'default'}
                className="w-full"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Test en cours...</>
                ) : connectionTested ? (
                  <><CheckCircle2 className="h-4 w-4 mr-2" /> Connexion vérifiée</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" /> Tester la connexion</>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Step 2: Pre-flight Checks */}
        {currentStep === 'preflight' && (
          <div className="space-y-4">
            <h3 className="font-medium">Vérifications Pré-Déploiement</h3>
            
            <div className="space-y-2">
              <Label htmlFor="github-url-preflight">URL du dépôt GitHub *</Label>
              <Input
                id="github-url-preflight"
                placeholder="https://github.com/user/repo"
                value={githubRepoUrl}
                onChange={(e) => handleRepoUrlChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-name-preflight">Nom du projet *</Label>
              <Input
                id="project-name-preflight"
                placeholder="mon-projet"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            {/* Skip dockerfile auto-fix option */}
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="skip-dockerfile-fix"
                checked={skipDockerfileFix}
                onCheckedChange={setSkipDockerfileFix}
              />
              <Label htmlFor="skip-dockerfile-fix" className="text-sm text-muted-foreground">
                Ne pas auto-corriger le Dockerfile (utiliser celui existant)
              </Label>
            </div>

            <Button
              onClick={runPreflightCheck}
              disabled={!githubRepoUrl || !projectName || isRunningPreflight}
              className="w-full"
            >
              {isRunningPreflight ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Vérifications en cours...</>
              ) : (
                <><ShieldCheck className="h-4 w-4 mr-2" /> Lancer les vérifications</>
              )}
            </Button>

            {preflightCheck && (
              <div className="space-y-3 mt-4">
                {/* GitHub Info */}
                {preflightCheck.github_info && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        <GitBranch className="h-4 w-4" />
                        Dépôt GitHub
                      </span>
                      <Badge variant={preflightCheck.github_info.has_write_permission ? 'default' : 'destructive'}>
                        {preflightCheck.github_info.permission_level || 'N/A'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      {preflightCheck.github_info.owner}/{preflightCheck.github_info.repo}
                    </p>
                    {!preflightCheck.github_info.has_write_permission && (
                      <Alert className="mt-2 bg-destructive/10 border-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Token sans droits d'écriture - impossible de corriger automatiquement le Dockerfile
                        </AlertDescription>
                      </Alert>
                    )}
                    {preflightCheck.github_info.dockerfile_fetched === false && (
                      <Alert className="mt-2 bg-warning/10 border-warning">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Dockerfile non récupéré depuis GitHub - vérifiez que le repo est correct
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
                
                {/* Check items */}
                <div className="grid gap-2">
                  <CheckItem 
                    label="Connexion Coolify" 
                    checked={preflightCheck.checks.coolify_connection} 
                  />
                  <CheckItem 
                    label="Accès GitHub" 
                    checked={preflightCheck.checks.github_access} 
                  />
                  <CheckItem 
                    label="Droits écriture GitHub" 
                    checked={preflightCheck.checks.github_write_permission || false}
                    detail={preflightCheck.github_info?.permission_level}
                  />
                  <CheckItem 
                    label="package.json présent" 
                    checked={preflightCheck.checks.package_json} 
                  />
                  <CheckItem 
                    label="Dockerfile valide" 
                    checked={preflightCheck.checks.dockerfile}
                    detail={preflightCheck.dockerfile_status === 'generated' ? '(généré)' : 
                           preflightCheck.dockerfile_status === 'exists_fixed' ? '(corrigé)' : 
                           preflightCheck.dockerfile_status === 'github_fetch_failed' ? '(non récupéré)' :
                           preflightCheck.checks.dockerfile_verified ? '(vérifié)' : ''}
                  />
                  <CheckItem 
                    label="Variables d'environnement" 
                    checked={preflightCheck.checks.env_vars} 
                  />
                </div>
                {/* Dockerfile preview with raw content from GitHub */}
                {(preflightCheck.dockerfile_proof || preflightCheck.github_info?.dockerfile_raw) && (
                  <div className="mt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDockerfile(!showDockerfile)}
                      className="w-full justify-start"
                    >
                      <FileCode className="h-4 w-4 mr-2" />
                      {showDockerfile ? 'Masquer' : 'Voir'} le Dockerfile analysé
                      {preflightCheck.dockerfile_proof?.is_valid ? (
                        <Badge variant="default" className="ml-2 bg-green-500">Valide</Badge>
                      ) : (
                        <Badge variant="destructive" className="ml-2">Invalide</Badge>
                      )}
                    </Button>
                    
                    {showDockerfile && (
                      <div className="mt-2 p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-2 text-xs">
                          <span className="text-muted-foreground">
                            COPY package.json: ligne {preflightCheck.dockerfile_proof?.copy_package_line || 'N/A'} |
                            npm install: ligne {preflightCheck.dockerfile_proof?.npm_install_line || 'N/A'}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const content = preflightCheck.github_info?.dockerfile_raw || preflightCheck.dockerfile_proof?.raw_content;
                                if (content) {
                                  navigator.clipboard.writeText(content);
                                  toast.success('Dockerfile copié');
                                }
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" /> Copier
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`${githubRepoUrl}/blob/${preflightCheck.branch}/Dockerfile`, '_blank')}
                            >
                              <Eye className="h-3 w-3 mr-1" /> GitHub
                            </Button>
                          </div>
                        </div>
                        <pre className="text-xs overflow-x-auto max-h-60 overflow-y-auto bg-black text-green-400 p-2 rounded whitespace-pre-wrap">
                          {preflightCheck.github_info?.dockerfile_raw || preflightCheck.dockerfile_proof?.raw_content || 'Contenu non disponible'}
                        </pre>
                        {preflightCheck.dockerfile_status === 'github_fetch_failed' && (
                          <Alert className="mt-2 bg-warning/10 border-warning">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              ⚠️ Dockerfile non récupéré depuis GitHub. Le repo "{preflightCheck.github_info?.owner}/{preflightCheck.github_info?.repo}" est-il correct?
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* Branch and commit info */}
                {preflightCheck.ready && (
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    <p><strong>Branche:</strong> {preflightCheck.branch}</p>
                    {preflightCheck.commit_sha && (
                      <p><strong>Commit:</strong> <code className="text-xs">{preflightCheck.commit_sha.slice(0, 7)}</code></p>
                    )}
                  </div>
                )}

                {/* Actions taken */}
                {preflightCheck.actions_taken.length > 0 && (
                  <Alert className="bg-blue-500/10 border-blue-500">
                    <FileCheck className="h-4 w-4 text-blue-500" />
                    <AlertDescription>
                      <strong>Actions effectuées:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {preflightCheck.actions_taken.map((action, i) => (
                          <li key={i}>{action}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Warnings */}
                {preflightCheck.warnings.map((warn, i) => (
                  <Alert key={i} className="bg-warning/10 border-warning">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <AlertDescription>{warn}</AlertDescription>
                  </Alert>
                ))}

                {/* Blocking errors */}
                {preflightCheck.blocking_errors.map((err, i) => (
                  <Alert key={i} variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{err}</AlertDescription>
                  </Alert>
                ))}

                {/* Ready status */}
                {preflightCheck.ready ? (
                  <Alert className="bg-green-500/10 border-green-500">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      Toutes les vérifications sont passées. Prêt pour le déploiement!
                    </AlertDescription>
                  </Alert>
                ) : preflightCheck.blocking_errors.length > 0 && (
                  <Button onClick={runPreflightCheck} variant="outline" className="w-full">
                    <RefreshCw className="h-4 w-4 mr-2" /> Réessayer les vérifications
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Repository Details */}
        {currentStep === 'repo' && (
          <div className="space-y-4">
            <h3 className="font-medium">Détails du Repository</h3>
            
            <div className="p-3 bg-muted/50 rounded-lg text-sm mb-4">
              <p><strong>URL:</strong> {githubRepoUrl}</p>
              <p><strong>Branche:</strong> {preflightCheck?.branch || gitBranch || 'main'}</p>
              {preflightCheck?.commit_sha && (
                <p><strong>Commit:</strong> <code>{preflightCheck.commit_sha.slice(0, 7)}</code></p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="git-branch">Branche Git (optionnel)</Label>
              <Input
                id="git-branch"
                placeholder={preflightCheck?.branch || 'main'}
                value={gitBranch}
                onChange={(e) => setGitBranch(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domaine (optionnel)</Label>
              <Input
                id="domain"
                placeholder="app.example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour utiliser l'IP du serveur
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Configuration */}
        {currentStep === 'config' && (
          <div className="space-y-4">
            <h3 className="font-medium">Variables d'environnement</h3>
            
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                Ces variables seront automatiquement configurées comme build-time dans Coolify.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="supabase-url">VITE_SUPABASE_URL</Label>
              <Input
                id="supabase-url"
                placeholder="https://xxx.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supabase-key">VITE_SUPABASE_PUBLISHABLE_KEY</Label>
              <Input
                id="supabase-key"
                type="password"
                placeholder="eyJ..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
              />
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Configuration automatique :</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>✅ <code>build_pack: dockerfile</code></li>
                <li>✅ <code>base_directory: /</code></li>
                <li>✅ <code>dockerfile_location: /Dockerfile</code></li>
                <li>✅ <code>git_branch: {preflightCheck?.branch || gitBranch || 'main'}</code></li>
                {preflightCheck?.commit_sha && (
                  <li>✅ <code>git_commit_sha: {preflightCheck.commit_sha.slice(0, 7)}...</code></li>
                )}
                <li>✅ <code>ports_exposes: 80</code></li>
                <li>✅ <code>force_rebuild: true</code></li>
                <li>✅ <code>force_no_cache: {forceNoCache ? 'true' : 'false'}</code></li>
              </ul>
            </div>

            {/* Advanced Options */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-sm mb-3">Options avancées</h4>
              
              {/* Debug Mode Toggle */}
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-3">
                <div className="flex items-center gap-2">
                  <Bug className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Mode Debug (logs API)</span>
                </div>
                <Switch
                  checked={debugMode}
                  onCheckedChange={setDebugMode}
                />
              </div>

              {/* Purge Cache Button */}
              <div className="flex gap-2 mb-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={purgeCoolifyCache}
                  disabled={isPurgingCache || !selectedServer}
                  className="flex-1"
                >
                  {isPurgingCache ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Purger cache Docker
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={compareDockerfiles}
                  disabled={isComparing || !selectedServer || !githubRepoUrl}
                  className="flex-1"
                >
                  {isComparing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <GitCompare className="h-4 w-4 mr-2" />
                  )}
                  Comparer Dockerfiles
                </Button>
              </div>

              {/* Dockerfile Comparison Results */}
              {dockerfileComparison && (
                <div className={`p-3 rounded-lg text-sm ${dockerfileComparison.is_synced ? 'bg-green-500/10 border border-green-500' : 'bg-destructive/10 border border-destructive'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {dockerfileComparison.is_synced ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="font-medium">
                      {dockerfileComparison.is_synced ? 'Dockerfiles synchronisés' : 'Désynchronisation détectée!'}
                    </span>
                  </div>
                  <ul className="text-xs space-y-1">
                    {dockerfileComparison.differences.map((diff, i) => (
                      <li key={i}>{diff}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Deployment */}
        {currentStep === 'deploy' && (
          <div className="space-y-4">
            <h3 className="font-medium">Déploiement</h3>
            
            {/* Deployment steps */}
            {deploymentSteps.length > 0 && (
              <div className="space-y-2">
                {deploymentSteps.map((step, idx) => (
                  <div 
                    key={idx}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg
                      ${step.status === 'success' ? 'bg-green-500/10' : 
                        step.status === 'error' ? 'bg-destructive/10' : 
                        'bg-muted/50'}
                    `}
                  >
                    {step.status === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : step.status === 'error' ? (
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-sm capitalize">{step.step}</p>
                      <p className="text-xs text-muted-foreground">{step.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Real-time status */}
            {deploymentStatus && (
              <Card className="border-2">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 mb-3">
                    {getStatusIcon(deploymentStatus.status)}
                    <div className="flex-1">
                      <p className="font-medium">{getStatusLabel(deploymentStatus.status)}</p>
                      {deploymentStatus.duration_seconds && (
                        <p className="text-xs text-muted-foreground">
                          Durée: {deploymentStatus.duration_seconds}s
                        </p>
                      )}
                    </div>
                    {isPolling && (
                      <Badge variant="outline" className="animate-pulse">
                        Actualisation auto
                      </Badge>
                    )}
                  </div>

                  {deploymentStatus.deployed_url && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(deploymentStatus.deployed_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" /> Ouvrir l'application
                    </Button>
                  )}

                  {deploymentStatus.logs && (
                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowLogs(!showLogs)}
                      >
                        <Terminal className="h-4 w-4 mr-2" />
                        {showLogs ? 'Masquer' : 'Voir'} les logs
                      </Button>
                      
                      {showLogs && (
                        <pre className="mt-2 p-3 bg-black text-green-400 rounded-lg text-xs overflow-x-auto max-h-60 overflow-y-auto">
                          {deploymentStatus.logs.slice(-3000)}
                        </pre>
                      )}
                    </div>
                  )}

                  {deploymentStatus.error_message && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{deploymentStatus.error_message}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Debug Mode: API Logs */}
            {debugMode && apiLogs.length > 0 && (
              <Card className="border-dashed border-2 border-primary/30">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    API Logs (Mode Debug)
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {apiLogs.map((log, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs font-mono p-1 bg-muted/50 rounded">
                        <span className="text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <Badge variant={log.status && log.status < 400 ? 'default' : 'destructive'} className="text-[10px] py-0">
                          {log.method}
                        </Badge>
                        <span className="truncate flex-1">{log.url}</span>
                        {log.status && <span className={log.status < 400 ? 'text-green-500' : 'text-destructive'}>{log.status}</span>}
                        {log.duration && <span className="text-muted-foreground">{log.duration}ms</span>}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setApiLogs([])}
                    className="mt-2 w-full"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Effacer les logs
                  </Button>
                </CardContent>
              </Card>
            )}

            {isLoading && !deploymentSteps.length && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {deploymentError && !deploymentStatus && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{deploymentError}</AlertDescription>
              </Alert>
            )}

            {deploymentResult && !deploymentStatus && (
              <Alert className="bg-green-500/10 border-green-500">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-green-700 dark:text-green-400">
                      Déploiement lancé avec succès!
                    </p>
                    {deploymentResult.app_uuid && (
                      <div className="flex items-center gap-2 text-sm">
                        <span>App UUID:</span>
                        <code className="bg-background px-2 py-0.5 rounded text-xs">
                          {deploymentResult.app_uuid}
                        </code>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-6 w-6"
                          onClick={() => {
                            navigator.clipboard.writeText(deploymentResult.app_uuid!);
                            toast.success('Copié!');
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    {selectedServer?.coolify_url && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => window.open(selectedServer.coolify_url!, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ouvrir Coolify
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Error handler for failed deployments */}
            {deploymentStatus?.status === 'failed' && deploymentResult?.app_uuid && (
              <CoolifyDeploymentErrorHandler
                logs={deploymentStatus.logs}
                githubRepoUrl={githubRepoUrl}
                coolifyAppUuid={deploymentResult.app_uuid}
                serverId={selectedServer?.id || ''}
                onAutoFix={() => {
                  // Restart deployment after fix
                  if (deploymentResult.app_uuid) {
                    setIsPolling(true);
                    pollDeploymentStatus(deploymentResult.app_uuid);
                  }
                }}
              />
            )}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={prevStep} 
            disabled={currentStepIndex === 0 || isLoading}
          >
            Précédent
          </Button>
          
          {currentStep !== 'deploy' ? (
            <Button 
              onClick={currentStep === 'config' ? startDeployment : nextStep}
              disabled={!canProceed() || isLoading}
            >
              {currentStep === 'config' ? (
                <><Play className="h-4 w-4 mr-2" /> Lancer le déploiement</>
              ) : (
                'Suivant'
              )}
            </Button>
          ) : (
            <Button 
              onClick={() => {
                setCurrentStep('server');
                setDeploymentSteps([]);
                setDeploymentResult(null);
                setDeploymentError(null);
                setDeploymentStatus(null);
                setPreflightCheck(null);
                setIsPolling(false);
              }}
              variant="outline"
              disabled={isLoading || isPolling}
            >
              Nouveau déploiement
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper component for check items
function CheckItem({ label, checked, detail }: { label: string; checked: boolean; detail?: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
      {checked ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      )}
      <span className={`text-sm ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>
        {label} {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </span>
    </div>
  );
}
