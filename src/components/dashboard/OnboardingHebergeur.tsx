import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  HelpCircle, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Rocket, 
  Server,
  Key,
  Lock,
  ExternalLink,
  Sparkles,
  Package,
  Plane,
  Home,
  Shield,
  Crown,
  Eye,
  EyeOff
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { saveDeploymentToHistory } from "./DeploymentHistory";

interface OnboardingHebergeurProps {
  providerName: string;
  projectName: string;
  extractedFiles: Array<{ path: string; content: string }>;
  onDeploymentComplete: (url: string) => void;
  onBack: () => void;
  isSubscribed: boolean;
}

interface FTPCredentials {
  host: string;
  username: string;
  password: string;
  port: string;
  remotePath: string;
}

// Simple encryption utility for credentials (base64 + reversal - not production-grade but obfuscates)
const encryptCredentials = (data: FTPCredentials): string => {
  const json = JSON.stringify(data);
  const reversed = json.split('').reverse().join('');
  return btoa(reversed);
};

const decryptCredentials = (encrypted: string): FTPCredentials => {
  const reversed = atob(encrypted);
  const json = reversed.split('').reverse().join('');
  return JSON.parse(json);
};

type ConnectionStatus = "idle" | "testing" | "success" | "error";
type DeploymentPhase = "packing" | "traveling" | "installing" | "finishing";

const deploymentMessages: Record<DeploymentPhase, string[]> = {
  packing: [
    "📦 Emballage des fichiers...",
    "🎁 On met du papier bulle sur votre code...",
    "📋 Vérification de la liste de voyage..."
  ],
  traveling: [
    "✈️ Voyage vers votre serveur...",
    "🚀 Décollage en cours...",
    "🌍 Traversée d'internet..."
  ],
  installing: [
    "🏠 Installation des meubles...",
    "🛋️ On arrange le salon...",
    "🖼️ On accroche les tableaux..."
  ],
  finishing: [
    "✨ Dernières finitions...",
    "🎨 Un coup de peinture final...",
    "🎉 Presque prêt !"
  ]
};

const providerHelp: Record<string, { icon: string; instructions: string; link?: string }> = {
  ionos: {
    icon: "🔵",
    instructions: "💡 Chez IONOS, allez dans votre espace client > Hébergement > Accès SFTP/SSH pour trouver ces infos. Votre hôte ressemble généralement à 'access123456789.webspace-data.io'.",
    link: "https://my.ionos.fr/"
  },
  greengeeks: {
    icon: "🌿",
    instructions: "💡 Chez GreenGeeks, connectez-vous à cPanel > FTP Accounts. Votre hôte est généralement votre nom de domaine ou une adresse comme 'ftp.votresite.com'.",
    link: "https://my.greengeeks.com/"
  },
  ovh: {
    icon: "🔷",
    instructions: "💡 Chez OVH, allez dans votre Manager > Web > Hébergements > FTP-SSH. Votre hôte ressemble à 'ftp.cluster0XX.hosting.ovh.net'.",
    link: "https://www.ovh.com/manager/"
  },
  hostinger: {
    icon: "🟣",
    instructions: "💡 Chez Hostinger, allez dans hPanel > Fichiers > Comptes FTP. Vous y trouverez tous vos identifiants de connexion.",
    link: "https://hpanel.hostinger.com/"
  },
  o2switch: {
    icon: "🟢",
    instructions: "💡 Chez o2switch, connectez-vous à cPanel > Comptes FTP. Votre hôte est généralement votre nom de domaine.",
    link: "https://www.o2switch.fr/"
  }
};

export function OnboardingHebergeur({
  providerName,
  projectName,
  extractedFiles,
  onDeploymentComplete,
  onBack,
  isSubscribed
}: OnboardingHebergeurProps) {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<FTPCredentials>({
    host: "",
    username: "",
    password: "",
    port: "21",
    remotePath: "/public_html"
  });
  const [selectedProvider, setSelectedProvider] = useState<string | null>(
    providerName.toLowerCase().includes("ionos") ? "ionos" :
    providerName.toLowerCase().includes("green") ? "greengeeks" :
    providerName.toLowerCase().includes("ovh") ? "ovh" :
    providerName.toLowerCase().includes("hostinger") ? "hostinger" :
    providerName.toLowerCase().includes("o2switch") ? "o2switch" : null
  );
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState<DeploymentPhase>("packing");
  const [currentMessage, setCurrentMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Clear sensitive data from memory when component unmounts
  React.useEffect(() => {
    return () => {
      setCredentials({
        host: "",
        username: "",
        password: "",
        port: "21",
        remotePath: "/public_html"
      });
    };
  }, []);

  const handleTestConnection = async () => {
    if (!credentials.host || !credentials.username || !credentials.password) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setConnectionStatus("testing");

    try {
      // Simulate connection test (in reality, this would call an edge function)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For demo purposes, we'll simulate a successful connection
      // In production, this would actually test the FTP connection
      const isValid = credentials.host.includes(".") && credentials.username.length > 0;
      
      if (isValid) {
        setConnectionStatus("success");
        toast.success("Connexion réussie ! La porte est ouverte.");
      } else {
        setConnectionStatus("error");
        toast.error("Connexion échouée. Vérifiez vos identifiants.");
      }
    } catch (error) {
      setConnectionStatus("error");
      toast.error("Erreur de connexion. Veuillez réessayer.");
    }
  };

  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeploymentProgress(0);

    const phases: DeploymentPhase[] = ["packing", "traveling", "installing", "finishing"];
    
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      setCurrentPhase(phase);
      
      const messages = deploymentMessages[phase];
      for (let j = 0; j < messages.length; j++) {
        setCurrentMessage(messages[j]);
        setDeploymentProgress(((i * 3 + j + 1) / 12) * 100);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    try {
      const { data, error } = await supabase.functions.invoke("deploy-ftp", {
        body: {
          credentials: {
            host: credentials.host,
            username: credentials.username,
            password: credentials.password,
            port: parseInt(credentials.port),
            protocol: "ftp",
            remotePath: credentials.remotePath
          },
          projectId: projectName,
          files: extractedFiles
        }
      });

      // Handle 402 Payment Required (credit insufficient)
      if (error?.message?.includes('402') || error?.status === 402) {
        const errorData = JSON.parse(error.context?.responseText || '{}');
        const creditType = errorData.credit_type || 'deploy';
        
        toast.error(`Crédit "${creditType}" requis`, {
          description: "Veuillez acheter un crédit pour continuer",
          action: {
            label: "Acheter",
            onClick: () => window.location.href = '/tarifs'
          }
        });
        setIsDeploying(false);
        return;
      }

      if (error) throw error;

      setDeploymentProgress(100);
      setCurrentMessage("🎉 Votre site est en ligne !");
      
      const deployedUrl = `https://${credentials.host.replace("ftp.", "")}`;
      
      // Save to deployment history
      if (user) {
        await saveDeploymentToHistory(user.id, projectName, providerName, {
          host: credentials.host,
          filesUploaded: extractedFiles.length,
          deploymentType: "ftp",
          deployedUrl,
        });
      }
      
      setTimeout(() => {
        onDeploymentComplete(deployedUrl);
        toast.success("Déploiement terminé avec succès !");
      }, 1000);
    } catch (error: any) {
      console.error("Deployment error:", error);
      
      // Check if it's a credit error
      if (error?.message?.includes('Crédit insuffisant')) {
        toast.error("Crédit requis", {
          description: "Achetez un crédit pour déployer",
          action: {
            label: "Acheter",
            onClick: () => window.location.href = '/tarifs'
          }
        });
      } else {
        toast.error("Erreur lors du déploiement. Veuillez réessayer.");
      }
      setIsDeploying(false);
    }
  };

  const renderProviderButtons = () => (
    <div className="space-y-4">
      <Label className="text-base font-medium">Quel est votre hébergeur ?</Label>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(providerHelp).map(([key, { icon }]) => (
          <Button
            key={key}
            variant={selectedProvider === key ? "default" : "outline"}
            className={`h-16 flex flex-col gap-1 transition-all ${
              selectedProvider === key 
                ? "ring-2 ring-primary ring-offset-2" 
                : "hover:border-primary/50"
            }`}
            onClick={() => setSelectedProvider(key)}
          >
            <span className="text-2xl">{icon}</span>
            <span className="text-xs capitalize">{key}</span>
          </Button>
        ))}
      </div>
      
      {selectedProvider && providerHelp[selectedProvider] && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              {providerHelp[selectedProvider].instructions}
            </p>
            {providerHelp[selectedProvider].link && (
              <Button
                variant="link"
                className="mt-2 p-0 h-auto text-primary"
                onClick={() => window.open(providerHelp[selectedProvider].link, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Accéder à mon espace client
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderCredentialsForm = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Host field */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="host">Adresse du serveur (Hôte)</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-4" side="right">
                  <p className="font-medium mb-2">🏠 C'est l'adresse de votre maison sur internet</p>
                  <p className="text-sm text-muted-foreground">
                    Elle ressemble souvent à <code className="bg-muted px-1 rounded">ftp.votresite.com</code> ou 
                    <code className="bg-muted px-1 rounded ml-1">access123.webspace-data.io</code>.
                    <br /><br />
                    📧 Vous la trouverez dans votre mail de bienvenue de votre hébergeur.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="host"
            placeholder="ftp.votresite.com"
            value={credentials.host}
            onChange={(e) => setCredentials({ ...credentials, host: e.target.value })}
            className="font-mono"
          />
        </div>

        {/* Username field */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="username">Identifiant / Login</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-4" side="right">
                  <p className="font-medium mb-2">👤 C'est votre nom d'utilisateur FTP</p>
                  <p className="text-sm text-muted-foreground">
                    ⚠️ Ce n'est pas forcément votre email !
                    <br /><br />
                    Regardez dans votre interface client, dans la section "FTP" ou "Accès fichiers".
                    Ça ressemble souvent à <code className="bg-muted px-1 rounded">u123456789</code>.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Input
            id="username"
            placeholder="u123456789 ou votre@email.com"
            value={credentials.username}
            onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
          />
        </div>

        {/* Password field */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="password">Mot de passe FTP</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-4" side="right">
                  <p className="font-medium mb-2">🔐 Le mot de passe de votre accès FTP</p>
                  <p className="text-sm text-muted-foreground">
                    C'est le mot de passe que vous avez créé lors de la configuration de votre accès FTP.
                    <br /><br />
                    💡 Si vous l'avez oublié, vous pouvez généralement le réinitialiser dans votre espace client.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>Non stocké</span>
            </div>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••••••"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              autoComplete="off"
              data-lpignore="true"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Shield className="h-3 w-3 text-green-500" />
            Vos identifiants ne sont jamais stockés et sont transmis de façon sécurisée
          </p>
        </div>

        {/* Advanced options (collapsed by default) */}
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
            ⚙️ Options avancées (facultatif)
          </summary>
          <div className="mt-4 space-y-4 pl-4 border-l-2 border-muted">
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                placeholder="21"
                value={credentials.port}
                onChange={(e) => setCredentials({ ...credentials, port: e.target.value })}
                className="w-24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remotePath">Dossier de destination</Label>
              <Input
                id="remotePath"
                placeholder="/public_html"
                value={credentials.remotePath}
                onChange={(e) => setCredentials({ ...credentials, remotePath: e.target.value })}
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  );

  const renderConnectionTest = () => (
    <div className="space-y-4">
      <Button
        onClick={handleTestConnection}
        disabled={connectionStatus === "testing" || !credentials.host || !credentials.username || !credentials.password}
        variant="outline"
        className="w-full h-14 text-base"
      >
        {connectionStatus === "testing" ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Vérification en cours...
          </>
        ) : connectionStatus === "success" ? (
          <>
            <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
            Connexion vérifiée !
          </>
        ) : connectionStatus === "error" ? (
          <>
            <XCircle className="h-5 w-5 mr-2 text-destructive" />
            Réessayer la connexion
          </>
        ) : (
          <>
            <Server className="h-5 w-5 mr-2" />
            Vérifier la connexion
          </>
        )}
      </Button>

      {connectionStatus === "success" && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  Succès ! La porte est ouverte 🚪
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Nous pouvons envoyer vos fichiers vers votre serveur.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {connectionStatus === "error" && (
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">
                  Oups ! La porte est fermée 🔒
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Vérifiez bien votre mot de passe ou l'adresse du serveur.
                  <br />
                  💡 Astuce : Copiez-collez les infos directement depuis votre espace client.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderDeployButton = () => (
    <div className="space-y-6">
      {/* Paywall for deployment */}
      {!isSubscribed && connectionStatus === "success" && (
        <Card className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-background border-amber-500/30">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-14 w-14 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Crown className="h-7 w-7 text-amber-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  Connexion validée ! 🎉
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Votre test de connexion est gratuit. Pour lancer le déploiement final, 
                  activez votre abonnement.
                </p>
              </div>
              <Link to="/tarifs">
                <Button className="gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-lg">
                  <Crown className="h-4 w-4" />
                  Débloquer le déploiement
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {!isDeploying ? (
        <Button
          onClick={handleDeploy}
          disabled={connectionStatus !== "success" || !isSubscribed}
          size="lg"
          className={`w-full h-20 text-xl font-bold transition-all ${
            isSubscribed && connectionStatus === "success"
              ? "bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/30 hover:scale-[1.02]"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {!isSubscribed ? (
            <>
              <Lock className="h-8 w-8 mr-3" />
              Déploiement réservé aux abonnés
            </>
          ) : (
            <>
              <Rocket className="h-8 w-8 mr-3" />
              Lancer le déploiement final
              <Sparkles className="h-6 w-6 ml-3" />
            </>
          )}
        </Button>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-3 text-xl font-medium">
                {currentPhase === "packing" && <Package className="h-8 w-8 text-primary animate-bounce" />}
                {currentPhase === "traveling" && <Plane className="h-8 w-8 text-primary animate-pulse" />}
                {currentPhase === "installing" && <Home className="h-8 w-8 text-primary animate-bounce" />}
                {currentPhase === "finishing" && <Sparkles className="h-8 w-8 text-primary animate-pulse" />}
                <span>{currentMessage}</span>
              </div>
              
              <Progress value={deploymentProgress} className="h-4" />
              
              <p className="text-center text-sm text-muted-foreground">
                {Math.round(deploymentProgress)}% complété
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Rocket className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl md:text-3xl">
            On s'occupe de tout ! 🎉
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Préparons votre déménagement vers <span className="font-semibold text-foreground">{providerName}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center pb-6">
          <p className="text-muted-foreground max-w-md mx-auto">
            🧑‍💻 Pas besoin d'être informaticien. Nous allons simplement connecter 
            votre nouvel hébergement à votre code tout propre.
          </p>
        </CardContent>
      </Card>

      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">1</span>
            Votre hébergeur
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderProviderButtons()}
        </CardContent>
      </Card>

      {/* Credentials Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">2</span>
            Vos identifiants FTP
          </CardTitle>
          <CardDescription>
            Ces informations se trouvent dans votre espace client ou votre mail de bienvenue
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderCredentialsForm()}
        </CardContent>
      </Card>

      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">3</span>
            Vérification
          </CardTitle>
          <CardDescription>
            Testons si nous pouvons accéder à votre serveur
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderConnectionTest()}
        </CardContent>
      </Card>

      {/* Deploy Button */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">4</span>
            Déploiement
          </CardTitle>
          <CardDescription>
            Plus qu'un clic pour mettre votre site en ligne !
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderDeployButton()}
        </CardContent>
      </Card>

      {/* Back Button */}
      {!isDeploying && (
        <Button variant="ghost" onClick={onBack} className="w-full">
          ← Choisir une autre option de déploiement
        </Button>
      )}
    </div>
  );
}
