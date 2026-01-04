import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: 'liberated' | 'cleaning' | 'deploying' | 'error' | 'pending';
  className?: string;
}

const statusConfig = {
  liberated: {
    color: 'bg-primary',
    glow: 'shadow-[0_0_20px_hsl(var(--primary)/0.6)]',
    label: 'LIBÉRÉ',
    animation: 'animate-pulse',
  },
  cleaning: {
    color: 'bg-blue-500',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.6)]',
    label: 'NETTOYAGE IA EN COURS...',
    animation: 'animate-spin',
  },
  deploying: {
    color: 'bg-orange-500',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.6)]',
    label: 'DÉPLOIEMENT VPS...',
    animation: 'animate-ping',
  },
  error: {
    color: 'bg-destructive',
    glow: 'shadow-[0_0_20px_hsl(var(--destructive)/0.6)]',
    label: 'ERREUR',
    animation: 'animate-pulse',
  },
  pending: {
    color: 'bg-muted-foreground',
    glow: 'shadow-[0_0_20px_hsl(var(--muted-foreground)/0.4)]',
    label: 'EN ATTENTE',
    animation: '',
  },
};

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const config = statusConfig[status];
  
  return (
    <div className={cn("flex items-center gap-4", className)}>
      {/* Animated indicator */}
      <div className="relative">
        <div 
          className={cn(
            "w-6 h-6 rounded-full",
            config.color,
            config.glow,
            status === 'cleaning' ? '' : config.animation
          )}
        />
        {status === 'cleaning' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn(
              "w-4 h-4 border-2 border-transparent border-t-white rounded-full",
              config.animation
            )} />
          </div>
        )}
        {/* Outer ring for extra effect */}
        <div 
          className={cn(
            "absolute -inset-1 rounded-full opacity-30",
            config.color,
            config.animation
          )} 
          style={{ animationDelay: '0.5s' }}
        />
      </div>
      
      {/* Status label */}
      <span className={cn(
        "text-lg font-bold tracking-wider",
        status === 'liberated' && "text-primary",
        status === 'cleaning' && "text-blue-400",
        status === 'deploying' && "text-orange-400",
        status === 'error' && "text-destructive",
        status === 'pending' && "text-muted-foreground"
      )}>
        {config.label}
      </span>
    </div>
  );
}
