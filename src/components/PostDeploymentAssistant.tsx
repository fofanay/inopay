import React, { useState } from "react";
import { 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  ChevronRight, 
  ChevronDown,
  Zap,
  Cloud,
  Rocket,
  Server,
  Check,
  ArrowRight,
  HelpCircle,
  Globe,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import DeploymentValidator from "./DeploymentValidator";

interface EnvVariable {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}

interface PostDeploymentAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  githubRepoUrl?: string;
  detectedEnvVars?: string[];
  projectName: string;
}

const ENV_VAR_INFO: Record<string, { description: string; example: string; required: boolean }> = {
  'VITE_SUPABASE_URL': { 
    description: 'URL de votre projet Supabase', 
    example: 'https://xxxx.supabase.co',
    required: true
  },
  'VITE_SUPABASE_ANON_KEY': { 
    description: 'Clé anonyme Supabase (publique)', 
    example: 'eyJhbGciOiJIUzI1...',
    required: true
  },
  'VITE_SUPABASE_PUBLISHABLE_KEY': { 
    description: 'Clé publique Supabase', 
    example: 'eyJhbGciOiJIUzI1...',
    required: false
  },
  'VITE_API_URL': { 
    description: 'URL de votre API backend', 
    example: 'https://api.example.com',
    required: false
  },
  'VITE_STRIPE_PUBLISHABLE_KEY': { 
    description: 'Clé publique Stripe (commence par pk_)', 
    example: 'pk_live_xxx ou pk_test_xxx',
    required: false
  },
  'STRIPE_SECRET_KEY': { 
    description: 'Clé secrète Stripe (à garder confidentielle)', 
    example: 'sk_live_xxx ou sk_test_xxx',
    required: false
  },
  'DATABASE_URL': { 
    description: 'URL de connexion PostgreSQL', 
    example: 'postgresql://user:pass@host:5432/db',
    required: false
  },
  'SUPABASE_URL': { 
    description: 'URL Supabase pour les edge functions', 
    example: 'https://xxxx.supabase.co',
    required: true
  },
  'SUPABASE_ANON_KEY': { 
    description: 'Clé anonyme pour edge functions', 
    example: 'eyJhbGciOiJIUzI1...',
    required: true
  },
  'SUPABASE_SERVICE_ROLE_KEY': { 
    description: 'Clé service role (backend uniquement, confidentielle)', 
    example: 'eyJhbGciOiJIUzI1...',
    required: false
  },
  'GITHUB_PERSONAL_ACCESS_TOKEN': { 
    description: 'Token GitHub avec permissions repo', 
    example: 'ghp_xxxxxxxxxxxx',
    required: false
  },
};

const PLATFORM_GUIDES = {
  vercel: {
    name: 'Vercel',
    icon: Zap,
    color: 'text-black dark:text-white',
    steps: [
      {
        title: 'Importer le projet',
        description: 'Cliquez sur "Add New..." → "Project" et sélectionnez votre dépôt GitHub',
        action: 'Aller sur Vercel',
        url: 'https://vercel.com/new'
      },
      {
        title: 'Configuration automatique',
        description: 'Le fichier vercel.json est déjà configuré pour résoudre les conflits de dépendances',
        details: 'Pas de configuration manuelle requise !'
      },
      {
        title: 'Ajouter les variables d\'environnement',
        description: 'Dans "Environment Variables", ajoutez chaque variable détectée',
        details: 'Project Settings → Environment Variables'
      },
      {
        title: 'Déployer',
        description: 'Cliquez sur "Deploy" - le build utilisera automatiquement --legacy-peer-deps',
        details: 'Le redéploiement est automatique à chaque push'
      }
    ],
    envInstructions: 'Project Settings → Environment Variables → Add New',
    commonIssues: [
      {
        error: 'ERESOLVE unable to resolve dependency tree',
        solution: 'Ce problème est déjà résolu ! Le vercel.json inclus force npm à utiliser --legacy-peer-deps. Relancez simplement le déploiement.',
        autoFixed: true
      },
      {
        error: 'react-leaflet requires react@^19',
        solution: 'Les dépendances incompatibles ont été automatiquement corrigées lors de l\'export. react-leaflet est maintenant en version ^4.2.1 compatible avec React 18.',
        autoFixed: true
      },
      {
        error: 'Build failed - Module not found',
        solution: 'Vérifiez que toutes les variables d\'environnement sont configurées dans Vercel (Settings → Environment Variables).',
        autoFixed: false
      }
    ]
  },
  netlify: {
    name: 'Netlify',
    icon: Cloud,
    color: 'text-teal-500',
    steps: [
      {
        title: 'Importer depuis GitHub',
        description: 'Cliquez sur "Add new site" → "Import an existing project"',
        action: 'Aller sur Netlify',
        url: 'https://app.netlify.com/start'
      },
      {
        title: 'Configuration automatique',
        description: 'Le fichier netlify.toml configure automatiquement le build avec --legacy-peer-deps',
        details: 'Aucune configuration manuelle requise'
      },
      {
        title: 'Ajouter les variables d\'environnement',
        description: 'Dans Site Settings, ajoutez les variables d\'environnement',
        details: 'Site Settings > Environment Variables > Add a variable'
      }
    ],
    envInstructions: 'Site Settings → Environment Variables → Add a variable',
    commonIssues: [
      {
        error: 'ERESOLVE unable to resolve dependency tree',
        solution: 'Le netlify.toml inclus dans votre projet utilise --legacy-peer-deps automatiquement. Relancez le déploiement.',
        autoFixed: true
      },
      {
        error: 'Page not found on refresh',
        solution: 'Les redirects SPA sont déjà configurés dans netlify.toml. Si le problème persiste, vérifiez que le fichier est bien présent.',
        autoFixed: true
      }
    ]
  },
  railway: {
    name: 'Railway',
    icon: Rocket,
    color: 'text-purple-500',
    steps: [
      {
        title: 'Créer un nouveau projet',
        description: 'Cliquez sur "New Project" → "Deploy from GitHub repo"',
        action: 'Aller sur Railway',
        url: 'https://railway.app/new'
      },
      {
        title: 'Ajouter les variables',
        description: 'Dans l\'onglet "Variables", ajoutez chaque variable',
        details: 'Cliquez sur le service > Variables > New Variable'
      },
      {
        title: 'Déploiement automatique',
        description: 'Railway redéploie automatiquement à chaque changement',
        details: 'Les déploiements sont visibles dans l\'onglet Deployments'
      }
    ],
    envInstructions: 'Service → Variables → New Variable'
  },
  docker: {
    name: 'Docker',
    icon: Server,
    color: 'text-blue-500',
    steps: [
      {
        title: 'Créer le fichier .env',
        description: 'Copiez le fichier .env.example vers .env et remplissez les valeurs',
        details: 'cp .env.example .env && nano .env'
      },
      {
        title: 'Build de l\'image',
        description: 'Construisez l\'image Docker avec les bonnes variables',
        details: 'docker build -t mon-app .'
      },
      {
        title: 'Lancer le conteneur',
        description: 'Démarrez le conteneur avec le fichier .env',
        details: 'docker run --env-file .env -p 80:80 mon-app'
      }
    ],
    envInstructions: 'Créez un fichier .env à la racine du projet'
  }
};

const PostDeploymentAssistant = ({ 
  isOpen, 
  onClose, 
  githubRepoUrl,
  detectedEnvVars = [],
  projectName
}: PostDeploymentAssistantProps) => {
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<keyof typeof PLATFORM_GUIDES>('vercel');
  const [completedSteps, setCompletedSteps] = useState<Record<string, number[]>>({
    vercel: [],
    netlify: [],
    railway: [],
    docker: []
  });
  const [expandedVars, setExpandedVars] = useState<string[]>([]);
  const [showValidator, setShowValidator] = useState(false);

  const envVariables: EnvVariable[] = detectedEnvVars.map(name => ({
    name,
    description: ENV_VAR_INFO[name]?.description || 'Variable d\'environnement',
    required: ENV_VAR_INFO[name]?.required || false,
    example: ENV_VAR_INFO[name]?.example
  }));

  const toggleStep = (platform: string, stepIndex: number) => {
    setCompletedSteps(prev => {
      const current = prev[platform] || [];
      if (current.includes(stepIndex)) {
        return { ...prev, [platform]: current.filter(i => i !== stepIndex) };
      }
      return { ...prev, [platform]: [...current, stepIndex] };
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({
      title: "Copié !",
      description: `${label} copié dans le presse-papiers`,
    });
  };

  const copyAllEnvVars = async () => {
    const content = envVariables
      .map(v => `${v.name}=`)
      .join('\n');
    await copyToClipboard(content, 'Toutes les variables');
  };

  const platform = PLATFORM_GUIDES[selectedPlatform];
  const PlatformIcon = platform.icon;
  const completedCount = completedSteps[selectedPlatform]?.length || 0;
  const totalSteps = platform.steps.length;
  const progress = (completedCount / totalSteps) * 100;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Assistant de configuration
          </DialogTitle>
          <DialogDescription>
            Guide étape par étape pour configurer vos variables d'environnement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Platform selector */}
          <Tabs value={selectedPlatform} onValueChange={(v) => setSelectedPlatform(v as keyof typeof PLATFORM_GUIDES)}>
            <TabsList className="grid w-full grid-cols-4">
              {Object.entries(PLATFORM_GUIDES).map(([key, p]) => {
                const Icon = p.icon;
                return (
                  <TabsTrigger key={key} value={key} className="gap-1.5">
                    <Icon className={`h-4 w-4 ${p.color}`} />
                    <span className="hidden sm:inline">{p.name}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {Object.entries(PLATFORM_GUIDES).map(([key, p]) => (
              <TabsContent key={key} value={key} className="mt-4 space-y-4">
                {/* Progress indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg bg-muted ${p.color}`}>
                      {React.createElement(p.icon, { className: "h-5 w-5" })}
                    </div>
                    <div>
                      <h3 className="font-semibold">{p.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {completedCount}/{totalSteps} étapes complétées
                      </p>
                    </div>
                  </div>
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Steps */}
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    {p.steps.map((step, index) => {
                      const isCompleted = completedSteps[key]?.includes(index);
                      return (
                        <div 
                          key={index}
                          className={`p-3 rounded-lg border transition-colors ${
                            isCompleted 
                              ? 'border-primary/50 bg-primary/5' 
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => toggleStep(key, index)}
                              className={`mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                isCompleted 
                                  ? 'bg-primary border-primary text-primary-foreground' 
                                  : 'border-muted-foreground/30 hover:border-primary'
                              }`}
                            >
                              {isCompleted ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <span className="text-xs font-medium">{index + 1}</span>
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                                  {step.title}
                                </h4>
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {step.description}
                              </p>
                              {step.details && (
                                <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
                                  {step.details}
                                </code>
                              )}
                              {step.action && step.url && (
                                <Button 
                                  variant="link" 
                                  size="sm" 
                                  className="p-0 h-auto mt-2"
                                  onClick={() => window.open(step.url, '_blank')}
                                >
                                  {step.action}
                                  <ExternalLink className="ml-1 h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                {/* Environment variables section */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">Variables d'environnement</CardTitle>
                        <CardDescription>
                          {p.envInstructions}
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm" onClick={copyAllEnvVars}>
                        <Copy className="h-4 w-4 mr-1.5" />
                        Tout copier
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {envVariables.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucune variable d'environnement détectée
                      </p>
                    ) : (
                      envVariables.map((envVar) => (
                        <Collapsible
                          key={envVar.name}
                          open={expandedVars.includes(envVar.name)}
                          onOpenChange={(open) => {
                            setExpandedVars(prev => 
                              open 
                                ? [...prev, envVar.name] 
                                : prev.filter(v => v !== envVar.name)
                            );
                          }}
                        >
                          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <CollapsibleTrigger className="flex items-center gap-1.5">
                                {expandedVars.includes(envVar.name) ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                              </CollapsibleTrigger>
                              <code className="text-sm font-mono truncate">{envVar.name}</code>
                              {envVar.required && (
                                <Badge variant="destructive" className="text-[10px] px-1.5">
                                  Requis
                                </Badge>
                              )}
                            </div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => copyToClipboard(envVar.name, envVar.name)}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copier le nom</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <CollapsibleContent>
                            <div className="ml-6 p-3 bg-muted/30 rounded-lg text-sm space-y-2">
                              <p className="text-muted-foreground">{envVar.description}</p>
                              {envVar.example && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Exemple:</span>
                                  <code className="bg-muted px-2 py-0.5 rounded text-xs">
                                    {envVar.example}
                                  </code>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Common issues section */}
                {(p as any).commonIssues && (p as any).commonIssues.length > 0 && (
                  <Card className="border-warning/30 bg-warning/5">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <CardTitle className="text-base">Problèmes courants et solutions</CardTitle>
                      </div>
                      <CardDescription>
                        Votre projet est pré-configuré pour éviter ces erreurs
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {((p as any).commonIssues as Array<{error: string; solution: string; autoFixed: boolean}>).map((issue, index) => (
                        <div 
                          key={index}
                          className={`p-3 rounded-lg border ${
                            issue.autoFixed 
                              ? 'border-success/30 bg-success/5' 
                              : 'border-warning/30 bg-warning/5'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            {issue.autoFixed ? (
                              <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                  {issue.error}
                                </code>
                                {issue.autoFixed && (
                                  <Badge variant="outline" className="text-[10px] text-success border-success/30 bg-success/10">
                                    Résolu automatiquement
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1.5">
                                {issue.solution}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            ))}
          </Tabs>

          {/* Quick actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => setShowValidator(true)}
              >
                <Globe className="h-4 w-4 mr-2" />
                Vérifier le déploiement
              </Button>
              {githubRepoUrl && (
                <Button 
                  variant="outline"
                  onClick={() => window.open(githubRepoUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Voir sur GitHub
                </Button>
              )}
              <Button 
                onClick={() => {
                  const url = selectedPlatform === 'vercel' 
                    ? `https://vercel.com/new/clone?repository-url=${encodeURIComponent(githubRepoUrl || '')}`
                    : selectedPlatform === 'netlify'
                    ? `https://app.netlify.com/start/deploy?repository=${encodeURIComponent(githubRepoUrl || '')}`
                    : selectedPlatform === 'railway'
                    ? 'https://railway.app/new'
                    : null;
                  
                  if (url) window.open(url, '_blank');
                }}
                disabled={!githubRepoUrl && selectedPlatform !== 'docker'}
              >
                Déployer sur {platform.name}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Deployment validator modal */}
        <DeploymentValidator 
          isOpen={showValidator}
          onClose={() => setShowValidator(false)}
          projectName={projectName}
        />
      </DialogContent>
    </Dialog>
  );
};

export default PostDeploymentAssistant;