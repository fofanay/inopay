import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  Server, 
  Key, 
  ExternalLink, 
  Check, 
  Copy, 
  Eye, 
  EyeOff,
  AlertTriangle,
  Zap,
  Shield,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface HetznerAutoProvisionProps {
  onSuccess: (serverData: {
    id: string;
    name: string;
    ip_address: string;
    credentials: {
      root_password: string;
      ssh_command: string;
    };
    installCommand: string;
  }) => void;
  onBack: () => void;
}

interface ServerType {
  id: string;
  name: string;
  cores: number;
  memory: number;
  disk: number;
  price: string;
}

const SERVER_TYPES: ServerType[] = [
  { id: 'cx22', name: 'CX22', cores: 2, memory: 4, disk: 40, price: '~5€/mois' },
  { id: 'cx32', name: 'CX32', cores: 4, memory: 8, disk: 80, price: '~10€/mois' },
  { id: 'cx42', name: 'CX42', cores: 8, memory: 16, disk: 160, price: '~20€/mois' },
  { id: 'cpx11', name: 'CPX11 (AMD)', cores: 2, memory: 2, disk: 40, price: '~4€/mois' },
  { id: 'cpx21', name: 'CPX21 (AMD)', cores: 3, memory: 4, disk: 80, price: '~8€/mois' },
];

const LOCATIONS = [
  { id: 'fsn1', name: 'Falkenstein, DE', flag: '🇩🇪' },
  { id: 'nbg1', name: 'Nuremberg, DE', flag: '🇩🇪' },
  { id: 'hel1', name: 'Helsinki, FI', flag: '🇫🇮' },
  { id: 'ash', name: 'Ashburn, US', flag: '🇺🇸' },
  { id: 'hil', name: 'Hillsboro, US', flag: '🇺🇸' },
];

export function HetznerAutoProvision({ onSuccess, onBack }: HetznerAutoProvisionProps) {
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverType, setServerType] = useState('cx22');
  const [location, setLocation] = useState('fsn1');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [result, setResult] = useState<any>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const { toast } = useToast();

  const handleProvision = async () => {
    if (!apiToken.trim()) {
      toast({
        title: "Token API requis",
        description: "Veuillez entrer votre token API Hetzner",
        variant: "destructive"
      });
      return;
    }

    if (!serverName.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez donner un nom à votre serveur",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Non connecté",
          description: "Vous devez être connecté pour créer un serveur",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('provision-hetzner-vps', {
        body: {
          hetzner_api_token: apiToken,
          server_name: serverName,
          server_type: serverType,
          location: location,
        }
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.details || data.error);
      }

      setResult(data);
      setStep('success');
      
      toast({
        title: "Serveur créé !",
        description: `${serverName} est en cours de démarrage sur Hetzner`,
      });

    } catch (error: any) {
      console.error('Provision error:', error);
      toast({
        title: "Erreur de création",
        description: error.message || "Impossible de créer le serveur",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyPassword = async () => {
    if (result?.credentials?.root_password) {
      await navigator.clipboard.writeText(result.credentials.root_password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
      toast({
        title: "Copié !",
        description: "Mot de passe copié dans le presse-papiers",
      });
    }
  };

  const selectedType = SERVER_TYPES.find(t => t.id === serverType);
  const selectedLocation = LOCATIONS.find(l => l.id === location);

  if (step === 'success' && result) {
    return (
      <div className="space-y-6">
        <Card className="border-success/50 bg-success/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-success" />
              </div>
              <div>
                <CardTitle className="text-success">Serveur créé avec succès !</CardTitle>
                <CardDescription>
                  Votre VPS Hetzner est en cours de démarrage
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Nom</p>
                <p className="font-medium">{result.server.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Adresse IP</p>
                <p className="font-mono font-medium">{result.server.ip_address}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credentials Card */}
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="w-4 h-4" />
              Identifiants root (à sauvegarder !)
            </CardTitle>
            <CardDescription>
              Ces identifiants ne seront plus affichés après cette page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-background rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Utilisateur</span>
                <code className="bg-muted px-2 py-1 rounded text-sm">root</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Mot de passe</span>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {result.credentials.root_password}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={copyPassword}
                  >
                    {copiedPassword ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Connexion SSH</span>
                <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                  {result.credentials.ssh_command}
                </code>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-warning">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Sauvegardez ces informations maintenant ! Elles ne seront plus accessibles ensuite.</p>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prochaines étapes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-medium">1</span>
                <span>Attendez 1-2 minutes que le serveur démarre</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-medium">2</span>
                <div>
                  <span>Connectez-vous en SSH :</span>
                  <code className="block mt-1 bg-muted px-2 py-1 rounded font-mono text-xs">
                    {result.credentials.ssh_command}
                  </code>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-medium">3</span>
                <div>
                  <span>Exécutez la commande d'installation :</span>
                  <code className="block mt-1 bg-zinc-900 text-zinc-100 px-3 py-2 rounded font-mono text-xs break-all">
                    {result.installCommand}
                  </code>
                </div>
              </li>
            </ol>

            <Button 
              className="w-full"
              onClick={() => onSuccess({
                id: result.server.id,
                name: result.server.name,
                ip_address: result.server.ip_address,
                credentials: result.credentials,
                installCommand: result.installCommand,
              })}
            >
              Continuer vers l'installation Coolify
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Création automatique VPS Hetzner</CardTitle>
              <CardDescription>
                Créez un serveur Hetzner en quelques clics avec votre token API
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* API Token Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiToken">Token API Hetzner</Label>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => window.open('https://console.hetzner.cloud/projects', '_blank')}
              >
                Obtenir un token <ExternalLink className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="relative">
              <Input
                id="apiToken"
                type={showToken ? 'text' : 'password'}
                placeholder="Votre token API Hetzner Cloud"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="pr-10 font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Projet → Security → API Tokens → Generate API Token (Read & Write)
            </p>
          </div>

          {/* Server Name */}
          <div className="space-y-2">
            <Label htmlFor="serverName">Nom du serveur</Label>
            <Input
              id="serverName"
              placeholder="mon-serveur-prod"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
            />
          </div>

          {/* Server Type */}
          <div className="space-y-2">
            <Label>Type de serveur</Label>
            <Select value={serverType} onValueChange={setServerType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVER_TYPES.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="font-medium">{type.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {type.cores} vCPU, {type.memory} Go RAM, {type.disk} Go SSD - {type.price}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label>Localisation</Label>
            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    <div className="flex items-center gap-2">
                      <span>{loc.flag}</span>
                      <span>{loc.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          {selectedType && selectedLocation && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-medium">Récapitulatif</p>
                    <p className="text-muted-foreground">
                      {selectedType.name} ({selectedType.cores} vCPU, {selectedType.memory} Go RAM) 
                      à {selectedLocation.name} - <strong>{selectedType.price}</strong>
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      Ubuntu 22.04 LTS avec firewall configuré
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <Button 
          onClick={handleProvision}
          disabled={isLoading || !apiToken.trim() || !serverName.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Création en cours...
            </>
          ) : (
            <>
              <Server className="w-4 h-4 mr-2" />
              Créer le serveur
            </>
          )}
        </Button>
      </div>

      {/* Security Note */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Shield className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Sécurité</p>
              <p>
                Votre token API n'est pas stocké par Inopay. Il est utilisé uniquement pour cette création 
                et n'est jamais conservé. Le serveur sera créé directement sur votre compte Hetzner.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default HetznerAutoProvision;
