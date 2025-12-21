import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Server, 
  Loader2, 
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Rocket,
  Globe,
  Plus
} from 'lucide-react';

interface UserServer {
  id: string;
  name: string;
  ip_address: string;
  provider: string | null;
  status: string;
  coolify_url: string | null;
}

interface DirectDeploymentProps {
  projectName: string;
  cleanedFiles: Record<string, string>;
  onDeploymentComplete?: (url: string) => void;
  onNeedSetup?: () => void;
}

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
  const [deployStatus, setDeployStatus] = useState<'idle' | 'preparing' | 'deploying' | 'complete' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
        .select('id, name, ip_address, provider, status, coolify_url')
        .eq('user_id', session.user.id)
        .eq('status', 'ready');

      if (error) throw error;
      setServers(data || []);
      
      // Auto-select first server if available
      if (data && data.length > 0) {
        setSelectedServerId(data[0].id);
      }
    } catch (error) {
      console.error('Error loading servers:', error);
    } finally {
      setLoadingServers(false);
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
    setDeployStatus('preparing');
    setProgress(10);
    setErrorMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non connecté');
      }

      setProgress(30);
      setDeployStatus('deploying');

      const { data, error } = await supabase.functions.invoke('deploy-direct', {
        body: {
          server_id: selectedServerId,
          project_name: projectName,
          files: cleanedFiles,
          domain: customDomain || null
        }
      });

      if (error) throw error;

      setProgress(100);
      setDeployStatus('complete');
      setDeployedUrl(data.deployment.deployed_url);

      toast({
        title: "Déploiement lancé !",
        description: "Votre site sera disponible dans quelques minutes.",
      });

      onDeploymentComplete?.(data.deployment.deployed_url);

    } catch (error: any) {
      console.error('Deployment error:', error);
      setDeployStatus('error');
      setErrorMessage(error.message || 'Erreur lors du déploiement');
      toast({
        title: "Erreur",
        description: error.message || 'Erreur lors du déploiement',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedServer = servers.find(s => s.id === selectedServerId);

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
  if (deployStatus === 'complete' && deployedUrl) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-secondary/5">
        <CardContent className="pt-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Déploiement lancé !</h3>
          <p className="text-muted-foreground mb-4">
            Votre site sera disponible dans quelques minutes à :
          </p>
          <code className="block p-3 bg-muted rounded-lg text-sm mb-4 break-all">
            {deployedUrl}
          </code>
          <Button onClick={() => window.open(deployedUrl, '_blank')} className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Ouvrir le site
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (deployStatus === 'error') {
    return (
      <Card className="border-destructive/30">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur de déploiement</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
          <Button 
            onClick={() => {
              setDeployStatus('idle');
              setProgress(0);
              setErrorMessage(null);
            }} 
            className="w-full mt-4"
            variant="outline"
          >
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Deploying state
  if (deployStatus === 'preparing' || deployStatus === 'deploying') {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {deployStatus === 'preparing' ? 'Préparation...' : 'Déploiement en cours...'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {deployStatus === 'preparing' 
                ? 'Génération du Dockerfile et préparation des fichiers'
                : 'Envoi vers votre serveur VPS via Coolify'}
            </p>
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
    <Card className="border-dashed">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-3">
          <Rocket className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-lg">Déployer sur votre VPS</CardTitle>
        <CardDescription>
          Déploiement direct sans GitHub ni compte tiers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm text-muted-foreground mb-4">
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            Zéro compte GitHub requis
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            100% de propriété du code
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            SSL automatique via Let's Encrypt
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            Dockerfile généré automatiquement
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
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedServer && (
            <p className="text-xs text-muted-foreground">
              Provider: {selectedServer.provider || 'Non spécifié'} • IP: {selectedServer.ip_address}
            </p>
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
              Déployer sur mon VPS
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
