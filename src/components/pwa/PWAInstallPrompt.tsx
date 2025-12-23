import { useState, useEffect } from "react";
import { Download, X, Smartphone, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function PWAInstallPrompt() {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // Check if user has dismissed before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) {
        setIsDismissed(true);
      }
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());
  };

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      handleDismiss();
    }
  };

  // Don't show if already installed or dismissed
  if (isInstalled || isDismissed) return null;

  // Show iOS instructions
  if (isIOS && !canInstall) {
    if (!showIOSInstructions) {
      return (
        <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-5">
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Installer l'application</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Ajoutez Vibe Monitor à votre écran d'accueil pour un accès rapide
              </p>
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => setShowIOSInstructions(true)}
              >
                <Share className="w-4 h-4 mr-2" />
                Comment installer
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-sm animate-in slide-in-from-bottom-10">
          <button
            onClick={() => {
              setShowIOSInstructions(false);
              handleDismiss();
            }}
            className="absolute top-4 right-4 p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-bold">Installer sur iOS</h2>
          </div>

          <ol className="space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="font-medium">Appuyez sur le bouton Partager</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  L'icône <Share className="w-3 h-3 inline" /> en bas de Safari
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="font-medium">Faites défiler et appuyez sur</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  "Sur l'écran d'accueil"
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="font-medium">Appuyez sur "Ajouter"</p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  L'app sera ajoutée à votre écran d'accueil
                </p>
              </div>
            </li>
          </ol>

          <Button
            className="w-full mt-6"
            onClick={() => {
              setShowIOSInstructions(false);
              handleDismiss();
            }}
          >
            Compris
          </Button>
        </div>
      </div>
    );
  }

  // Show standard install prompt for Android/Desktop
  if (!canInstall) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-5">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Installer l'application</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Installez Vibe Monitor pour un accès hors ligne et des notifications
          </p>
          <Button
            size="sm"
            className="mt-3 w-full"
            onClick={handleInstall}
          >
            <Download className="w-4 h-4 mr-2" />
            Installer
          </Button>
        </div>
      </div>
    </div>
  );
}
