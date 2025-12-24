// @inopay-core-protected
// Self-Liberation Launcher - Triggers Inopay's own liberation in production mode
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
  ExternalLink,
  Key,
  Eye,
  EyeOff,
  Settings,
  Database,
  RefreshCw,
  XCircle
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

interface PreflightStatus {
  github: { ok: boolean; message: string; username?: string };
  coolify: { ok: boolean; message: string; url?: string };
  externalBackend?: { ok: boolean; message: string };
}

export function SelfLiberationLauncher() {
  const [isRunning, setIsRunning] = useState(false);
  const [steps, setSteps] = useState<LiberationStep[]>([
    { id: 'auth', name: 'Vérification authentification', status: 'pending' },
    { id: 'token-check', name: 'Validation permissions GitHub', status: 'pending' },
    { id: 'fetch', name: 'Récupération du code source', status: 'pending' },
    { id: 'clean', name: 'Nettoyage propriétaire', status: 'pending' },
    { id: 'validate', name: 'Validation package.json', status: 'pending' },
    { id: 'github', name: 'Push vers GitHub', status: 'pending' },
    { id: 'coolify', name: 'Déploiement Coolify', status: 'pending' },
  ]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<LiberationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // GitHub token configuration state
  const [githubToken, setGithubToken] = useState('');
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [githubScopes, setGithubScopes] = useState<string[]>([]);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(true);
  
  // Destination owner (for private GitHub)
  const [destinationOwner, setDestinationOwner] = useState('');
  
  // Coolify configuration
  const [coolifyUrl, setCoolifyUrl] = useState('');
  const [coolifyToken, setCoolifyToken] = useState('');
  const [isCoolifyConfigured, setIsCoolifyConfigured] = useState(false);
  const [isTestingCoolify, setIsTestingCoolify] = useState(false);
  const [showCoolifyToken, setShowCoolifyToken] = useState(false);
  
  // External backend configuration
  const [externalBackendUrl, setExternalBackendUrl] = useState('');
  const [externalAnonKey, setExternalAnonKey] = useState('');
  
  // Preflight status
  const [preflight, setPreflight] = useState<PreflightStatus | null>(null);
  const [isPreflightRunning, setIsPreflightRunning] = useState(false);

  // Load existing configurations on mount
  useEffect(() => {
    const loadExistingConfig = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setTokenLoading(false);
          return;
        }

        // Load user settings
        const { data: settings } = await supabase
          .from('user_settings')
          .select('github_token, github_destination_username')
          .eq('user_id', session.user.id)
          .single();

        if (settings?.github_token) {
          setGithubToken(settings.github_token);
          const validation = await validateGitHubTokenScopes(settings.github_token);
          if (validation.valid) {
            setIsTokenValid(true);
            setGithubUsername(validation.username || null);
            setGithubScopes(validation.scopes);
          }
        }
        
        if (settings?.github_destination_username) {
          setDestinationOwner(settings.github_destination_username);
        }

        // Load server config (Coolify)
        const { data: serverData } = await supabase
          .from('user_servers')
          .select('coolify_url, coolify_token, db_url, anon_key')
          .eq('user_id', session.user.id)
          .single();

        if (serverData) {
          if (serverData.coolify_url) setCoolifyUrl(serverData.coolify_url);
          if (serverData.coolify_token) {
            setCoolifyToken(serverData.coolify_token);
            setIsCoolifyConfigured(true);
          }
          if (serverData.db_url) setExternalBackendUrl(serverData.db_url);
          if (serverData.anon_key) setExternalAnonKey(serverData.anon_key);
        }
      } catch (err) {
        console.error('Error loading config:', err);
      } finally {
        setTokenLoading(false);
      }
    };

    loadExistingConfig();
  }, []);

  const validateGitHubTokenScopes = async (token: string): Promise<{
    valid: boolean;
    username?: string;
    scopes: string[];
    missing: string[];
  }> => {
    const requiredScopes = ['repo', 'admin:repo_hook'];
    
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        return { valid: false, scopes: [], missing: requiredScopes };
      }

      const userData = await response.json();
      const scopesHeader = response.headers.get('X-OAuth-Scopes') || '';
      const scopes = scopesHeader.split(',').map(s => s.trim()).filter(Boolean);
      
      const missing = requiredScopes.filter(required => {
        const [mainScope, subScope] = required.split(':');
        return !scopes.some(scope => 
          scope === required || 
          scope === mainScope || 
          (subScope && scope.startsWith(`${mainScope}:`))
        );
      });

      return {
        valid: missing.length === 0,
        username: userData.login,
        scopes,
        missing
      };
    } catch {
      return { valid: false, scopes: [], missing: requiredScopes };
    }
  };

  const testAndSaveGitHubToken = async () => {
    if (!githubToken.trim()) {
      toast.error('Veuillez entrer un token GitHub');
      return;
    }

    setIsTestingToken(true);
    
    try {
      const validation = await validateGitHubTokenScopes(githubToken.trim());
      
      if (!validation.valid) {
        setIsTokenValid(false);
        setGithubUsername(null);
        setGithubScopes([]);
        toast.error('Token invalide ou permissions manquantes', {
          description: `Scopes manquants: ${validation.missing.join(', ')}`
        });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée');
        return;
      }

      const { error: upsertError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: session.user.id,
          github_token: githubToken.trim(),
          github_destination_username: destinationOwner.trim() || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;

      setIsTokenValid(true);
      setGithubUsername(validation.username || null);
      setGithubScopes(validation.scopes);
      toast.success('Token GitHub configuré', {
        description: `Connecté en tant que ${validation.username}`
      });
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde', {
        description: err instanceof Error ? err.message : 'Erreur inconnue'
      });
    } finally {
      setIsTestingToken(false);
    }
  };

  const testAndSaveCoolify = async () => {
    if (!coolifyUrl.trim() || !coolifyToken.trim()) {
      toast.error('Veuillez entrer l\'URL et le token Coolify');
      return;
    }

    setIsTestingCoolify(true);
    
    try {
      // Test Coolify connection
      const response = await fetch(`${coolifyUrl.trim()}/api/v1/applications`, {
        headers: {
          'Authorization': `Bearer ${coolifyToken.trim()}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 401) {
          toast.error('Token Coolify invalide');
        } else if (status === 403) {
          toast.error('Token sans permissions suffisantes');
        } else {
          toast.error(`Erreur connexion Coolify (HTTP ${status})`);
        }
        return;
      }

      const apps = await response.json();
      
      // Save to user_servers
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée');
        return;
      }

      // Upsert to user_servers
      const { data: existingServer } = await supabase
        .from('user_servers')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (existingServer) {
        await supabase
          .from('user_servers')
          .update({
            coolify_url: coolifyUrl.trim(),
            coolify_token: coolifyToken.trim(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingServer.id);
      } else {
        await supabase
          .from('user_servers')
          .insert({
            user_id: session.user.id,
            name: 'Serveur Principal',
            ip_address: new URL(coolifyUrl.trim()).hostname,
            coolify_url: coolifyUrl.trim(),
            coolify_token: coolifyToken.trim(),
            status: 'active'
          });
      }

      setIsCoolifyConfigured(true);
      toast.success('Coolify configuré', {
        description: `${apps.length} applications trouvées`
      });
    } catch (err) {
      toast.error('Erreur connexion Coolify', {
        description: err instanceof Error ? err.message : 'URL invalide'
      });
    } finally {
      setIsTestingCoolify(false);
    }
  };

  const runPreflight = async () => {
    setIsPreflightRunning(true);
    const status: PreflightStatus = {
      github: { ok: false, message: 'Non testé' },
      coolify: { ok: false, message: 'Non testé' }
    };

    // Check GitHub
    if (githubToken) {
      const validation = await validateGitHubTokenScopes(githubToken);
      status.github = validation.valid 
        ? { ok: true, message: 'Connecté', username: validation.username }
        : { ok: false, message: `Permissions manquantes: ${validation.missing.join(', ')}` };
    } else {
      status.github = { ok: false, message: 'Token non configuré' };
    }

    // Check Coolify
    if (coolifyUrl && coolifyToken) {
      try {
        const response = await fetch(`${coolifyUrl}/api/v1/applications`, {
          headers: {
            'Authorization': `Bearer ${coolifyToken}`,
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const apps = await response.json();
          const inopayApp = apps.find((app: any) => 
            app.name?.toLowerCase().includes('inopay') ||
            app.git_repository?.includes('inopay')
          );
          status.coolify = inopayApp 
            ? { ok: true, message: `App trouvée: ${inopayApp.name}`, url: inopayApp.fqdn }
            : { ok: false, message: `${apps.length} apps mais aucune "inopay"` };
        } else {
          status.coolify = { ok: false, message: `HTTP ${response.status}` };
        }
      } catch (err) {
        status.coolify = { ok: false, message: 'Connexion impossible' };
      }
    } else {
      status.coolify = { ok: false, message: 'Non configuré' };
    }

    // Check external backend (optional)
    if (externalBackendUrl) {
      try {
        const testUrl = externalBackendUrl.includes('/rest/') 
          ? externalBackendUrl 
          : `${externalBackendUrl}/rest/v1/`;
        const response = await fetch(testUrl, {
          headers: externalAnonKey ? { 'apikey': externalAnonKey } : {}
        });
        status.externalBackend = response.ok 
          ? { ok: true, message: 'Backend accessible' }
          : { ok: false, message: `HTTP ${response.status}` };
      } catch {
        status.externalBackend = { ok: false, message: 'Connexion impossible' };
      }
    }

    setPreflight(status);
    setIsPreflightRunning(false);
  };

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
    
    setSteps(prev => prev.map(s => ({ ...s, status: 'pending', message: undefined })));

    try {
      // Step 1: Auth verification
      updateStep('auth', { status: 'running', message: 'Vérification session...' });
      setProgress(2);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        updateStep('auth', { status: 'error', message: 'Session non authentifiée' });
        throw new Error('Session non authentifiée');
      }

      updateStep('auth', { status: 'success', message: 'Authentifié', details: session.user.email });
      setProgress(5);

      // Step 2: Fetch and validate GitHub token
      updateStep('token-check', { status: 'running', message: 'Récupération du token GitHub...' });

      const { data: settings } = await supabase
        .from('user_settings')
        .select('github_token, github_destination_username')
        .eq('user_id', session.user.id)
        .single();

      if (!settings?.github_token) {
        updateStep('token-check', { 
          status: 'error', 
          message: 'Token GitHub non configuré',
          details: 'Configurez votre token ci-dessus'
        });
        throw new Error('Token GitHub non configuré');
      }

      updateStep('token-check', { status: 'running', message: 'Validation des permissions...' });

      const tokenValidation = await validateGitHubTokenScopes(settings.github_token);

      if (!tokenValidation.valid) {
        const missingScopes = tokenValidation.missing.join(', ');
        updateStep('token-check', { 
          status: 'error', 
          message: `Permissions manquantes: ${missingScopes}`,
          details: 'Régénérez le token avec les scopes requis'
        });
        throw new Error(`Token GitHub invalide: scopes manquants (${missingScopes})`);
      }

      updateStep('token-check', { 
        status: 'success', 
        message: `Permissions validées (${tokenValidation.username})`,
        details: settings.github_destination_username 
          ? `Destination: ${settings.github_destination_username}` 
          : `Destination: ${tokenValidation.username}`
      });
      setProgress(10);

      // Step 3: Fetch source code from GitHub
      const repoOwner = 'fofanay';
      const repoName = 'inopay';
      
      updateStep('fetch', { status: 'running', message: 'Téléchargement des fichiers source...' });
      setProgress(10);

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
      
      const relevantFiles = treeData.tree.filter((item: any) => 
        item.type === 'blob' && 
        !item.path.includes('node_modules/') &&
        !item.path.includes('dist/') &&
        !item.path.includes('.git/') &&
        !item.path.includes('bun.lockb') &&
        !item.path.includes('package-lock.json') &&
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

      const fetchFileContent = async (file: any, retries = 3): Promise<string | null> => {
        for (let attempt = 1; attempt <= retries; attempt++) {
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
              
              if (contentData.size && contentData.size > 100000 && !contentData.content) {
                const blobResponse = await fetch(
                  `https://api.github.com/repos/${repoOwner}/${repoName}/git/blobs/${file.sha}`,
                  {
                    headers: {
                      'Authorization': `Bearer ${settings.github_token}`,
                      'Accept': 'application/vnd.github.v3+json'
                    }
                  }
                );
                
                if (blobResponse.ok) {
                  const blobData = await blobResponse.json();
                  if (blobData.content && blobData.encoding === 'base64') {
                    return atob(blobData.content.replace(/\n/g, ''));
                  }
                }
              } else if (contentData.content) {
                return atob(contentData.content.replace(/\n/g, ''));
              }
            } else if (contentResponse.status === 403) {
              const blobResponse = await fetch(
                `https://api.github.com/repos/${repoOwner}/${repoName}/git/blobs/${file.sha}`,
                {
                  headers: {
                    'Authorization': `Bearer ${settings.github_token}`,
                    'Accept': 'application/vnd.github.v3+json'
                  }
                }
              );
              
              if (blobResponse.ok) {
                const blobData = await blobResponse.json();
                if (blobData.content && blobData.encoding === 'base64') {
                  return atob(blobData.content.replace(/\n/g, ''));
                }
              }
            }
          } catch (err) {
            console.warn(`[Fetch] Attempt ${attempt}/${retries} failed for ${file.path}:`, err);
            if (attempt < retries) {
              await new Promise(r => setTimeout(r, 500 * attempt));
            }
          }
        }
        return null;
      };

      let fetchedCount = 0;
      let failedCount = 0;
      const MAX_CONCURRENT = 5;
      
      for (let i = 0; i < relevantFiles.length; i += MAX_CONCURRENT) {
        const batch = relevantFiles.slice(i, i + MAX_CONCURRENT);
        const results = await Promise.all(
          batch.map(async (file: any) => {
            const content = await fetchFileContent(file);
            if (content !== null) {
              return { path: file.path, content };
            }
            return null;
          })
        );
        
        for (const result of results) {
          if (result) {
            filesToProcess.push(result);
            fetchedCount++;
          } else {
            failedCount++;
          }
        }

        setProgress(15 + ((i + batch.length) / relevantFiles.length) * 25);
        updateStep('fetch', { 
          status: 'running', 
          message: `Téléchargement: ${fetchedCount}/${relevantFiles.length} fichiers...` 
        });
      }

      updateStep('fetch', { 
        status: 'success', 
        message: `${filesToProcess.length} fichiers récupérés${failedCount > 0 ? ` (${failedCount} ignorés)` : ''}`,
        details: `Source: ${repoOwner}/${repoName}`
      });
      setProgress(40);

      // Step 4: Clean proprietary patterns
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

      // Step 5: Validate package.json
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

      // Step 6: Push to GitHub production repo
      updateStep('github', { status: 'running', message: 'Push vers GitHub...' });

      const githubResponse = await supabase.functions.invoke('process-project-liberation', {
        body: {
          files: cleanData.files || filesToProcess,
          projectName: 'inopay-production',
          userId: session.user.id,
          destinationOwner: settings.github_destination_username || undefined,
          action: 'full-pipeline'
        }
      });

      if (githubResponse.error) {
        throw new Error(`Erreur GitHub: ${githubResponse.error.message}`);
      }

      const githubData = githubResponse.data;

      if (!githubData.phases?.github?.success) {
        updateStep('github', { 
          status: 'error', 
          message: githubData.phases?.github?.error || 'Échec push GitHub' 
        });
      } else {
        updateStep('github', { 
          status: 'success', 
          message: 'Poussé vers GitHub',
          details: githubData.phases.github.repoUrl
        });
      }
      setProgress(85);

      // Step 7: Trigger Coolify deployment
      updateStep('coolify', { status: 'running', message: 'Déclenchement déploiement Coolify...' });

      if (githubData.phases?.coolify?.success) {
        updateStep('coolify', { 
          status: 'success', 
          message: 'Déploiement lancé',
          details: githubData.phases.coolify.deploymentUrl
        });
      } else if (githubData.phases?.coolify?.error) {
        updateStep('coolify', { 
          status: 'error', 
          message: githubData.phases.coolify.error
        });
      } else {
        updateStep('coolify', { 
          status: 'error', 
          message: 'Configuration Coolify manquante'
        });
      }
      setProgress(100);

      // Set final result
      setResult({
        cleanedFiles: cleanData.cleanedFiles || filesToProcess.length,
        totalChanges: cleanData.summary?.totalChanges || 0,
        removedPatterns: cleanData.summary?.removedPatterns || [],
        githubUrl: githubData.phases?.github?.repoUrl,
        deploymentUrl: githubData.phases?.coolify?.deploymentUrl
      });

      toast.success('Auto-libération terminée !', {
        description: 'Inopay est maintenant souverain'
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(errorMessage);
      toast.error('Échec de l\'auto-libération', { description: errorMessage });
      
      setSteps(prev => prev.map(s => 
        s.status === 'running' ? { ...s, status: 'error', message: errorMessage } : s
      ));
    } finally {
      setIsRunning(false);
    }
  };

  const getStepIcon = (step: LiberationStep) => {
    const icons: Record<string, React.ReactNode> = {
      auth: <Shield className="h-5 w-5" />,
      'token-check': <Github className="h-5 w-5" />,
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

  const canLaunch = isTokenValid && !isRunning;

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
        {/* Preflight Status */}
        {preflight && (
          <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">État des connexions</span>
              <Button variant="ghost" size="sm" onClick={runPreflight}>
                <RefreshCw className={`h-4 w-4 ${isPreflightRunning ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                {preflight.github.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>GitHub: {preflight.github.message}</span>
              </div>
              <div className="flex items-center gap-2">
                {preflight.coolify.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span>Coolify: {preflight.coolify.message}</span>
              </div>
            </div>
          </div>
        )}

        {/* GitHub Configuration */}
        <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Github className="h-5 w-5 text-primary" />
              <span className="font-medium">Configuration GitHub</span>
            </div>
            {tokenLoading ? (
              <Badge variant="secondary">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Chargement...
              </Badge>
            ) : isTokenValid ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connecté: {githubUsername}
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Non configuré
              </Badge>
            )}
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="github-token">Token GitHub (PAT)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="github-token"
                    type={showToken ? 'text' : 'password'}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Scopes: <code className="bg-muted px-1 rounded">repo</code>, <code className="bg-muted px-1 rounded">admin:repo_hook</code>
                {' • '}
                <a 
                  href="https://github.com/settings/tokens/new?scopes=repo,admin:repo_hook&description=Inopay%20Auto-Liberation" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Créer un token <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dest-owner">Owner cible (optionnel)</Label>
              <Input
                id="dest-owner"
                placeholder="votre-username-ou-organisation"
                value={destinationOwner}
                onChange={(e) => setDestinationOwner(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour utiliser votre compte GitHub personnel
              </p>
            </div>

            <Button
              onClick={testAndSaveGitHubToken}
              disabled={isTestingToken || !githubToken.trim()}
              variant={isTokenValid ? 'outline' : 'default'}
            >
              {isTestingToken ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Test en cours...</>
              ) : isTokenValid ? (
                'Retester & Sauvegarder'
              ) : (
                'Tester & Sauvegarder'
              )}
            </Button>
          </div>
        </div>

        {/* Coolify Configuration */}
        <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              <span className="font-medium">Configuration Coolify</span>
            </div>
            {isCoolifyConfigured ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Configuré
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Settings className="h-3 w-3 mr-1" />
                Non configuré
              </Badge>
            )}
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="coolify-url">URL Coolify</Label>
              <Input
                id="coolify-url"
                placeholder="https://coolify.monserveur.com"
                value={coolifyUrl}
                onChange={(e) => setCoolifyUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coolify-token">Token API Coolify</Label>
              <div className="relative">
                <Input
                  id="coolify-token"
                  type={showCoolifyToken ? 'text' : 'password'}
                  placeholder="Token API Coolify"
                  value={coolifyToken}
                  onChange={(e) => setCoolifyToken(e.target.value)}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowCoolifyToken(!showCoolifyToken)}
                >
                  {showCoolifyToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Créez un token dans Coolify: Settings → API
              </p>
            </div>

            <Button
              onClick={testAndSaveCoolify}
              disabled={isTestingCoolify || !coolifyUrl.trim() || !coolifyToken.trim()}
              variant={isCoolifyConfigured ? 'outline' : 'default'}
            >
              {isTestingCoolify ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Test en cours...</>
              ) : (
                'Tester & Sauvegarder'
              )}
            </Button>
          </div>
        </div>

        {/* External Backend (Optional) */}
        <div className="p-4 rounded-lg border border-dashed border-border bg-muted/10 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-muted-foreground">Backend externe (optionnel)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Configurez si vous souhaitez migrer vers votre propre backend Supabase.
          </p>
          <div className="grid gap-3">
            <Input
              placeholder="https://votre-projet.supabase.co"
              value={externalBackendUrl}
              onChange={(e) => setExternalBackendUrl(e.target.value)}
            />
            <Input
              placeholder="Anon Key"
              value={externalAnonKey}
              onChange={(e) => setExternalAnonKey(e.target.value)}
            />
          </div>
        </div>

        <Separator />

        {/* Preflight Button */}
        <Button
          onClick={runPreflight}
          disabled={isPreflightRunning}
          variant="outline"
          className="w-full"
        >
          {isPreflightRunning ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Vérification...</>
          ) : (
            <><RefreshCw className="h-4 w-4 mr-2" /> Vérifier les connexions</>
          )}
        </Button>

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
          disabled={!canLaunch}
          className="w-full h-12 text-lg font-bold"
          size="lg"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Libération en cours...
            </>
          ) : !isTokenValid ? (
            <>
              <Key className="mr-2 h-5 w-5" />
              Configurez le token GitHub
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
          et déclencher un déploiement sur votre VPS.
        </p>
      </CardContent>
    </Card>
  );
}
