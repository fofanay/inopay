import { Link } from 'react-router-dom';
import { Shield, Key, Coins, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const commandments = [
  {
    icon: Shield,
    title: 'Zéro Dépendance',
    description: 'Code pur, sans marqueurs propriétaires.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  {
    icon: Key,
    title: 'Souveraineté Totale',
    description: 'Votre GitHub, votre VPS, vos clés.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  {
    icon: Coins,
    title: 'Liberté Économique',
    description: 'Divisez vos coûts par 3.',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
];

export function ManifesteBanner() {
  return (
    <Card className="bg-gradient-to-br from-slate-900 via-[#1A202C] to-slate-900 border-slate-700/50 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Tagline */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Manifeste
              </Badge>
            </div>
            <h3 className="text-xl font-bold text-white">
              Reprenez les clés de votre royaume
            </h3>
            <p className="text-sm text-slate-400 italic">
              "Le code est une propriété, pas un abonnement."
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

          {/* Right: CTA */}
          <div className="flex-shrink-0">
            <Link to="/about">
              <Button 
                variant="outline" 
                size="sm"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Lire le manifeste
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
