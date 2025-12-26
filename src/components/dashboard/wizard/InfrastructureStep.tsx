import { useState } from "react";
import { Server, Database, Globe, Terminal, Copy, Check, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, HelpCircle, Wifi, WifiOff, FileCode } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWizard, HostingType } from "@/contexts/WizardContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// Helper component for info tooltips
function InfoTooltip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-sm">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Connection test result component
function ConnectionStatus({ status, label }: { status: "idle" | "testing" | "success" | "error"; label: string }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 10 }}
        className="flex items-center gap-2"
      >
        {status === "testing" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {status === "success" && <CheckCircle2 className="h-4 w-4 text-success" />}
        {status === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
        {status === "idle" && <WifiOff className="h-4 w-4 text-muted-foreground" />}
        <span className={cn(
          "text-sm",
          status === "success" && "text-success",
          status === "error" && "text-destructive",
          status === "idle" && "text-muted-foreground"
        )}>
          {label}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}

export function InfrastructureStep() {
  const { state, dispatch, nextStep, prevStep } = useWizard();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [copied, setCopied] = useState(false);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [dbConnectionStatus, setDbConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [vpsConnectionStatus, setVpsConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
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

  // Test Supabase connection
  const testSupabaseConnection = async () => {
    if (!state.destination.destSupabaseUrl || !state.destination.destSupabaseKey) {
      toast({ title: "Champs requis", description: "Entrez l'URL et la clé Supabase", variant: "destructive" });
      return;
    }
    
    setDbConnectionStatus("testing");
    
    try {
      // Simple ping test via edge function
      const { data, error } = await supabase.functions.invoke("test-coolify-connection", {
        body: { 
          url: state.destination.destSupabaseUrl,
          type: "supabase"
        }
      });
      
      if (error) throw error;
      
      setDbConnectionStatus("success");
      toast({ title: "Connexion réussie !", description: "Base de données accessible" });
    } catch (error: any) {
      setDbConnectionStatus("error");
      toast({ title: "Échec de connexion", description: error.message, variant: "destructive" });
    }
  };

  // Create VPS setup
  const createVpsSetup = async () => {
    if (!user) return;
    
    setIsCreatingSetup(true);
    
    try {
      const setupId = crypto.randomUUID();
      
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
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsCreatingSetup(false);
    }
  };

  // Test VPS connection (ping)
  const testVpsConnection = async () => {
    if (!state.destination.vpsIp) {
      toast({ title: "IP requise", description: "Entrez l'IP de votre VPS", variant: "destructive" });
      return;
    }
    
    setVpsConnectionStatus("testing");
    
    try {
      const { data, error } = await supabase.functions.invoke("check-server-status", {
        body: { serverIp: state.destination.vpsIp }
      });
      
      if (error) throw error;
      
      setVpsConnectionStatus("success");
      toast({ title: "VPS accessible !", description: "Connexion établie" });
    } catch (error: any) {
      setVpsConnectionStatus("error");
      toast({ title: "VPS inaccessible", description: "Vérifiez l'IP et le firewall", variant: "destructive" });
    }
  };

  // Generate GitHub Actions workflow
  const generateGitHubAction = () => {
    const workflowContent = `name: Deploy to FTP
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Deploy to FTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.4
        with:
          server: \${{ secrets.FTP_HOST }}
          username: \${{ secrets.FTP_USER }}
          password: \${{ secrets.FTP_PASSWORD }}
          local-dir: ./dist/
          server-dir: /public_html/`;

    const blob = new Blob([workflowContent], { type: "text/yaml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "deploy.yml";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ 
      title: "Fichier généré !",
      description: "Placez-le dans .github/workflows/ de votre dépôt"
    });
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const oneLinerId = state.destination.setupId;
  const oneLiner = oneLinerId 
    ? `curl -sSL "${supabaseUrl}/functions/v1/serve-setup-script?id=${oneLinerId}" | sudo bash`
    : "";

  const canContinue = state.destination.isGithubValidated;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-2 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Infrastructure de destination
          </CardTitle>
          <CardDescription>
            Configurez où votre code libéré sera hébergé
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Database Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Données</h3>
                <InfoTooltip content="Configurez la migration de votre base de données Supabase vers une nouvelle instance privée." />
              </div>
              <Switch
                checked={state.destination.migrateSupabase}
                onCheckedChange={(checked) => dispatch({ type: "UPDATE_DESTINATION", payload: { migrateSupabase: checked } })}
              />
            </div>
            
            <AnimatePresence>
              {state.destination.migrateSupabase && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                    {/* Source */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-muted-foreground">Source (Lovable Cloud)</Label>
                        <InfoTooltip content="URL et clé de votre projet Supabase actuel créé via Lovable." />
                      </div>
                      <Input
                        placeholder="https://xxx.supabase.co"
                        value={state.destination.sourceSupabaseUrl}
                        onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { sourceSupabaseUrl: e.target.value } })}
                      />
                      <div className="relative">
                        <Input
                          type={showTokens.sourceKey ? "text" : "password"}
                          placeholder="Service Role Key"
                          value={state.destination.sourceSupabaseKey}
                          onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { sourceSupabaseKey: e.target.value } })}
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowToken("sourceKey")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showTokens.sourceKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    
                    {/* Destination */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label className="text-muted-foreground">Destination (votre Supabase)</Label>
                        <InfoTooltip content="Votre propre projet Supabase où les données seront migrées." />
                      </div>
                      <Input
                        placeholder="https://xxx.supabase.co"
                        value={state.destination.destSupabaseUrl}
                        onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { destSupabaseUrl: e.target.value } })}
                      />
                      <div className="relative">
                        <Input
                          type={showTokens.destKey ? "text" : "password"}
                          placeholder="Service Role Key"
                          value={state.destination.destSupabaseKey}
                          onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { destSupabaseKey: e.target.value } })}
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowToken("destKey")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showTokens.destKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={testSupabaseConnection}
                      disabled={dbConnectionStatus === "testing"}
                      className="gap-2"
                    >
                      <Wifi className="h-4 w-4" />
                      Test de connexion auto
                    </Button>
                  </div>
                  
                  {dbConnectionStatus !== "idle" && (
                    <div className="mt-2">
                      <ConnectionStatus 
                        status={dbConnectionStatus} 
                        label={
                          dbConnectionStatus === "testing" ? "Test en cours..." :
                          dbConnectionStatus === "success" ? "Base de données connectée" :
                          "Échec de connexion"
                        }
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Separator />

          {/* Hosting Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Hébergement</h3>
              <InfoTooltip content="Choisissez comment déployer votre application : VPS avec Docker/Coolify ou hébergeur web traditionnel." />
            </div>
            
            <Tabs 
              value={state.destination.hostingType} 
              onValueChange={(v) => dispatch({ type: "UPDATE_DESTINATION", payload: { hostingType: v as HostingType } })}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="vps" className="gap-2">
                  <Terminal className="h-4 w-4" />
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
                    <strong>Installation automatique :</strong> Une commande unique installe Docker, Coolify et PostgreSQL.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>IP de votre VPS</Label>
                      <InfoTooltip content="L'adresse IP publique de votre serveur VPS (ex: 123.45.67.89). Vous la trouverez dans le panneau de contrôle de votre fournisseur (Hetzner, OVH, IONOS...)." />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="123.45.67.89"
                        value={state.destination.vpsIp}
                        onChange={(e) => dispatch({ type: "UPDATE_DESTINATION", payload: { vpsIp: e.target.value } })}
                      />
                      <Button 
                        variant="outline" 
                        onClick={testVpsConnection}
                        disabled={vpsConnectionStatus === "testing" || !state.destination.vpsIp}
                      >
                        {vpsConnectionStatus === "testing" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wifi className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {vpsConnectionStatus !== "idle" && (
                      <ConnectionStatus 
                        status={vpsConnectionStatus} 
                        label={
                          vpsConnectionStatus === "testing" ? "Test en cours..." :
                          vpsConnectionStatus === "success" ? "VPS accessible" :
                          "VPS inaccessible"
                        }
                      />
                    )}
                  </div>
                  
                  {!state.destination.setupId ? (
                    <Button onClick={createVpsSetup} disabled={isCreatingSetup} className="w-full gap-2">
                      {isCreatingSetup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
                      Générer la commande d'installation
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Label>Commande d'installation (one-liner)</Label>
                      <div className="relative">
                        <pre className="bg-slate-950 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto">
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
                        Exécutez en tant que <code className="bg-muted px-1 rounded">root</code> sur votre VPS Ubuntu.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="traditional" className="space-y-4 mt-4">
                <Alert>
                  <Globe className="h-4 w-4" />
                  <AlertDescription>
                    Pour les hébergeurs traditionnels, Inopay génère une GitHub Action pour déployer automatiquement.
                  </AlertDescription>
                </Alert>
                
                <div className="grid gap-4 p-4 bg-muted/30 rounded-lg">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Hôte FTP</Label>
                      <InfoTooltip content="L'adresse de votre serveur FTP fournie par votre hébergeur (ex: ftp.ovh.net, ftp.ionos.com)." />
                    </div>
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
                      <div className="flex items-center gap-2">
                        <Label>Mot de passe</Label>
                        <InfoTooltip content="Le mot de passe de votre compte FTP." />
                      </div>
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
                
                <Button 
                  variant="outline" 
                  onClick={generateGitHubAction}
                  className="w-full gap-2"
                  disabled={!state.destination.ftpHost}
                >
                  <FileCode className="h-4 w-4" />
                  Télécharger GitHub Action (.yml)
                </Button>
              </TabsContent>
            </Tabs>
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
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
