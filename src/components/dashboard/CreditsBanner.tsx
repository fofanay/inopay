import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useUserLimits } from "@/hooks/useUserLimits";
import { SecurityBadge } from "@/components/ui/security-badge";
import { LIMIT_SOURCES, PLAN_LIMITS } from "@/lib/constants";
import { 
  Crown, 
  Zap, 
  Package, 
  Sparkles,
  Loader2
} from "lucide-react";

export function CreditsBanner() {
  const limits = useUserLimits();

  if (limits.isLoading) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="py-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const getContextBadge = () => {
    if (limits.isTester) {
      return (
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-warning" />
          <span className="font-semibold text-warning">Accès Testeur Illimité</span>
        </div>
      );
    }

    if (limits.hasEnterpriseAccess) {
      return (
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-semibold text-primary">Limites Enterprise Activées</span>
        </div>
      );
    }

    if (limits.isPro) {
      return (
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <span className="font-semibold text-accent">Plan Pro</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-muted-foreground" />
        <span className="font-medium text-muted-foreground">Plan Gratuit</span>
      </div>
    );
  };

  const getSourceLabel = () => {
    return LIMIT_SOURCES[limits.source];
  };

  return (
    <Card className={`border-0 shadow-md overflow-hidden ${
      limits.hasEnterpriseAccess || limits.isTester
        ? 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent'
        : 'bg-gradient-to-r from-muted/50 to-transparent'
    }`}>
      <CardContent className="py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Left: Plan/Status */}
          <div className="flex items-center gap-4">
            {getContextBadge()}
            
            {limits.source !== 'plan' && (
              <Badge variant="outline" className="text-xs bg-background/50">
                {getSourceLabel()}
              </Badge>
            )}
          </div>

          {/* Right: Credits & Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Credits summary */}
            {limits.credits.total > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 border border-border/50">
                <span className="text-sm text-muted-foreground">Crédits:</span>
                <span className="font-semibold text-foreground">{limits.credits.total}</span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  ({limits.credits.deploy} déploiements, {limits.credits.redeploy} redéploiements)
                </div>
              </div>
            )}

            {/* Security badges */}
            {limits.hasEnterpriseAccess && (
              <SecurityBadge type="enterprise-limits" />
            )}
            
            {limits.isTester && (
              <SecurityBadge type="tester" />
            )}
          </div>
        </div>

        {/* Limits info */}
        <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-4 text-sm text-muted-foreground">
          <span>Limites: <strong className="text-foreground">{limits.maxFiles}</strong> fichiers</span>
          <span>•</span>
          <span><strong className="text-foreground">{limits.maxRepos}</strong> repos</span>
        </div>
      </CardContent>
    </Card>
  );
}
