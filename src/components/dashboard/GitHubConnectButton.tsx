import { useState } from "react";
import { Github, Loader2, ArrowRight, Link, Shield, Zap, CheckCircle2, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GitHubConnectButtonProps {
  onConnected?: () => void;
  isCompleted?: boolean;
  onSwitchToZip?: () => void;
  onGitHubImport?: (url: string) => void;
  githubUrl?: string;
  onGithubUrlChange?: (url: string) => void;
  isLoading?: boolean;
}

const GitHubConnectButton = ({ 
  onConnected, 
  isCompleted, 
  onSwitchToZip,
  onGitHubImport,
  githubUrl = "",
  onGithubUrlChange,
  isLoading = false
}: GitHubConnectButtonProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleGitHubConnect = async () => {
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          scopes: "repo read:user user:email",
        },
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error("GitHub auth error:", err);
      
      toast({
        title: "Connexion OAuth indisponible",
        description: "Utilisez l'option URL GitHub ci-dessus pour importer votre projet.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (githubUrl.trim() && onGitHubImport) {
      onGitHubImport(githubUrl);
    }
  };

  return (
    <Card className="card-shadow border border-border overflow-hidden">
      <CardHeader className="text-center pb-4">
        <div className="flex justify-center mb-4">
          {isCompleted ? (
            <Badge className="bg-success/10 text-success border-success/20 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Complété
            </Badge>
          ) : (
            <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
              <Sparkles className="h-3 w-3" />
              Recommandé
            </Badge>
          )}
        </div>
        <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 border border-primary/20">
          <Github className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl text-foreground">Étape 1 : Source du projet</CardTitle>
        <CardDescription className="text-base max-w-md mx-auto text-muted-foreground">
          Entrez l'URL de votre dépôt GitHub pour libérer votre code généré par IA
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex flex-col items-center pb-8">
        {/* Section principale : URL GitHub */}
        <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link className="h-4 w-4" />
              <span>URL de votre dépôt GitHub (depuis Lovable → GitHub)</span>
            </div>
            <Input
              type="url"
              placeholder="https://github.com/username/repository"
              value={githubUrl}
              onChange={(e) => onGithubUrlChange?.(e.target.value)}
              className="w-full rounded-lg border-border text-base py-6"
              disabled={isLoading}
            />
          </div>
          <Button 
            type="submit"
            size="lg"
            className="w-full gap-3 text-lg py-7 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-lg hover:shadow-xl"
            disabled={!githubUrl.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Github className="h-6 w-6" />
            )}
            Libérer ce projet
            <ArrowRight className="h-5 w-5" />
          </Button>
        </form>
        
        {/* Avantages */}
        <div className="mt-10 grid grid-cols-3 gap-6 text-center max-w-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Link className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Import direct</span>
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
            <span className="text-sm text-muted-foreground">Analyse instantanée</span>
          </div>
        </div>

        {/* Alternatives */}
        <div className="mt-8 pt-6 border-t border-border w-full max-w-lg">
          <p className="text-sm text-center text-muted-foreground mb-4">Ou choisissez une autre méthode</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {onSwitchToZip && (
              <Button
                variant="outline"
                onClick={onSwitchToZip}
                className="gap-2 border-border"
              >
                <Upload className="h-4 w-4" />
                Uploader un .zip
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={handleGitHubConnect}
              disabled={loading}
              className="gap-2 text-muted-foreground"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Github className="h-4 w-4" />
              )}
              OAuth GitHub (bientôt)
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GitHubConnectButton;
