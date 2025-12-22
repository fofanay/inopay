import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Github, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface GitHubConnectionStatusProps {
  onConnect?: () => void;
  variant?: "compact" | "full";
}

export function GitHubConnectionStatus({ onConnect, variant = "compact" }: GitHubConnectionStatusProps) {
  const [status, setStatus] = useState<"loading" | "connected" | "disconnected" | "expired">("loading");
  const [username, setUsername] = useState<string | null>(null);

  const checkGitHubConnection = async () => {
    setStatus("loading");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        setStatus("disconnected");
        return;
      }

      const githubToken = sessionData.session.provider_token;
      
      if (!githubToken) {
        setStatus("disconnected");
        return;
      }

      // Try to fetch user info to verify token is valid
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${githubToken}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUsername(userData.login);
        setStatus("connected");
      } else if (response.status === 401) {
        setStatus("expired");
      } else {
        setStatus("disconnected");
      }
    } catch (error) {
      console.error("Error checking GitHub connection:", error);
      setStatus("disconnected");
    }
  };

  useEffect(() => {
    checkGitHubConnection();
  }, []);

  const handleConnect = async () => {
    if (onConnect) {
      onConnect();
      return;
    }

    try {
      await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          scopes: "repo read:user user:email",
        },
      });
    } catch (error) {
      console.error("GitHub OAuth error:", error);
    }
  };

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
        status === "connected" 
          ? "bg-success/10 text-success" 
          : status === "expired"
            ? "bg-warning/10 text-warning"
            : "bg-muted text-muted-foreground"
      )}>
        {status === "connected" ? (
          <>
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>@{username}</span>
          </>
        ) : status === "expired" ? (
          <>
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Token expiré</span>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 px-2 text-warning hover:text-warning"
              onClick={handleConnect}
            >
              Reconnecter
            </Button>
          </>
        ) : (
          <>
            <Github className="h-3.5 w-3.5" />
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-6 px-2"
              onClick={handleConnect}
            >
              Connecter GitHub
            </Button>
          </>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <Card className={cn(
      "border shadow-sm",
      status === "connected" 
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
              status === "connected" 
                ? "bg-success/10" 
                : status === "expired"
                  ? "bg-warning/10"
                  : "bg-muted"
            )}>
              <Github className={cn(
                "h-5 w-5",
                status === "connected" 
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
                    status === "connected" 
                      ? "bg-success/10 text-success border-success/30" 
                      : status === "expired"
                        ? "bg-warning/10 text-warning border-warning/30"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {status === "connected" 
                    ? "Connecté" 
                    : status === "expired" 
                      ? "Expiré" 
                      : "Non connecté"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {status === "connected" 
                  ? `Connecté en tant que @${username}` 
                  : status === "expired"
                    ? "Votre connexion GitHub a expiré"
                    : "Connectez GitHub pour importer vos projets"}
              </p>
            </div>
          </div>

          {status !== "connected" && (
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

          {status === "connected" && (
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
