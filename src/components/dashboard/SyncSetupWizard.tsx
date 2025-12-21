import { useState } from "react";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Copy, 
  ExternalLink, 
  Key, 
  Link, 
  Shield,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Deployment {
  id: string;
  project_name: string;
  deployed_url: string | null;
  github_repo_url: string | null;
}

interface SyncSetupWizardProps {
  deployment: Deployment;
  onComplete: () => void;
  onCancel: () => void;
}

export function SyncSetupWizard({ deployment, onComplete, onCancel }: SyncSetupWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [copied, setCopied] = useState<"url" | "secret" | null>(null);

  const generateSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleStartSetup = async () => {
    if (!user) return;

    setIsCreating(true);
    try {
      const secret = generateSecret();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/github-sync-webhook`;

      // Create sync configuration
      const { error } = await supabase.from("sync_configurations").insert({
        user_id: user.id,
        deployment_id: deployment.id,
        github_repo_url: deployment.github_repo_url,
        github_webhook_secret: secret,
        sync_enabled: false, // Will enable after webhook is configured
      });

      if (error) throw error;

      setWebhookSecret(secret);
      setWebhookUrl(url);
      setStep(2);
    } catch (error) {
      console.error("Error creating sync config:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la configuration de synchronisation",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async (text: string, type: "url" | "secret") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copié !",
      description: `${type === "url" ? "URL du webhook" : "Secret"} copié dans le presse-papier`,
    });
  };

  const handleComplete = async () => {
    // Enable sync
    const { error } = await supabase
      .from("sync_configurations")
      .update({ sync_enabled: true })
      .eq("deployment_id", deployment.id);

    if (error) {
      console.error("Error enabling sync:", error);
    }

    setIsComplete(true);
    setTimeout(() => {
      onComplete();
    }, 1500);
  };

  const getGitHubSettingsUrl = () => {
    if (!deployment.github_repo_url) return "";
    const match = deployment.github_repo_url.match(/github\.com\/([^/]+\/[^/]+)/);
    if (!match) return "";
    return `https://github.com/${match[1]}/settings/hooks/new`;
  };

  if (isComplete) {
    return (
      <Card className="max-w-2xl mx-auto border-success/30">
        <CardContent className="py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10 mx-auto mb-4">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Configuration terminée !</h3>
          <p className="text-muted-foreground">
            La synchronisation automatique est maintenant active pour {deployment.project_name}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Configuration Sync Mirror</h2>
          <p className="text-muted-foreground">{deployment.project_name}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s < step
                  ? "bg-success text-success-foreground"
                  : s === step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            {s < 3 && <div className={`h-1 flex-1 rounded ${s < step ? "bg-success" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Introduction */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Étape 1 : Préparation
            </CardTitle>
            <CardDescription>
              Nous allons configurer un webhook sécurisé entre GitHub et Inopay
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Ce qui va se passer :</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Génération d'un secret de sécurité unique
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Création de l'URL webhook Inopay
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  Configuration dans votre dépôt GitHub
                </li>
              </ul>
            </div>

            <div className="flex items-center gap-3 p-4 bg-info/10 rounded-lg border border-info/20">
              <Key className="h-5 w-5 text-info" />
              <div className="text-sm">
                <p className="font-medium text-info">Sécurité HMAC-SHA256</p>
                <p className="text-muted-foreground">
                  Seules les requêtes signées par GitHub seront acceptées
                </p>
              </div>
            </div>

            <Button onClick={handleStartSetup} className="w-full gap-2" disabled={isCreating}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  Générer les clés de sécurité
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Webhook Configuration */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5 text-primary" />
              Étape 2 : Configuration du Webhook GitHub
            </CardTitle>
            <CardDescription>
              Copiez ces informations dans les paramètres de votre dépôt GitHub
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Payload URL</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={webhookUrl} readOnly className="font-mono text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(webhookUrl, "url")}
                  >
                    {copied === "url" ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label>Secret</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={webhookSecret} readOnly className="font-mono text-sm" type="password" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(webhookSecret, "secret")}
                  >
                    {copied === "secret" ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label>Content type</Label>
                <Input value="application/json" readOnly className="mt-1" />
              </div>

              <div>
                <Label>Events</Label>
                <div className="mt-1 p-3 bg-muted/50 rounded-lg">
                  <Badge>Push events</Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sélectionnez uniquement "Just the push event"
                  </p>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => window.open(getGitHubSettingsUrl(), "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              Ouvrir les paramètres GitHub
            </Button>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1 gap-2">
                J'ai configuré le webhook
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              Étape 3 : Activation
            </CardTitle>
            <CardDescription>
              Vérifiez que tout est correctement configuré
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
                <Check className="h-5 w-5 text-success" />
                <div>
                  <p className="font-medium">Secret généré</p>
                  <p className="text-sm text-muted-foreground">Clé HMAC-SHA256 sécurisée</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
                <Check className="h-5 w-5 text-success" />
                <div>
                  <p className="font-medium">Configuration Inopay</p>
                  <p className="text-sm text-muted-foreground">Prêt à recevoir les webhooks</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Webhook GitHub</p>
                  <p className="text-sm text-muted-foreground">
                    Assurez-vous d'avoir configuré le webhook dans GitHub
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm">
                <strong>Prochaine étape :</strong> Après avoir cliqué sur "Activer", chaque push vers 
                la branche main/master déclenchera automatiquement un nettoyage et un déploiement.
              </p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <Button onClick={handleComplete} className="flex-1 gap-2 bg-success hover:bg-success/90">
                <Check className="h-4 w-4" />
                Activer Sync Mirror
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SyncSetupWizard;
