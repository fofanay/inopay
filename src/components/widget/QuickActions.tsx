import { useState } from "react";
import { Loader2, Upload, BarChart3, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface QuickActionsProps {
  syncConfigId?: string;
  coolifyUrl?: string;
  onForceSync?: () => void;
  className?: string;
}

export function QuickActions({ syncConfigId, coolifyUrl, onForceSync, className }: QuickActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleNewLiberation = () => {
    navigate('/liberator/upload');
  };

  const handleViewReports = () => {
    navigate('/liberator/history');
  };

  const handleOpenVPS = () => {
    if (coolifyUrl) {
      window.open(coolifyUrl, '_blank');
    } else {
      toast.info("Configurez d'abord votre serveur VPS dans les paramètres");
      navigate('/dashboard');
    }
  };

  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleNewLiberation}
        className={cn(
          "flex flex-col items-center justify-center h-auto py-3 gap-1.5",
          "bg-primary/10 border-primary/20 hover:bg-primary/20 hover:border-primary/30",
          "text-primary"
        )}
      >
        <Upload className="w-4 h-4" />
        <span className="text-xs font-medium">LIBÉRER</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleViewReports}
        className={cn(
          "flex flex-col items-center justify-center h-auto py-3 gap-1.5",
          "bg-card border-border hover:bg-muted",
          "text-foreground"
        )}
      >
        <BarChart3 className="w-4 h-4" />
        <span className="text-xs font-medium">RAPPORTS</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleOpenVPS}
        disabled={isLoading}
        className={cn(
          "flex flex-col items-center justify-center h-auto py-3 gap-1.5",
          "bg-card border-border hover:bg-muted",
          "text-foreground"
        )}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Server className="w-4 h-4" />
        )}
        <span className="text-xs font-medium">VPS</span>
      </Button>
    </div>
  );
}
