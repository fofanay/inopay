import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DeploymentErrorHandler, parseDeploymentError, DeploymentError } from './DeploymentErrorHandler';
import { 
  Server, 
  Loader2, 
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Rocket,
  Globe,
  Plus,
  Database,
  Key,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  CreditCard
} from 'lucide-react';

interface UserServer {
  id: string;
  name: string;
  ip_address: string;
  provider: string | null;
  status: string;
  coolify_url: string | null;
  db_status: string | null;
  db_host: string | null;
  db_name: string | null;
  db_user: string | null;
}

interface DirectDeploymentProps {
  projectName: string;
  cleanedFiles: Record<string, string>;
  onDeploymentComplete?: (url: string) => void;
  onNeedSetup?: () => void;
}

type DeployStep = 'idle' | 'checking-db' | 'creating-db' | 'migrating' | 'preparing' | 'deploying' | 'complete' | 'error';

export function DirectDeployment({ 
  projectName, 
  cleanedFiles, 
  onDeploymentComplete,
  onNeedSetup 
}: DirectDeploymentProps) {
  const [servers, setServers] = useState<UserServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [customDomain, setCustomDomain] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingServers, setLoadingServers] = useState(true);
  const [deployStep, setDeployStep] = useState<DeployStep>('idle');
  const [progress, setProgress] = useState(0);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<DeploymentError | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [migrationResults, setMigrationResults] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    setLoadingServers(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('user_servers')
        .select('id, name, ip_address, provider, status, coolify_url, db_status, db_host, db_name, db_user')
        .eq('user_id', session.user.id)
        .eq('status', 'ready');

      if (error) throw error;
      setServers(data || []);
      
      if (data && data.length > 0) {
        setSelectedServerId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading servers:', error);
    } finally {
      setLoadingServers(false);
    }
  };

  const setupDatabase = async (serverId: string): Promise<boolean> => {
    setDeployStep('creating-db');
    setProgress(20);

    try {
      const { data, error } = await supabase.functions.invoke('setup-database', {
        body: { server_id: serverId }
      });

      if (error) throw error;

      if (data.success) {
        setProgress(35);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Database setup error:', error);
      throw new Error(`Échec de la configuration de la base de données: ${error.message}`);
    }
  };

  const migrateSchema = async (serverId: string): Promise<boolean> => {
    setDeployStep('migrating');
    setProgress(45);

    try {
      const { data, error } = await supabase.functions.invoke('migrate-schema', {
        body: { 
          server_id: serverId,
          files: cleanedFiles
        }
      });

      if (error) throw error;

      setMigrationResults(data);
      setProgress(60);
      return true;
    } catch (error: any) {
      console.error('Migration error:', error);
      // Don't fail the deployment if migration fails
      return true;
    }
  };

  const handleDeploy = async () => {
    if (!selectedServerId) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un serveur",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setDeployStep('checking-db');
    setProgress(5);
    setDeployError(null);
    setMigrationResults(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non connecté');
      }

      const selectedServer = servers.find(s => s.id === selectedServerId);

      // Step 1: Check and setup database if needed
      if (!selectedServer?.db_status || selectedServer.db_status !== 'ready') {
        await setupDatabase(selectedServerId);
        await loadServers(); // Reload to get updated DB info
      } else {
        setProgress(35);
      }

      // Step 2: Migrate schema
      await migrateSchema(selectedServerId);

      // Step 3: Deploy application
      setDeployStep('preparing');
      setProgress(70);

      setDeployStep('deploying');
      setProgress(85);

      const { data, error } = await supabase.functions.invoke('deploy-direct', {
        body: {
          server_id: selectedServerId,
          project_name: projectName,
          files: cleanedFiles,
          domain: customDomain || null
        }
      });

      // Handle 402 Payment Required (credit insufficient)
      if (error?.message?.includes('402') || error?.status === 402) {
        const errorData = JSON.parse(error.context?.responseText || '{}');
        const creditType = errorData.credit_type || 'deploy';
        
        setDeployStep('error');
        setDeployError(parseDeploymentError({
          code: '402',
          message: `Crédit "${creditType}" requis pour continuer`,
          details: error.message
        }));
        return;
      }

      if (error) throw error;

      setProgress(100);
      setDeployStep('complete');
      setDeployedUrl(data.deployment.deployed_url);

      toast({
        title: "Déploiement réussi !",
        description: "Votre site et base de données sont configurés.",
      });

      onDeploymentComplete?.(data.deployment.deployed_url);

    } catch (error: any) {
      console.error('Deployment error:', error);
      
      setDeployStep('error');
      setDeployError(parseDeploymentError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié !", description: "Valeur copiée dans le presse-papier" });
  };

  const selectedServer = servers.find(s => s.id === selectedServerId);

  const getStepLabel = (step: DeployStep): string => {
    switch (step) {
      case 'checking-db': return 'Vérification de la base de données...';
      case 'creating-db': return 'Création de PostgreSQL...';
      case 'migrating': return 'Migration du schéma...';
      case 'preparing': return 'Préparation du déploiement...';
      case 'deploying': return 'Déploiement en cours...';
      default: return '';
    }
  };

  // No servers configured
  if (!loadingServers && servers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
            <Server className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-lg">Aucun serveur configuré</CardTitle>
          <CardDescription>
            Configurez d'abord un serveur VPS pour déployer directement
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={onNeedSetup} className="gap-2">
            <Plus className="h-4 w-4" />
            Configurer un serveur VPS
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading servers
  if (loadingServers) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Chargement des serveurs...</p>
        </CardContent>
      </Card>
    );
  }

  // Deployment complete
  if (deployStep === 'complete' && deployedUrl) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
        <CardContent className="pt-8 space-y-6">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Déploiement complet !</h3>
            <p className="text-muted-foreground mb-4">
              Application + Base de données configurées
            </p>
            <code className="block p-3 bg-muted rounded-lg text-sm mb-4 break-all">
              {deployedUrl}
            </code>
            <Button onClick={() => window.open(deployedUrl, '_blank')} className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Ouvrir le site
            </Button>
          </div>

          {/* Database info */}
          {selectedServer?.db_host && (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="database">
                <AccordionTrigger className="text-sm">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Configuration de la base de données
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="text-muted-foreground">Hôte</span>
                      <code>{selectedServer.db_host}</code>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="text-muted-foreground">Port</span>
                      <code>5432</code>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="text-muted-foreground">Base</span>
                      <code>{selectedServer.db_name}</code>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-muted rounded">
                      <span className="text-muted-foreground">Utilisateur</span>
                      <code>{selectedServer.db_user}</code>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {migrationResults && (
                <AccordionItem value="migrations">
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Migrations ({migrationResults.summary?.total || 0})
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2">
                      {migrationResults.migrations?.map((m: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-sm p-2 bg-muted rounded">
                          {m.status === 'executed' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : m.status === 'failed' ? (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Loader2 className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className="truncate flex-1">{m.statement}</span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          )}
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (deployStep === 'error' && deployError) {
    const handleRetry = () => {
      setDeployStep('idle');
      setProgress(0);
      setDeployError(null);
    };

    const handleNavigate = (tab: string) => {
      if (tab === 'servers' && onNeedSetup) {
        onNeedSetup();
      }
    };

    return (
      <DeploymentErrorHandler
        error={deployError}
        onRetry={handleRetry}
        onNavigate={handleNavigate}
      />
    );
  }

  // Deploying state
  if (deployStep !== 'idle') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{getStepLabel(deployStep)}</h3>
            
            {/* Progress steps */}
            <div className="w-full space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full ${progress >= 5 ? 'bg-green-500' : 'bg-muted'}`} />
                <span className={progress >= 5 ? 'text-foreground' : 'text-muted-foreground'}>
                  Vérification serveur
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full ${progress >= 20 ? 'bg-green-500' : 'bg-muted'}`} />
                <span className={progress >= 20 ? 'text-foreground' : 'text-muted-foreground'}>
                  Configuration PostgreSQL
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full ${progress >= 45 ? 'bg-green-500' : 'bg-muted'}`} />
                <span className={progress >= 45 ? 'text-foreground' : 'text-muted-foreground'}>
                  Migration du schéma
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full ${progress >= 70 ? 'bg-green-500' : 'bg-muted'}`} />
                <span className={progress >= 70 ? 'text-foreground' : 'text-muted-foreground'}>
                  Injection des secrets
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className={`h-2 w-2 rounded-full ${progress >= 85 ? 'bg-green-500' : 'bg-muted'}`} />
                <span className={progress >= 85 ? 'text-foreground' : 'text-muted-foreground'}>
                  Déploiement application
                </span>
              </div>
            </div>

            <div className="w-full">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">{Math.round(progress)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Idle state - show form
  return (
    <Card className="border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center gap-2 mb-3">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
            ⚡ Ultra-Rapide
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            Sans GitHub
          </Badge>
        </div>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
          <Rocket className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-lg">Déploiement Ultra-Rapide</CardTitle>
        <CardDescription>
          Direct vers votre VPS • Sans GitHub • PostgreSQL auto
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-muted-foreground mb-4">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <span><strong>Zero GitHub</strong> - Transfert direct mémoire → VPS</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            PostgreSQL auto-configuré
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            Secrets Zero-Knowledge (auto-supprimés)
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            SSL automatique via Let's Encrypt
          </li>
        </ul>

        <div className="space-y-2">
          <Label>Serveur de destination</Label>
          <Select value={selectedServerId} onValueChange={setSelectedServerId}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez un serveur" />
            </SelectTrigger>
            <SelectContent>
              {servers.map((server) => (
                <SelectItem key={server.id} value={server.id}>
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    <span>{server.name}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {server.ip_address}
                    </Badge>
                    {server.db_status === 'ready' && (
                      <Badge variant="outline" className="ml-1 text-xs text-green-600">
                        <Database className="h-3 w-3 mr-1" />
                        DB
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedServer && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Provider: {selectedServer.provider || 'Non spécifié'}</span>
              <span>•</span>
              <span>IP: {selectedServer.ip_address}</span>
              {selectedServer.db_status === 'ready' && (
                <>
                  <span>•</span>
                  <span className="text-green-600">DB prête</span>
                </>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customDomain" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Domaine personnalisé (optionnel)
          </Label>
          <Input
            id="customDomain"
            placeholder="monsite.com"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Laissez vide pour utiliser un sous-domaine automatique
          </p>
        </div>

        <Button 
          onClick={handleDeploy} 
          className="w-full glow-sm" 
          size="lg"
          disabled={isLoading || !selectedServerId}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Déploiement...
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-5 w-5" />
              Déployer avec Auto-DB
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
