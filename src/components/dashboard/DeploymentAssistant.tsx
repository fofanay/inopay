import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Check, Cloud, DollarSign, Server, Zap, Download, Github, ExternalLink, Upload, Loader2, PartyPopper, Eye, EyeOff, Shield, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OnboardingHebergeur } from "./OnboardingHebergeur";
import { DeploymentErrorHandler, parseDeploymentError, DeploymentError } from "./DeploymentErrorHandler";

interface DeploymentAssistantProps {
  projectName: string;
  extractedFiles?: Map<string, string>;
  onDownload: () => void;
  onGitHubPush: () => void;
  onBack: () => void;
  disabled?: boolean;
  isSubscribed?: boolean;
}

type DeploymentOption = "simple" | "budget" | "selfhosted" | null;
type DeploymentStep = "select-option" | "has-account" | "select-provider" | "ftp-credentials" | "deploying" | "success";

interface HostingProvider {
  id: string;
  name: string;
  logo: string;
  category: DeploymentOption;
  defaultHost?: string;
  defaultPort?: number;
}

interface FTPCredentials {
  host: string;
  username: string;
  password: string;
  port: number;
  remotePath: string;
}

const hostingProviders: HostingProvider[] = [
  // Simple (PaaS)
  { id: "vercel", name: "Vercel", logo: "▲", category: "simple" },
  { id: "netlify", name: "Netlify", logo: "◆", category: "simple" },
  { id: "railway", name: "Railway", logo: "🚂", category: "simple" },
  // Budget (Shared hosting)
  { id: "ionos", name: "IONOS", logo: "🌐", category: "budget", defaultHost: "access.ionos.fr", defaultPort: 21 },
  { id: "greengeeks", name: "GreenGeeks", logo: "🌱", category: "budget", defaultPort: 21 },
  { id: "hostgator", name: "HostGator", logo: "🐊", category: "budget", defaultPort: 21 },
  { id: "ovh", name: "OVH", logo: "🔷", category: "budget", defaultHost: "ftp.cluster0XX.hosting.ovh.net", defaultPort: 21 },
  { id: "o2switch", name: "o2switch", logo: "⚡", category: "budget", defaultPort: 21 },
  { id: "hostinger", name: "Hostinger", logo: "🔵", category: "budget", defaultPort: 21 },
  // Self-hosted (VPS)
  { id: "hetzner", name: "Hetzner", logo: "🖥️", category: "selfhosted" },
  { id: "digitalocean", name: "DigitalOcean", logo: "🌊", category: "selfhosted" },
  { id: "vultr", name: "Vultr", logo: "🔥", category: "selfhosted" },
  { id: "linode", name: "Linode", logo: "🟢", category: "selfhosted" },
  { id: "scaleway", name: "Scaleway", logo: "🔶", category: "selfhosted" },
];

const deploymentOptions = [
  {
    id: "simple" as const,
    title: "Le plus simple",
    subtitle: "Clic-bouton",
    description: "Déploiement instantané sans configuration serveur",
    icon: Zap,
    providers: ["Vercel", "Netlify", "Railway"],
    badge: "Recommandé",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    features: [
      "Déploiement en 1 clic",
      "SSL automatique",
      "CDN intégré",
    ],
  },
  {
    id: "budget" as const,
    title: "Le moins cher",
    subtitle: "Hébergement classique",
    description: "Hébergement mutualisé avec abonnement mensuel",
    icon: DollarSign,
    providers: ["IONOS", "GreenGeeks", "HostGator"],
    badge: "Économique",
    badgeColor: "bg-success/10 text-success border-success/20",
    features: [
      "À partir de 3$/mois",
      "Support inclus",
      "Transfert automatique",
    ],
  },
  {
    id: "selfhosted" as const,
    title: "Mon propre serveur",
    subtitle: "Contrôle total",
    description: "VPS ou serveur dédié avec Docker",
    icon: Server,
    providers: ["Hetzner", "DigitalOcean", "VPS"],
    badge: "Pro",
    badgeColor: "bg-accent/10 text-accent border-accent/20",
    features: [
      "Contrôle total",
      "Scalabilité illimitée",
      "Configuration Docker incluse",
    ],
  },
];

const DeploymentAssistant = ({
  projectName,
  extractedFiles,
  onDownload,
  onGitHubPush,
  onBack,
  disabled = false,
  isSubscribed = false,
}: DeploymentAssistantProps) => {
  const { toast } = useToast();
  const [showOnboardingHebergeur, setShowOnboardingHebergeur] = useState(false);
  const [selectedOption, setSelectedOption] = useState<DeploymentOption>(null);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [step, setStep] = useState<DeploymentStep>("select-option");
  const [showPassword, setShowPassword] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployMessage, setDeployMessage] = useState("");
  const [deployResult, setDeployResult] = useState<{
    success: boolean;
    provider: string;
    filesUploaded: number;
  } | null>(null);
  const [deployError, setDeployError] = useState<DeploymentError | null>(null);

  const [ftpCredentials, setFtpCredentials] = useState<FTPCredentials>({
    host: "",
    username: "",
    password: "",
    port: 21,
    remotePath: "/public_html",
  });

  const handleOptionSelect = (option: DeploymentOption) => {
    setSelectedOption(option);
    setHasAccount(null);
    setSelectedProvider("");
    setStep(option === "simple" ? "select-provider" : "has-account");
  };

  const handleReset = () => {
    setSelectedOption(null);
    setHasAccount(null);
    setSelectedProvider("");
    setStep("select-option");
    setFtpCredentials({
      host: "",
      username: "",
      password: "",
      port: 21,
      remotePath: "/public_html",
    });
    setDeployResult(null);
    setDeployError(null);
    setIsDeploying(false);
    setDeployProgress(0);
    setShowOnboardingHebergeur(false);
  };

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    const provider = hostingProviders.find(p => p.id === providerId);
    
    if (provider && selectedOption === "budget") {
      // Use new OnboardingHebergeur component for budget hosting
      setShowOnboardingHebergeur(true);
    }
  };

  const handleFTPDeploy = async () => {
    if (!ftpCredentials.host || !ftpCredentials.username || !ftpCredentials.password) {
      toast({
        title: "Informations manquantes",
        description: "Veuillez remplir tous les champs de connexion",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);
    setStep("deploying");
    setDeployProgress(0);
    setDeployMessage("Préparation du build...");

    try {
      // Convert extractedFiles Map to array
      const filesArray: { path: string; content: string }[] = [];
      if (extractedFiles) {
        extractedFiles.forEach((content, path) => {
          filesArray.push({ path, content });
        });
      }

      // Simulate progress for build phase
      setDeployProgress(15);
      setDeployMessage("Transformation en fichiers statiques...");
      await new Promise(r => setTimeout(r, 800));

      setDeployProgress(35);
      setDeployMessage("Génération du build de production...");
      await new Promise(r => setTimeout(r, 600));

      setDeployProgress(50);
      setDeployMessage("Connexion au serveur FTP...");
      await new Promise(r => setTimeout(r, 500));

      // Call the edge function
      const { data, error } = await supabase.functions.invoke("deploy-ftp", {
        body: {
          credentials: {
            host: ftpCredentials.host,
            username: ftpCredentials.username,
            password: ftpCredentials.password,
            port: ftpCredentials.port,
            protocol: "ftp",
            remotePath: ftpCredentials.remotePath,
          },
          projectId: projectName,
          files: filesArray,
        },
      });

      // Handle 402 Payment Required (credit insufficient)
      if (error?.message?.includes('402') || error?.status === 402) {
        setIsDeploying(false);
        setStep("ftp-credentials");
        setDeployError(parseDeploymentError({
          code: '402',
          message: 'Crédit de déploiement requis',
          details: error.message
        }));
        return;
      }

      if (error) throw error;

      setDeployProgress(80);
      setDeployMessage("Transfert des fichiers...");
      await new Promise(r => setTimeout(r, 800));

      setDeployProgress(100);
      setDeployMessage("Finalisation...");
      await new Promise(r => setTimeout(r, 400));

      const providerName = hostingProviders.find(p => p.id === selectedProvider)?.name || "votre hébergeur";
      
      setDeployResult({
        success: true,
        provider: providerName,
        filesUploaded: data.filesUploaded || filesArray.length,
      });
      setStep("success");

      toast({
        title: "Déploiement réussi !",
        description: `Votre site est en ligne sur ${providerName}`,
      });

    } catch (error: any) {
      console.error("FTP Deploy error:", error);
      setIsDeploying(false);
      setStep("ftp-credentials");
      setDeployError(parseDeploymentError(error));
    }
  };

  const filteredProviders = hostingProviders.filter(
    (p) => p.category === selectedOption
  );

  // Convert extractedFiles Map to array for OnboardingHebergeur
  const filesArray: { path: string; content: string }[] = [];
  if (extractedFiles) {
    extractedFiles.forEach((content, path) => {
      filesArray.push({ path, content });
    });
  }

  // Show OnboardingHebergeur for budget hosting
  if (showOnboardingHebergeur && selectedOption === "budget") {
    const provider = hostingProviders.find(p => p.id === selectedProvider);
    return (
      <OnboardingHebergeur
        providerName={provider?.name || "votre hébergeur"}
        projectName={projectName}
        extractedFiles={filesArray}
        onDeploymentComplete={(url) => {
          setDeployResult({
            success: true,
            provider: provider?.name || "votre hébergeur",
            filesUploaded: filesArray.length
          });
          setStep("success");
          setShowOnboardingHebergeur(false);
        }}
        onBack={() => {
          setShowOnboardingHebergeur(false);
          setStep("select-provider");
        }}
        isSubscribed={isSubscribed}
      />
    );
  }

  // Step: Select deployment option
  if (step === "select-option") {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 gap-1">
            <Cloud className="h-3 w-3" />
            Assistant de Déploiement
          </Badge>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Où souhaitez-vous déployer ?
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Choisissez l'option qui correspond le mieux à vos besoins
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {deploymentOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Card
                key={option.id}
                className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg ${
                  disabled ? "opacity-50 pointer-events-none" : ""
                }`}
                onClick={() => handleOptionSelect(option.id)}
              >
                <CardHeader className="text-center pb-2">
                  <Badge className={`mx-auto mb-3 ${option.badgeColor}`}>
                    {option.badge}
                  </Badge>
                  <div className="mx-auto h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                    <Icon className="h-7 w-7 text-foreground" />
                  </div>
                  <CardTitle className="text-lg">{option.title}</CardTitle>
                  <CardDescription className="text-sm font-medium text-primary">
                    {option.subtitle}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    {option.description}
                  </p>
                  <ul className="space-y-2 text-left">
                    {option.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {option.providers.join(" • ")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Direct download option */}
        <div className="text-center pt-4 border-t border-border">
          <p className="text-sm text-muted-foreground mb-3">
            Ou téléchargez directement votre projet
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              onClick={onDownload}
              disabled={disabled}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Télécharger (.zip)
            </Button>
            <Button
              variant="outline"
              onClick={onGitHubPush}
              disabled={disabled}
              className="gap-2"
            >
              <Github className="h-4 w-4" />
              Push vers GitHub
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Step: Has account question (for budget/selfhosted)
  if (step === "has-account") {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux options
        </Button>

        <div className="text-center mb-6">
          <Badge
            className={`mb-3 ${
              selectedOption === "budget"
                ? "bg-success/10 text-success border-success/20"
                : "bg-accent/10 text-accent border-accent/20"
            } gap-1`}
          >
            {selectedOption === "budget" ? (
              <DollarSign className="h-3 w-3" />
            ) : (
              <Server className="h-3 w-3" />
            )}
            {selectedOption === "budget" ? "Hébergement Économique" : "Auto-hébergement"}
          </Badge>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Avez-vous déjà un compte hébergeur ?
          </h3>
          <p className="text-muted-foreground">
            Nous adaptons les instructions à votre situation
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
          <Card
            className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
            onClick={() => {
              setHasAccount(true);
              setStep("select-provider");
            }}
          >
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-success" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">
                Oui, j'ai un compte
              </h4>
              <p className="text-sm text-muted-foreground">
                Déployons sur mon hébergeur existant
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
            onClick={() => {
              setHasAccount(false);
              setStep("select-provider");
            }}
          >
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Cloud className="h-6 w-6 text-accent" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">
                Non, pas encore
              </h4>
              <p className="text-sm text-muted-foreground">
                Aidez-moi à choisir
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step: Select provider
  if (step === "select-provider" && selectedOption !== "budget") {
    // For "simple" option - show platform links with ONE-CLICK deploy
    if (selectedOption === "simple") {
      return (
        <div className="space-y-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux options
          </Button>

          <div className="text-center mb-6">
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20 gap-1">
              <Zap className="h-3 w-3" />
              Déploiement Simple
            </Badge>
            <h3 className="text-2xl font-bold text-foreground mb-2">
              Déploiement en un clic
            </h3>
            <p className="text-muted-foreground">
              Poussez votre projet vers GitHub, puis déployez automatiquement
            </p>
          </div>

          <Card className="card-shadow">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                    1
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-2">
                      Poussez vers GitHub
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Votre projet sera nettoyé et configuré automatiquement (vercel.json, netlify.toml inclus)
                    </p>
                    <Button onClick={onGitHubPush} disabled={disabled} className="gap-2">
                      <Github className="h-4 w-4" />
                      Créer le repo GitHub
                    </Button>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-2">
                      Déployez en un clic
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Cliquez sur votre plateforme préférée pour un déploiement automatique :
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        className="gap-2 border-foreground/20 hover:border-primary hover:bg-primary/5"
                        onClick={() => {
                          toast({
                            title: "Étape 1 d'abord",
                            description: "Créez le repo GitHub, puis cliquez sur Vercel pour un déploiement 1-clic",
                          });
                        }}
                      >
                        <span>▲</span>
                        <span className="font-medium">Vercel</span>
                        <Badge variant="secondary" className="text-[10px] ml-1">Recommandé</Badge>
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-foreground/20 hover:border-primary hover:bg-primary/5"
                        onClick={() => {
                          toast({
                            title: "Étape 1 d'abord",
                            description: "Créez le repo GitHub, puis cliquez sur Netlify pour déployer",
                          });
                        }}
                      >
                        <span>◆</span>
                        <span className="font-medium">Netlify</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-foreground/20 hover:border-primary hover:bg-primary/5"
                        onClick={() => {
                          toast({
                            title: "Étape 1 d'abord",
                            description: "Créez le repo GitHub, puis cliquez sur Railway pour déployer",
                          });
                        }}
                      >
                        <span>🚂</span>
                        <span className="font-medium">Railway</span>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Info box for automatic config */}
                <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-success mt-0.5" />
                    <div>
                      <h5 className="font-medium text-success mb-1">Configuration automatique incluse</h5>
                      <ul className="text-sm text-success/80 space-y-1">
                        <li>• <code className="bg-success/20 px-1 rounded">vercel.json</code> - Résout les conflits de dépendances</li>
                        <li>• <code className="bg-success/20 px-1 rounded">netlify.toml</code> - Configuration build optimisée</li>
                        <li>• <code className="bg-success/20 px-1 rounded">.npmrc</code> - Mode legacy-peer-deps activé</li>
                        <li>• <code className="bg-success/20 px-1 rounded">.env.example</code> - Liste des variables à configurer</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                    3
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-foreground mb-1">
                      Configurez vos variables d'environnement
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Copiez les valeurs du <code className="bg-muted px-1 rounded">.env.example</code> vers les paramètres de votre plateforme.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Common issues warning */}
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
                <div>
                  <h5 className="font-medium text-warning mb-1">En cas d'erreur de déploiement</h5>
                  <p className="text-sm text-warning/80">
                    Si vous voyez <code className="bg-warning/20 px-1 rounded">ERESOLVE unable to resolve dependency tree</code>, 
                    pas de panique ! Le projet inclut déjà les corrections. Relancez simplement le déploiement.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // For selfhosted - show Coolify guided setup
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep("has-account")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>

        <div className="text-center mb-6">
          <Badge className="mb-3 bg-accent/10 text-accent border-accent/20 gap-1">
            <Server className="h-3 w-3" />
            Auto-hébergement Pro
          </Badge>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Déployez comme un pro avec Coolify
          </h3>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Nous recommandons <strong>Coolify</strong> pour gérer vos applications sur votre serveur. 
            C'est un Heroku/Vercel auto-hébergé, gratuit et open source.
          </p>
        </div>

        {/* Coolify recommendation card */}
        <Card className="card-shadow border-accent/30 max-w-2xl mx-auto">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-accent to-primary flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <CardTitle className="text-lg">Coolify - PaaS auto-hébergé</CardTitle>
                <CardDescription>Gérez vos apps comme Vercel, sur votre propre serveur</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: GitHub push */}
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">
                    Envoyez votre code sur GitHub
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    FreedomCode pousse votre projet nettoyé sur un nouveau repo GitHub.
                  </p>
                  <Button onClick={onGitHubPush} disabled={disabled} className="gap-2">
                    <Github className="h-4 w-4" />
                    Créer le repo GitHub
                  </Button>
                </div>
              </div>
            </div>

            {/* Step 2: Install Coolify */}
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">
                    Installez Coolify sur votre serveur
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Connectez-vous à votre VPS en SSH et collez cette commande magique :
                  </p>
                  <div className="relative">
                    <code className="block px-4 py-3 bg-foreground text-background rounded-lg text-sm font-mono overflow-x-auto">
                      curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
                    </code>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="absolute right-2 top-1/2 -translate-y-1/2 gap-1"
                      onClick={() => {
                        navigator.clipboard.writeText("curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash");
                        toast({
                          title: "Copié !",
                          description: "Collez cette commande dans votre terminal SSH",
                        });
                      }}
                    >
                      <Check className="h-3 w-3" />
                      Copier
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Installation automatique en ~2 minutes (Docker, Traefik, SSL inclus)
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3: Import from GitHub */}
            <div className="space-y-3">
              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">
                    Importez votre projet dans Coolify
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Votre code nettoyé est déjà sur GitHub. Dans Coolify :
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal">
                    <li>Accédez à <strong>http://votre-ip:8000</strong></li>
                    <li>Créez un compte administrateur</li>
                    <li>Cliquez sur <strong>"New Resource"</strong> → <strong>"Public Repository"</strong></li>
                    <li>Collez l'URL de votre repo GitHub</li>
                    <li>Cliquez sur <strong>"Deploy"</strong> - c'est tout !</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* VPS providers */}
            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">
                💡 <strong>Pas encore de serveur ?</strong> Voici nos recommandations :
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "Hetzner", url: "https://hetzner.cloud", price: "~5$/mois", logo: "🖥️" },
                  { name: "DigitalOcean", url: "https://digitalocean.com", price: "~6$/mois", logo: "🌊" },
                  { name: "Vultr", url: "https://vultr.com", price: "~6$/mois", logo: "🔥" },
                  { name: "Scaleway", url: "https://scaleway.com", price: "~5$/mois", logo: "🔶" },
                ].map((vps) => (
                  <a
                    key={vps.name}
                    href={vps.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:border-accent/50 hover:bg-muted/50 transition-all text-sm"
                  >
                    <span>{vps.logo}</span>
                    <span className="font-medium">{vps.name}</span>
                    <span className="text-muted-foreground">{vps.price}</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alternative: Manual Docker */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Préférez une installation manuelle ?
          </p>
          <Button variant="link" onClick={onDownload} className="text-muted-foreground gap-2">
            <Download className="h-4 w-4" />
            Télécharger le projet avec Dockerfile
          </Button>
        </div>
      </div>
    );
  }

  // Step: Select budget provider
  if (step === "select-provider" && selectedOption === "budget") {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep("has-account")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>

        <div className="text-center mb-6">
          <Badge className="mb-3 bg-success/10 text-success border-success/20 gap-1">
            <DollarSign className="h-3 w-3" />
            Hébergement Économique
          </Badge>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            {hasAccount ? "Chez quel hébergeur ?" : "Choisissez un hébergeur"}
          </h3>
          <p className="text-muted-foreground">
            {hasAccount
              ? "Sélectionnez votre hébergeur pour le déploiement automatique"
              : "Voici nos recommandations pour commencer"}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg mx-auto">
          {filteredProviders.map((provider) => (
            <Card
              key={provider.id}
              className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
              onClick={() => handleProviderSelect(provider.id)}
            >
              <CardContent className="p-4 text-center">
                <span className="text-3xl mb-2 block">{provider.logo}</span>
                <span className="font-medium text-foreground">{provider.name}</span>
              </CardContent>
            </Card>
          ))}
          <Card
            className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
            onClick={() => handleProviderSelect("other")}
          >
            <CardContent className="p-4 text-center">
              <span className="text-3xl mb-2 block">🔧</span>
              <span className="font-medium text-foreground">Autre</span>
            </CardContent>
          </Card>
        </div>

        {!hasAccount && (
          <div className="bg-muted/50 rounded-lg p-4 max-w-lg mx-auto">
            <p className="text-sm text-muted-foreground text-center">
              💡 <strong>Conseil :</strong> IONOS et o2switch sont populaires en France avec un bon rapport qualité/prix.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Step: FTP credentials form
  if (step === "ftp-credentials") {
    const provider = hostingProviders.find(p => p.id === selectedProvider);
    
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep("select-provider")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>

        <div className="text-center mb-6">
          <Badge className="mb-3 bg-success/10 text-success border-success/20 gap-1">
            <Upload className="h-3 w-3" />
            Connexion FTP
          </Badge>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Connexion à {provider?.name || "votre hébergeur"}
          </h3>
          <p className="text-muted-foreground">
            Entrez les informations FTP reçues par email de votre hébergeur
          </p>
        </div>

        {/* Error display */}
        {deployError && (
          <DeploymentErrorHandler
            error={deployError}
            onRetry={() => setDeployError(null)}
            className="max-w-md mx-auto"
          />
        )}

        <Card className="card-shadow max-w-md mx-auto">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Security notice */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Vos identifiants ne sont jamais stockés. Ils sont utilisés uniquement pour ce transfert.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="host">Adresse du serveur (Host)</Label>
                <Input
                  id="host"
                  placeholder="ftp.mondomaine.com"
                  value={ftpCredentials.host}
                  onChange={(e) => setFtpCredentials(prev => ({ ...prev, host: e.target.value }))}
                  className="bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Exemple : ftp.ionos.fr ou access.votredomaine.com
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Identifiant (Username)</Label>
                <Input
                  id="username"
                  placeholder="u12345678"
                  value={ftpCredentials.username}
                  onChange={(e) => setFtpCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={ftpCredentials.password}
                    onChange={(e) => setFtpCredentials(prev => ({ ...prev, password: e.target.value }))}
                    className="bg-background pr-10"
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={ftpCredentials.port}
                    onChange={(e) => setFtpCredentials(prev => ({ ...prev, port: parseInt(e.target.value) || 21 }))}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remotePath">Dossier distant</Label>
                  <Input
                    id="remotePath"
                    placeholder="/public_html"
                    value={ftpCredentials.remotePath}
                    onChange={(e) => setFtpCredentials(prev => ({ ...prev, remotePath: e.target.value }))}
                    className="bg-background"
                  />
                </div>
              </div>

              <Button
                onClick={handleFTPDeploy}
                disabled={disabled || !ftpCredentials.host || !ftpCredentials.username || !ftpCredentials.password}
                className="w-full gap-2 mt-4"
                size="lg"
              >
                <Upload className="h-4 w-4" />
                Déployer automatiquement
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="link" onClick={onDownload} className="text-muted-foreground">
            <Download className="h-4 w-4 mr-2" />
            Ou télécharger manuellement
          </Button>
        </div>
      </div>
    );
  }

  // Step: Deploying progress
  if (step === "deploying") {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Déploiement en cours...
          </h3>
          <p className="text-muted-foreground mb-6">
            {deployMessage}
          </p>
          <div className="max-w-md mx-auto">
            <Progress value={deployProgress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">{deployProgress}%</p>
          </div>
        </div>

        <Card className="card-shadow max-w-md mx-auto">
          <CardContent className="p-4">
            <div className="space-y-2 text-sm">
              <div className={`flex items-center gap-2 ${deployProgress >= 15 ? "text-primary" : "text-muted-foreground"}`}>
                {deployProgress >= 15 ? <Check className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                Préparation du build
              </div>
              <div className={`flex items-center gap-2 ${deployProgress >= 35 ? "text-primary" : "text-muted-foreground"}`}>
                {deployProgress >= 35 ? <Check className="h-4 w-4" /> : deployProgress >= 15 ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="h-4 w-4" />}
                Transformation en fichiers statiques
              </div>
              <div className={`flex items-center gap-2 ${deployProgress >= 50 ? "text-primary" : "text-muted-foreground"}`}>
                {deployProgress >= 50 ? <Check className="h-4 w-4" /> : deployProgress >= 35 ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="h-4 w-4" />}
                Connexion au serveur FTP
              </div>
              <div className={`flex items-center gap-2 ${deployProgress >= 80 ? "text-primary" : "text-muted-foreground"}`}>
                {deployProgress >= 80 ? <Check className="h-4 w-4" /> : deployProgress >= 50 ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="h-4 w-4" />}
                Transfert des fichiers
              </div>
              <div className={`flex items-center gap-2 ${deployProgress >= 100 ? "text-primary" : "text-muted-foreground"}`}>
                {deployProgress >= 100 ? <Check className="h-4 w-4" /> : deployProgress >= 80 ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="h-4 w-4" />}
                Finalisation
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step: Success
  if (step === "success" && deployResult) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6 animate-bounce" style={{ animationDuration: "2s" }}>
            <PartyPopper className="h-10 w-10 text-success" />
          </div>
          <h3 className="text-3xl font-bold text-foreground mb-3">
            Félicitations ! 🎉
          </h3>
          <p className="text-xl text-muted-foreground mb-2">
            Votre site est en ligne sur {deployResult.provider}
          </p>
          <p className="text-sm text-muted-foreground">
            {deployResult.filesUploaded} fichiers transférés avec succès
          </p>
        </div>

        <Card className="card-shadow max-w-md mx-auto border-success/30">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10">
                <Check className="h-5 w-5 text-success" />
                <span className="text-foreground font-medium">Build de production généré</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10">
                <Check className="h-5 w-5 text-success" />
                <span className="text-foreground font-medium">Fichiers transférés via FTP</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10">
                <Check className="h-5 w-5 text-success" />
                <span className="text-foreground font-medium">Configuration .htaccess ajoutée</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border space-y-3">
              <Button className="w-full gap-2" size="lg" asChild>
                <a href={`https://${ftpCredentials.host.replace("ftp.", "")}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Voir mon site en ligne
                </a>
              </Button>
              <Button variant="outline" onClick={handleReset} className="w-full gap-2">
                <ArrowLeft className="h-4 w-4" />
                Déployer un autre projet
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            💡 N'oubliez pas de configurer votre nom de domaine dans l'interface de {deployResult.provider}
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default DeploymentAssistant;
