import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ExternalLink, 
  Check, 
  ChevronRight, 
  Server,
  CreditCard,
  MapPin,
  Terminal,
  Copy,
  ArrowLeft,
  Play,
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VPSProvider {
  id: string;
  name: string;
  logo: string;
  signupUrl: string;
  minPrice: string;
  createVPSUrl: string;
  recommendedPlan: string;
  steps: {
    title: string;
    description: string;
    link?: string;
  }[];
}

const PROVIDERS: VPSProvider[] = [
  {
    id: 'hetzner',
    name: 'Hetzner',
    logo: '🇩🇪',
    signupUrl: 'https://accounts.hetzner.com/signUp',
    createVPSUrl: 'https://console.hetzner.cloud/projects',
    minPrice: '5€/mois',
    recommendedPlan: 'CX22 (2 vCPU, 4 Go RAM)',
    steps: [
      {
        title: 'Créer un compte Hetzner',
        description: 'Inscrivez-vous gratuitement sur Hetzner Cloud',
        link: 'https://accounts.hetzner.com/signUp'
      },
      {
        title: 'Créer un projet',
        description: 'Dans la console, cliquez sur "New Project" et donnez-lui un nom',
        link: 'https://console.hetzner.cloud/projects'
      },
      {
        title: 'Ajouter un serveur',
        description: 'Cliquez "Add Server", sélectionnez Ubuntu 22.04, choisissez CX22 (2 vCPU, 4 Go RAM)',
      },
      {
        title: 'Récupérer l\'adresse IP',
        description: 'Une fois créé, copiez l\'adresse IP publique affichée dans la liste des serveurs',
      }
    ]
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    logo: '🌊',
    signupUrl: 'https://cloud.digitalocean.com/registrations/new',
    createVPSUrl: 'https://cloud.digitalocean.com/droplets/new',
    minPrice: '6$/mois',
    recommendedPlan: 'Basic Droplet (2 vCPU, 2 Go RAM)',
    steps: [
      {
        title: 'Créer un compte DigitalOcean',
        description: 'Inscrivez-vous et obtenez 200$ de crédit gratuit pendant 60 jours',
        link: 'https://cloud.digitalocean.com/registrations/new'
      },
      {
        title: 'Créer un Droplet',
        description: 'Cliquez "Create Droplet", sélectionnez Ubuntu 22.04 LTS',
        link: 'https://cloud.digitalocean.com/droplets/new'
      },
      {
        title: 'Choisir la taille',
        description: 'Sélectionnez Basic, puis le plan à 12$/mois (2 vCPU, 2 Go RAM)',
      },
      {
        title: 'Récupérer l\'adresse IP',
        description: 'Une fois créé, copiez l\'adresse IP publique depuis la page du Droplet',
      }
    ]
  },
  {
    id: 'ovh',
    name: 'OVH Cloud',
    logo: '🇨🇦',
    signupUrl: 'https://www.ovhcloud.com/en-ca/auth/',
    createVPSUrl: 'https://www.ovhcloud.com/en-ca/vps/',
    minPrice: '5$/mois',
    recommendedPlan: 'VPS Starter (2 vCPU, 2 Go RAM)',
    steps: [
      {
        title: 'Créer un compte OVH',
        description: 'Inscrivez-vous sur OVHcloud (version canadienne recommandée)',
        link: 'https://www.ovhcloud.com/en-ca/auth/'
      },
      {
        title: 'Commander un VPS',
        description: 'Allez dans VPS, choisissez "VPS Starter" avec Ubuntu 22.04',
        link: 'https://www.ovhcloud.com/en-ca/vps/'
      },
      {
        title: 'Configurer le VPS',
        description: 'Sélectionnez la localisation Canada (Beauharnois) pour les meilleures latences',
      },
      {
        title: 'Récupérer l\'adresse IP',
        description: 'Après installation (~10 min), trouvez l\'IP dans votre espace client OVH',
      }
    ]
  },
  {
    id: 'ionos',
    name: 'IONOS',
    logo: '🌐',
    signupUrl: 'https://www.ionos.ca/servers/vps',
    createVPSUrl: 'https://www.ionos.ca/servers/vps',
    minPrice: '2$/mois',
    recommendedPlan: 'VPS Linux M (2 vCPU, 2 Go RAM)',
    steps: [
      {
        title: 'Créer un compte IONOS',
        description: 'Inscrivez-vous sur IONOS - le VPS le moins cher du marché',
        link: 'https://www.ionos.ca/servers/vps'
      },
      {
        title: 'Commander un VPS',
        description: 'Choisissez "VPS Linux M" avec Ubuntu 22.04',
        link: 'https://www.ionos.ca/servers/vps'
      },
      {
        title: 'Attendre l\'activation',
        description: 'L\'activation peut prendre jusqu\'à 15 minutes',
      },
      {
        title: 'Récupérer l\'adresse IP',
        description: 'Trouvez l\'IP dans votre espace client sous "Serveurs"',
      }
    ]
  }
];

interface VPSCreationGuideProps {
  selectedProvider: string;
  onComplete: (ipAddress: string) => void;
  onBack: () => void;
}

export function VPSCreationGuide({ selectedProvider, onComplete, onBack }: VPSCreationGuideProps) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [ipAddress, setIpAddress] = useState('');
  const { toast } = useToast();

  const provider = PROVIDERS.find(p => p.id === selectedProvider) || PROVIDERS[0];

  const toggleStep = (stepIndex: number) => {
    setCompletedSteps(prev => 
      prev.includes(stepIndex) 
        ? prev.filter(s => s !== stepIndex)
        : [...prev, stepIndex]
    );
  };

  const allStepsCompleted = completedSteps.length === provider.steps.length;

  const handleContinue = () => {
    if (!ipAddress.trim()) {
      toast({
        title: "Adresse IP requise",
        description: "Veuillez entrer l'adresse IP de votre VPS",
        variant: "destructive"
      });
      return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ipAddress)) {
      toast({
        title: "Format invalide",
        description: "L'adresse IP doit être au format xxx.xxx.xxx.xxx",
        variant: "destructive"
      });
      return;
    }

    onComplete(ipAddress);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">{provider.logo}</span>
            Guide de création VPS {provider.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            Suivez ces étapes pour créer votre serveur
          </p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-sm">Configuration recommandée</p>
              <p className="text-sm text-muted-foreground">
                <strong>{provider.recommendedPlan}</strong> - À partir de {provider.minPrice}
              </p>
              <p className="text-xs text-muted-foreground">
                Système : Ubuntu 22.04 LTS • Ports 80, 443, 8000 ouverts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            Étapes de création
          </CardTitle>
          <CardDescription>
            Cochez chaque étape une fois terminée
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {provider.steps.map((step, index) => (
            <div 
              key={index}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                completedSteps.includes(index) 
                  ? 'bg-success/5 border-success/20' 
                  : 'bg-muted/30 border-border'
              }`}
            >
              <Checkbox 
                checked={completedSteps.includes(index)}
                onCheckedChange={() => toggleStep(index)}
                className="mt-1"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{index + 1}. {step.title}</span>
                  {completedSteps.includes(index) && (
                    <Check className="w-4 h-4 text-success" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{step.description}</p>
                {step.link && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-primary"
                    onClick={() => window.open(step.link, '_blank')}
                  >
                    Ouvrir <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* IP Input */}
      <Card className={allStepsCompleted ? 'border-primary/50' : ''}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Adresse IP du serveur
          </CardTitle>
          <CardDescription>
            Entrez l'adresse IP publique de votre VPS nouvellement créé
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="123.45.67.89"
              value={ipAddress}
              onChange={(e) => setIpAddress(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
            />
          </div>
          <Button 
            onClick={handleContinue}
            disabled={!allStepsCompleted || !ipAddress.trim()}
            className="w-full"
          >
            {allStepsCompleted ? (
              <>
                Continuer avec cette IP
                <ChevronRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Complétez les étapes ci-dessus
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Video Tutorial Placeholder */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Play className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Tutoriel vidéo disponible</p>
              <p className="text-sm text-muted-foreground">
                Regardez notre guide étape par étape pour {provider.name}
              </p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" disabled>
              Bientôt disponible
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default VPSCreationGuide;
