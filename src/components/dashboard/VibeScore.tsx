import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Unlock, ArrowRight, DollarSign, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";

interface VibeScoreProps {
  vibeScore: number;
  freedomScore: number;
  savingsScore?: number;
  potentialSavings?: number;
  onUnlock?: () => void;
}

const VibeScore = ({ vibeScore, freedomScore, savingsScore = 100, potentialSavings = 0, onUnlock }: VibeScoreProps) => {
  const needsUnlock = freedomScore < 100;
  const hasSavingsPotential = potentialSavings > 0;

  // Determine grid layout based on whether savings is shown
  const gridCols = hasSavingsPotential ? "grid-cols-3" : "grid-cols-2";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-accent/5 p-6">
      {/* Background decoration */}
      <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-accent/10 blur-3xl" />
      {hasSavingsPotential && (
        <div className="absolute top-1/2 right-1/4 h-24 w-24 rounded-full bg-success/10 blur-2xl" />
      )}
      
      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-3 w-3 mr-1" />
            Vibe-Score™
          </Badge>
          {hasSavingsPotential && (
            <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
              <TrendingDown className="h-3 w-3 mr-1" />
              -{potentialSavings}$/mois
            </Badge>
          )}
        </div>

        {/* Scores */}
        <div className={`grid ${gridCols} gap-4 mb-6`}>
          {/* Vibe Score */}
          <div className="text-center p-4 rounded-xl bg-card/50 border border-border">
            <div className="relative inline-flex items-center justify-center mb-2">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="3"
                  strokeDasharray={`${vibeScore}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-2xl font-bold text-primary">{vibeScore}%</span>
            </div>
            <p className="text-sm font-medium text-foreground">Vibe</p>
            <p className="text-xs text-muted-foreground">Stack moderne</p>
          </div>

          {/* Freedom Score */}
          <div className="text-center p-4 rounded-xl bg-card/50 border border-border">
            <div className="relative inline-flex items-center justify-center mb-2">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="hsl(var(--muted))"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={freedomScore === 100 ? "hsl(var(--success))" : "hsl(var(--accent))"}
                  strokeWidth="3"
                  strokeDasharray={`${freedomScore}, 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className={`absolute text-2xl font-bold ${freedomScore === 100 ? "text-success" : "text-accent"}`}>
                {freedomScore}%
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">Liberté</p>
            <p className="text-xs text-muted-foreground">
              {freedomScore === 100 ? "Code libéré" : "Dépendances"}
            </p>
          </div>

          {/* Savings Score - Only shown if there are potential savings */}
          {hasSavingsPotential && (
            <div className="text-center p-4 rounded-xl bg-card/50 border border-success/20">
              <div className="relative inline-flex items-center justify-center mb-2">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--success))"
                    strokeWidth="3"
                    strokeDasharray={`${savingsScore}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <DollarSign className="absolute h-6 w-6 text-success" />
              </div>
              <p className="text-sm font-medium text-foreground">Économies</p>
              <p className="text-xs text-success font-medium">
                {potentialSavings}$/mois
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        {needsUnlock && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              Votre app a un <span className="text-primary font-semibold">Vibe de {vibeScore}%</span>, 
              mais une <span className="text-accent font-semibold">Liberté de {freedomScore}%</span>.
              {hasSavingsPotential && (
                <> Économisez <span className="text-success font-semibold">{potentialSavings}$/mois</span> en migrant vers l'Open Source.</>
              )}
            </p>
            {onUnlock ? (
              <Button onClick={onUnlock} className="w-full rounded-xl" size="lg">
                <Unlock className="h-4 w-4 mr-2" />
                Passer à 100% de Liberté
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Link to="/tarifs" className="block">
                <Button className="w-full rounded-xl" size="lg">
                  <Unlock className="h-4 w-4 mr-2" />
                  Passer à 100% de Liberté
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            )}
          </div>
        )}

        {freedomScore === 100 && !hasSavingsPotential && (
          <div className="text-center p-4 rounded-xl bg-success/10 border border-success/20">
            <p className="text-sm font-medium text-success">
              🎉 Félicitations ! Votre code est 100% libre et optimisé.
            </p>
          </div>
        )}

        {freedomScore === 100 && hasSavingsPotential && (
          <div className="text-center p-4 rounded-xl bg-success/10 border border-success/20">
            <p className="text-sm font-medium text-success">
              🎉 Code libéré ! Économisez encore {potentialSavings}$/mois avec l'Open Source.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VibeScore;
