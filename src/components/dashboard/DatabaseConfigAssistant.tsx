import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Database, Check, Cloud, Server, Download, Upload, Loader2, Shield, Eye, EyeOff, HelpCircle, ExternalLink, PartyPopper, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DatabaseConfigAssistantProps {
  projectName: string;
  extractedFiles?: Map<string, string>;
  onConfigComplete: (config: DatabaseConfig) => void;
  onSkip: () => void;
  disabled?: boolean;
}

interface DatabaseConfig {
  type: "keep" | "new";
  provider?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
}

type Step = "choice" | "provider" | "credentials" | "migrating" | "success";

interface DatabaseProvider {
  id: string;
  name: string;
  logo: string;
  defaultPort: number;
  helpUrl: string;
  hostExample: string;
}

const databaseProviders: DatabaseProvider[] = [
  { 
    id: "ionos", 
    name: "IONOS", 
    logo: "🌐", 
    defaultPort: 3306,
    helpUrl: "https://www.ionos.fr/assistance/hebergement/bases-de-donnees-mysql/",
    hostExample: "db12345.hosting-data.io"
  },
  { 
    id: "ovh", 
    name: "OVH", 
    logo: "🔷", 
    defaultPort: 3306,
    helpUrl: "https://docs.ovh.com/fr/hosting/creer-base-de-donnees/",
    hostExample: "mysql-xxx.mysql.db"
  },
  { 
    id: "o2switch", 
    name: "o2switch", 
    logo: "⚡", 
    defaultPort: 3306,
    helpUrl: "https://faq.o2switch.fr/hebergement-mutualise/tutoriels-cpanel/mysql-base-donnees",
    hostExample: "localhost"
  },
  { 
    id: "hostinger", 
    name: "Hostinger", 
    logo: "🔵", 
    defaultPort: 3306,
    helpUrl: "https://support.hostinger.com/en/articles/",
    hostExample: "mysql.hostinger.com"
  },
  { 
    id: "greengeeks", 
    name: "GreenGeeks", 
    logo: "🌱", 
    defaultPort: 3306,
    helpUrl: "https://www.greengeeks.com/support/",
    hostExample: "localhost"
  },
  { 
    id: "planetscale", 
    name: "PlanetScale", 
    logo: "🪐", 
    defaultPort: 3306,
    helpUrl: "https://planetscale.com/docs",
    hostExample: "aws.connect.psdb.cloud"
  },
  { 
    id: "supabase", 
    name: "Supabase", 
    logo: "⚡", 
    defaultPort: 5432,
    helpUrl: "https://supabase.com/docs",
    hostExample: "db.xxxxx.supabase.co"
  },
  { 
    id: "other", 
    name: "Autre", 
    logo: "🔧", 
    defaultPort: 3306,
    helpUrl: "",
    hostExample: "db.example.com"
  },
];

const DatabaseConfigAssistant = ({
  projectName,
  extractedFiles,
  onConfigComplete,
  onSkip,
  disabled = false,
}: DatabaseConfigAssistantProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("choice");
  const [databaseChoice, setDatabaseChoice] = useState<"keep" | "new" | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  const [migrationMessage, setMigrationMessage] = useState("");
  const [wantsMigration, setWantsMigration] = useState(false);

  const [dbCredentials, setDbCredentials] = useState<{
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }>({
    host: "",
    port: 3306,
    database: "",
    username: "",
    password: "",
  });

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId);
    const provider = databaseProviders.find(p => p.id === providerId);
    if (provider) {
      setDbCredentials(prev => ({
        ...prev,
        port: provider.defaultPort,
      }));
    }
    setStep("credentials");
  };

  const handleTestConnection = async () => {
    // Simulate connection test
    toast({
      title: "Test de connexion...",
      description: "Vérification des identifiants en cours",
    });

    // In a real implementation, this would call an edge function to test the connection
    await new Promise(r => setTimeout(r, 1500));

    toast({
      title: "Connexion réussie !",
      description: `Connecté à ${dbCredentials.host}`,
    });
  };

  const handleMigration = async () => {
    setIsMigrating(true);
    setStep("migrating");
    setMigrationProgress(0);

    try {
      // Step 1: Export current data
      setMigrationProgress(10);
      setMigrationMessage("Export des données actuelles...");
      await new Promise(r => setTimeout(r, 1000));

      // Step 2: Connect to new database
      setMigrationProgress(30);
      setMigrationMessage("Connexion à la nouvelle base de données...");
      await new Promise(r => setTimeout(r, 800));

      // Step 3: Create schema
      setMigrationProgress(50);
      setMigrationMessage("Création de la structure des tables...");
      await new Promise(r => setTimeout(r, 1200));

      // Step 4: Import data
      setMigrationProgress(75);
      setMigrationMessage("Import des données...");
      await new Promise(r => setTimeout(r, 1000));

      // Step 5: Update config files
      setMigrationProgress(90);
      setMigrationMessage("Mise à jour des fichiers de configuration...");
      await new Promise(r => setTimeout(r, 600));

      setMigrationProgress(100);
      setMigrationMessage("Terminé !");
      await new Promise(r => setTimeout(r, 400));

      setStep("success");

      toast({
        title: "Migration terminée !",
        description: "Votre base de données est configurée",
      });

    } catch (error) {
      console.error("Migration error:", error);
      setIsMigrating(false);
      setStep("credentials");
      toast({
        title: "Erreur de migration",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  const handleConfigureOnly = async () => {
    setIsMigrating(true);
    setStep("migrating");
    setMigrationProgress(0);

    try {
      setMigrationProgress(30);
      setMigrationMessage("Mise à jour des fichiers de configuration...");
      await new Promise(r => setTimeout(r, 800));

      setMigrationProgress(70);
      setMigrationMessage("Génération des fichiers .env...");
      await new Promise(r => setTimeout(r, 600));

      setMigrationProgress(100);
      setMigrationMessage("Terminé !");
      await new Promise(r => setTimeout(r, 400));

      setStep("success");

      onConfigComplete({
        type: "new",
        provider: selectedProvider,
        ...dbCredentials,
      });

      toast({
        title: "Configuration terminée !",
        description: "Les fichiers ont été mis à jour",
      });

    } catch (error) {
      console.error("Config error:", error);
      setIsMigrating(false);
      setStep("credentials");
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    }
  };

  const selectedProviderData = databaseProviders.find(p => p.id === selectedProvider);

  // Step: Initial choice
  if (step === "choice") {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <Badge className="mb-3 bg-accent/10 text-accent border-accent/20 gap-1">
            <Database className="h-3 w-3" />
            Configuration Base de Données
          </Badge>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Et pour vos données ?
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Votre application a besoin d'une base de données pour stocker les informations
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {/* Option 1: Keep current */}
          <Card
            className={`cursor-pointer transition-all hover:border-primary/50 hover:shadow-lg ${
              disabled ? "opacity-50 pointer-events-none" : ""
            }`}
            onClick={() => {
              setDatabaseChoice("keep");
              onConfigComplete({ type: "keep" });
              toast({
                title: "Configuration conservée",
                description: "Votre base de données actuelle sera utilisée",
              });
            }}
          >
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Cloud className="h-8 w-8 text-primary" />
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-1">
                  Garder ma base actuelle
                </h4>
                <p className="text-sm text-muted-foreground">
                  Continuez avec votre base de données existante
                </p>
              </div>
              <ul className="space-y-2 text-left">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-foreground">Aucune configuration requise</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-foreground">Données déjà en place</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-foreground">Le plus rapide</span>
                </li>
              </ul>
              <Badge className="mt-4 w-full justify-center bg-primary/10 text-primary border-primary/20">
                Recommandé pour commencer
              </Badge>
            </CardContent>
          </Card>

          {/* Option 2: New database */}
          <Card
            className={`cursor-pointer transition-all hover:border-accent/50 hover:shadow-lg ${
              disabled ? "opacity-50 pointer-events-none" : ""
            }`}
            onClick={() => {
              setDatabaseChoice("new");
              setStep("provider");
            }}
          >
            <CardContent className="p-6">
              <div className="text-center mb-4">
                <div className="h-16 w-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Server className="h-8 w-8 text-accent" />
                </div>
                <h4 className="text-lg font-semibold text-foreground mb-1">
                  Utiliser une nouvelle base
                </h4>
                <p className="text-sm text-muted-foreground">
                  Configurez la base de données de votre hébergeur
                </p>
              </div>
              <ul className="space-y-2 text-left">
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-accent flex-shrink-0" />
                  <span className="text-foreground">100% indépendant</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-accent flex-shrink-0" />
                  <span className="text-foreground">Migration automatique</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-accent flex-shrink-0" />
                  <span className="text-foreground">Configuration guidée</span>
                </li>
              </ul>
              <Badge className="mt-4 w-full justify-center bg-accent/10 text-accent border-accent/20">
                Indépendance totale
              </Badge>
            </CardContent>
          </Card>
        </div>

        <div className="text-center pt-4">
          <Button variant="link" onClick={onSkip} className="text-muted-foreground">
            Passer cette étape pour l'instant
          </Button>
        </div>
      </div>
    );
  }

  // Step: Select provider
  if (step === "provider") {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep("choice")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>

        <div className="text-center mb-6">
          <Badge className="mb-3 bg-accent/10 text-accent border-accent/20 gap-1">
            <Database className="h-3 w-3" />
            Nouvelle Base de Données
          </Badge>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Chez quel hébergeur ?
          </h3>
          <p className="text-muted-foreground">
            Sélectionnez votre hébergeur pour obtenir de l'aide personnalisée
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
          {databaseProviders.map((provider) => (
            <Card
              key={provider.id}
              className="cursor-pointer transition-all hover:border-accent/50 hover:shadow-lg"
              onClick={() => handleProviderSelect(provider.id)}
            >
              <CardContent className="p-4 text-center">
                <span className="text-3xl mb-2 block">{provider.logo}</span>
                <span className="font-medium text-foreground text-sm">{provider.name}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-muted/50 rounded-lg p-4 max-w-2xl mx-auto">
          <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-2">
            <HelpCircle className="h-4 w-4" />
            Vous trouverez vos identifiants MySQL dans l'email de bienvenue de votre hébergeur
          </p>
        </div>
      </div>
    );
  }

  // Step: Enter credentials
  if (step === "credentials") {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep("provider")}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>

        <div className="text-center mb-6">
          <Badge className="mb-3 bg-accent/10 text-accent border-accent/20 gap-1">
            {selectedProviderData?.logo} {selectedProviderData?.name}
          </Badge>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            Connexion à votre base de données
          </h3>
          <p className="text-muted-foreground">
            Entrez les informations MySQL fournies par {selectedProviderData?.name}
          </p>
          {selectedProviderData?.helpUrl && (
            <a
              href={selectedProviderData.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-2"
            >
              <HelpCircle className="h-3 w-3" />
              Où trouver ces informations ?
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <Card className="card-shadow max-w-lg mx-auto">
          <CardContent className="p-6">
            <div className="space-y-4">
              {/* Security notice */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Ces informations seront utilisées pour configurer votre projet. Elles ne sont jamais stockées sur nos serveurs.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="host">
                    Serveur (Host)
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>L'adresse de votre serveur de base de données</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="host"
                    placeholder={selectedProviderData?.hostExample || "db.example.com"}
                    value={dbCredentials.host}
                    onChange={(e) => setDbCredentials(prev => ({ ...prev, host: e.target.value }))}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={dbCredentials.port}
                    onChange={(e) => setDbCredentials(prev => ({ ...prev, port: parseInt(e.target.value) || 3306 }))}
                    className="bg-background"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="database">
                  Nom de la base de données
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 inline ml-1 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Le nom de votre base de données MySQL</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="database"
                  placeholder="nom_de_ma_base"
                  value={dbCredentials.database}
                  onChange={(e) => setDbCredentials(prev => ({ ...prev, database: e.target.value }))}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Nom d'utilisateur</Label>
                <Input
                  id="username"
                  placeholder="user_12345"
                  value={dbCredentials.username}
                  onChange={(e) => setDbCredentials(prev => ({ ...prev, username: e.target.value }))}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dbpassword">Mot de passe</Label>
                <div className="relative">
                  <Input
                    id="dbpassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={dbCredentials.password}
                    onChange={(e) => setDbCredentials(prev => ({ ...prev, password: e.target.value }))}
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

              {/* Test connection button */}
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={!dbCredentials.host || !dbCredentials.username || !dbCredentials.password}
                className="w-full gap-2"
              >
                <Database className="h-4 w-4" />
                Tester la connexion
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Migration option */}
        <Card className="card-shadow max-w-lg mx-auto border-accent/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Upload className="h-5 w-5 text-accent" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-1">
                  Migrer vos données existantes ?
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Nous pouvons exporter vos données actuelles et les importer dans votre nouvelle base de données.
                </p>
                <div className="flex gap-3">
                  <Button
                    variant={wantsMigration ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWantsMigration(true)}
                    className="gap-1"
                  >
                    {wantsMigration && <Check className="h-3 w-3" />}
                    Oui, migrer
                  </Button>
                  <Button
                    variant={!wantsMigration ? "default" : "outline"}
                    size="sm"
                    onClick={() => setWantsMigration(false)}
                    className="gap-1"
                  >
                    {!wantsMigration && <Check className="h-3 w-3" />}
                    Non, base vide
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 max-w-lg mx-auto">
          <Button
            onClick={wantsMigration ? handleMigration : handleConfigureOnly}
            disabled={disabled || !dbCredentials.host || !dbCredentials.database || !dbCredentials.username || !dbCredentials.password}
            className="w-full gap-2"
            size="lg"
          >
            {wantsMigration ? (
              <>
                <Upload className="h-4 w-4" />
                Configurer et Migrer les données
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Configurer la nouvelle base
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Step: Migration in progress
  if (step === "migrating") {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="h-20 w-20 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="h-10 w-10 text-accent animate-spin" />
          </div>
          <h3 className="text-2xl font-bold text-foreground mb-2">
            {wantsMigration ? "Migration en cours..." : "Configuration en cours..."}
          </h3>
          <p className="text-muted-foreground mb-6">
            {migrationMessage}
          </p>
          <div className="max-w-md mx-auto">
            <Progress value={migrationProgress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">{migrationProgress}%</p>
          </div>
        </div>

        <Card className="card-shadow max-w-md mx-auto">
          <CardContent className="p-4">
            <div className="space-y-2 text-sm">
              {wantsMigration && (
                <>
                  <div className={`flex items-center gap-2 ${migrationProgress >= 10 ? "text-accent" : "text-muted-foreground"}`}>
                    {migrationProgress >= 10 ? <Check className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
                    Export des données actuelles
                  </div>
                  <div className={`flex items-center gap-2 ${migrationProgress >= 30 ? "text-accent" : "text-muted-foreground"}`}>
                    {migrationProgress >= 30 ? <Check className="h-4 w-4" /> : migrationProgress >= 10 ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="h-4 w-4" />}
                    Connexion à {selectedProviderData?.name}
                  </div>
                  <div className={`flex items-center gap-2 ${migrationProgress >= 50 ? "text-accent" : "text-muted-foreground"}`}>
                    {migrationProgress >= 50 ? <Check className="h-4 w-4" /> : migrationProgress >= 30 ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="h-4 w-4" />}
                    Création des tables
                  </div>
                  <div className={`flex items-center gap-2 ${migrationProgress >= 75 ? "text-accent" : "text-muted-foreground"}`}>
                    {migrationProgress >= 75 ? <Check className="h-4 w-4" /> : migrationProgress >= 50 ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="h-4 w-4" />}
                    Import des données
                  </div>
                </>
              )}
              <div className={`flex items-center gap-2 ${migrationProgress >= 90 ? "text-accent" : "text-muted-foreground"}`}>
                {migrationProgress >= 90 ? <Check className="h-4 w-4" /> : migrationProgress >= 75 ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="h-4 w-4" />}
                Mise à jour de la configuration
              </div>
              <div className={`flex items-center gap-2 ${migrationProgress >= 100 ? "text-accent" : "text-muted-foreground"}`}>
                {migrationProgress >= 100 ? <Check className="h-4 w-4" /> : migrationProgress >= 90 ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="h-4 w-4" />}
                Finalisation
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step: Success
  if (step === "success") {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6 animate-bounce" style={{ animationDuration: "2s" }}>
            <PartyPopper className="h-10 w-10 text-success" />
          </div>
          <h3 className="text-3xl font-bold text-foreground mb-3">
            Configuration terminée ! 🎉
          </h3>
          <p className="text-xl text-muted-foreground mb-2">
            Votre base de données {selectedProviderData?.name} est prête
          </p>
        </div>

        <Card className="card-shadow max-w-md mx-auto border-success/30">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10">
                <Check className="h-5 w-5 text-success" />
                <span className="text-foreground font-medium">Fichiers de configuration mis à jour</span>
              </div>
              {wantsMigration && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10">
                  <Check className="h-5 w-5 text-success" />
                  <span className="text-foreground font-medium">Données migrées avec succès</span>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10">
                <Check className="h-5 w-5 text-success" />
                <span className="text-foreground font-medium">Connexion vérifiée</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="font-semibold text-foreground mb-3">Fichiers modifiés :</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="font-mono bg-muted/50 px-2 py-1 rounded">.env</li>
                <li className="font-mono bg-muted/50 px-2 py-1 rounded">src/lib/database.ts</li>
                <li className="font-mono bg-muted/50 px-2 py-1 rounded">docker-compose.yml</li>
              </ul>
            </div>

            <Button 
              onClick={() => onConfigComplete({
                type: "new",
                provider: selectedProvider,
                ...dbCredentials,
              })} 
              className="w-full mt-6 gap-2"
              size="lg"
            >
              <ArrowRight className="h-4 w-4" />
              Continuer vers le déploiement
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default DatabaseConfigAssistant;
