import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Server, 
  Copy, 
  Check, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  Terminal,
  Shield,
  Zap
} from 'lucide-react';

interface VPSProvider {
  id: string;
  name: string;
  logo: string;
  signupUrl: string;
  minPrice: string;
}

const VPS_PROVIDERS: VPSProvider[] = [
  { id: 'hetzner', name: 'Hetzner', logo: '🇩🇪', signupUrl: 'https://www.hetzner.com/cloud', minPrice: '5$/mois' },
  { id: 'digitalocean', name: 'DigitalOcean', logo: '🌊', signupUrl: 'https://www.digitalocean.com/', minPrice: '6$/mois' },
  { id: 'vultr', name: 'Vultr', logo: '⚡', signupUrl: 'https://www.vultr.com/', minPrice: '4$/mois' },
  { id: 'ionos', name: 'IONOS', logo: '🌐', signupUrl: 'https://www.ionos.ca/serveur/vps', minPrice: '2$/mois' },
  { id: 'scaleway', name: 'Scaleway', logo: '🇫🇷', signupUrl: 'https://www.scaleway.com/', minPrice: '4$/mois' },
  { id: 'ovh', name: 'OVH', logo: '🇨🇦', signupUrl: 'https://www.ovhcloud.com/en-ca/vps/', minPrice: '5$/mois' },
];

interface UserServer {
  id: string;
  name: string;
  ip_address: string;
  provider: string;
  status: string;
  coolify_url: string | null;
  setup_id: string;
  created_at: string;
}

export function VPSOnboarding() {
  const [step, setStep] = useState(0); // Start at step 0 now
  const [hasExistingVPS, setHasExistingVPS] = useState<boolean | null>(null);
  const [showCreationGuide, setShowCreationGuide] = useState(false);
  const [provider, setProvider] = useState('hetzner');
  const [serverName, setServerName] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [installCommand, setInstallCommand] = useState('');
  const [copied, setCopied] = useState(false);
  const [currentServer, setCurrentServer] = useState<UserServer | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const { toast } = useToast();

  // Poll server status when installing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentServer && (currentServer.status === 'pending' || currentServer.status === 'installing')) {
      interval = setInterval(async () => {
        setCheckingStatus(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          const { data, error } = await supabase.functions.invoke('check-server-status', {
            body: { server_id: currentServer.id }
          });

          if (!error && data.status === 'ready') {
            setCurrentServer(prev => prev ? { ...prev, status: 'ready', coolify_url: data.coolify_url } : null);
            toast({
              title: "Serveur prêt !",
              description: "Coolify est installé et opérationnel.",
            });
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Status check error:', err);
        } finally {
          setCheckingStatus(false);
        }
      }, 10000); // Check every 10 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentServer, toast]);

  const handleSetupServer = async () => {
    if (!serverName || !ipAddress) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs.",
        variant: "destructive"
      });
      return;
    }

    // Validate IP address format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
      toast({
        title: "Erreur",
        description: "Adresse IP invalide.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Erreur",
          description: "Vous devez être connecté.",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('setup-vps', {
        body: { name: serverName, ip_address: ipAddress, provider }
      });

      if (error) throw error;

      setInstallCommand(data.installCommand);
      setCurrentServer(data.server);
      setStep(3);

      toast({
        title: "Serveur enregistré",
        description: "Exécutez la commande sur votre VPS pour continuer.",
      });
    } catch (error: any) {
      console.error('Setup error:', error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de configurer le serveur.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyCommand = async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copié !",
      description: "Collez cette commande dans votre terminal SSH.",
    });
  };

  // New Step 0: Ask if user has existing VPS
  const renderStep0 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Avez-vous déjà un serveur VPS ?</h3>
        <p className="text-sm text-muted-foreground">
          Un VPS (Virtual Private Server) est un serveur virtuel que vous louez chez un hébergeur
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card 
          className={`cursor-pointer transition-all hover:border-primary/50 ${
            hasExistingVPS === true ? 'border-primary ring-2 ring-primary/20' : ''
          }`}
          onClick={() => {
            setHasExistingVPS(true);
            setStep(1);
          }}
        >
          <CardContent className="pt-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-success" />
            </div>
            <h4 className="font-medium">Oui, j'ai un VPS</h4>
            <p className="text-sm text-muted-foreground">
              J'ai déjà un serveur Ubuntu avec son adresse IP
            </p>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:border-primary/50 ${
            hasExistingVPS === false ? 'border-primary ring-2 ring-primary/20' : ''
          }`}
          onClick={() => {
            setHasExistingVPS(false);
            setShowCreationGuide(true);
            setStep(1);
          }}
        >
          <CardContent className="pt-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
              <Server className="w-6 h-6 text-primary" />
            </div>
            <h4 className="font-medium">Non, je dois en créer un</h4>
            <p className="text-sm text-muted-foreground">
              Guidez-moi pour créer mon premier VPS (~5 min)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          Pourquoi un VPS ?
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• <strong>Contrôle total</strong> : Vous êtes propriétaire de votre infrastructure</li>
          <li>• <strong>Économique</strong> : À partir de 5€/mois pour des déploiements illimités</li>
          <li>• <strong>Performance</strong> : Ressources dédiées pour vos applications</li>
          <li>• <strong>Souveraineté</strong> : Vos données restent sur votre serveur</li>
        </ul>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Choisissez votre hébergeur VPS</h3>
        <p className="text-sm text-muted-foreground">
          Sélectionnez où vous souhaitez héberger votre application
        </p>
      </div>

      <RadioGroup value={provider} onValueChange={setProvider} className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {VPS_PROVIDERS.map((p) => (
          <div key={p.id}>
            <RadioGroupItem value={p.id} id={p.id} className="peer sr-only" />
            <Label
              htmlFor={p.id}
              className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
            >
              <span className="text-2xl mb-2">{p.logo}</span>
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">{p.minPrice}</span>
            </Label>
          </div>
        ))}
      </RadioGroup>

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" size="sm" onClick={() => setStep(0)}>
          Retour
        </Button>

        <div className="flex gap-2">
          {showCreationGuide && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const selectedProvider = VPS_PROVIDERS.find(p => p.id === provider);
                if (selectedProvider) {
                  window.open(selectedProvider.signupUrl, '_blank');
                }
              }}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Créer un compte {VPS_PROVIDERS.find(p => p.id === provider)?.name}
            </Button>
          )}

          <Button onClick={() => setStep(2)}>
            Continuer
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Informations du serveur</h3>
        <p className="text-sm text-muted-foreground">
          Entrez les détails de votre VPS Ubuntu 22.04
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="serverName">Nom du serveur</Label>
          <Input
            id="serverName"
            placeholder="Mon serveur de production"
            value={serverName}
            onChange={(e) => setServerName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ipAddress">Adresse IP du serveur</Label>
          <Input
            id="ipAddress"
            placeholder="123.45.67.89"
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            L'adresse IP publique de votre VPS
          </p>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <Shield className="w-4 h-4 text-green-500" />
          Configuration requise
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Ubuntu 22.04 LTS (recommandé)</li>
          <li>• Minimum 2 Go RAM, 2 vCPU</li>
          <li>• Accès root via SSH</li>
          <li>• Ports 80, 443 et 8000 ouverts</li>
        </ul>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep(1)}>
          Retour
        </Button>
        <Button onClick={handleSetupServer} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Configuration...
            </>
          ) : (
            <>
              Configurer
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Installez Coolify sur votre serveur</h3>
        <p className="text-sm text-muted-foreground">
          Exécutez cette commande sur votre VPS pour installer automatiquement Docker et Coolify
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-zinc-900 text-zinc-100 rounded-lg p-4 font-mono text-sm">
          <div className="flex items-start justify-between gap-4">
            <code className="break-all">{installCommand}</code>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 text-zinc-400 hover:text-zinc-100"
              onClick={copyCommand}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Terminal className="w-4 h-4" />
          <span>Connectez-vous via SSH : <code className="bg-muted px-1 rounded">ssh root@{ipAddress}</code></span>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            {currentServer?.status === 'ready' ? (
              <Check className="w-5 h-5 text-green-500 mt-0.5" />
            ) : (
              <Loader2 className="w-5 h-5 text-primary animate-spin mt-0.5" />
            )}
            <div className="space-y-1 flex-1">
              <p className="font-medium">
                {currentServer?.status === 'ready' 
                  ? "✅ Coolify est opérationnel !" 
                  : currentServer?.status === 'installing'
                    ? "Installation en cours..."
                    : "En attente de l'installation..."}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentServer?.status === 'ready' 
                  ? "Votre serveur est prêt pour les déploiements"
                  : "Inopay détectera automatiquement quand Coolify sera installé"}
              </p>
              {currentServer?.coolify_url && (
                <Button
                  variant="link"
                  className="p-0 h-auto text-sm"
                  onClick={() => window.open(currentServer.coolify_url!, '_blank')}
                >
                  Ouvrir Coolify <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              )}
            </div>
            {checkingStatus && (
              <Badge variant="secondary" className="shrink-0">
                Vérification...
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-500" />
          Ce que fait ce script
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>1. Met à jour le système</li>
          <li>2. Installe Docker</li>
          <li>3. Installe Coolify avec SSL automatique</li>
          <li>4. Configure le callback vers Inopay</li>
        </ul>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep(2)}>
          Retour
        </Button>
        {currentServer?.status === 'ready' && (
          <Button onClick={() => setStep(4)}>
            Continuer vers le déploiement
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold">Configuration terminée !</h3>
        <p className="text-sm text-muted-foreground">
          Votre serveur <strong>{serverName}</strong> est prêt pour les déploiements
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="w-5 h-5" />
            {serverName}
          </CardTitle>
          <CardDescription>{ipAddress}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Statut</span>
            <Badge variant="default" className="bg-green-500">Prêt</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Provider</span>
            <span className="text-sm">{VPS_PROVIDERS.find(p => p.id === provider)?.name}</span>
          </div>
          {currentServer?.coolify_url && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Coolify</span>
              <Button
                variant="link"
                className="p-0 h-auto text-sm"
                onClick={() => window.open(currentServer.coolify_url!, '_blank')}
              >
                Ouvrir <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-center text-muted-foreground">
        Vous pouvez maintenant déployer vos applications sur ce serveur depuis l'onglet "Déploiement"
      </p>
    </div>
  );

  // Calculate total steps based on flow
  const totalSteps = 5; // 0, 1, 2, 3, 4

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Server className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle>Ajouter un serveur VPS</CardTitle>
            <CardDescription>
              Configurez votre propre serveur pour des déploiements illimités
            </CardDescription>
          </div>
        </div>
        
        {/* Progress indicator */}
        {step > 0 && (
          <div className="flex items-center gap-2 pt-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    s < step 
                      ? 'bg-primary text-primary-foreground' 
                      : s === step 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s < step ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < 4 && (
                  <div className={`flex-1 h-0.5 ${s < step ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </CardContent>
    </Card>
  );
}
