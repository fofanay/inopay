import { useState } from "react";
import { Github, Loader2, ArrowRight, Plug, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GitHubConnectButtonProps {
  onConnected?: () => void;
}

const GitHubConnectButton = ({ onConnected }: GitHubConnectButtonProps) => {
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
    } catch (err) {
      console.error("GitHub auth error:", err);
      toast({
        title: "Erreur de connexion",
        description: "Impossible de se connecter à GitHub. Veuillez réessayer.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Card className="card-shadow border border-border status-border-blue overflow-hidden">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-info/20 to-info/5 flex items-center justify-center mb-4 border border-info/20">
          <Plug className="h-10 w-10 text-info" />
        </div>
        <CardTitle className="text-2xl text-foreground">Connectez votre GitHub</CardTitle>
        <CardDescription className="text-base max-w-md mx-auto text-muted-foreground">
          Accédez à vos projets en un clic et libérez-les de toute dépendance propriétaire
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
          Se connecter avec GitHub
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
      </CardContent>
    </Card>
  );
};

export default GitHubConnectButton;
