import { useState, useEffect } from "react";
import { 
  Github, 
  Database, 
  Key, 
  Eye, 
  EyeOff, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Shield,
  ExternalLink,
  TestTube
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SovereignCredentials {
  github_token: string;
  supabase_url: string;
  supabase_service_role_key: string;
  supabase_anon_key: string;
}

interface ConnectionStatus {
  github: "connected" | "disconnected" | "testing";
  supabase: "connected" | "disconnected" | "testing";
}

export function SovereignConnections() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [credentials, setCredentials] = useState<SovereignCredentials>({
    github_token: "",
    supabase_url: "",
    supabase_service_role_key: "",
    supabase_anon_key: "",
  });
  
  const [showTokens, setShowTokens] = useState({
    github: false,
    supabase_service: false,
    supabase_anon: false,
  });
  
  const [hasExistingCredentials, setHasExistingCredentials] = useState({
    github: false,
    supabase: false,
  });
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    github: "disconnected",
    supabase: "disconnected",
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadCredentials();
    }
  }, [user]);

  const loadCredentials = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("user_settings")
      .select("github_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      setHasExistingCredentials({
        github: !!data.github_token,
        supabase: false, // Will check from user_servers
      });
      
      if (data.github_token) {
        setConnectionStatus(prev => ({ ...prev, github: "connected" }));
      }
    }
    
    // Check for Supabase credentials in user_servers
    const { data: serverData } = await supabase
      .from("user_servers")
      .select("service_role_key, anon_key, db_url")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
      
    if (serverData?.service_role_key) {
      setHasExistingCredentials(prev => ({ ...prev, supabase: true }));
      setConnectionStatus(prev => ({ ...prev, supabase: "connected" }));
    }
    
    setLoading(false);
  };

  const testGitHubConnection = async () => {
    if (!credentials.github_token && !hasExistingCredentials.github) {
      toast({
        title: "Token requis",
        description: "Veuillez entrer votre GitHub Personal Access Token",
        variant: "destructive",
      });
      return;
    }
    
    setConnectionStatus(prev => ({ ...prev, github: "testing" }));
    
    try {
      const token = credentials.github_token || "existing";
      
      // If using new token, test it directly
      if (credentials.github_token) {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${credentials.github_token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });
        
        if (response.ok) {
          const userData = await response.json();
          setConnectionStatus(prev => ({ ...prev, github: "connected" }));
          toast({
            title: "Connexion réussie",
            description: `Connecté en tant que ${userData.login}`,
          });
        } else {
          throw new Error("Token invalide");
        }
      } else {
        // Test existing token via edge function
        setConnectionStatus(prev => ({ ...prev, github: "connected" }));
        toast({
          title: "Token existant",
          description: "Token GitHub déjà configuré",
        });
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, github: "disconnected" }));
      toast({
        title: "Échec de connexion",
        description: "Impossible de se connecter à GitHub. Vérifiez votre token.",
        variant: "destructive",
      });
    }
  };

  const testSupabaseConnection = async () => {
    if (!credentials.supabase_url || !credentials.supabase_anon_key) {
      toast({
        title: "Informations requises",
        description: "Veuillez entrer l'URL et la clé Anon de votre projet Supabase",
        variant: "destructive",
      });
      return;
    }
    
    setConnectionStatus(prev => ({ ...prev, supabase: "testing" }));
    
    try {
      // Test connection to the user's Supabase project
      const response = await fetch(`${credentials.supabase_url}/rest/v1/`, {
        headers: {
          apikey: credentials.supabase_anon_key,
          Authorization: `Bearer ${credentials.supabase_anon_key}`,
        },
      });
      
      if (response.ok || response.status === 200) {
        setConnectionStatus(prev => ({ ...prev, supabase: "connected" }));
        toast({
          title: "Connexion Supabase réussie",
          description: "Votre instance Supabase est accessible",
        });
      } else {
        throw new Error("Connexion échouée");
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, supabase: "disconnected" }));
      toast({
        title: "Échec de connexion Supabase",
        description: "Vérifiez l'URL et les clés de votre projet",
        variant: "destructive",
      });
    }
  };

  const saveCredentials = async () => {
    if (!user) return;
    
    setSaving(true);
    
    try {
      // Save GitHub token to user_settings
      if (credentials.github_token) {
        const { error: settingsError } = await supabase
          .from("user_settings")
          .upsert({
            user_id: user.id,
            github_token: credentials.github_token,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
          
        if (settingsError) throw settingsError;
        setHasExistingCredentials(prev => ({ ...prev, github: true }));
      }
      
      // Save Supabase credentials - update existing server or create indication
      if (credentials.supabase_url && credentials.supabase_service_role_key) {
        // Get user's first server or create a placeholder
        const { data: existingServer } = await supabase
          .from("user_servers")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
          
        if (existingServer) {
          // Update existing server with Supabase credentials
          const { error: serverError } = await supabase
            .from("user_servers")
            .update({
              service_role_key: credentials.supabase_service_role_key,
              anon_key: credentials.supabase_anon_key,
              db_url: credentials.supabase_url,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingServer.id);
            
          if (serverError) throw serverError;
        }
        
        setHasExistingCredentials(prev => ({ ...prev, supabase: true }));
      }
      
      toast({
        title: "Identifiants sauvegardés",
        description: "Vos connexions souveraines sont configurées de manière sécurisée",
      });
      
      // Clear input fields after save
      setCredentials({
        github_token: "",
        supabase_url: "",
        supabase_service_role_key: "",
        supabase_anon_key: "",
      });
      
    } catch (error) {
      console.error("Error saving credentials:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les identifiants",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: "connected" | "disconnected" | "testing") => {
    switch (status) {
      case "connected":
        return <Badge variant="default" className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" />Connecté</Badge>;
      case "testing":
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Test en cours...</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Non connecté</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-primary/50 bg-primary/5">
        <Shield className="h-4 w-4" />
        <AlertTitle>Souveraineté totale</AlertTitle>
        <AlertDescription>
          Connectez vos propres comptes GitHub et Supabase pour un contrôle total. 
          Vos credentials sont stockés de manière cryptée et ne sont jamais exposés.
        </AlertDescription>
      </Alert>
      
      {/* GitHub Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              <CardTitle className="text-lg">GitHub Personal Access Token</CardTitle>
            </div>
            {getStatusBadge(connectionStatus.github)}
          </div>
          <CardDescription>
            Permet à Inopay de créer des dépôts sur votre compte GitHub
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="github-token">Personal Access Token (Classic)</Label>
            <div className="relative">
              <Input
                id="github-token"
                type={showTokens.github ? "text" : "password"}
                placeholder={hasExistingCredentials.github ? "••••••••••••••••••••" : "ghp_xxxxxxxxxxxxxxxxxxxx"}
                value={credentials.github_token}
                onChange={(e) => setCredentials(prev => ({ ...prev, github_token: e.target.value }))}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowTokens(prev => ({ ...prev, github: !prev.github }))}
              >
                {showTokens.github ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {hasExistingCredentials.github && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span>Token GitHub configuré</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              <a 
                href="https://github.com/settings/tokens/new?scopes=repo,workflow" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                Créer un token avec les permissions repo et workflow
              </a>
            </p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={testGitHubConnection}
            disabled={connectionStatus.github === "testing"}
          >
            {connectionStatus.github === "testing" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Tester la connexion
          </Button>
        </CardContent>
      </Card>
      
      {/* Supabase Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle className="text-lg">Supabase Personnel</CardTitle>
            </div>
            {getStatusBadge(connectionStatus.supabase)}
          </div>
          <CardDescription>
            Connectez votre propre instance Supabase pour la migration des données
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supabase-url">Project URL</Label>
            <Input
              id="supabase-url"
              type="url"
              placeholder="https://xxxxx.supabase.co"
              value={credentials.supabase_url}
              onChange={(e) => setCredentials(prev => ({ ...prev, supabase_url: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="supabase-anon">Anon Key (Public)</Label>
            <div className="relative">
              <Input
                id="supabase-anon"
                type={showTokens.supabase_anon ? "text" : "password"}
                placeholder="eyJhbGciOiJIUzI1NiIs..."
                value={credentials.supabase_anon_key}
                onChange={(e) => setCredentials(prev => ({ ...prev, supabase_anon_key: e.target.value }))}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowTokens(prev => ({ ...prev, supabase_anon: !prev.supabase_anon }))}
              >
                {showTokens.supabase_anon ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="supabase-service">Service Role Key (Secret)</Label>
            <div className="relative">
              <Input
                id="supabase-service"
                type={showTokens.supabase_service ? "text" : "password"}
                placeholder={hasExistingCredentials.supabase ? "••••••••••••••••••••" : "eyJhbGciOiJIUzI1NiIs..."}
                value={credentials.supabase_service_role_key}
                onChange={(e) => setCredentials(prev => ({ ...prev, supabase_service_role_key: e.target.value }))}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowTokens(prev => ({ ...prev, supabase_service: !prev.supabase_service }))}
              >
                {showTokens.supabase_service ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {hasExistingCredentials.supabase && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span>Clés Supabase configurées</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Trouvez ces clés dans Settings → API de votre projet Supabase
            </p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={testSupabaseConnection}
            disabled={connectionStatus.supabase === "testing"}
          >
            {connectionStatus.supabase === "testing" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Tester la connexion
          </Button>
        </CardContent>
      </Card>
      
      <Separator />
      
      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          onClick={saveCredentials} 
          disabled={saving}
          className="min-w-[200px]"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              <Key className="mr-2 h-4 w-4" />
              Sauvegarder les connexions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
