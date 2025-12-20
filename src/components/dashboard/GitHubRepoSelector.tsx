import { useState, useEffect } from "react";
import { Search, GitBranch, Star, Clock, Unlock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

const GitHubRepoSelector = ({ onSelectRepo, isLoading }: GitHubRepoSelectorProps) => {
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
      
      if (!sessionData.session?.provider_token) {
        setError("Token GitHub non disponible. Veuillez vous reconnecter.");
        setLoading(false);
        return;
      }

      const response = await supabase.functions.invoke("list-github-repos", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erreur lors de la récupération des dépôts");
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

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">Chargement de vos projets</h3>
            <p className="text-muted-foreground">
              Nous récupérons la liste de vos dépôts GitHub...
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <GitBranch className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Erreur de connexion</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchRepos} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Réessayer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-primary" />
          Sélectionnez votre projet
        </CardTitle>
        <CardDescription>
          Choisissez le dépôt que vous souhaitez libérer de ses dépendances propriétaires
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un projet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Repos list */}
        <ScrollArea className="h-[400px] rounded-md border">
          <div className="p-4 space-y-3">
            {filteredRepos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {repos.length === 0 
                  ? "Aucun dépôt trouvé sur votre compte GitHub"
                  : "Aucun projet ne correspond à votre recherche"
                }
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{repo.name}</h4>
                      {repo.private && (
                        <Badge variant="outline" className="text-xs">
                          Privé
                        </Badge>
                      )}
                      {repo.language && (
                        <Badge variant="secondary" className="text-xs">
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
                    className="ml-4 gap-2"
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

        <p className="text-sm text-muted-foreground text-center mt-4">
          {filteredRepos.length} projet{filteredRepos.length !== 1 ? "s" : ""} disponible{filteredRepos.length !== 1 ? "s" : ""}
        </p>
      </CardContent>
    </Card>
  );
};

export default GitHubRepoSelector;
