import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  TestTube,
  ArrowRight,
  Download,
  Upload,
  Info
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
  // GitHub SOURCE (Lovable)
  github_source_url: string;
  github_source_token: string;
  // GitHub DESTINATION (Personnel)
  github_destination_token: string;
  github_destination_username: string;
  // Supabase Personnel
  supabase_url: string;
  supabase_service_role_key: string;
  supabase_anon_key: string;
}

interface ConnectionStatus {
  github_source: "connected" | "disconnected" | "testing";
  github_destination: "connected" | "disconnected" | "testing";
  supabase: "connected" | "disconnected" | "testing";
}

export function SovereignConnections() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [credentials, setCredentials] = useState<SovereignCredentials>({
    github_source_url: "",
    github_source_token: "",
    github_destination_token: "",
    github_destination_username: "",
    supabase_url: "",
    supabase_service_role_key: "",
    supabase_anon_key: "",
  });
  
  const [showTokens, setShowTokens] = useState({
    github_source: false,
    github_destination: false,
    supabase_service: false,
    supabase_anon: false,
  });
  
  const [hasExistingCredentials, setHasExistingCredentials] = useState({
    github_source: false,
    github_destination: false,
    supabase: false,
  });
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    github_source: "disconnected",
    github_destination: "disconnected",
    supabase: "disconnected",
  });
  
  const [destinationUsername, setDestinationUsername] = useState<string | null>(null);
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
      .select("github_token, github_source_token, github_destination_token, github_destination_username")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      const hasSource = !!(data.github_source_token || data.github_token);
      const hasDestination = !!data.github_destination_token;
      
      setHasExistingCredentials({
        github_source: hasSource,
        github_destination: hasDestination,
        supabase: false,
      });
      
      if (hasSource) {
        setConnectionStatus(prev => ({ ...prev, github_source: "connected" }));
      }
      if (hasDestination) {
        setConnectionStatus(prev => ({ ...prev, github_destination: "connected" }));
        if (data.github_destination_username) {
          setDestinationUsername(data.github_destination_username);
        }
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

  const testGitHubSourceConnection = async () => {
    const token = credentials.github_source_token;
    
    if (!token && !hasExistingCredentials.github_source) {
      // Test via URL publique
      if (credentials.github_source_url) {
        setConnectionStatus(prev => ({ ...prev, github_source: "connected" }));
        toast({
          title: t('sovereignConnections.sourceUrlValid'),
          description: t('sovereignConnections.lovableRepoAccessible'),
        });
        return;
      }
      toast({
        title: t('sovereignConnections.infoRequired'),
        description: t('sovereignConnections.enterUrlOrToken'),
        variant: "destructive",
      });
      return;
    }
    
    setConnectionStatus(prev => ({ ...prev, github_source: "testing" }));
    
    try {
      if (token) {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });
        
        if (response.ok) {
          const userData = await response.json();
          setConnectionStatus(prev => ({ ...prev, github_source: "connected" }));
          toast({
            title: t('sovereignConnections.sourceConnected'),
            description: t('sovereignConnections.accessToAccount', { login: userData.login }),
          });
        } else {
          throw new Error("Token invalide");
        }
      } else {
        setConnectionStatus(prev => ({ ...prev, github_source: "connected" }));
        toast({
          title: t('sovereignConnections.sourceConfigured'),
          description: t('sovereignConnections.sourceTokenSaved'),
        });
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, github_source: "disconnected" }));
      toast({
        title: t('sovereignConnections.sourceConnectionFailed'),
        description: t('sovereignConnections.checkTokenOrUrl'),
        variant: "destructive",
      });
    }
  };

  const testGitHubDestinationConnection = async () => {
    if (!credentials.github_destination_token && !hasExistingCredentials.github_destination) {
      toast({
        title: t('sovereignConnections.tokenRequired'),
        description: t('sovereignConnections.enterPatForPersonal'),
        variant: "destructive",
      });
      return;
    }
    
    setConnectionStatus(prev => ({ ...prev, github_destination: "testing" }));
    
    try {
      const token = credentials.github_destination_token;
      
      if (token) {
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });
        
        if (response.ok) {
          const userData = await response.json();
          
          // Vérifier les permissions repo
          const scopeHeader = response.headers.get("x-oauth-scopes");
          const hasRepoScope = scopeHeader?.includes("repo");
          
          setDestinationUsername(userData.login);
          setCredentials(prev => ({ ...prev, github_destination_username: userData.login }));
          setConnectionStatus(prev => ({ ...prev, github_destination: "connected" }));
          
          toast({
            title: t('sovereignConnections.destinationConnected'),
            description: t('sovereignConnections.readyToExport', { login: userData.login }) + (hasRepoScope ? " ✓ permissions repo" : " ⚠️ " + t('sovereignConnections.checkPermissions')),
          });
        } else {
          throw new Error("Token invalide");
        }
      } else {
        setConnectionStatus(prev => ({ ...prev, github_destination: "connected" }));
        toast({
          title: t('sovereignConnections.destinationConfigured'),
          description: t('sovereignConnections.destinationTokenSaved'),
        });
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, github_destination: "disconnected" }));
      toast({
        title: t('sovereignConnections.destinationConnectionFailed'),
        description: t('sovereignConnections.checkPat'),
        variant: "destructive",
      });
    }
  };

  const testSupabaseConnection = async () => {
    if (!credentials.supabase_url || !credentials.supabase_anon_key) {
      toast({
        title: t('sovereignConnections.infoRequired'),
        description: t('sovereignConnections.enterSupabaseInfo'),
        variant: "destructive",
      });
      return;
    }
    
    setConnectionStatus(prev => ({ ...prev, supabase: "testing" }));
    
    try {
      const response = await fetch(`${credentials.supabase_url}/rest/v1/`, {
        headers: {
          apikey: credentials.supabase_anon_key,
          Authorization: `Bearer ${credentials.supabase_anon_key}`,
        },
      });
      
      if (response.ok || response.status === 200) {
        setConnectionStatus(prev => ({ ...prev, supabase: "connected" }));
        toast({
          title: t('sovereignConnections.supabaseConnected'),
          description: t('sovereignConnections.supabaseAccessible'),
        });
      } else {
        throw new Error("Connexion échouée");
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, supabase: "disconnected" }));
      toast({
        title: t('sovereignConnections.supabaseConnectionFailed'),
        description: t('sovereignConnections.checkSupabaseInfo'),
        variant: "destructive",
      });
    }
  };

  const saveCredentials = async () => {
    if (!user) return;
    
    setSaving(true);
    
    try {
      const updateData: {
        user_id: string;
        updated_at: string;
        github_source_token?: string;
        github_destination_token?: string;
        github_destination_username?: string;
      } = {
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };
      
      // GitHub Source Token
      if (credentials.github_source_token) {
        updateData.github_source_token = credentials.github_source_token;
        setHasExistingCredentials(prev => ({ ...prev, github_source: true }));
      }
      
      // GitHub Destination Token
      if (credentials.github_destination_token) {
        updateData.github_destination_token = credentials.github_destination_token;
        if (credentials.github_destination_username || destinationUsername) {
          updateData.github_destination_username = credentials.github_destination_username || destinationUsername || undefined;
        }
        setHasExistingCredentials(prev => ({ ...prev, github_destination: true }));
      }
      
      const { error: settingsError } = await supabase
        .from("user_settings")
        .upsert(updateData, { onConflict: "user_id" });
        
      if (settingsError) throw settingsError;
      
      // Save Supabase credentials
      if (credentials.supabase_url && credentials.supabase_service_role_key) {
        const { data: existingServer } = await supabase
          .from("user_servers")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();
          
        if (existingServer) {
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
        title: t('sovereignConnections.connectionsSaved'),
        description: t('sovereignConnections.credentialsSecured'),
      });
      
      // Clear input fields after save
      setCredentials({
        github_source_url: "",
        github_source_token: "",
        github_destination_token: "",
        github_destination_username: "",
        supabase_url: "",
        supabase_service_role_key: "",
        supabase_anon_key: "",
      });
      
    } catch (error) {
      console.error("Error saving credentials:", error);
      toast({
        title: t('common.error'),
        description: t('sovereignConnections.saveFailed'),
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
        return <Badge variant="default" className="bg-success"><CheckCircle2 className="h-3 w-3 mr-1" />{t('sovereignConnections.status.connected')}</Badge>;
      case "testing":
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />{t('sovereignConnections.status.testing')}</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />{t('sovereignConnections.status.notConnected')}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Alert className="border-primary/50 bg-primary/5">
        <Shield className="h-4 w-4" />
        <AlertTitle>{t('sovereignConnections.dualConnection')}</AlertTitle>
        <AlertDescription>
          <strong>{t('sovereignConnections.githubSource')}</strong> = {t('sovereignConnections.githubSourceDesc')}.<br />
          <strong>{t('sovereignConnections.githubDestination')}</strong> = {t('sovereignConnections.githubDestinationDesc')}.
        </AlertDescription>
      </Alert>
      
      {/* Visual Flow Indicator */}
      <div className="flex items-center justify-center gap-4 py-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <Download className="h-4 w-4 text-orange-500" />
          <span className="font-medium text-sm">{t('sovereignConnections.sourceLovable')}</span>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <div className="px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg">
          <span className="font-medium text-sm">🧹 {t('sovereignConnections.cleaningInopay')}</span>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <div className="flex items-center gap-2 px-4 py-2 bg-success/10 border border-success/30 rounded-lg">
          <Upload className="h-4 w-4 text-success" />
          <span className="font-medium text-sm">{t('sovereignConnections.personalDestination')}</span>
        </div>
      </div>
      
      {/* GitHub SOURCE - Import from Lovable */}
      <Card className="border-orange-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-lg">📥 {t('sovereignConnections.githubSourceTitle')}</CardTitle>
            </div>
            {getStatusBadge(connectionStatus.github_source)}
          </div>
          <CardDescription>
            {t('sovereignConnections.githubSourceCardDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="github-source-url">{t('sovereignConnections.lovableRepoUrl')}</Label>
            <Input
              id="github-source-url"
              type="url"
              placeholder="https://github.com/lovable-org/mon-projet"
              value={credentials.github_source_url}
              onChange={(e) => setCredentials(prev => ({ ...prev, github_source_url: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              {t('sovereignConnections.lovableRepoUrlHint')}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="github-source-token">{t('sovereignConnections.tokenOptional')}</Label>
            <div className="relative">
              <Input
                id="github-source-token"
                type={showTokens.github_source ? "text" : "password"}
                placeholder={hasExistingCredentials.github_source ? "••••••••••••••••••••" : "ghp_... (optionnel)"}
                value={credentials.github_source_token}
                onChange={(e) => setCredentials(prev => ({ ...prev, github_source_token: e.target.value }))}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowTokens(prev => ({ ...prev, github_source: !prev.github_source }))}
              >
                {showTokens.github_source ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {hasExistingCredentials.github_source && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span>{t('sovereignConnections.sourceTokenConfigured')}</span>
              </div>
            )}
          </div>
          
          <Button 
            variant="outline" 
            onClick={testGitHubSourceConnection}
            disabled={connectionStatus.github_source === "testing"}
          >
            {connectionStatus.github_source === "testing" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            {t('sovereignConnections.testSource')}
          </Button>
        </CardContent>
      </Card>
      
      {/* GitHub DESTINATION - Export to Personal */}
      <Card className="border-success/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-success" />
              <CardTitle className="text-lg">📤 {t('sovereignConnections.githubDestinationTitle')}</CardTitle>
            </div>
            {getStatusBadge(connectionStatus.github_destination)}
          </div>
          <CardDescription>
            {t('sovereignConnections.githubDestinationCardDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="default" className="border-info/50 bg-info/5">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {t('sovereignConnections.destinationTokenInfo')}
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label htmlFor="github-dest-token">{t('sovereignConnections.patClassic')}</Label>
            <div className="relative">
              <Input
                id="github-dest-token"
                type={showTokens.github_destination ? "text" : "password"}
                placeholder={hasExistingCredentials.github_destination ? "••••••••••••••••••••" : "ghp_xxxxxxxxxxxxxxxxxxxx"}
                value={credentials.github_destination_token}
                onChange={(e) => setCredentials(prev => ({ ...prev, github_destination_token: e.target.value }))}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowTokens(prev => ({ ...prev, github_destination: !prev.github_destination }))}
              >
                {showTokens.github_destination ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            
            {hasExistingCredentials.github_destination && destinationUsername && (
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span>{t('sovereignConnections.exportTo')} <strong>@{destinationUsername}</strong></span>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              <a 
                href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=InoPay%20Sovereign%20Export" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-primary"
              >
                {t('sovereignConnections.createTokenLink')}
              </a>
            </p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={testGitHubDestinationConnection}
            disabled={connectionStatus.github_destination === "testing"}
            className="border-success/50 hover:bg-success/10"
          >
            {connectionStatus.github_destination === "testing" ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            {t('sovereignConnections.testDestination')}
          </Button>
        </CardContent>
      </Card>
      
      {/* Supabase Connection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle className="text-lg">🗄️ {t('sovereignConnections.supabaseTitle')}</CardTitle>
            </div>
            {getStatusBadge(connectionStatus.supabase)}
          </div>
          <CardDescription>
            {t('sovereignConnections.supabaseCardDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="supabase-url">{t('sovereignConnections.projectUrl')}</Label>
            <Input
              id="supabase-url"
              type="url"
              placeholder="https://xxxxx.supabase.co"
              value={credentials.supabase_url}
              onChange={(e) => setCredentials(prev => ({ ...prev, supabase_url: e.target.value }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="supabase-anon">{t('sovereignConnections.anonKey')}</Label>
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
            <Label htmlFor="supabase-service">{t('sovereignConnections.serviceRoleKey')}</Label>
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
                <span>{t('sovereignConnections.supabaseKeysConfigured')}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {t('sovereignConnections.findKeysHint')}
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
            {t('sovereignConnections.testConnection')}
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
              {t('common.saving')}
            </>
          ) : (
            <>
              <Key className="mr-2 h-4 w-4" />
              {t('sovereignConnections.saveConnections')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
