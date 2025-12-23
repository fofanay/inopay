import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { 
  Rocket, 
  Loader2, 
  CheckCircle2, 
  Github, 
  Globe,
  ExternalLink,
  AlertCircle,
  FolderOpen
} from 'lucide-react';

interface FirstDeploymentWizardProps {
  serverId: string;
  serverName: string;
  onDeploymentComplete: () => void;
}

interface AnalyzedProject {
  id: string;
  project_name: string;
  file_name: string | null;
  portability_score: number | null;
  status: string;
}

export function FirstDeploymentWizard({ 
  serverId, 
  serverName,
  onDeploymentComplete 
}: FirstDeploymentWizardProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'source' | 'config' | 'deploying' | 'complete'>('source');
  const [sourceType, setSourceType] = useState<'github' | 'analyzed' | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [domain, setDomain] = useState('');
  const [analyzedProjects, setAnalyzedProjects] = useState<AnalyzedProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<AnalyzedProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<{ url?: string; error?: string } | null>(null);
  const { toast } = useToast();

  // Load analyzed projects
  useEffect(() => {
    const loadProjects = async () => {
      const { data, error } = await supabase
        .from('projects_analysis')
        .select('id, project_name, file_name, portability_score, status')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setAnalyzedProjects(data);
      }
    };

    loadProjects();
  }, []);

  const handleSelectSource = (type: 'github' | 'analyzed') => {
    setSourceType(type);
    if (type === 'github') {
      setStep('config');
    }
  };

  const handleSelectAnalyzedProject = (project: AnalyzedProject) => {
    setSelectedProject(project);
    setProjectName(project.project_name);
    setStep('config');
  };

  const handleDeploy = async () => {
    if (!projectName.trim()) {
      toast({
        title: t('firstDeployment.nameRequired'),
        description: t('firstDeployment.enterProjectName'),
        variant: "destructive"
      });
      return;
    }

    if (sourceType === 'github' && !githubUrl.trim()) {
      toast({
        title: t('firstDeployment.githubUrlRequired'),
        description: t('firstDeployment.enterGithubUrl'),
        variant: "destructive"
      });
      return;
    }

    setIsDeploying(true);
    setStep('deploying');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('deploy-coolify', {
        body: {
          server_id: serverId,
          project_name: projectName.trim(),
          github_repo_url: githubUrl.trim() || null,
          domain: domain.trim() || null
        }
      });

      if (error) throw error;

      if (data.success) {
        setDeploymentResult({ url: data.deployed_url });
        setStep('complete');
        toast({
          title: t('firstDeployment.deploymentStarted'),
          description: t('firstDeployment.appBuilding'),
        });
        onDeploymentComplete();
      } else {
        throw new Error(data.error || 'Deployment failed');
      }
    } catch (error: any) {
      console.error('Deployment error:', error);
      setDeploymentResult({ error: error.message });
      setStep('complete');
      toast({
        title: t('serverManagement.deploymentError'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">{t('firstDeployment.title')}</CardTitle>
        </div>
        <CardDescription>
          {t('firstDeployment.description')} {serverName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={step === 'source' ? 'default' : 'secondary'}>1. {t('firstDeployment.source')}</Badge>
          <span className="text-muted-foreground">→</span>
          <Badge variant={step === 'config' ? 'default' : 'secondary'}>2. {t('firstDeployment.config')}</Badge>
          <span className="text-muted-foreground">→</span>
          <Badge variant={step === 'deploying' || step === 'complete' ? 'default' : 'secondary'}>3. {t('firstDeployment.deployment')}</Badge>
        </div>

        {/* Step 1: Source selection */}
        {step === 'source' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('firstDeployment.chooseSource')}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handleSelectSource('github')}
              >
                <Github className="w-6 h-6" />
                <span>{t('firstDeployment.githubRepo')}</span>
                <span className="text-xs text-muted-foreground">{t('firstDeployment.githubRepoDesc')}</span>
              </Button>
              {analyzedProjects.length > 0 && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => setSourceType('analyzed')}
                >
                  <FolderOpen className="w-6 h-6" />
                  <span>{t('firstDeployment.analyzedProject')}</span>
                  <span className="text-xs text-muted-foreground">{analyzedProjects.length} {t('firstDeployment.analyzedProjectDesc')}</span>
                </Button>
              )}
            </div>

            {/* Show analyzed projects list */}
            {sourceType === 'analyzed' && (
              <div className="space-y-2 mt-4">
                <Label>{t('firstDeployment.selectAnalyzed')}</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {analyzedProjects.map((project) => (
                    <Button
                      key={project.id}
                      variant="ghost"
                      className="w-full justify-start h-auto py-3"
                      onClick={() => handleSelectAnalyzedProject(project)}
                    >
                      <div className="flex items-center gap-3 w-full">
                        <FolderOpen className="w-4 h-4 text-muted-foreground" />
                        <div className="flex-1 text-left">
                          <p className="font-medium">{project.project_name}</p>
                          <p className="text-xs text-muted-foreground">{project.file_name}</p>
                        </div>
                        {project.portability_score && (
                          <Badge variant="outline" className="text-xs">
                            {project.portability_score}% {t('firstDeployment.portable')}
                          </Badge>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Configuration */}
        {step === 'config' && (
          <div className="space-y-4">
            {sourceType === 'github' && (
              <div className="space-y-2">
                <Label htmlFor="github-url">{t('firstDeployment.githubUrl')}</Label>
                <Input
                  id="github-url"
                  placeholder={t('firstDeployment.githubUrlPlaceholder')}
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="project-name">{t('firstDeployment.projectName')}</Label>
              <Input
                id="project-name"
                placeholder={t('firstDeployment.projectNamePlaceholder')}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">{t('firstDeployment.customDomain')}</Label>
              <Input
                id="domain"
                placeholder={t('firstDeployment.customDomainPlaceholder')}
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('firstDeployment.customDomainDesc')}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('source')}>
                {t('liberation.step2.back')}
              </Button>
              <Button onClick={handleDeploy} className="flex-1">
                <Rocket className="w-4 h-4 mr-2" />
                {t('firstDeployment.launchDeployment')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Deploying */}
        {step === 'deploying' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">{t('firstDeployment.deploying')}</p>
              <p className="text-sm text-muted-foreground">
                {t('firstDeployment.building')} {projectName}
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <div className="space-y-4">
            {deploymentResult?.url ? (
              <Alert className="border-primary/30 bg-primary/5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <AlertDescription className="space-y-3">
                  <p className="font-medium">{t('firstDeployment.deploySuccess')}</p>
                  <p className="text-sm">
                    {t('firstDeployment.deploySuccessDesc')}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(deploymentResult.url, '_blank')}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    {deploymentResult.url}
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium">{t('firstDeployment.deployError')}</p>
                  <p className="text-sm">{deploymentResult?.error || t('firstDeployment.unknownError')}</p>
                </AlertDescription>
              </Alert>
            )}

            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                setStep('source');
                setSourceType(null);
                setGithubUrl('');
                setProjectName('');
                setDomain('');
                setDeploymentResult(null);
              }}
            >
              {t('firstDeployment.deployAnother')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}