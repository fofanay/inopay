import { useState } from "react";
import { RefreshCw, Activity, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface QuickActionsProps {
  syncConfigId: string;
  coolifyUrl?: string;
  onForceSync: () => void;
  className?: string;
}

export function QuickActions({ syncConfigId, coolifyUrl, onForceSync, className }: QuickActionsProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleForceSync = async () => {
    setIsSyncing(true);
    
    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    
    try {
      const { error } = await supabase.functions.invoke('diff-clean', {
        body: { 
          sync_config_id: syncConfigId,
          force: true
        }
      });
      
      if (error) throw error;
      
      toast.success("Synchronisation forcée déclenchée !");
      onForceSync();
    } catch (error) {
      console.error('Force sync error:', error);
      toast.error("Erreur lors de la synchronisation forcée");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenHealth = () => {
    if (coolifyUrl) {
      window.open(coolifyUrl, '_blank', 'noopener,noreferrer');
    } else {
      toast.info("Console Coolify non disponible");
    }
  };

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <Button
        onClick={handleForceSync}
        disabled={isSyncing}
        className={cn(
          "relative overflow-hidden",
          "bg-gradient-to-r from-blue-600 to-cyan-600",
          "hover:from-blue-500 hover:to-cyan-500",
          "border border-blue-400/30",
          "shadow-[0_0_20px_rgba(59,130,246,0.3)]",
          "transition-all duration-300",
          "h-14"
        )}
      >
        {isSyncing ? (
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="w-5 h-5 mr-2" />
        )}
        <span className="font-semibold">
          {isSyncing ? 'SYNC...' : 'FORCE SYNC'}
        </span>
      </Button>
      
      <Button
        onClick={handleOpenHealth}
        variant="outline"
        className={cn(
          "relative overflow-hidden",
          "bg-white/5 backdrop-blur-sm",
          "border border-white/20",
          "hover:bg-white/10 hover:border-green-400/50",
          "shadow-[0_0_15px_rgba(255,255,255,0.1)]",
          "transition-all duration-300",
          "h-14"
        )}
      >
        <Activity className="w-5 h-5 mr-2 text-green-400" />
        <span className="font-semibold">APP HEALTH</span>
        <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
      </Button>
    </div>
  );
}
