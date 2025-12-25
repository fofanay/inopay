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
  GitBranch
} from 'lucide-react';
import { toast } from 'sonner';

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
  onAutoFix?: (fixAction: string) => void;
  showRawLogs?: boolean;
}

interface DetectedError {
  pattern: ErrorPattern;
  match: string;
}

export function CoolifyDeploymentErrorHandler({ 
  logs, 
  onAutoFix,
  showRawLogs = true 
}: CoolifyDeploymentErrorHandlerProps) {
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());
  const [showLogs, setShowLogs] = useState(false);

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
        <Badge variant="destructive">{detectedErrors.length}</Badge>
      </div>

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

                  {error.pattern.autoFixable && onAutoFix && error.pattern.fixAction && (
                    <Button 
                      size="sm" 
                      onClick={() => onAutoFix(error.pattern.fixAction!)}
                      className="w-full"
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Corriger automatiquement
                    </Button>
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
