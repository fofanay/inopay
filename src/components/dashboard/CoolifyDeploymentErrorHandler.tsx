import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp,
  Copy,
  ExternalLink,
  Lightbulb,
  Terminal,
  Wrench,
  FileCode,
  Package,
  Server,
  GitBranch,
  Loader2,
  GitCommit,
  RotateCw,
  Search,
  Settings,
  Key,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ErrorPattern {
  id: string;
  pattern: RegExp;
  title: string;
  severity: 'error' | 'warning' | 'info';
  category: 'build' | 'config' | 'network' | 'auth' | 'docker';
  description: string;
  solutions: string[];
  autoFixable: boolean;
  fixAction?: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Build errors
  {
    id: 'npm_ci_no_lockfile',
    pattern: /npm ci.*can only install with an existing package-lock\.json/i,
    title: 'package-lock.json manquant',
    severity: 'error',
    category: 'build',
    description: 'La commande npm ci nécessite un fichier package-lock.json qui n\'existe pas.',
    solutions: [
      '1. Modifiez le Dockerfile pour utiliser "npm install" au lieu de "npm ci"',
      '2. Ou générez package-lock.json en exécutant "npm install" localement puis committez',
      '3. Le projet utilise peut-être Bun (bun.lockb) - adaptez le Dockerfile'
    ],
    autoFixable: true,
    fixAction: 'patch_dockerfile_npm_install'
  },
  {
    id: 'package_json_not_found',
    pattern: /ENOENT.*package\.json|Could not read package\.json/i,
    title: 'package.json introuvable',
    severity: 'error',
    category: 'config',
    description: 'Le fichier package.json n\'est pas trouvé dans le contexte de build.',
    solutions: [
      '1. Vérifiez que package.json est à la racine du dépôt GitHub',
      '2. Dans Coolify, vérifiez que "Base Directory" est vide ou "/" ',
      '3. Vérifiez que "Build Context" est "."'
    ],
    autoFixable: false
  },
  {
    id: 'dockerfile_not_found',
    pattern: /failed to read dockerfile|dockerfile.*not found/i,
    title: 'Dockerfile introuvable',
    severity: 'error',
    category: 'config',
    description: 'Coolify ne trouve pas le Dockerfile à l\'emplacement spécifié.',
    solutions: [
      '1. Vérifiez que Dockerfile est à la racine du dépôt',
      '2. Dans Coolify, vérifiez "Dockerfile Location" = "Dockerfile" ou "/Dockerfile"',
      '3. Le nom est sensible à la casse : "Dockerfile" (pas "dockerfile")'
    ],
    autoFixable: false
  },
  {
    id: 'port_binding_failed',
    pattern: /port.*already.*use|address already in use|bind.*failed/i,
    title: 'Port déjà utilisé',
    severity: 'error',
    category: 'docker',
    description: 'Le port demandé est déjà utilisé par une autre application.',
    solutions: [
      '1. Dans Coolify, changez le port mappé (ex: 8080:80 au lieu de 80:80)',
      '2. Arrêtez l\'application qui utilise ce port',
      '3. Utilisez un port aléatoire dans Coolify'
    ],
    autoFixable: false
  },
  {
    id: 'github_auth_failed',
    pattern: /authentication failed|could not read username|permission denied.*github/i,
    title: 'Authentification GitHub échouée',
    severity: 'error',
    category: 'auth',
    description: 'Coolify ne peut pas accéder au dépôt GitHub (privé ou token invalide).',
    solutions: [
      '1. Si le dépôt est privé, configurez une Source GitHub dans Coolify',
      '2. Vérifiez que le token GitHub a le scope "repo" complet',
      '3. Ou rendez le dépôt public sur GitHub'
    ],
    autoFixable: false
  },
  {
    id: 'github_not_found',
    pattern: /repository not found|404.*github/i,
    title: 'Dépôt GitHub introuvable',
    severity: 'error',
    category: 'auth',
    description: 'Le dépôt n\'existe pas ou n\'est pas accessible.',
    solutions: [
      '1. Vérifiez l\'URL du dépôt (orthographe, majuscules)',
      '2. Vérifiez que le dépôt n\'a pas été supprimé ou renommé',
      '3. Si privé, configurez l\'accès dans Coolify'
    ],
    autoFixable: false
  },
  {
    id: 'npm_install_failed',
    pattern: /npm ERR!.*install|npm error.*install failed/i,
    title: 'Installation npm échouée',
    severity: 'error',
    category: 'build',
    description: 'L\'installation des dépendances npm a échoué.',
    solutions: [
      '1. Vérifiez que toutes les dépendances dans package.json sont valides',
      '2. Essayez d\'ajouter --legacy-peer-deps au Dockerfile',
      '3. Vérifiez les logs pour identifier la dépendance problématique'
    ],
    autoFixable: false
  },
  {
    id: 'vite_build_failed',
    pattern: /vite.*build.*failed|error during build/i,
    title: 'Build Vite échoué',
    severity: 'error',
    category: 'build',
    description: 'La compilation Vite a échoué.',
    solutions: [
      '1. Vérifiez les erreurs TypeScript dans le code',
      '2. Vérifiez que les variables d\'environnement VITE_* sont configurées',
      '3. Testez le build localement avec "npm run build"'
    ],
    autoFixable: false
  },
  {
    id: 'memory_limit',
    pattern: /out of memory|javascript heap|killed.*memory/i,
    title: 'Mémoire insuffisante',
    severity: 'error',
    category: 'docker',
    description: 'Le build a dépassé la limite de mémoire disponible.',
    solutions: [
      '1. Augmentez la mémoire allouée au container dans Coolify',
      '2. Ajoutez NODE_OPTIONS="--max-old-space-size=4096" dans le Dockerfile',
      '3. Optimisez les dépendances du projet'
    ],
    autoFixable: false
  },
  {
    id: 'network_timeout',
    pattern: /timeout|network.*error|ETIMEDOUT|ECONNRESET/i,
    title: 'Timeout réseau',
    severity: 'warning',
    category: 'network',
    description: 'Une opération réseau a expiré.',
    solutions: [
      '1. Réessayez le déploiement (erreur temporaire)',
      '2. Vérifiez la connectivité du serveur',
      '3. Vérifiez que npm registry est accessible'
    ],
    autoFixable: false
  }
];

interface CoolifyDeploymentErrorHandlerProps {
  logs: string;
  githubRepoUrl?: string;
  coolifyAppUuid?: string;
  serverId?: string;
  onAutoFix?: (fixAction: string) => void;
  onAutoFixComplete?: () => void;
  onRedeployTriggered?: (deploymentUuid: string) => void;
  showRawLogs?: boolean;
}

interface DetectedError {
  pattern: ErrorPattern;
  match: string;
}

interface AutoFixResult {
  success: boolean;
  message?: string;
  commit_sha?: string;
  commit_url?: string;
  files_modified?: string[];
  redeploy?: {
    success: boolean;
    deployment_uuid?: string;
    message?: string;
  };
}

interface DiagnosticsResult {
  app?: {
    uuid: string;
    name: string;
    build_pack: string | null;
    base_directory: string | null;
    dockerfile_location: string | null;
    git_repository: string | null;
    git_branch: string | null;
    git_commit_sha: string | null;
    status: string | null;
  };
  diagnostics?: {
    build_pack_ok: boolean;
    base_directory_ok: boolean;
    dockerfile_location_ok: boolean;
    git_configured: boolean;
  };
  deployments?: Array<{
    uuid: string;
    status: string;
    created_at: string;
  }>;
}

interface RepoInspectionResult {
  valid: boolean;
  owner: string;
  repo: string;
  default_branch: string;
  root_files: string[];
  has_package_json: boolean;
  has_dockerfile: boolean;
  has_package_lock: boolean;
  has_bun_lockb: boolean;
  dockerfile_analysis: {
    exists: boolean;
    content?: string;
    has_broken_pattern: boolean;
    broken_pattern_details?: string;
    has_copy_package_before_install: boolean;
    line_numbers?: {
      copy_package?: number;
      npm_install?: number;
    };
  };
  warnings: string[];
  errors: string[];
}

interface MissingEnvVar {
  key: string;
  description: string;
  isBuildTime: boolean;
  required: boolean;
  suggestedValue?: string;
}

interface EnvVarsResult {
  current_env_vars: Array<{
    key: string;
    is_build_time: boolean;
    has_value: boolean;
  }>;
  missing_required: MissingEnvVar[];
  missing_optional: MissingEnvVar[];
  warnings: string[];
  auto_fix_results?: {
    fixed: string[];
    failed: Array<{ key: string; error: string }>;
  };
  summary: {
    total_current: number;
    missing_required_count: number;
    missing_optional_count: number;
    warnings_count: number;
    is_ready: boolean;
  };
}

export function CoolifyDeploymentErrorHandler({ 
  logs, 
  githubRepoUrl,
  coolifyAppUuid,
  serverId,
  onAutoFix,
  onAutoFixComplete,
  onRedeployTriggered,
  showRawLogs = true 
}: CoolifyDeploymentErrorHandlerProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [showLogs, setShowLogs] = useState(false);
  const [isFixing, setIsFixing] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<AutoFixResult | null>(null);
  const [autoRedeploy, setAutoRedeploy] = useState(true);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [repoInspection, setRepoInspection] = useState<RepoInspectionResult | null>(null);
  const [isCheckingEnvVars, setIsCheckingEnvVars] = useState(false);
  const [envVarsResult, setEnvVarsResult] = useState<EnvVarsResult | null>(null);
  const [isFixingEnvVars, setIsFixingEnvVars] = useState(false);

  // Detect errors in logs
  const detectedErrors: DetectedError[] = [];
  
  for (const pattern of ERROR_PATTERNS) {
    const match = logs.match(pattern.pattern);
    if (match) {
      detectedErrors.push({
        pattern,
        match: match[0]
      });
    }
  }

  const handleAutoFix = async (fixAction: string) => {
    if (!githubRepoUrl) {
      toast.error('URL du dépôt GitHub requise pour l\'auto-fix');
      return;
    }

    setIsFixing(fixAction);
    setFixResult(null);

    try {
      const canRedeploy = autoRedeploy && coolifyAppUuid && serverId;
      
      const { data, error } = await supabase.functions.invoke('auto-fix-dockerfile', {
        body: {
          github_repo_url: githubRepoUrl,
          fix_type: fixAction,
          auto_redeploy: canRedeploy,
          coolify_app_uuid: coolifyAppUuid,
          server_id: serverId
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setFixResult({
          success: true,
          message: data.message,
          commit_sha: data.commit_sha,
          commit_url: data.commit_url,
          files_modified: data.files_modified,
          redeploy: data.redeploy
        });
        
        if (data.redeploy?.success) {
          toast.success('Dockerfile corrigé et redéploiement lancé!', {
            description: `Commit: ${data.commit_sha?.slice(0, 7)} - Redeploy en cours...`,
            action: data.commit_url ? {
              label: 'Voir commit',
              onClick: () => window.open(data.commit_url, '_blank')
            } : undefined
          });
          onRedeployTriggered?.(data.redeploy.deployment_uuid);
        } else {
          toast.success('Dockerfile corrigé avec succès!', {
            description: `Commit: ${data.commit_sha?.slice(0, 7)}${data.redeploy ? ` - Redeploy: ${data.redeploy.message}` : ''}`,
            action: data.commit_url ? {
              label: 'Voir',
              onClick: () => window.open(data.commit_url, '_blank')
            } : undefined
          });
        }
        
        onAutoFix?.(fixAction);
        onAutoFixComplete?.();
      } else {
        throw new Error(data.error || 'Auto-fix failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      setFixResult({
        success: false,
        message: errorMessage
      });
      toast.error('Échec de l\'auto-fix', { description: errorMessage });
    } finally {
      setIsFixing(null);
    }
  }

  const toggleError = (id: string) => {
    const newExpanded = new Set(expandedErrors);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedErrors(newExpanded);
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(logs);
    toast.success('Logs copiés!');
  };

  const handleInspectRepo = async () => {
    if (!githubRepoUrl) {
      toast.error('URL du dépôt GitHub requise');
      return;
    }

    setIsInspecting(true);
    setRepoInspection(null);

    try {
      const { data, error } = await supabase.functions.invoke('inspect-github-repo', {
        body: {
          github_repo_url: githubRepoUrl
        }
      });

      if (error) throw error;

      setRepoInspection(data);
      
      if (data.dockerfile_analysis?.has_broken_pattern) {
        toast.error('Dockerfile cassé détecté!', {
          description: data.dockerfile_analysis.broken_pattern_details
        });
      } else if (data.errors?.length > 0) {
        toast.warning(`${data.errors.length} problème(s) trouvé(s)`);
      } else {
        toast.success('Dépôt validé avec succès');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error('Échec de l\'inspection', { description: errorMessage });
    } finally {
      setIsInspecting(false);
    }
  };

  const handleDiagnostics = async () => {
    if (!coolifyAppUuid || !serverId) {
      toast.error('UUID de l\'application et ID du serveur requis');
      return;
    }

    setIsDiagnosing(true);
    setDiagnostics(null);

    try {
      const { data, error } = await supabase.functions.invoke('get-coolify-app-details', {
        body: {
          server_id: serverId,
          app_uuid: coolifyAppUuid
        }
      });

      if (error) throw error;

      setDiagnostics(data);
      
      if (data.diagnostics) {
        const issues = [];
        if (!data.diagnostics.build_pack_ok) issues.push('build_pack');
        if (!data.diagnostics.base_directory_ok) issues.push('base_directory');
        if (!data.diagnostics.dockerfile_location_ok) issues.push('dockerfile_location');
        if (!data.diagnostics.git_configured) issues.push('git');
        
        if (issues.length > 0) {
          toast.warning(`Configuration à vérifier: ${issues.join(', ')}`);
        } else {
          toast.success('Configuration Coolify OK');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error('Échec du diagnostic', { description: errorMessage });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleCheckEnvVars = async () => {
    if (!coolifyAppUuid || !serverId) {
      toast.error('UUID de l\'application et ID du serveur requis');
      return;
    }

    setIsCheckingEnvVars(true);
    setEnvVarsResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('detect-missing-env-vars', {
        body: {
          server_id: serverId,
          app_uuid: coolifyAppUuid,
          auto_fix: false
        }
      });

      if (error) throw error;

      setEnvVarsResult(data);
      
      if (data.summary.missing_required_count > 0) {
        toast.warning(`${data.summary.missing_required_count} variable(s) requise(s) manquante(s)`);
      } else if (data.warnings.length > 0) {
        toast.warning(`${data.warnings.length} avertissement(s)`);
      } else {
        toast.success('Variables d\'environnement OK');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error('Échec de la vérification', { description: errorMessage });
    } finally {
      setIsCheckingEnvVars(false);
    }
  };

  const handleFixEnvVars = async () => {
    if (!coolifyAppUuid || !serverId) {
      toast.error('UUID de l\'application et ID du serveur requis');
      return;
    }

    setIsFixingEnvVars(true);

    try {
      const { data, error } = await supabase.functions.invoke('detect-missing-env-vars', {
        body: {
          server_id: serverId,
          app_uuid: coolifyAppUuid,
          auto_fix: true
        }
      });

      if (error) throw error;

      setEnvVarsResult(data);
      
      if (data.auto_fix_results?.fixed.length > 0) {
        toast.success(`${data.auto_fix_results.fixed.length} variable(s) ajoutée(s)`);
      }
      if (data.auto_fix_results?.failed.length > 0) {
        toast.warning(`${data.auto_fix_results.failed.length} variable(s) en échec`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error('Échec de la correction', { description: errorMessage });
    } finally {
      setIsFixingEnvVars(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-warning" />;
      default: return <CheckCircle2 className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'build': return <Package className="h-4 w-4" />;
      case 'config': return <FileCode className="h-4 w-4" />;
      case 'docker': return <Server className="h-4 w-4" />;
      case 'auth': return <GitBranch className="h-4 w-4" />;
      default: return <Terminal className="h-4 w-4" />;
    }
  };

  if (!logs || logs.trim().length === 0) {
    return (
      <Alert>
        <Terminal className="h-4 w-4" />
        <AlertTitle>Pas de logs disponibles</AlertTitle>
        <AlertDescription>
          Les logs de déploiement ne sont pas encore disponibles.
        </AlertDescription>
      </Alert>
    );
  }

  if (detectedErrors.length === 0) {
    return (
      <div className="space-y-4">
        <Alert className="bg-green-500/10 border-green-500">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="text-green-700 dark:text-green-400">Aucune erreur détectée</AlertTitle>
          <AlertDescription>
            Les logs ne contiennent pas d'erreurs connues. Le déploiement peut être en cours ou terminé avec succès.
          </AlertDescription>
        </Alert>

        {showRawLogs && (
          <Collapsible open={showLogs} onOpenChange={setShowLogs}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <Terminal className="h-4 w-4 mr-2" />
                {showLogs ? 'Masquer' : 'Afficher'} les logs bruts
                {showLogs ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2">
                <CardContent className="p-4">
                  <div className="flex justify-end mb-2">
                    <Button size="sm" variant="ghost" onClick={copyLogs}>
                      <Copy className="h-4 w-4 mr-1" /> Copier
                    </Button>
                  </div>
                  <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap">
                    {logs}
                  </pre>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          {detectedErrors.length} erreur{detectedErrors.length > 1 ? 's' : ''} détectée{detectedErrors.length > 1 ? 's' : ''}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {githubRepoUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInspectRepo}
              disabled={isInspecting}
            >
              {isInspecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileCode className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">Inspecter Repo</span>
            </Button>
          )}
          {coolifyAppUuid && serverId && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiagnostics}
                disabled={isDiagnosing}
              >
                {isDiagnosing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Diagnostic</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCheckEnvVars}
                disabled={isCheckingEnvVars}
              >
                {isCheckingEnvVars ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Key className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">Env Vars</span>
              </Button>
            </>
          )}
          <Badge variant="destructive">{detectedErrors.length}</Badge>
        </div>
      </div>

      {/* Repo Inspection Results */}
      {repoInspection && (
        <Card className={`border-2 ${repoInspection.valid ? 'border-green-500/50 bg-green-500/5' : 'border-destructive/50 bg-destructive/5'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Inspection du dépôt: {repoInspection.owner}/{repoInspection.repo}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-primary" />
                <span>Branche: <strong>{repoInspection.default_branch}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                {repoInspection.has_package_json ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
                <span>package.json</span>
              </div>
              <div className="flex items-center gap-2">
                {repoInspection.has_dockerfile ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-warning" />
                )}
                <span>Dockerfile</span>
              </div>
              <div className="flex items-center gap-2">
                {repoInspection.has_package_lock || repoInspection.has_bun_lockb ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-warning" />
                )}
                <span>{repoInspection.has_package_lock ? 'package-lock.json' : repoInspection.has_bun_lockb ? 'bun.lockb' : 'Pas de lock file'}</span>
              </div>
            </div>

            {/* Dockerfile Analysis */}
            {repoInspection.dockerfile_analysis?.exists && (
              <div className={`p-2 rounded text-xs ${repoInspection.dockerfile_analysis.has_broken_pattern ? 'bg-destructive/20 border border-destructive' : 'bg-green-500/10'}`}>
                <div className="flex items-center gap-2 font-medium">
                  {repoInspection.dockerfile_analysis.has_broken_pattern ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">Dockerfile cassé!</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">Dockerfile valide</span>
                    </>
                  )}
                </div>
                {repoInspection.dockerfile_analysis.broken_pattern_details && (
                  <p className="mt-1 text-destructive">{repoInspection.dockerfile_analysis.broken_pattern_details}</p>
                )}
                {repoInspection.dockerfile_analysis.line_numbers && (
                  <p className="text-muted-foreground mt-1">
                    COPY package: L{repoInspection.dockerfile_analysis.line_numbers.copy_package || '?'} | 
                    npm install: L{repoInspection.dockerfile_analysis.line_numbers.npm_install || '?'}
                  </p>
                )}
              </div>
            )}

            {/* Errors */}
            {repoInspection.errors.length > 0 && (
              <div className="space-y-1">
                {repoInspection.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {repoInspection.warnings.length > 0 && (
              <div className="space-y-1">
                {repoInspection.warnings.map((warn, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-warning">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diagnostics Results */}
      {diagnostics && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuration Coolify
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2">
                {diagnostics.diagnostics?.build_pack_ok ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
                <span>build_pack: {diagnostics.app?.build_pack || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                {diagnostics.diagnostics?.base_directory_ok ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
                <span>base_directory: {diagnostics.app?.base_directory || '/'}</span>
              </div>
              <div className="flex items-center gap-2">
                {diagnostics.diagnostics?.dockerfile_location_ok ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
                <span>dockerfile: {diagnostics.app?.dockerfile_location || '/Dockerfile'}</span>
              </div>
              <div className="flex items-center gap-2">
                {diagnostics.diagnostics?.git_configured ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
                <span>git: {diagnostics.diagnostics?.git_configured ? 'configuré' : 'manquant'}</span>
              </div>
            </div>
            
            {/* Git Branch and Commit Info */}
            {diagnostics.app?.git_branch && (
              <div className="flex items-center gap-4 text-xs border-t pt-2 mt-2">
                <div className="flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  <span>Branche: <strong>{diagnostics.app.git_branch}</strong></span>
                </div>
                {diagnostics.app.git_commit_sha && (
                  <div className="flex items-center gap-1">
                    <GitCommit className="h-3 w-3" />
                    <span>Commit: <code className="bg-muted px-1 rounded">{diagnostics.app.git_commit_sha.slice(0, 7)}</code></span>
                  </div>
                )}
              </div>
            )}
            
            {/* Branch mismatch warning */}
            {repoInspection && diagnostics.app?.git_branch && 
             repoInspection.default_branch !== diagnostics.app.git_branch && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Attention:</strong> Coolify utilise la branche <code>{diagnostics.app.git_branch}</code> mais 
                  la branche par défaut du dépôt est <code>{repoInspection.default_branch}</code>
                </AlertDescription>
              </Alert>
            )}
            
            {diagnostics.app?.status && (
              <p className="text-xs text-muted-foreground">
                Status: <Badge variant="outline" className="text-xs">{diagnostics.app.status}</Badge>
              </p>
            )}
            {diagnostics.deployments && diagnostics.deployments.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Dernier déploiement: {diagnostics.deployments[0]?.status}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Environment Variables Check Results */}
      {envVarsResult && (
        <Card className={`border-2 ${envVarsResult.summary.is_ready ? 'border-green-500/50 bg-green-500/5' : 'border-orange-500/50 bg-orange-500/5'}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Variables d'environnement
              </div>
              {!envVarsResult.summary.is_ready && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleFixEnvVars}
                  disabled={isFixingEnvVars}
                >
                  {isFixingEnvVars ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Auto-fix
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-4 text-xs">
              <Badge variant={envVarsResult.summary.is_ready ? 'default' : 'destructive'}>
                {envVarsResult.summary.total_current} configurée(s)
              </Badge>
              {envVarsResult.summary.missing_required_count > 0 && (
                <Badge variant="destructive">
                  {envVarsResult.summary.missing_required_count} requise(s) manquante(s)
                </Badge>
              )}
              {envVarsResult.summary.warnings_count > 0 && (
                <Badge variant="outline" className="border-orange-500 text-orange-500">
                  {envVarsResult.summary.warnings_count} avertissement(s)
                </Badge>
              )}
            </div>

            {/* Current env vars */}
            {envVarsResult.current_env_vars.length > 0 && (
              <div className="text-xs">
                <p className="font-medium mb-1">Variables actuelles:</p>
                <div className="flex flex-wrap gap-1">
                  {envVarsResult.current_env_vars.map((env) => (
                    <Badge 
                      key={env.key} 
                      variant="outline" 
                      className={`text-xs ${env.is_build_time ? 'border-blue-500' : ''}`}
                    >
                      {env.key}
                      {env.is_build_time && <span className="ml-1 text-blue-500">⚡</span>}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Missing required */}
            {envVarsResult.missing_required.length > 0 && (
              <div className="text-xs space-y-1">
                <p className="font-medium text-destructive">Variables requises manquantes:</p>
                {envVarsResult.missing_required.map((env) => (
                  <div key={env.key} className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    <span>{env.key}</span>
                    <span className="text-muted-foreground">- {env.description}</span>
                    {env.suggestedValue && (
                      <Badge variant="outline" className="text-xs text-green-600">
                        Auto-fix disponible
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {envVarsResult.warnings.length > 0 && (
              <div className="text-xs space-y-1">
                <p className="font-medium text-orange-500">Avertissements:</p>
                {envVarsResult.warnings.map((warn, i) => (
                  <div key={i} className="flex items-start gap-2 text-orange-500">
                    <AlertTriangle className="h-3 w-3 mt-0.5" />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-fix results */}
            {envVarsResult.auto_fix_results && (
              <div className="text-xs space-y-1 border-t pt-2">
                {envVarsResult.auto_fix_results.fixed.length > 0 && (
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Variables ajoutées: {envVarsResult.auto_fix_results.fixed.join(', ')}</span>
                  </div>
                )}
                {envVarsResult.auto_fix_results.failed.length > 0 && (
                  <div className="space-y-1">
                    {envVarsResult.auto_fix_results.failed.map((fail) => (
                      <div key={fail.key} className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        <span>{fail.key}: {fail.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {detectedErrors.map((error, idx) => (
          <Card key={`${error.pattern.id}-${idx}`} className={`
            border-l-4 
            ${error.pattern.severity === 'error' ? 'border-l-destructive' : 
              error.pattern.severity === 'warning' ? 'border-l-warning' : 'border-l-muted'}
          `}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getSeverityIcon(error.pattern.severity)}
                  <div>
                    <CardTitle className="text-base">{error.pattern.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getCategoryIcon(error.pattern.category)}
                        <span className="ml-1 capitalize">{error.pattern.category}</span>
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => toggleError(error.pattern.id)}
                >
                  {expandedErrors.has(error.pattern.id) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            
            <Collapsible open={expandedErrors.has(error.pattern.id)}>
              <CollapsibleContent>
                <CardContent className="pt-0 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {error.pattern.description}
                  </p>

                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs font-mono text-muted-foreground truncate">
                      Log: "{error.match}"
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Solutions recommandées
                    </h4>
                    <ul className="space-y-1">
                      {error.pattern.solutions.map((solution, sIdx) => (
                        <li key={sIdx} className="text-sm text-muted-foreground pl-4">
                          {solution}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {error.pattern.autoFixable && githubRepoUrl && error.pattern.fixAction && (
                    <div className="space-y-2">
                      {fixResult && fixResult.success && (
                        <Alert className="bg-green-500/10 border-green-500">
                          <GitCommit className="h-4 w-4 text-green-500" />
                          <AlertTitle className="text-green-700 dark:text-green-400">
                            Correction appliquée
                          </AlertTitle>
                          <AlertDescription className="text-sm space-y-2">
                            <p>{fixResult.message}</p>
                            {fixResult.files_modified && (
                              <p className="text-xs">
                                Fichiers modifiés: {fixResult.files_modified.join(', ')}
                              </p>
                            )}
                            {fixResult.redeploy && (
                              <div className={`flex items-center gap-2 text-xs ${fixResult.redeploy.success ? 'text-green-600' : 'text-orange-500'}`}>
                                <RotateCw className="h-3 w-3" />
                                {fixResult.redeploy.success 
                                  ? `Redéploiement lancé: ${fixResult.redeploy.deployment_uuid?.slice(0, 8)}...`
                                  : `Redeploy: ${fixResult.redeploy.message}`
                                }
                              </div>
                            )}
                            {fixResult.commit_url && (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto"
                                onClick={() => window.open(fixResult.commit_url, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Voir le commit
                              </Button>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {fixResult && !fixResult.success && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Échec de l'auto-fix</AlertTitle>
                          <AlertDescription>{fixResult.message}</AlertDescription>
                        </Alert>
                      )}
                      
                      {/* Auto-redeploy toggle */}
                      {coolifyAppUuid && serverId && (
                        <div className="flex items-center justify-between text-sm">
                          <label className="flex items-center gap-2 text-muted-foreground">
                            <RotateCw className="h-4 w-4" />
                            Redéployer automatiquement après correction
                          </label>
                          <input
                            type="checkbox"
                            checked={autoRedeploy}
                            onChange={(e) => setAutoRedeploy(e.target.checked)}
                            className="rounded border-border"
                          />
                        </div>
                      )}
                      
                      <Button 
                        size="sm" 
                        onClick={() => handleAutoFix(error.pattern.fixAction!)}
                        disabled={isFixing !== null}
                        className="w-full"
                      >
                        {isFixing === error.pattern.fixAction ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            {autoRedeploy && coolifyAppUuid ? 'Correction + Redéploiement...' : 'Correction en cours...'}
                          </>
                        ) : (
                          <>
                            <Wrench className="h-4 w-4 mr-2" />
                            {autoRedeploy && coolifyAppUuid ? 'Corriger et redéployer' : 'Corriger automatiquement'}
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {showRawLogs && (
        <Collapsible open={showLogs} onOpenChange={setShowLogs}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <Terminal className="h-4 w-4 mr-2" />
              {showLogs ? 'Masquer' : 'Afficher'} les logs complets
              {showLogs ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardContent className="p-4">
                <div className="flex justify-end mb-2">
                  <Button size="sm" variant="ghost" onClick={copyLogs}>
                    <Copy className="h-4 w-4 mr-1" /> Copier
                  </Button>
                </div>
                <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-64 whitespace-pre-wrap">
                  {logs}
                </pre>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
