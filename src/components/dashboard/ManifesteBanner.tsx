import { Shield, Key, Coins, ArrowRight, Sparkles, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function ManifesteBanner() {
  const { t } = useTranslation();
  
  const commandments = [
    {
      icon: Shield,
      title: t('manifeste.zeroDependency'),
      description: t('manifeste.zeroDependencyDesc'),
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
    },
    {
      icon: Key,
      title: t('manifeste.totalSovereignty'),
      description: t('manifeste.totalSovereigntyDesc'),
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
    },
    {
      icon: Coins,
      title: t('manifeste.economicFreedom'),
      description: t('manifeste.economicFreedomDesc'),
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
    },
  ];

  const manifestePoints = [
    {
      icon: Shield,
      title: t('manifeste.zeroDependency'),
      description: t('manifeste.zeroDependencyDesc'),
      details: "Votre code ne dépend d'aucun service externe propriétaire. Pas de SDK fermé, pas de lock-in technique.",
      color: 'text-emerald-400',
    },
    {
      icon: Key,
      title: t('manifeste.totalSovereignty'),
      description: t('manifeste.totalSovereigntyDesc'),
      details: "GitHub est votre dépôt source. VPS est votre infrastructure. Vous contrôlez les clés, les accès, les données.",
      color: 'text-blue-400',
    },
    {
      icon: Coins,
      title: t('manifeste.economicFreedom'),
      description: t('manifeste.economicFreedomDesc'),
      details: "Hébergement à partir de 5€/mois au lieu de 50€+. Divisez vos coûts par 3 minimum.",
      color: 'text-amber-400',
    },
  ];

  return (
    <Card className="bg-gradient-to-br from-slate-900 via-[#1A202C] to-slate-900 border-slate-700/50 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Tagline */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                {t('manifeste.badge')}
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-white">
              {t('manifeste.title')}
            </h3>
            <p className="text-sm text-slate-400 italic">
              "{t('manifeste.quote')}"
            </p>
          </div>

          {/* Center: 3 Commandments */}
          <div className="flex flex-wrap gap-3 lg:gap-4">
            {commandments.map((cmd) => (
              <div 
                key={cmd.title}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cmd.bg} border ${cmd.border} transition-transform hover:scale-105`}
              >
                <cmd.icon className={`h-4 w-4 ${cmd.color}`} />
                <div>
                  <span className="text-xs font-medium text-white">{cmd.title}</span>
                  <p className="text-[10px] text-slate-400 hidden sm:block">{cmd.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right: CTA - Opens manifeste modal */}
          <div className="flex-shrink-0">
            <Dialog>
              <DialogTrigger asChild>
                <Button 
                  size="sm"
                  className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:from-primary/90 hover:to-accent/90 shadow-lg shadow-primary/25"
                >
                  {t('manifeste.readManifeste')}
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-700 text-white">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-primary" />
                    {t('manifeste.badge')} - {t('manifeste.title')}
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-4 space-y-6">
                  <p className="text-slate-300 italic text-lg border-l-4 border-primary pl-4">
                    "{t('manifeste.quote')}"
                  </p>
                  
                  <div className="space-y-4">
                    {manifestePoints.map((point, index) => (
                      <div 
                        key={point.title}
                        className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg bg-slate-700/50`}>
                            <point.icon className={`h-5 w-5 ${point.color}`} />
                          </div>
                          <div className="flex-1">
                            <h4 className={`font-semibold ${point.color}`}>
                              {index + 1}. {point.title}
                            </h4>
                            <p className="text-slate-400 text-sm mt-1">
                              {point.details}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4 border-t border-slate-700">
                    <p className="text-sm text-slate-400 text-center">
                      Inopay libère votre code des plateformes propriétaires. Gardez le vibe, reprenez le contrôle.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
