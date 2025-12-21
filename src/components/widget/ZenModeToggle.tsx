import { Moon, Bell, BellOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface ZenModeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

export function ZenModeToggle({ enabled, onToggle, className }: ZenModeToggleProps) {
  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-xl",
      "bg-white/5 backdrop-blur-sm border border-white/10",
      className
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          enabled ? "bg-purple-500/20 text-purple-400" : "bg-gray-500/20 text-gray-400"
        )}>
          <Moon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Mode Zen</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Alertes critiques uniquement" : "Toutes les notifications"}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {enabled ? (
          <BellOff className="w-4 h-4 text-purple-400" />
        ) : (
          <Bell className="w-4 h-4 text-muted-foreground" />
        )}
        <Switch
          checked={enabled}
          onCheckedChange={onToggle}
          className="data-[state=checked]:bg-purple-600"
        />
      </div>
    </div>
  );
}
