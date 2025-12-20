import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, Cloud, DollarSign, Server, Zap, Download, Github, ExternalLink } from "lucide-react";

interface DeploymentAssistantProps {
  projectName: string;
  onDownload: () => void;
  onGitHubPush: () => void;
  onBack: () => void;
  disabled?: boolean;
}

type DeploymentOption = "simple" | "budget" | "selfhosted" | null;

interface HostingProvider {
  id: string;
  name: string;
  logo: string;
  category: DeploymentOption;
}

const hostingProviders: HostingProvider[] = [
  // Simple (PaaS)
  { id: "vercel", name: "Vercel", logo: "▲", category: "simple" },
  { id: "netlify", name: "Netlify", logo: "◆", category: "simple" },
  { id: "railway", name: "Railway", logo: "🚂", category: "simple" },
  // Budget (Shared hosting)
  { id: "ionos", name: "IONOS", logo: "🌐", category: "budget" },
  { id: "greengeeks", name: "GreenGeeks", logo: "🌱", category: "budget" },
  { id: "hostgator", name: "HostGator", logo: "🐊", category: "budget" },
  { id: "ovh", name: "OVH", logo: "🔷", category: "budget" },
  { id: "o2switch", name: "o2switch", logo: "⚡", category: "budget" },
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
      "À partir de 3€/mois",
      "Support inclus",
      "Email inclus",
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
  onDownload,
  onGitHubPush,
  onBack,
  disabled = false,
}: DeploymentAssistantProps) => {
  const [selectedOption, setSelectedOption] = useState<DeploymentOption>(null);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("");

  const handleOptionSelect = (option: DeploymentOption) => {
    setSelectedOption(option);
    setHasAccount(null);
    setSelectedProvider("");
  };

  const handleReset = () => {
    setSelectedOption(null);
    setHasAccount(null);
    setSelectedProvider("");
  };

  const filteredProviders = hostingProviders.filter(
    (p) => p.category === selectedOption
  );

  const getDeploymentInstructions = () => {
    if (!selectedProvider) return null;

    const provider = hostingProviders.find((p) => p.id === selectedProvider);
    if (!provider) return null;

    const instructions: Record<string, { steps: string[]; link: string }> = {
      vercel: {
        steps: [
          "Connectez-vous à Vercel avec GitHub",
          "Importez votre nouveau repo",
          "Vercel détecte automatiquement la config",
          "Cliquez sur Deploy",
        ],
        link: "https://vercel.com/new",
      },
      netlify: {
        steps: [
          "Connectez-vous à Netlify",
          "Cliquez sur 'Add new site'",
          "Choisissez 'Import an existing project'",
          "Sélectionnez votre repo GitHub",
        ],
        link: "https://app.netlify.com/start",
      },
      railway: {
        steps: [
          "Connectez-vous à Railway",
          "Créez un nouveau projet",
          "Déployez depuis GitHub",
          "Railway configure automatiquement le Dockerfile",
        ],
        link: "https://railway.app/new",
      },
      hetzner: {
        steps: [
          "Créez un serveur Cloud (CX11 suffit)",
          "Connectez-vous en SSH",
          "Installez Docker: curl -fsSL https://get.docker.com | sh",
          "Uploadez et lancez avec docker compose up -d",
        ],
        link: "https://console.hetzner.cloud/",
      },
      digitalocean: {
        steps: [
          "Créez un Droplet Docker",
          "Connectez-vous en SSH",
          "Clonez votre repo ou uploadez les fichiers",
          "Lancez avec docker compose up -d",
        ],
        link: "https://cloud.digitalocean.com/droplets/new",
      },
      ionos: {
        steps: [
          "Accédez à votre espace IONOS",
          "Allez dans 'Hébergement Web'",
          "Utilisez le File Manager pour uploader",
          "Configurez le domaine vers le dossier",
        ],
        link: "https://my.ionos.fr/",
      },
      greengeeks: {
        steps: [
          "Connectez-vous au cPanel",
          "Utilisez le File Manager",
          "Uploadez dans public_html",
          "Votre site est en ligne !",
        ],
        link: "https://my.greengeeks.com/",
      },
    };

    return instructions[selectedProvider] || {
      steps: [
        "Téléchargez le projet libéré",
        "Uploadez les fichiers sur votre hébergeur",
        "Configurez votre domaine",
        "Votre application est en ligne !",
      ],
      link: "#",
    };
  };

  // Step 1: Option selection
  if (!selectedOption) {
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

  // Step 2: For "simple" option, show quick deploy
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
            Poussez votre projet vers GitHub, puis connectez-le à votre plateforme
          </p>
        </div>

        {/* Step by step */}
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
                    Choisissez votre plateforme
                  </h4>
                  <div className="flex flex-wrap gap-3">
                    {filteredProviders.map((provider) => (
                      <a
                        key={provider.id}
                        href={`https://${provider.id}.com`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-muted/50 transition-all"
                      >
                        <span>{provider.logo}</span>
                        <span className="font-medium">{provider.name}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground mb-1">
                    Importez depuis GitHub
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    La plateforme détectera automatiquement la configuration et déploiera votre app.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: For "budget" or "selfhosted" - Ask if they have an account
  if (hasAccount === null) {
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
            onClick={() => setHasAccount(true)}
          >
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-6 w-6 text-success" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">
                Oui, j'ai un compte
              </h4>
              <p className="text-sm text-muted-foreground">
                Je veux déployer sur mon hébergeur existant
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg"
            onClick={() => setHasAccount(false)}
          >
            <CardContent className="p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <Cloud className="h-6 w-6 text-accent" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">
                Non, pas encore
              </h4>
              <p className="text-sm text-muted-foreground">
                Aidez-moi à choisir un hébergeur
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Step 3: Provider selection and instructions
  const instructions = getDeploymentInstructions();

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setHasAccount(null)}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour
      </Button>

      <div className="text-center mb-6">
        <h3 className="text-2xl font-bold text-foreground mb-2">
          {hasAccount ? "Chez quel hébergeur ?" : "Choisissez un hébergeur"}
        </h3>
        <p className="text-muted-foreground">
          {hasAccount
            ? "Sélectionnez votre hébergeur pour obtenir les instructions personnalisées"
            : "Voici nos recommandations pour commencer"}
        </p>
      </div>

      <div className="max-w-md mx-auto mb-6">
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="w-full bg-card">
            <SelectValue placeholder="Sélectionnez votre hébergeur..." />
          </SelectTrigger>
          <SelectContent className="bg-card border-border z-50">
            {filteredProviders.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                <span className="flex items-center gap-2">
                  <span>{provider.logo}</span>
                  <span>{provider.name}</span>
                </span>
              </SelectItem>
            ))}
            <SelectItem value="other">
              <span className="flex items-center gap-2">
                <span>🔧</span>
                <span>Autre hébergeur</span>
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedProvider && instructions && (
        <Card className="card-shadow max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              Instructions de déploiement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 mb-6">
              {instructions.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-foreground text-sm pt-0.5">{step}</span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col gap-3">
              <Button onClick={onDownload} disabled={disabled} className="gap-2">
                <Download className="h-4 w-4" />
                Télécharger le projet (.zip)
              </Button>
              {instructions.link !== "#" && (
                <a
                  href={instructions.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" className="w-full gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Ouvrir {hostingProviders.find((p) => p.id === selectedProvider)?.name || "l'hébergeur"}
                  </Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DeploymentAssistant;
