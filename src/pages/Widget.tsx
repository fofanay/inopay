import { useSearchParams } from "react-router-dom";
import { VibeMonitorWidget } from "@/components/widget/VibeMonitorWidget";
import { Zap } from "lucide-react";

export default function Widget() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="glass-widget p-8 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Token Manquant</h2>
          <p className="text-muted-foreground text-sm">
            Veuillez accéder à ce widget via le lien fourni dans votre dashboard Inopay.
          </p>
        </div>
      </div>
    );
  }

  return <VibeMonitorWidget token={token} />;
}
