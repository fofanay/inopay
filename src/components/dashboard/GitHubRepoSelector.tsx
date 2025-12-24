import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, GitBranch, Star, Clock, Unlock, Loader2, RefreshCw, Radar, CheckCircle2, Github, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  updated_at: string;
  stargazers_count: number;
  default_branch: string;
  language: string | null;
}

interface GitHubRepoSelectorProps {
  onSelectRepo: (repo: GitHubRepo) => void;
  isLoading: boolean;
  isCompleted?: boolean;
}

const GitHubRepoSelector = ({ onSelectRepo, isLoading, isCompleted }: GitHubRepoSelectorProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        setError("Session non disponible. Veuillez vous reconnecter.");
        setLoading(false);
        return;
      }

      // Check if user has a GitHub provider token (connected via OAuth)
      const githubToken = sessionData.session.provider_token;
      
      if (!githubToken) {
        setError("Token GitHub non disponible. Veuillez vous connecter avec GitHub pour accéder à vos dépôts.");
        setLoading(false);
        return;
      }

      // Send the GitHub token to the edge function
      const response = await supabase.functions.invoke("list-github-repos", {
        body: {
          github_token: githubToken,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        // Check if it's a token expiration error
        if (response.error.message?.includes("401") || response.error.message?.includes("expired")) {
          setError("Votre connexion GitHub a expiré. Veuillez vous reconnecter avec GitHub.");
        } else {
          throw new Error(response.error.message || "Erreur lors de la récupération des dépôts");
        }
        return;
      }

      const repoList = response.data.repos || [];
      setRepos(repoList);
      setFilteredRepos(repoList);
    } catch (err) {
      console.error("Error fetching repos:", err);
      setError(err instanceof Error ? err.message : "Impossible de récupérer vos dépôts");
      toast({
        title: "Erreur",
        description: "Impossible de récupérer vos dépôts GitHub",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredRepos(repos);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRepos(
        repos.filter(
          (repo) =>
            repo.name.toLowerCase().includes(query) ||
            repo.description?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, repos]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getLanguageColor = (language: string | null) => {
    const colors: Record<string, string> = {
      TypeScript: "bg-blue-500",
      JavaScript: "bg-yellow-500",
      Python: "bg-green-500",
      Go: "bg-cyan-500",
      Rust: "bg-orange-500",
    };
    return colors[language || ""] || "bg-muted-foreground";
  };

  if (loading) {
    return (
      <Card className="card-shadow border border-border">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">Chargement de vos projets</h3>
            <p className="text-muted-foreground">
              Nous récupérons la liste de vos dépôts GitHub...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleGitHubReconnect = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          scopes: "repo read:user user:email",
        },
      });
      if (error) throw error;
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de se reconnecter à GitHub",
        variant: "destructive",
      });
    }
  };

  if (error) {
    const isTokenExpired = error.includes("expiré") || error.includes("reconnecter");
    
    return (
      <Card className="card-shadow border border-border status-border-red">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
              {isTokenExpired ? (
                <AlertCircle className="h-8 w-8 text-warning" />
              ) : (
                <GitBranch className="h-8 w-8 text-destructive" />
              )}
            </div>
            <h3 className="text-lg font-semibold mb-2 text-foreground">
              {isTokenExpired ? "Connexion GitHub expirée" : "Erreur de connexion"}
            </h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="flex gap-3">
              {isTokenExpired ? (
                <Button onClick={handleGitHubReconnect} className="gap-2 rounded-lg">
                  <Github className="h-4 w-4" />
                  Reconnecter GitHub
                </Button>
              ) : (
                <Button onClick={fetchRepos} variant="outline" className="gap-2 rounded-lg">
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-shadow border border-border status-border-blue">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Radar className="h-5 w-5 text-accent" />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground">Étape 1 : Source du projet</CardTitle>
              <CardDescription className="text-muted-foreground">
                Sélectionnez l'application à libérer de ses dépendances propriétaires
              </CardDescription>
            </div>
          </div>
          {isCompleted && (
            <Badge className="bg-success/10 text-success border-success/20 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Complété
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("ui.searchProjects")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 rounded-lg border-border bg-background"
          />
        </div>

        {/* Repos list */}
        <ScrollArea className="h-[400px] rounded-lg border border-border bg-muted/30">
          <div className="p-3 space-y-2">
            {filteredRepos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {repos.length === 0 
                  ? "Aucun dépôt trouvé sur votre compte GitHub"
                  : "Aucun projet ne correspond à votre recherche"
                }
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-all duration-200 card-hover"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-semibold text-foreground">{repo.name}</h4>
                      {repo.private && (
                        <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                          Privé
                        </Badge>
                      )}
                      {repo.language && (
                        <Badge className="text-xs bg-secondary text-secondary-foreground border-0">
                          <span className={`w-2 h-2 rounded-full mr-1.5 ${getLanguageColor(repo.language)}`} />
                          {repo.language}
                        </Badge>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-sm text-muted-foreground truncate mb-2">
                        {repo.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {repo.stargazers_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(repo.updated_at)}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => onSelectRepo(repo)}
                    disabled={isLoading}
                    className="ml-4 gap-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                    size="sm"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                    Libérer
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
          <span>{filteredRepos.length} projet{filteredRepos.length !== 1 ? "s" : ""} disponible{filteredRepos.length !== 1 ? "s" : ""}</span>
          <Button variant="ghost" size="sm" onClick={fetchRepos} className="gap-2 text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GitHubRepoSelector;
