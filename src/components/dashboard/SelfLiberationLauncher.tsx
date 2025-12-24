// @inopay-core-protected
// Self-Liberation Launcher - Triggers Inopay's own liberation in production mode
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Rocket, 
  Shield, 
  Github, 
  Server, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  FileCode,
  Cloud,
  ExternalLink
} from 'lucide-react';

interface LiberationStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
  details?: string;
}

interface LiberationResult {
  cleanedFiles: number;
  totalChanges: number;
  removedPatterns: string[];
  githubUrl?: string;
  deploymentUrl?: string;
}

export function SelfLiberationLauncher() {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<LiberationStep[]>([
    { id: 'fetch', name: 'Récupération du code source', status: 'pending' },
    { id: 'clean', name: 'Nettoyage propriétaire', status: 'pending' },
    { id: 'validate', name: 'Validation package.json', status: 'pending' },
    { id: 'github', name: 'Push vers GitHub', status: 'pending' },
    { id: 'coolify', name: 'Déploiement Coolify', status: 'pending' },
  ]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<LiberationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateStep = useCallback((id: string, updates: Partial<LiberationStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === id ? { ...step, ...updates } : step
    ));
  }, []);

  const validatePackageJson = (content: string): { valid: boolean; error?: string } => {
    try {
      const trimmed = content.trim();
      if (!trimmed.startsWith('{')) {
        return { valid: false, error: `Fichier commence par "${trimmed.slice(0, 20)}" au lieu de "{"` };
      }
      if (!trimmed.endsWith('}')) {
        return { valid: false, error: 'Fichier ne se termine pas par "}"' };
      }
      JSON.parse(trimmed);
      return { valid: true };
    } catch (e) {
      return { valid: false, error: e instanceof Error ? e.message : 'Erreur de parsing' };
    }
  };

  const launchLiberation = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    setProgress(0);
    
    // Reset steps
    setSteps(prev => prev.map(s => ({ ...s, status: 'pending', message: undefined })));

    try {
      // Step 1: Fetch source code from GitHub
      updateStep('fetch', { status: 'running', message: 'Connexion à GitHub...' });
      setProgress(5);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session non authentifiée');
      }

      // Fetch user's GitHub token
      const { data: settings } = await supabase
        .from('user_settings')
        .select('github_token')
        .eq('user_id', session.user.id)
        .single();

      if (!settings?.github_token) {
        throw new Error('Token GitHub non configuré');
      }

      // Fetch current repo files from inopay repository
      const repoOwner = 'fofanay';
      const repoName = 'inopay';
      
      updateStep('fetch', { status: 'running', message: 'Téléchargement des fichiers source...' });
      setProgress(10);

      // Get repo tree
      const treeResponse = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/main?recursive=1`,
        {
          headers: {
            'Authorization': `Bearer ${settings.github_token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!treeResponse.ok) {
        throw new Error('Impossible de récupérer l\'arbre du dépôt');
      }

      const treeData = await treeResponse.json();
      const filesToProcess: { path: string; content: string }[] = [];
      
      // Filter relevant files (exclude node_modules, dist, etc.)
      const relevantFiles = treeData.tree.filter((item: any) => 
        item.type === 'blob' && 
        !item.path.includes('node_modules/') &&
        !item.path.includes('dist/') &&
        !item.path.includes('.git/') &&
        !item.path.includes('bun.lockb') &&
        (item.path.endsWith('.ts') || 
         item.path.endsWith('.tsx') || 
         item.path.endsWith('.js') || 
         item.path.endsWith('.jsx') ||
         item.path.endsWith('.json') ||
         item.path.endsWith('.css') ||
         item.path.endsWith('.html') ||
         item.path.endsWith('.md') ||
         item.path.endsWith('.toml') ||
         item.path.endsWith('.yml') ||
         item.path.endsWith('.yaml') ||
         item.path === 'Dockerfile' ||
         item.path.endsWith('.conf'))
      );

      updateStep('fetch', { 
        status: 'running', 
        message: `Téléchargement de ${relevantFiles.length} fichiers...` 
      });
      setProgress(15);

      // Fetch file contents in batches
      let fetchedCount = 0;
      for (const file of relevantFiles.slice(0, 200)) { // Limit to 200 files
        try {
          const contentResponse = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${file.path}`,
            {
              headers: {
                'Authorization': `Bearer ${settings.github_token}`,
                'Accept': 'application/vnd.github.v3+json'
              }
            }
          );

          if (contentResponse.ok) {
            const contentData = await contentResponse.json();
            if (contentData.content) {
              const decodedContent = atob(contentData.content.replace(/\n/g, ''));
              filesToProcess.push({
                path: file.path,
                content: decodedContent
              });
              fetchedCount++;
            }
          }
        } catch {
          console.warn(`Failed to fetch ${file.path}`);
        }

        // Update progress
        setProgress(15 + (fetchedCount / relevantFiles.length) * 25);
      }

      updateStep('fetch', { 
        status: 'success', 
        message: `${filesToProcess.length} fichiers récupérés`,
        details: `Source: ${repoOwner}/${repoName}`
      });
      setProgress(40);

      // Step 2: Clean proprietary patterns
      updateStep('clean', { status: 'running', message: 'Nettoyage en cours...' });

      const cleanResponse = await supabase.functions.invoke('process-project-liberation', {
        body: {
          files: filesToProcess,
          projectName: 'inopay-production',
          userId: session.user.id,
          action: 'clean-only'
        }
      });

      if (cleanResponse.error) {
        throw new Error(`Erreur nettoyage: ${cleanResponse.error.message}`);
      }

      const cleanData = cleanResponse.data;
      
      if (!cleanData.success) {
        throw new Error(cleanData.error || 'Échec du nettoyage');
      }

      updateStep('clean', { 
        status: 'success', 
        message: `${cleanData.cleanedFiles} fichiers nettoyés`,
        details: `${cleanData.summary?.totalChanges || 0} modifications`
      });
      setProgress(60);

      // Step 3: Validate package.json
      updateStep('validate', { status: 'running', message: 'Validation package.json...' });

      const packageFile = cleanData.files?.find((f: any) => f.path === 'package.json');
      if (packageFile) {
        const validation = validatePackageJson(packageFile.content);
        if (!validation.valid) {
          throw new Error(`package.json invalide: ${validation.error}`);
        }
      }

      updateStep('validate', { 
        status: 'success', 
        message: 'package.json valide',
        details: 'JSON syntaxiquement correct'
      });
      setProgress(70);

      // Step 4: Push to GitHub production repo
      updateStep('github', { status: 'running', message: 'Push vers inopay-production...' });

      const githubResponse = await supabase.functions.invoke('process-project-liberation', {
        body: {
          files: cleanData.files || filesToProcess,
          projectName: 'inopay-production',
          userId: session.user.id,
          action: 'full-pipeline'
        }
      });

      if (githubResponse.error) {
        throw new Error(`Erreur GitHub: ${githubResponse.error.message}`);
      }

      const githubData = githubResponse.data;

      if (!githubData.github?.success) {
        updateStep('github', { 
          status: 'error', 
          message: githubData.github?.error || 'Échec push GitHub' 
        });
        // Continue anyway - GitHub might be optional
      } else {
        updateStep('github', { 
          status: 'success', 
          message: 'Poussé vers GitHub',
          details: githubData.github.repoUrl
        });
      }
      setProgress(85);

      // Step 5: Trigger Coolify deployment
      updateStep('coolify', { status: 'running', message: 'Déclenchement déploiement Coolify...' });

      if (githubData.coolify?.success) {
        updateStep('coolify', { 
          status: 'success', 
          message: 'Déploiement lancé',
          details: githubData.coolify.deploymentUrl
        });
      } else if (githubData.coolify?.error) {
        updateStep('coolify', { 
          status: 'error', 
          message: githubData.coolify.error
        });
      } else {
        // Manual Coolify trigger
        const { data: serverData } = await supabase
          .from('user_servers')
          .select('coolify_url, coolify_token')
          .eq('user_id', session.user.id)
          .single();

        if (serverData?.coolify_url && serverData?.coolify_token) {
          try {
            const coolifyResponse = await fetch(`${serverData.coolify_url}/api/v1/applications`, {
              headers: {
                'Authorization': `Bearer ${serverData.coolify_token}`,
                'Accept': 'application/json'
              }
            });

            if (coolifyResponse.ok) {
              const apps = await coolifyResponse.json();
              const inopayApp = apps.find((app: any) => 
                app.name?.toLowerCase().includes('inopay') ||
                app.git_repository?.includes('inopay-production')
              );

              if (inopayApp) {
                await fetch(`${serverData.coolify_url}/api/v1/applications/${inopayApp.uuid}/restart`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${serverData.coolify_token}`,
                    'Accept': 'application/json'
                  }
                });
                updateStep('coolify', { 
                  status: 'success', 
                  message: 'Déploiement déclenché',
                  details: inopayApp.fqdn || 'VPS IONOS'
                });
              } else {
                updateStep('coolify', { 
                  status: 'error', 
                  message: 'Application non trouvée sur Coolify'
                });
              }
            }
          } catch (e) {
            updateStep('coolify', { 
              status: 'error', 
              message: 'Erreur connexion Coolify'
            });
          }
        } else {
          updateStep('coolify', { 
            status: 'error', 
            message: 'Configuration Coolify manquante'
          });
        }
      }
      setProgress(100);

      // Set final result
      setResult({
        cleanedFiles: cleanData.cleanedFiles || filesToProcess.length,
        totalChanges: cleanData.summary?.totalChanges || 0,
        removedPatterns: cleanData.summary?.removedPatterns || [],
        githubUrl: githubData.github?.repoUrl,
        deploymentUrl: githubData.coolify?.deploymentUrl
      });

      toast.success('Auto-libération terminée !', {
        description: 'Inopay est maintenant souverain'
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      toast.error('Échec de l\'auto-libération', { description: errorMessage });
      
      // Mark current running step as error
      setSteps(prev => prev.map(s => 
        s.status === 'running' ? { ...s, status: 'error', message: errorMessage } : s
      ));
    } finally {
      setIsRunning(false);
    }
  };

  const getStepIcon = (step: LiberationStep) => {
    const icons: Record<string, React.ReactNode> = {
      fetch: <FileCode className="h-5 w-5" />,
      clean: <Shield className="h-5 w-5" />,
      validate: <CheckCircle2 className="h-5 w-5" />,
      github: <Github className="h-5 w-5" />,
      coolify: <Cloud className="h-5 w-5" />,
    };
    return icons[step.id] || <Server className="h-5 w-5" />;
  };

  const getStepStatusColor = (status: LiberationStep['status']) => {
    switch (status) {
      case 'success': return 'text-green-500';
      case 'error': return 'text-red-500';
      case 'running': return 'text-yellow-500 animate-pulse';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-background to-primary/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Rocket className="h-6 w-6 text-primary" />
            Auto-Libération Production
          </CardTitle>
          <Badge variant="outline" className="border-primary text-primary">
            Mode Final
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Overview */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <span>VPS IONOS: 209.46.125.157</span>
          </div>
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4" />
            <span>Target: inopay-production</span>
          </div>
        </div>

        {/* Progress Bar */}
        {isRunning && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progression</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step) => (
            <div 
              key={step.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                step.status === 'running' ? 'border-primary bg-primary/5' :
                step.status === 'success' ? 'border-green-500/30 bg-green-500/5' :
                step.status === 'error' ? 'border-red-500/30 bg-red-500/5' :
                'border-border'
              }`}
            >
              <div className={getStepStatusColor(step.status)}>
                {step.status === 'running' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : step.status === 'success' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : step.status === 'error' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  getStepIcon(step)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{step.name}</span>
                  {step.status !== 'pending' && (
                    <Badge 
                      variant={step.status === 'success' ? 'default' : 
                               step.status === 'error' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {step.status === 'running' ? 'En cours' :
                       step.status === 'success' ? 'Terminé' :
                       step.status === 'error' ? 'Erreur' : 'En attente'}
                    </Badge>
                  )}
                </div>
                {step.message && (
                  <p className="text-sm text-muted-foreground mt-1">{step.message}</p>
                )}
                {step.details && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                    {step.details}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Result */}
        {result && !error && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              <div className="space-y-2">
                <p className="font-medium">Libération réussie !</p>
                <div className="text-sm space-y-1">
                  <p>• {result.cleanedFiles} fichiers traités</p>
                  <p>• {result.totalChanges} modifications appliquées</p>
                  {result.githubUrl && (
                    <a 
                      href={result.githubUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Github className="h-3 w-3" />
                      Voir sur GitHub
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {result.deploymentUrl && (
                    <a 
                      href={result.deploymentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      <Server className="h-3 w-3" />
                      Voir le déploiement
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Launch Button */}
        <Button 
          onClick={launchLiberation}
          disabled={isRunning}
          className="w-full h-12 text-lg font-bold"
          size="lg"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Libération en cours...
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-5 w-5" />
              Lancer l'Auto-Libération
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Ce processus va nettoyer le code source d'Inopay, le pousser vers GitHub 
          et déclencher un déploiement sur votre VPS IONOS.
        </p>
      </CardContent>
    </Card>
  );
}
