import { useState, useEffect } from 'react';
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
  Copy
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

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

type WizardStep = 'server' | 'repo' | 'config' | 'deploy';

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
    if (!projectName) {
      setProjectName(extractProjectName(url));
    }
  };

  const startDeployment = async () => {
    if (!selectedServer || !githubRepoUrl || !projectName) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setIsLoading(true);
    setDeploymentError(null);
    setDeploymentSteps([]);
    setCurrentStep('deploy');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      // Build env vars
      const envVars: Record<string, string> = {};
      if (supabaseUrl) envVars['VITE_SUPABASE_URL'] = supabaseUrl;
      if (supabaseKey) envVars['VITE_SUPABASE_PUBLISHABLE_KEY'] = supabaseKey;

      const response = await supabase.functions.invoke('auto-configure-coolify-app', {
        body: {
          server_id: selectedServer.id,
          project_name: projectName,
          github_repo_url: githubRepoUrl,
          domain: domain || null,
          env_vars: Object.keys(envVars).length > 0 ? envVars : null,
          auto_deploy: true
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
    { id: 'repo' as WizardStep, label: 'Repository', icon: GitBranch },
    { id: 'config' as WizardStep, label: 'Configuration', icon: Settings },
    { id: 'deploy' as WizardStep, label: 'Déploiement', icon: Rocket }
  ];

  const getStepIndex = (step: WizardStep) => wizardSteps.findIndex(s => s.id === step);
  const currentStepIndex = getStepIndex(currentStep);
  const progress = ((currentStepIndex + 1) / wizardSteps.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case 'server':
        return selectedServer && connectionTested;
      case 'repo':
        return githubRepoUrl && projectName;
      case 'config':
        return true; // Config is optional
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

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Assistant de Déploiement Coolify
        </CardTitle>
        <CardDescription>
          Configurez et déployez automatiquement votre application sur Coolify
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

        {/* Step 2: Repository */}
        {currentStep === 'repo' && (
          <div className="space-y-4">
            <h3 className="font-medium">Configuration du Repository</h3>
            
            <div className="space-y-2">
              <Label htmlFor="github-url">URL du dépôt GitHub *</Label>
              <Input
                id="github-url"
                placeholder="https://github.com/user/repo"
                value={githubRepoUrl}
                onChange={(e) => handleRepoUrlChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-name">Nom du projet *</Label>
              <Input
                id="project-name"
                placeholder="mon-projet"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
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

        {/* Step 3: Configuration */}
        {currentStep === 'config' && (
          <div className="space-y-4">
            <h3 className="font-medium">Variables d'environnement (optionnel)</h3>
            
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription>
                Ces variables seront ajoutées automatiquement à votre application Coolify.
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
                <li>✅ <code>base_directory: /</code></li>
                <li>✅ <code>dockerfile_location: /Dockerfile</code></li>
                <li>✅ <code>ports_exposes: 80</code></li>
                <li>✅ <code>build_pack: dockerfile</code></li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 4: Deployment */}
        {currentStep === 'deploy' && (
          <div className="space-y-4">
            <h3 className="font-medium">Déploiement en cours</h3>
            
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

            {isLoading && deploymentSteps.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {deploymentError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{deploymentError}</AlertDescription>
              </Alert>
            )}

            {deploymentResult && (
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
                <><Rocket className="h-4 w-4 mr-2" /> Lancer le déploiement</>
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
              }}
              variant="outline"
              disabled={isLoading}
            >
              Nouveau déploiement
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
