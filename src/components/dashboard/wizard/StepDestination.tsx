import { useState } from "react";
import { Server, Globe, Github, Database, Copy, Check, Eye, EyeOff, Loader2, CheckCircle2, ExternalLink, Terminal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useWizard, HostingType } from "@/contexts/WizardContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export function StepDestination() {
  const { state, dispatch, nextStep, prevStep } = useWizard();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [copied, setCopied] = useState(false);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [isCreatingSetup, setIsCreatingSetup] = useState(false);

  const toggleShowToken = (key: string) => {
    setShowTokens(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copié !", description: "Commande copiée dans le presse-papier" });
  };

  // Create VPS setup and get one-liner
  const createVpsSetup = async () => {
    if (!user) return;
    
    setIsCreatingSetup(true);
    
    try {
      // Generate setup ID
      const setupId = crypto.randomUUID();
      
      // Create server entry
      const { error } = await supabase.from("user_servers").insert({
        user_id: user.id,
        name: `VPS-${Date.now()}`,
        ip_address: state.destination.vpsIp || "pending",
        setup_id: setupId,
        status: "pending",
      });
      
      if (error) throw error;
      
      dispatch({
        type: "UPDATE_DESTINATION",
        payload: { setupId },
      });
      
      toast({ 
        title: "Setup créé !", 
        description: "Copiez la commande et exécutez-la sur votre VPS" 
      });
    } catch (error: any) {
      console.error("[StepDestination] Error:", error);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsCreatingSetup(false);
    }
  };

  // Validate GitHub destination
  const validateGitHub = async () => {
    if (!state.destination.destinationToken) {
      toast({ title: "Token requis", description: "Entrez votre Personal Access Token", variant: "destructive" });
      return;
    }
    
    setIsValidating(true);
    
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${state.destination.destinationToken}`, Accept: "application/vnd.github.v3+json" }
      });
      
      if (response.ok) {
        const userData = await response.json();
        
        // Save token
        if (user) {
          await supabase
            .from("user_settings")
            .upsert({
              user_id: user.id,
              github_destination_token: state.destination.destinationToken,
              github_destination_username: userData.login,
              updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });
        }
        
        dispatch({
          type: "UPDATE_DESTINATION",
          payload: { 
            destinationUsername: userData.login,
            isGithubValidated: true,
          },
        });
        
        toast({ title: "GitHub connecté !", description: `Bienvenue ${userData.login}` });
      } else {
        throw new Error("Token invalide");
      }
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsValidating(false);
    }
  };

  const canContinue = state.destination.isGithubValidated && 
    (state.destination.hostingType === "vps" ? state.destination.setupId : true);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const oneLinerId = state.destination.setupId;
  const oneLiner = oneLinerId 
    ? `curl -sSL "${supabaseUrl}/functions/v1/serve-setup-script?id=${oneLinerId}" | sudo bash`
    : "";

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Configuration de la destination
        </CardTitle>
        <CardDescription>
          Définissez où votre code libéré sera déployé
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* GitHub Destination (Required) */}
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            <h3 className="font-semibold">Dépôt GitHub de destination</h3>
            {state.destination.isGithubValidated && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/30 ml-auto">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connecté
              </Badge>
            )}
          </div>
          
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Token GitHub (pour créer le dépôt)</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showTokens.github ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxx"
                    value={state.destination.destinationToken}
                    onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { destinationToken: e.target.value } })}
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowToken("github")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showTokens.github ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button onClick={validateGitHub} disabled={isValidating || state.destination.isGithubValidated} variant="outline">
                  {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider"}
                </Button>
              </div>
              {state.destination.destinationUsername && (
                <p className="text-sm text-muted-foreground">
                  Connecté en tant que : <span className="font-medium text-foreground">{state.destination.destinationUsername}</span>
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Nom du nouveau dépôt</Label>
              <Input
                placeholder="mon-projet-libre"
                value={state.destination.destinationRepo}
                onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { destinationRepo: e.target.value } })}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Hosting Type Selection */}
        <Tabs 
          value={state.destination.hostingType} 
          onValueChange={(v) => dispatch({ type: "UPDATE_DESTINATION", payload: { hostingType: v as HostingType } })}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vps" className="gap-2">
              <Server className="h-4 w-4" />
              VPS Ubuntu
            </TabsTrigger>
            <TabsTrigger value="traditional" className="gap-2">
              <Globe className="h-4 w-4" />
              Hébergeur Web
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="vps" className="space-y-4 mt-4">
            <Alert className="border-info/50 bg-info/5">
              <Terminal className="h-4 w-4 text-info" />
              <AlertDescription>
                <strong>Installation automatique :</strong> Copiez cette commande et exécutez-la sur votre VPS Ubuntu.
                Elle installera automatiquement Docker, Coolify et PostgreSQL.
              </AlertDescription>
            </Alert>
            
            {!state.destination.setupId ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>IP de votre VPS (optionnel)</Label>
                  <Input
                    placeholder="123.45.67.89"
                    value={state.destination.vpsIp}
                    onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { vpsIp: e.target.value } })}
                  />
                </div>
                <Button onClick={createVpsSetup} disabled={isCreatingSetup} className="w-full gap-2">
                  {isCreatingSetup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
                  Générer la commande d'installation
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Commande d'installation (one-liner)</Label>
                <div className="relative">
                  <pre className="bg-slate-950 text-slate-200 p-4 rounded-lg text-xs font-mono overflow-x-auto">
                    {oneLiner}
                  </pre>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="absolute top-2 right-2 gap-1.5"
                    onClick={() => copyToClipboard(oneLiner)}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copié" : "Copier"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Exécutez cette commande en tant que <code className="bg-muted px-1 rounded">root</code> sur votre VPS Ubuntu.
                </p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="traditional" className="space-y-4 mt-4">
            <Alert>
              <Globe className="h-4 w-4" />
              <AlertDescription>
                Pour les hébergeurs traditionnels (OVH, IONOS, etc.), Inopay génèrera une GitHub Action 
                pour déployer automatiquement à chaque push.
              </AlertDescription>
            </Alert>
            
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Hôte FTP</Label>
                <Input
                  placeholder="ftp.example.com"
                  value={state.destination.ftpHost}
                  onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { ftpHost: e.target.value } })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Utilisateur FTP</Label>
                  <Input
                    placeholder="user"
                    value={state.destination.ftpUser}
                    onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { ftpUser: e.target.value } })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mot de passe FTP</Label>
                  <div className="relative">
                    <Input
                      type={showTokens.ftp ? "text" : "password"}
                      placeholder="••••••••"
                      value={state.destination.ftpPassword}
                      onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { ftpPassword: e.target.value } })}
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowToken("ftp")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showTokens.ftp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        {/* Supabase Migration (Optional) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <h3 className="font-semibold">Migration Supabase</h3>
              <Badge variant="outline">Optionnel</Badge>
            </div>
            <Switch
              checked={state.destination.migrateSupabase}
              onCheckedChange={(checked) => dispatch({ type: "UPDATE_DESTINATION", payload: { migrateSupabase: checked } })}
            />
          </div>
          
          {state.destination.migrateSupabase && (
            <div className="grid gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label className="text-muted-foreground">Source (Lovable Cloud)</Label>
                  <Input
                    placeholder="URL Supabase source"
                    value={state.destination.sourceSupabaseUrl}
                    onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { sourceSupabaseUrl: e.target.value } })}
                  />
                  <Input
                    type="password"
                    placeholder="Service Role Key source"
                    value={state.destination.sourceSupabaseKey}
                    onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { sourceSupabaseKey: e.target.value } })}
                  />
                </div>
                <div className="space-y-3">
                  <Label className="text-muted-foreground">Destination (votre Supabase)</Label>
                  <Input
                    placeholder="URL Supabase destination"
                    value={state.destination.destSupabaseUrl}
                    onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { destSupabaseUrl: e.target.value } })}
                  />
                  <Input
                    type="password"
                    placeholder="Service Role Key destination"
                    value={state.destination.destSupabaseKey}
                    onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { destSupabaseKey: e.target.value } })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={prevStep} className="flex-1">
            Retour
          </Button>
          <Button 
            onClick={nextStep} 
            disabled={!canContinue}
            className="flex-1 gap-2"
          >
            Continuer
            {!canContinue && <span className="text-xs opacity-70">(GitHub requis)</span>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
