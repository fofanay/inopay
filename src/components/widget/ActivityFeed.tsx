import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle2, AlertCircle, Loader2, Rocket, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Activity {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
}

interface ActivityFeedProps {
  activities: Activity[];
  className?: string;
}

const statusIcons = {
  success: CheckCircle2,
  info: RefreshCw,
  warning: AlertCircle,
  error: AlertCircle,
  pending: Loader2,
};

const statusColors = {
  success: "text-green-400 bg-green-500/20",
  info: "text-blue-400 bg-blue-500/20",
  warning: "text-orange-400 bg-orange-500/20",
  error: "text-red-400 bg-red-500/20",
  pending: "text-gray-400 bg-gray-500/20",
};

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  if (!activities || activities.length === 0) {
    return (
      <div className={cn("text-center py-6 text-muted-foreground", className)}>
        <Rocket className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucune activité récente</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {activities.slice(0, 3).map((activity, index) => {
        const Icon = statusIcons[activity.status as keyof typeof statusIcons] || RefreshCw;
        const colorClass = statusColors[activity.status as keyof typeof statusColors] || statusColors.info;
        
        return (
          <div 
            key={activity.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-xl",
              "bg-white/5 backdrop-blur-sm border border-white/10",
              "animate-fade-in"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={cn(
              "p-2 rounded-lg shrink-0",
              colorClass
            )}>
              <Icon className={cn(
                "w-4 h-4",
                activity.status === 'pending' && "animate-spin"
              )} />
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {activity.title}
              </p>
              {activity.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {activity.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground/70 mt-1">
                {formatDistanceToNow(new Date(activity.created_at), { 
                  addSuffix: true, 
                  locale: fr 
                })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
