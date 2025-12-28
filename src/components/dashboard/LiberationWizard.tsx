import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Github, 
  CheckCircle2, 
  Loader2, 
  Eye, 
  EyeOff, 
  ArrowRight,
  ArrowLeft,
  Lock,
  Unlock,
  Info,
  Rocket,
  AlertTriangle,
  ExternalLink,
  FolderGit,
  Plus
} from 'lucide-react';

type WizardStep = 'source' | 'destination' | 'review';

interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  private: boolean;
}

interface WizardConfig {
  // Source
  sourceToken: string;
  sourceUrl: string;
  // Destination
  destinationToken: string;
  destinationUsername: string;
  isPrivateRepo: boolean;
  // Repo destination mode
  createNewRepo: boolean;
  existingRepoName?: string;
}

interface LiberationWizardProps {
  onComplete: (config: WizardConfig) => void;
  onSkip?: () => void;
}

export function LiberationWizard({ onComplete, onSkip }: LiberationWizardProps) {
  const [step, setStep] = useState<WizardStep>('source');
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  
  // Show/hide password fields
  const [showSourceToken, setShowSourceToken] = useState(false);
  const [showDestToken, setShowDestToken] = useState(false);
  
  // Config state
  const [config, setConfig] = useState<WizardConfig>({
    sourceToken: '',
    sourceUrl: '',
    destinationToken: '',
    destinationUsername: '',
    isPrivateRepo: true,
    createNewRepo: true,
    existingRepoName: undefined,
  });
  
  // Destination repos
  const [destRepos, setDestRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  
  // Validation states
  const [sourceValid, setSourceValid] = useState<boolean | null>(null);
  const [destValid, setDestValid] = useState<boolean | null>(null);
  const [sourceUsername, setSourceUsername] = useState<string>('');
  
  // Pre-configured status
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  useEffect(() => {
    loadExistingConfig();
  }, []);

  const loadExistingConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data: settings } = await supabase
        .from('user_settings')
        .select('github_source_token, github_destination_token, github_destination_username, default_repo_private')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (settings) {
        const hasConfig = !!(settings.github_source_token && settings.github_destination_token && settings.github_destination_username);
        setHasExistingConfig(hasConfig);
        
        setConfig({
          sourceToken: settings.github_source_token || '',
          sourceUrl: '',
          destinationToken: settings.github_destination_token || '',
          destinationUsername: settings.github_destination_username || '',
          isPrivateRepo: settings.default_repo_private ?? true,
          createNewRepo: true,
          existingRepoName: undefined,
        });
        
        // Validate existing tokens
        if (settings.github_source_token) {
          validateGitHubToken(settings.github_source_token, 'source');
        }
        if (settings.github_destination_token) {
          validateGitHubToken(settings.github_destination_token, 'destination');
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateGitHubToken = async (token: string, type: 'source' | 'destination') => {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        if (type === 'source') {
          setSourceValid(true);
          setSourceUsername(userData.login);
        } else {
          setDestValid(true);
        }
        return true;
      } else {
        if (type === 'source') setSourceValid(false);
        else setDestValid(false);
        return false;
      }
    } catch {
      if (type === 'source') setSourceValid(false);
      else setDestValid(false);
      return false;
    }
  };

  // Load repos from destination account for existing repo selection
  const loadDestRepos = async (token: string) => {
    if (!token) return;
    
    setLoadingRepos(true);
    try {
      const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (response.ok) {
        const repos = await response.json();
        setDestRepos(repos);
      } else {
        console.error('Failed to load destination repos');
        setDestRepos([]);
      }
    } catch (error) {
      console.error('Error loading destination repos:', error);
      setDestRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleValidateSource = async () => {
    if (!config.sourceToken.trim()) {
      toast.error('Token requis');
      return;
    }
    
    setIsValidating(true);
    const isValid = await validateGitHubToken(config.sourceToken.trim(), 'source');
    setIsValidating(false);
    
    if (isValid) {
      toast.success('Token source validé');
    } else {
      toast.error('Token invalide');
    }
  };

  const handleValidateDestination = async () => {
    if (!config.destinationToken.trim()) {
      toast.error('Token requis');
      return;
    }
    
    setIsValidating(true);
    const isValid = await validateGitHubToken(config.destinationToken.trim(), 'destination');
    setIsValidating(false);
    
    if (isValid) {
      toast.success('Token destination validé');
      // Load destination repos for existing repo selection
      loadDestRepos(config.destinationToken.trim());
    } else {
      toast.error('Token invalide');
    }
  };

  const saveConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from('user_settings')
        .upsert({
          user_id: session.user.id,
          github_source_token: config.sourceToken.trim(),
          github_destination_token: config.destinationToken.trim(),
          github_destination_username: config.destinationUsername.trim(),
          default_repo_private: config.isPrivateRepo,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const handleNext = async () => {
    if (step === 'source') {
      if (!sourceValid) {
        await handleValidateSource();
        if (!sourceValid) return;
      }
      setStep('destination');
    } else if (step === 'destination') {
      if (!destValid) {
        await handleValidateDestination();
        if (!destValid) return;
      }
      if (!config.destinationUsername.trim()) {
        toast.error('Username destination requis');
        return;
      }
      setStep('review');
    }
  };

  const handleBack = () => {
    if (step === 'destination') setStep('source');
    else if (step === 'review') setStep('destination');
  };

  const handleComplete = async () => {
    await saveConfig();
    onComplete(config);
  };

  const getProgress = () => {
    switch (step) {
      case 'source': return 33;
      case 'destination': return 66;
      case 'review': return 100;
      default: return 0;
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case 'source': return 1;
      case 'destination': return 2;
      case 'review': return 3;
      default: return 1;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Rocket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Configuration pré-libération</CardTitle>
              <CardDescription>
                Étape {getStepNumber()} sur 3 - Configurez vos accès avant de lancer la libération
              </CardDescription>
            </div>
          </div>
          {hasExistingConfig && onSkip && (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              Passer
            </Button>
          )}
        </div>
        <Progress value={getProgress()} className="mt-4" />
      </CardHeader>
      <CardContent>
        <AnimatePresence mode="wait">
          {/* STEP 1: Source GitHub */}
          {step === 'source' && (
            <motion.div
              key="source"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Github className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">GitHub Source</h3>
                {sourceValid && (
                  <Badge className="bg-primary/10 text-primary border-primary/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Validé ({sourceUsername})
                  </Badge>
                )}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Token pour accéder aux repositories source (votre code Lovable/Bolt/etc).
                  <a 
                    href="https://github.com/settings/tokens/new?scopes=repo" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="ml-2 text-primary hover:underline inline-flex items-center"
                  >
                    Créer un token <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="source-token">Token GitHub source (scope "repo")</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="source-token"
                        type={showSourceToken ? 'text' : 'password'}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        value={config.sourceToken}
                        onChange={(e) => {
                          setConfig({ ...config, sourceToken: e.target.value });
                          setSourceValid(null);
                        }}
                        className={sourceValid === false ? 'border-destructive' : sourceValid === true ? 'border-primary' : ''}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowSourceToken(!showSourceToken)}
                      >
                        {showSourceToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleValidateSource}
                      disabled={isValidating || !config.sourceToken.trim()}
                    >
                      {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Valider'}
                    </Button>
                  </div>
                  {sourceValid === false && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Token invalide ou expiré
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleNext} 
                  disabled={!sourceValid}
                >
                  Suivant
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Destination GitHub */}
          {step === 'destination' && (
            <motion.div
              key="destination"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Github className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">GitHub Destination</h3>
                {destValid && (
                  <Badge className="bg-primary/10 text-primary border-primary/30">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Validé
                  </Badge>
                )}
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Token et compte pour pousser le code nettoyé. 
                  Peut être différent du compte source pour garantir la souveraineté.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dest-token">Token GitHub destination (scope "repo")</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="dest-token"
                        type={showDestToken ? 'text' : 'password'}
                        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                        value={config.destinationToken}
                        onChange={(e) => {
                          setConfig({ ...config, destinationToken: e.target.value });
                          setDestValid(null);
                        }}
                        className={destValid === false ? 'border-destructive' : destValid === true ? 'border-primary' : ''}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowDestToken(!showDestToken)}
                      >
                        {showDestToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={handleValidateDestination}
                      disabled={isValidating || !config.destinationToken.trim()}
                    >
                      {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Valider'}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dest-username">Username/Organisation destination</Label>
                  <Input
                    id="dest-username"
                    placeholder="mon-compte-souverain"
                    value={config.destinationUsername}
                    onChange={(e) => setConfig({ ...config, destinationUsername: e.target.value })}
                  />
                </div>

                {/* Repo mode selector */}
                <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                  <Label className="text-sm font-medium">Mode de destination</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, createNewRepo: true, existingRepoName: undefined })}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        config.createNewRepo 
                          ? 'bg-primary/10 border-primary text-primary' 
                          : 'bg-background border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Plus className="h-4 w-4" />
                        <span className="font-medium text-sm">Nouveau repo</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Créer un nouveau dépôt
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfig({ ...config, createNewRepo: false });
                        if (destValid && destRepos.length === 0) {
                          loadDestRepos(config.destinationToken);
                        }
                      }}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        !config.createNewRepo 
                          ? 'bg-primary/10 border-primary text-primary' 
                          : 'bg-background border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FolderGit className="h-4 w-4" />
                        <span className="font-medium text-sm">Repo existant</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Pousser vers un repo existant
                      </p>
                    </button>
                  </div>

                  {/* Existing repo selector */}
                  {!config.createNewRepo && (
                    <div className="space-y-2 mt-3">
                      <Label>Sélectionner le repo destination</Label>
                      {loadingRepos ? (
                        <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Chargement des repos...
                        </div>
                      ) : (
                        <Select
                          value={config.existingRepoName || ''}
                          onValueChange={(value) => setConfig({ ...config, existingRepoName: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir un repo existant" />
                          </SelectTrigger>
                          <SelectContent>
                            {destRepos.map((repo) => (
                              <SelectItem key={repo.full_name} value={repo.name}>
                                <div className="flex items-center gap-2">
                                  <FolderGit className="h-4 w-4" />
                                  {repo.name}
                                  {repo.private && (
                                    <Lock className="h-3 w-3 text-muted-foreground" />
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {!loadingRepos && destRepos.length === 0 && destValid && (
                        <p className="text-xs text-muted-foreground">
                          Aucun repo trouvé. Vérifiez les permissions du token.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Info display */}
                  <p className="text-xs text-muted-foreground mt-2">
                    {config.createNewRepo ? (
                      <>Le code sera poussé vers <span className="font-mono">github.com/{config.destinationUsername || 'username'}/[nom-projet]</span></>
                    ) : config.existingRepoName ? (
                      <>Le code sera poussé vers <span className="font-mono">github.com/{config.destinationUsername || 'username'}/{config.existingRepoName}</span></>
                    ) : (
                      <>Sélectionnez un repo existant</>
                    )}
                  </p>
                </div>

                {/* Private repo switch - only for new repos */}
                {config.createNewRepo && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      {config.isPrivateRepo ? (
                        <Lock className="h-4 w-4 text-primary" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">
                        {config.isPrivateRepo ? 'Repo privé' : 'Repo public'}
                      </span>
                    </div>
                    <Switch
                      checked={config.isPrivateRepo}
                      onCheckedChange={(checked) => setConfig({ ...config, isPrivateRepo: checked })}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button 
                  onClick={handleNext} 
                  disabled={!destValid || !config.destinationUsername.trim() || (!config.createNewRepo && !config.existingRepoName)}
                >
                  Suivant
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Review */}
          {step === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Vérification finale</h3>
              </div>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Github className="h-4 w-4" />
                    <span className="font-medium">Source</span>
                    <Badge variant="outline" className="bg-primary/10 text-primary">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {sourceUsername}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Token configuré pour accéder aux repositories source
                  </p>
                </div>

                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Github className="h-4 w-4" />
                    <span className="font-medium">Destination</span>
                    <Badge variant="outline" className="bg-primary/10 text-primary">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {config.destinationUsername}
                    </Badge>
                    <Badge variant="outline">
                      {config.createNewRepo ? (
                        <><Plus className="h-3 w-3 mr-1" />Nouveau repo</>
                      ) : (
                        <><FolderGit className="h-3 w-3 mr-1" />Repo existant</>
                      )}
                    </Badge>
                    {config.createNewRepo && (
                      <Badge variant="outline">
                        {config.isPrivateRepo ? (
                          <><Lock className="h-3 w-3 mr-1" />Privé</>
                        ) : (
                          <><Unlock className="h-3 w-3 mr-1" />Public</>
                        )}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">
                    {config.createNewRepo 
                      ? `github.com/${config.destinationUsername}/[nom-projet]`
                      : `github.com/${config.destinationUsername}/${config.existingRepoName}`
                    }
                  </p>
                </div>
              </div>

              <Alert className="bg-primary/5 border-primary/20">
                <Rocket className="h-4 w-4 text-primary" />
                <AlertDescription className="text-primary">
                  Tout est prêt ! Cliquez sur "Lancer la libération" pour continuer.
                </AlertDescription>
              </Alert>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <Button onClick={handleComplete} className="bg-primary">
                  <Rocket className="h-4 w-4 mr-2" />
                  Lancer la libération
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
