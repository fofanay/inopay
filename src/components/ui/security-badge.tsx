import { Badge } from "@/components/ui/badge";
import { Lock, Shield, Zap, Crown, Rocket, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SecurityBadgeType = 
  | 'zero-knowledge'
  | 'secrets-cleaned'
  | 'enterprise-limits'
  | 'ultra-rapide'
  | 'direct-deploy'
  | 'secrets-pending'
  | 'tester';

interface SecurityBadgeProps {
  type: SecurityBadgeType;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showIcon?: boolean;
}

const BADGE_CONFIG: Record<SecurityBadgeType, {
  label: string;
  icon: typeof Lock;
  className: string;
}> = {
  'zero-knowledge': {
    label: 'Zero-Knowledge',
    icon: Lock,
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
  },
  'secrets-cleaned': {
    label: 'Secrets Nettoyés',
    icon: Shield,
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20',
  },
  'enterprise-limits': {
    label: 'Limites Enterprise',
    icon: Crown,
    className: 'bg-violet-500/10 text-violet-400 border-violet-500/20 hover:bg-violet-500/20',
  },
  'ultra-rapide': {
    label: 'Ultra-Rapide',
    icon: Zap,
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
  },
  'direct-deploy': {
    label: 'Déploiement Direct',
    icon: Rocket,
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
  },
  'secrets-pending': {
    label: 'Secrets Temporaires',
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
  },
  'tester': {
    label: 'Testeur',
    icon: Crown,
    className: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20',
  },
};

const SIZE_CLASSES = {
  sm: 'text-xs px-1.5 py-0.5',
  default: 'text-xs px-2 py-1',
  lg: 'text-sm px-3 py-1.5',
};

const ICON_SIZES = {
  sm: 'h-3 w-3',
  default: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

export function SecurityBadge({ 
  type, 
  size = 'default', 
  className,
  showIcon = true 
}: SecurityBadgeProps) {
  const config = BADGE_CONFIG[type];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={cn(
        config.className,
        SIZE_CLASSES[size],
        'flex items-center gap-1 font-medium transition-colors',
        className
      )}
    >
      {showIcon && <Icon className={ICON_SIZES[size]} />}
      {config.label}
    </Badge>
  );
}

// Composant pour afficher le statut de sécurité d'un secret
interface SecretStatusProps {
  hasSecret: boolean;
  cleaned?: boolean;
  size?: 'sm' | 'default';
}

export function SecretStatus({ hasSecret, cleaned, size = 'default' }: SecretStatusProps) {
  if (!hasSecret || cleaned) {
    return (
      <div className="flex items-center gap-1 text-emerald-400">
        <CheckCircle2 className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>Nettoyé</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-amber-400">
      <AlertTriangle className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>Présent</span>
    </div>
  );
}

// Composant pour afficher un indicateur de limite
interface LimitBadgeProps {
  source: 'plan' | 'purchase' | 'tester';
  className?: string;
}

export function LimitBadge({ source, className }: LimitBadgeProps) {
  switch (source) {
    case 'purchase':
      return <SecurityBadge type="enterprise-limits" className={className} />;
    case 'tester':
      return <SecurityBadge type="tester" className={className} />;
    default:
      return null;
  }
}
