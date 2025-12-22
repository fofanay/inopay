import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
        title: "Nom requis",
        description: "Veuillez entrer un nom pour votre projet.",
        variant: "destructive"
      });
      return;
    }

    if (sourceType === 'github' && !githubUrl.trim()) {
      toast({
        title: "URL GitHub requise",
        description: "Veuillez entrer l'URL de votre dépôt GitHub.",
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
          title: "Déploiement lancé !",
          description: "Votre application est en cours de construction.",
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
        title: "Erreur de déploiement",
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
          <CardTitle className="text-lg">Premier déploiement</CardTitle>
        </div>
        <CardDescription>
          Déployez votre première application sur {serverName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={step === 'source' ? 'default' : 'secondary'}>1. Source</Badge>
          <span className="text-muted-foreground">→</span>
          <Badge variant={step === 'config' ? 'default' : 'secondary'}>2. Configuration</Badge>
          <span className="text-muted-foreground">→</span>
          <Badge variant={step === 'deploying' || step === 'complete' ? 'default' : 'secondary'}>3. Déploiement</Badge>
        </div>

        {/* Step 1: Source selection */}
        {step === 'source' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choisissez la source de votre projet :
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => handleSelectSource('github')}
              >
                <Github className="w-6 h-6" />
                <span>Dépôt GitHub</span>
                <span className="text-xs text-muted-foreground">Depuis une URL GitHub</span>
              </Button>
              {analyzedProjects.length > 0 && (
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={() => setSourceType('analyzed')}
                >
                  <FolderOpen className="w-6 h-6" />
                  <span>Projet analysé</span>
                  <span className="text-xs text-muted-foreground">{analyzedProjects.length} projets disponibles</span>
                </Button>
              )}
            </div>

            {/* Show analyzed projects list */}
            {sourceType === 'analyzed' && (
              <div className="space-y-2 mt-4">
                <Label>Sélectionner un projet analysé :</Label>
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
                            {project.portability_score}% portable
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
                <Label htmlFor="github-url">URL du dépôt GitHub</Label>
                <Input
                  id="github-url"
                  placeholder="https://github.com/user/repo"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="project-name">Nom du projet</Label>
              <Input
                id="project-name"
                placeholder="mon-application"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Domaine personnalisé (optionnel)</Label>
              <Input
                id="domain"
                placeholder="app.mondomaine.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour utiliser un sous-domaine automatique
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('source')}>
                Retour
              </Button>
              <Button onClick={handleDeploy} className="flex-1">
                <Rocket className="w-4 h-4 mr-2" />
                Lancer le déploiement
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Deploying */}
        {step === 'deploying' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="text-center">
              <p className="font-medium">Déploiement en cours...</p>
              <p className="text-sm text-muted-foreground">
                Construction et déploiement de {projectName}
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
                  <p className="font-medium">Déploiement réussi !</p>
                  <p className="text-sm">
                    Votre application est en cours de construction. Elle sera disponible sous peu à :
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
                  <p className="font-medium">Erreur de déploiement</p>
                  <p className="text-sm">{deploymentResult?.error || 'Une erreur inconnue est survenue'}</p>
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
              Déployer un autre projet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
