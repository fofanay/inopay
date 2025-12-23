import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  titleKey: string;
  descriptionKey: string;
  featuresKeys: string[];
  badgeKey?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  recommended?: boolean;
  price?: string;
}

const OPTIONS: OptionCard[] = [
  {
    id: 'zip',
    icon: Download,
    titleKey: 'deploymentChoice.options.zip.title',
    descriptionKey: 'deploymentChoice.options.zip.description',
    featuresKeys: [
      'deploymentChoice.options.zip.features.0',
      'deploymentChoice.options.zip.features.1',
      'deploymentChoice.options.zip.features.2',
      'deploymentChoice.options.zip.features.3'
    ],
    badgeKey: 'deploymentChoice.options.zip.badge',
    badgeVariant: 'secondary',
    price: '0€'
  },
  {
    id: 'ftp',
    icon: Globe,
    titleKey: 'deploymentChoice.options.ftp.title',
    descriptionKey: 'deploymentChoice.options.ftp.description',
    featuresKeys: [
      'deploymentChoice.options.ftp.features.0',
      'deploymentChoice.options.ftp.features.1',
      'deploymentChoice.options.ftp.features.2',
      'deploymentChoice.options.ftp.features.3'
    ],
    badgeKey: 'deploymentChoice.options.ftp.badge',
    badgeVariant: 'outline',
    price: '~3€/mois'
  },
  {
    id: 'vps',
    icon: Server,
    titleKey: 'deploymentChoice.options.vps.title',
    descriptionKey: 'deploymentChoice.options.vps.description',
    featuresKeys: [
      'deploymentChoice.options.vps.features.0',
      'deploymentChoice.options.vps.features.1',
      'deploymentChoice.options.vps.features.2',
      'deploymentChoice.options.vps.features.3'
    ],
    badgeKey: 'deploymentChoice.options.vps.badge',
    badgeVariant: 'default',
    recommended: true,
    price: '~5€/mois'
  }
];

export function DeploymentChoice({ onSelect, hasExistingVPS = false }: DeploymentChoiceProps) {
  const { t } = useTranslation();
  const [hoveredOption, setHoveredOption] = useState<DeploymentOption | null>(null);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">{t('deploymentChoice.title')}</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          {t('deploymentChoice.subtitle')}
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
                  {t('deploymentChoice.recommended')}
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
                <CardTitle className="text-lg">{t(option.titleKey)}</CardTitle>
                {option.badgeKey && !option.recommended && (
                  <Badge variant={option.badgeVariant}>{t(option.badgeKey)}</Badge>
                )}
              </div>
              <CardDescription className="min-h-[40px]">
                {t(option.descriptionKey)}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {option.featuresKeys.map((featureKey, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{t(featureKey)}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {t('deploymentChoice.estimatedCost')}
                  </span>
                  <span className="font-medium text-foreground">{option.price}</span>
                </div>
              </div>

              <Button 
                className="w-full" 
                variant={option.recommended ? 'default' : 'outline'}
              >
                {t('deploymentChoice.choose')}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              {option.id === 'vps' && hasExistingVPS && (
                <p className="text-xs text-center text-success flex items-center justify-center gap-1">
                  <Check className="w-3 h-3" />
                  {t('deploymentChoice.vpsConfigured')}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span>{t('deploymentChoice.sovereign')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span>{t('deploymentChoice.deploymentInMinutes')}</span>
        </div>
      </div>
    </div>
  );
}

export default DeploymentChoice;
