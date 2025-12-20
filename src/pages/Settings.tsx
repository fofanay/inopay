import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Key, Save, Loader2, Eye, EyeOff, CheckCircle2, Github, AlertCircle, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ApiProvider = "openai" | "anthropic";

interface UserSettings {
  id?: string;
  api_provider: ApiProvider;
  api_key: string;
  github_token?: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, subscription } = useAuth();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<UserSettings>({
    api_provider: "openai",
    api_key: "",
    github_token: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGithub, setSavingGithub] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGithubToken, setShowGithubToken] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [hasExistingGithubToken, setHasExistingGithubToken] = useState(false);

  const isPro = subscription?.planType === "pro" || subscription?.planType === "enterprise" as any;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching settings:", error);
    } else if (data) {
      setSettings({
        id: data.id,
        api_provider: data.api_provider as ApiProvider,
        api_key: "",
        github_token: "",
      });
      setHasExistingKey(!!data.api_key);
      // Check if github_token field exists and has a value
      const dataWithGithub = data as { github_token?: string };
      setHasExistingGithubToken(!!dataWithGithub.github_token);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);

    let error;

    if (settings.id) {
      const updateData: { api_provider: string; api_key?: string } = {
        api_provider: settings.api_provider,
      };
      if (settings.api_key) {
        updateData.api_key = settings.api_key;
      }
      
      const result = await supabase
        .from("user_settings")
        .update(updateData)
        .eq("id", settings.id);
      error = result.error;
    } else {
      const insertData: { user_id: string; api_provider: string; api_key?: string } = {
        user_id: user.id,
        api_provider: settings.api_provider,
      };
      if (settings.api_key) {
        insertData.api_key = settings.api_key;
      }
      
      const result = await supabase
        .from("user_settings")
        .insert([insertData])
        .select()
        .single();
      error = result.error;
      if (result.data) {
        setSettings(prev => ({ ...prev, id: result.data.id }));
      }
    }

    setSaving(false);

    if (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les paramètres",
        variant: "destructive",
      });
    } else {
      setHasExistingKey(!!settings.api_key || hasExistingKey);
      setSettings(prev => ({ ...prev, api_key: "" }));
      toast({
        title: "Succès",
        description: "Paramètres sauvegardés avec succès",
      });
    }
  };

  const handleSaveGithubToken = async () => {
    if (!user || !isPro) return;

    setSavingGithub(true);

    try {
      // Save GitHub token to user_settings
      const updateData: Record<string, string> = {};
      if (settings.github_token) {
        updateData.github_token = settings.github_token;
      }

      let error;
      if (settings.id) {
        const result = await supabase
          .from("user_settings")
          .update(updateData)
          .eq("id", settings.id);
        error = result.error;
      } else {
        const result = await supabase
          .from("user_settings")
          .insert([{
            user_id: user.id,
            api_provider: settings.api_provider,
            ...updateData,
          }])
          .select()
          .single();
        error = result.error;
        if (result.data) {
          setSettings(prev => ({ ...prev, id: result.data.id }));
        }
      }

      if (error) throw error;

      setHasExistingGithubToken(!!settings.github_token || hasExistingGithubToken);
      setSettings(prev => ({ ...prev, github_token: "" }));
      toast({
        title: "Succès",
        description: "Token GitHub sauvegardé avec succès",
      });
    } catch (error) {
      console.error("Error saving GitHub token:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le token GitHub",
        variant: "destructive",
      });
    } finally {
      setSavingGithub(false);
    }
  };

  const handleRemoveGithubToken = async () => {
    if (!user || !settings.id) return;

    setSavingGithub(true);

    try {
      const { error } = await supabase
        .from("user_settings")
        .update({ github_token: null })
        .eq("id", settings.id);

      if (error) throw error;

      setHasExistingGithubToken(false);
      toast({
        title: "Succès",
        description: "Token GitHub supprimé",
      });
    } catch (error) {
      console.error("Error removing GitHub token:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le token GitHub",
        variant: "destructive",
      });
    } finally {
      setSavingGithub(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              Paramètres
            </h1>
            <p className="text-lg text-muted-foreground">
              Configurez vos clés API et tokens pour une expérience optimale
            </p>
          </div>

          {/* GitHub Token Card - Pro Feature */}
          <Card className={`animate-fade-in mb-6 ${!isPro ? 'opacity-75' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Github className="h-5 w-5" />
                  Token GitHub personnel
                </CardTitle>
                {isPro ? (
                  <Badge className="bg-primary text-primary-foreground">Pro</Badge>
                ) : (
                  <Badge variant="outline">Pro requis</Badge>
                )}
              </div>
              <CardDescription>
                Connectez votre propre token GitHub pour augmenter les limites API (5000 requêtes/heure)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isPro ? (
                <Alert>
                  <Crown className="h-4 w-4" />
                  <AlertTitle>Fonctionnalité Pro</AlertTitle>
                  <AlertDescription>
                    Cette fonctionnalité est réservée aux utilisateurs Pro. 
                    Passez à Pro pour connecter votre propre token GitHub et bénéficier de limites API plus élevées.
                    <div className="mt-3">
                      <Link to="/pricing">
                        <Button size="sm">
                          Voir les plans
                        </Button>
                      </Link>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* GitHub Token Input */}
                  <div className="space-y-3">
                    <Label htmlFor="github-token">Token d'accès personnel GitHub</Label>
                    <div className="relative">
                      <Input
                        id="github-token"
                        type={showGithubToken ? "text" : "password"}
                        placeholder={hasExistingGithubToken ? "••••••••••••••••••••" : "ghp_..."}
                        value={settings.github_token}
                        onChange={(e) => setSettings(prev => ({ ...prev, github_token: e.target.value }))}
                        className="pr-10"
                        disabled={!isPro}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowGithubToken(!showGithubToken)}
                      >
                        {showGithubToken ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {hasExistingGithubToken && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Un token GitHub est configuré</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={handleRemoveGithubToken}
                          disabled={savingGithub}
                        >
                          Supprimer
                        </Button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Créez un token sur <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">github.com/settings/tokens</a> avec les permissions <code className="bg-muted px-1 rounded">repo</code> (lecture).
                    </p>
                  </div>

                  {/* Save GitHub Token Button */}
                  <Button 
                    onClick={handleSaveGithubToken} 
                    disabled={savingGithub || !settings.github_token}
                    className="w-full"
                  >
                    {savingGithub ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sauvegarde...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Sauvegarder le token GitHub
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* AI API Key Card */}
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Configuration de l'IA
              </CardTitle>
              <CardDescription>
                Choisissez votre fournisseur d'IA et entrez votre clé API pour activer le nettoyage automatique du code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Provider Selection */}
              <div className="space-y-3">
                <Label>Fournisseur d'IA</Label>
                <RadioGroup
                  value={settings.api_provider}
                  onValueChange={(value: ApiProvider) => 
                    setSettings(prev => ({ ...prev, api_provider: value }))
                  }
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem
                      value="openai"
                      id="openai"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="openai"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <span className="text-lg font-semibold">OpenAI</span>
                      <span className="text-sm text-muted-foreground">GPT-4o</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="anthropic"
                      id="anthropic"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="anthropic"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <span className="text-lg font-semibold">Anthropic</span>
                      <span className="text-sm text-muted-foreground">Claude Sonnet</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* API Key Input */}
              <div className="space-y-3">
                <Label htmlFor="api-key">
                  Clé API {settings.api_provider === "openai" ? "OpenAI" : "Anthropic"}
                </Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder={hasExistingKey ? "••••••••••••••••••••" : "sk-..."}
                    value={settings.api_key}
                    onChange={(e) => setSettings(prev => ({ ...prev, api_key: e.target.value }))}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {hasExistingKey && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Une clé API est déjà configurée</span>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {settings.api_provider === "openai" 
                    ? "Obtenez votre clé sur platform.openai.com" 
                    : "Obtenez votre clé sur console.anthropic.com"}
                </p>
              </div>

              {/* Save Button */}
              <Button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sauvegarde...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Sauvegarder
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="mt-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">Comment ça fonctionne ?</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>1. Configurez votre clé API ci-dessus</li>
                <li>2. Analysez un projet depuis le Dashboard</li>
                <li>3. Cliquez sur "Générer le code autonome" pour chaque fichier à risque</li>
                <li>4. L'IA réécrit le code en supprimant les dépendances propriétaires</li>
                <li>5. Comparez et téléchargez le code nettoyé</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
