import { useState, useEffect } from "react";
import { Search, GitBranch, Star, Clock, Loader2, RefreshCw, Radar, CheckCircle2, Github, AlertCircle, Layers, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface GitHubRepo {
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

interface GitHubMultiRepoSelectorProps {
  onSelectRepos: (repos: GitHubRepo[]) => void;
  isLoading: boolean;
  maxSelection?: number;
}

const GitHubMultiRepoSelector = ({ onSelectRepos, isLoading, maxSelection = 50 }: GitHubMultiRepoSelectorProps) => {
  const { toast } = useToast();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<Set<number>>(new Set());
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

      const githubToken = sessionData.session.provider_token;
      
      if (!githubToken) {
        setError("Token GitHub non disponible. Veuillez vous connecter avec GitHub.");
        setLoading(false);
        return;
      }

      const response = await supabase.functions.invoke("list-github-repos", {
        body: { github_token: githubToken },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) {
        if (response.error.message?.includes("401") || response.error.message?.includes("expired")) {
          setError("Votre connexion GitHub a expiré. Veuillez vous reconnecter.");
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
            repo.description?.toLowerCase().includes(query) ||
            repo.language?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, repos]);

  const toggleRepo = (repoId: number) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(repoId)) {
      newSelected.delete(repoId);
    } else {
      if (newSelected.size >= maxSelection) {
        toast({
          title: "Limite atteinte",
          description: `Vous ne pouvez sélectionner que ${maxSelection} repositories maximum`,
          variant: "destructive",
        });
        return;
      }
      newSelected.add(repoId);
    }
    setSelectedRepos(newSelected);
  };

  const selectAll = () => {
    const allIds = filteredRepos.slice(0, maxSelection).map(r => r.id);
    setSelectedRepos(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedRepos(new Set());
  };

  const handleStartBatchAnalysis = () => {
    const selectedReposList = repos.filter(r => selectedRepos.has(r.id));
    onSelectRepos(selectedReposList);
  };

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
      Vue: "bg-emerald-500",
      React: "bg-sky-500",
    };
    return colors[language || ""] || "bg-muted-foreground";
  };

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
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Layers className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-xl text-foreground">Import Batch Multi-Repos</CardTitle>
              <CardDescription className="text-muted-foreground">
                Sélectionnez plusieurs projets à analyser en une seule opération
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1 border-accent/30 text-accent">
            <Zap className="h-3 w-3" />
            Portfolio Plan
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search and actions bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, description ou langage..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-lg border-border bg-background"
            />
          </div>
          <Button variant="outline" size="sm" onClick={selectAll} className="whitespace-nowrap">
            Tout sélectionner
          </Button>
          <Button variant="ghost" size="sm" onClick={deselectAll} className="whitespace-nowrap">
            Désélectionner
          </Button>
        </div>

        {/* Selection summary */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-accent" />
            <span className="font-medium text-foreground">
              {selectedRepos.size} projet{selectedRepos.size !== 1 ? "s" : ""} sélectionné{selectedRepos.size !== 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground">/ {maxSelection} max</span>
          </div>
          <Button
            onClick={handleStartBatchAnalysis}
            disabled={selectedRepos.size === 0 || isLoading}
            className="gap-2 bg-gradient-to-r from-accent to-primary hover:opacity-90"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Radar className="h-4 w-4" />
            )}
            Analyser {selectedRepos.size} projet{selectedRepos.size !== 1 ? "s" : ""}
          </Button>
        </div>

        {/* Repos list with checkboxes */}
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
              filteredRepos.map((repo) => {
                const isSelected = selectedRepos.has(repo.id);
                return (
                  <div
                    key={repo.id}
                    onClick={() => toggleRepo(repo.id)}
                    className={`flex items-center gap-3 p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                      isSelected 
                        ? "border-accent bg-accent/5 ring-1 ring-accent/20" 
                        : "border-border bg-card hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={() => toggleRepo(repo.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="data-[state=checked]:bg-accent data-[state=checked]:border-accent"
                    />
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
                        <p className="text-sm text-muted-foreground truncate mb-1">
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
                  </div>
                );
              })
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

export default GitHubMultiRepoSelector;
