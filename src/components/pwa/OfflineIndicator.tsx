import { WifiOff, Wifi } from "lucide-react";
import { useOfflineDetection } from "@/hooks/useOfflineDetection";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const { isOnline, wasOffline } = useOfflineDetection();

  // Don't show if always been online
  if (isOnline && !wasOffline) return null;

  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium shadow-lg transition-all duration-300",
        isOnline
          ? "bg-green-500/90 text-white animate-in fade-in slide-in-from-top-2"
          : "bg-destructive text-destructive-foreground animate-pulse"
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Connexion rétablie</span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Mode hors ligne</span>
        </>
      )}
    </div>
  );
}
