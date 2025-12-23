import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { VibeMonitorWidget } from "@/components/widget/VibeMonitorWidget";
import { Zap, QrCode, KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STORAGE_KEY = "inopay_widget_token";

export default function Widget() {
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token');
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualToken, setManualToken] = useState("");

  // Load token from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setStoredToken(saved);
    }
  }, []);

  // Save URL token to localStorage when present
  useEffect(() => {
    if (urlToken) {
      localStorage.setItem(STORAGE_KEY, urlToken);
      setStoredToken(urlToken);
    }
  }, [urlToken]);

  const token = urlToken || storedToken;

  const handleManualSubmit = () => {
    if (manualToken.trim()) {
      localStorage.setItem(STORAGE_KEY, manualToken.trim());
      setStoredToken(manualToken.trim());
      setShowManualInput(false);
      setManualToken("");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStoredToken(null);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="glass-widget p-8 text-center max-w-sm space-y-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
            <Zap className="w-8 h-8 text-amber-400" />
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Accès au Widget</h2>
            <p className="text-muted-foreground text-sm">
              Scannez le QR code depuis votre dashboard Inopay ou entrez votre token manuellement.
            </p>
          </div>

          {showManualInput ? (
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Entrez votre token..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManualInput(false)}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={handleManualSubmit}
                  disabled={!manualToken.trim()}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  Valider
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10 gap-2"
                onClick={() => setShowManualInput(true)}
              >
                <KeyRound className="w-4 h-4" />
                Entrer un token
              </Button>
              
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <QrCode className="w-4 h-4" />
                <span>Ou scannez le QR code depuis votre dashboard</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <VibeMonitorWidget token={token} />
      <button
        onClick={handleLogout}
        className="fixed bottom-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
        title="Changer de token"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
