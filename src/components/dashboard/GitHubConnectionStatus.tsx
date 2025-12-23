import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Github, CheckCircle2, AlertCircle, Loader2, ExternalLink, Key } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface GitHubConnectionStatusProps {
  onConnect?: () => void;
  variant?: "compact" | "full";
}

export function GitHubConnectionStatus({ onConnect, variant = "compact" }: GitHubConnectionStatusProps) {
  const [status, setStatus] = useState<"loading" | "connected" | "connected_pat" | "disconnected" | "expired">("loading");
  const [username, setUsername] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<"oauth" | "pat" | null>(null);

  const checkGitHubConnection = async () => {
    setStatus("loading");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        setStatus("disconnected");
        return;
      }

      const userId = sessionData.session.user.id;
      const githubToken = sessionData.session.provider_token;
      
      // Check for PAT in user_settings
      const { data: settings } = await supabase
        .from("user_settings")
        .select("github_token")
        .eq("user_id", userId)
        .maybeSingle();
      
      const hasPAT = !!settings?.github_token;
      
      // Try OAuth first
      if (githubToken) {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${githubToken}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setUsername(userData.login);
          setConnectionType("oauth");
          setStatus("connected");
          return;
        } else if (response.status === 401 && !hasPAT) {
          setStatus("expired");
          return;
        }
      }
      
      // If no OAuth or OAuth expired, check PAT
      if (hasPAT) {
        setConnectionType("pat");
        setStatus("connected_pat");
        setUsername(null); // PAT doesn't provide username easily
        return;
      }
      
      setStatus("disconnected");
    } catch (error) {
      console.error("Error checking GitHub connection:", error);
      setStatus("disconnected");
    }
  };

  useEffect(() => {
    checkGitHubConnection();
  }, []);

  const handleConnect = () => {
    if (onConnect) {
      onConnect();
    }
  };
  
  const isConnected = status === "connected" || status === "connected_pat";

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Vérification...</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
        isConnected 
          ? "bg-success/10 text-success" 
          : status === "expired"
            ? "bg-warning/10 text-warning"
            : "bg-muted text-muted-foreground"
      )}>
        {isConnected ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {status === "connected_pat" ? (
              <span className="flex items-center gap-1">
                <Key className="h-3 w-3" />
                PAT
              </span>
            ) : (
              <span>@{username}</span>
            )}
          </>
        ) : status === "expired" ? (
          <>
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Token expiré</span>
            {onConnect ? (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 px-2 text-warning hover:text-warning"
                onClick={handleConnect}
              >
                Reconnecter
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs opacity-70 cursor-help">Configurez via Déploiement Souverain</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Allez dans "Déploiement Souverain" pour configurer GitHub</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        ) : (
          <>
            <Github className="h-3.5 w-3.5" />
            {onConnect ? (
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 px-2"
                onClick={handleConnect}
              >
                Connecter GitHub
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-xs opacity-70 cursor-help">Non configuré</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Allez dans "Déploiement Souverain" pour configurer GitHub</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <Card className={cn(
      "border shadow-sm",
      isConnected 
        ? "border-success/30 bg-success/5" 
        : status === "expired"
          ? "border-warning/30 bg-warning/5"
          : "border-border"
    )}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-lg",
              isConnected 
                ? "bg-success/10" 
                : status === "expired"
                  ? "bg-warning/10"
                  : "bg-muted"
            )}>
              <Github className={cn(
                "h-5 w-5",
                isConnected 
                  ? "text-success" 
                  : status === "expired"
                    ? "text-warning"
                    : "text-foreground"
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">GitHub</span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs",
                    isConnected 
                      ? "bg-success/10 text-success border-success/30" 
                      : status === "expired"
                        ? "bg-warning/10 text-warning border-warning/30"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isConnected 
                    ? (status === "connected_pat" ? "Connecté (PAT)" : "Connecté") 
                    : status === "expired" 
                      ? "Expiré" 
                      : "Non connecté"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {status === "connected" 
                  ? `Connecté en tant que @${username}` 
                  : status === "connected_pat"
                    ? "Connecté via Personal Access Token"
                    : status === "expired"
                      ? "Votre connexion GitHub a expiré"
                      : "Connectez GitHub pour importer vos projets"}
              </p>
            </div>
          </div>

          {!isConnected && onConnect && (
            <Button 
              onClick={handleConnect}
              className={cn(
                "gap-2",
                status === "expired" 
                  ? "bg-warning hover:bg-warning/90 text-warning-foreground" 
                  : ""
              )}
            >
              <Github className="h-4 w-4" />
              {status === "expired" ? "Reconnecter" : "Connecter"}
            </Button>
          )}
          
          {!isConnected && !onConnect && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    disabled
                    className="gap-2 opacity-50"
                  >
                    <Github className="h-4 w-4" />
                    Connecter
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configurez GitHub via "Déploiement Souverain"</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {status === "connected" && username && (
            <a 
              href={`https://github.com/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Voir le profil
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
