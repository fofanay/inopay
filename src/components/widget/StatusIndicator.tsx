import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: 'synced' | 'cleaning' | 'deploying' | 'error';
  className?: string;
}

const statusConfig = {
  synced: {
    color: 'bg-green-500',
    glow: 'shadow-[0_0_20px_rgba(34,197,94,0.6)]',
    label: 'SYNCHRONISÉ',
    animation: 'animate-pulse',
  },
  cleaning: {
    color: 'bg-blue-500',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.6)]',
    label: 'NETTOYAGE EN COURS...',
    animation: 'animate-spin',
  },
  deploying: {
    color: 'bg-orange-500',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.6)]',
    label: 'ENVOI VERS LE VPS...',
    animation: 'animate-ping',
  },
  error: {
    color: 'bg-red-500',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.6)]',
    label: 'ALERTE',
    animation: 'animate-pulse',
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
        status === 'synced' && "text-green-400",
        status === 'cleaning' && "text-blue-400",
        status === 'deploying' && "text-orange-400",
        status === 'error' && "text-red-400"
      )}>
        {config.label}
      </span>
    </div>
  );
}
