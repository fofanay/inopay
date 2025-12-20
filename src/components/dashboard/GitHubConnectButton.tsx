import { useState } from "react";
import { Github, Loader2, ArrowRight } from "lucide-react";
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
    <Card className="border-2 border-dashed hover:border-primary/50 transition-colors">
      <CardHeader className="text-center">
        <div className="mx-auto h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
          <Github className="h-10 w-10 text-foreground" />
        </div>
        <CardTitle className="text-2xl">Connectez votre GitHub</CardTitle>
        <CardDescription className="text-base max-w-md mx-auto">
          Accédez à vos projets en un clic et libérez-les de toute dépendance propriétaire
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center pb-8">
        <Button
          size="lg"
          onClick={handleGitHubConnect}
          disabled={loading}
          className="gap-3 text-lg px-8 py-6"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Github className="h-5 w-5" />
          )}
          Se connecter avec GitHub
          <ArrowRight className="h-5 w-5" />
        </Button>
        
        <div className="mt-8 space-y-3 text-sm text-muted-foreground text-center">
          <p className="flex items-center gap-2 justify-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
            Autorisez l'accès à vos dépôts
          </p>
          <p className="flex items-center gap-2 justify-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
            Sélectionnez le projet à libérer
          </p>
          <p className="flex items-center gap-2 justify-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
            Obtenez un code 100% indépendant
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default GitHubConnectButton;
