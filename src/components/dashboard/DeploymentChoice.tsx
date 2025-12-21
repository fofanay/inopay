import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Server, 
  Globe, 
  ArrowRight, 
  Check,
  Zap,
  Shield,
  Clock,
  DollarSign
} from 'lucide-react';

export type DeploymentOption = 'zip' | 'ftp' | 'vps';

interface DeploymentChoiceProps {
  onSelect: (option: DeploymentOption) => void;
  hasExistingVPS?: boolean;
}

interface OptionCard {
  id: DeploymentOption;
  icon: React.ElementType;
  title: string;
  description: string;
  features: string[];
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  recommended?: boolean;
  price?: string;
}

const OPTIONS: OptionCard[] = [
  {
    id: 'zip',
    icon: Download,
    title: 'Archive ZIP',
    description: 'Téléchargez votre projet nettoyé prêt à déployer manuellement',
    features: [
      'Code nettoyé des dépendances Lovable',
      'Dockerfile inclus',
      'Instructions de déploiement',
      'Déploiement manuel requis'
    ],
    badge: 'Gratuit',
    badgeVariant: 'secondary',
    price: '0€'
  },
  {
    id: 'ftp',
    icon: Globe,
    title: 'Hébergement mutualisé',
    description: 'Déployez sur un hébergement web classique via FTP/SFTP',
    features: [
      'Compatible OVH, Hostinger, etc.',
      'Pas de VPS requis',
      'Simple et rapide',
      'Idéal pour sites vitrines'
    ],
    badge: 'Simple',
    badgeVariant: 'outline',
    price: '~3€/mois'
  },
  {
    id: 'vps',
    icon: Server,
    title: 'VPS avec Coolify',
    description: 'Déployez sur votre propre serveur avec gestion automatisée',
    features: [
      'Contrôle total du serveur',
      'Déploiements illimités',
      'SSL automatique',
      'Idéal pour apps complexes'
    ],
    badge: 'Recommandé',
    badgeVariant: 'default',
    recommended: true,
    price: '~5€/mois'
  }
];

export function DeploymentChoice({ onSelect, hasExistingVPS = false }: DeploymentChoiceProps) {
  const [hoveredOption, setHoveredOption] = useState<DeploymentOption | null>(null);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Comment souhaitez-vous déployer ?</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Choisissez la méthode de déploiement adaptée à vos besoins et à votre niveau technique
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {OPTIONS.map((option) => (
          <Card
            key={option.id}
            className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
              option.recommended 
                ? 'border-primary ring-2 ring-primary/20' 
                : 'border-border hover:border-primary/50'
            } ${hoveredOption === option.id ? 'scale-[1.02]' : ''}`}
            onMouseEnter={() => setHoveredOption(option.id)}
            onMouseLeave={() => setHoveredOption(null)}
            onClick={() => onSelect(option.id)}
          >
            {option.recommended && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground shadow-md">
                  <Zap className="w-3 h-3 mr-1" />
                  Recommandé
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-2 pt-6">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 ${
                option.recommended 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}>
                <option.icon className="w-7 h-7" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <CardTitle className="text-lg">{option.title}</CardTitle>
                {option.badge && !option.recommended && (
                  <Badge variant={option.badgeVariant}>{option.badge}</Badge>
                )}
              </div>
              <CardDescription className="min-h-[40px]">
                {option.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {option.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    Coût estimé
                  </span>
                  <span className="font-medium text-foreground">{option.price}</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                variant={option.recommended ? 'default' : 'outline'}
              >
                Choisir
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              {option.id === 'vps' && hasExistingVPS && (
                <p className="text-xs text-center text-success flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" />
                  Vous avez déjà un VPS configuré
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span>100% souverain</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span>Déploiement en minutes</span>
        </div>
      </div>
    </div>
  );
}

export default DeploymentChoice;
