import { useState } from "react";
import { Github, Loader2, ArrowRight, Plug, Shield, Zap, CheckCircle2, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GitHubConnectButtonProps {
  onConnected?: () => void;
  isCompleted?: boolean;
  onSwitchToUrl?: () => void;
}

const GitHubConnectButton = ({ onConnected, isCompleted, onSwitchToUrl }: GitHubConnectButtonProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleGitHubConnect = async () => {
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          scopes: "repo read:user",
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error("GitHub auth error:", err);
      
      // Check if OAuth provider is not configured
      const isProviderNotConfigured = err?.message?.includes("provider") || err?.code === "provider_not_enabled";
      
      toast({
        title: "Erreur de connexion",
        description: isProviderNotConfigured 
          ? "La connexion GitHub OAuth n'est pas configurée. Utilisez l'option URL manuelle."
          : "Impossible de se connecter à GitHub. Veuillez réessayer ou utiliser l'URL manuelle.",
        variant: "destructive",
      });
      setLoading(false);
      
      // Auto-switch to URL method if OAuth is not configured
      if (isProviderNotConfigured && onSwitchToUrl) {
        setTimeout(() => onSwitchToUrl(), 2000);
      }
    }
  };

  return (
    <Card className="card-shadow border border-border status-border-blue overflow-hidden">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-4">
          {isCompleted && (
            <Badge className="bg-success/10 text-success border-success/20 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Complété
            </Badge>
          )}
        </div>
        <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center mb-4 border border-info/20">
          <Plug className="h-10 w-10 text-info" />
        </div>
        <CardTitle className="text-2xl text-foreground">Étape 1 : Source du projet</CardTitle>
        <CardDescription className="text-base max-w-md mx-auto text-muted-foreground">
          Connectez votre compte GitHub pour lister vos applications créées par IA ou uploadez manuellement votre archive ZIP.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center pb-8">
        <Button
          size="lg"
          onClick={handleGitHubConnect}
          disabled={loading}
          className="gap-3 text-lg px-10 py-7 rounded-xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-200 shadow-lg hover:shadow-xl"
        >
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Github className="h-6 w-6" />
          )}
          Continuer avec GitHub
          <ArrowRight className="h-5 w-5" />
        </Button>
        
        <div className="mt-10 grid grid-cols-3 gap-6 text-center max-w-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
              <Plug className="h-5 w-5 text-info" />
            </div>
            <span className="text-sm text-muted-foreground">Connexion sécurisée</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-success" />
            </div>
            <span className="text-sm text-muted-foreground">Données protégées</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-warning" />
            </div>
            <span className="text-sm text-muted-foreground">Import instantané</span>
          </div>
        </div>

        {/* Alternative : URL manuelle */}
        {onSwitchToUrl && (
          <div className="mt-6 pt-6 border-t border-border">
            <Button
              variant="ghost"
              onClick={onSwitchToUrl}
              className="text-muted-foreground hover:text-foreground gap-2"
            >
              <Link className="h-4 w-4" />
              Entrer l'URL GitHub manuellement
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default GitHubConnectButton;
