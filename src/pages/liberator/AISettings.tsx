import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  Server,
  Cpu,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  RefreshCw,
  ExternalLink,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AIProvider {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  status: "connected" | "disconnected" | "testing";
  models?: string[];
}

const defaultProviders: AIProvider[] = [
  {
    id: "ollama",
    name: "Ollama",
    url: "http://localhost:11434",
    enabled: true,
    status: "disconnected",
    models: ["llama3", "codellama", "mistral"],
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    url: "http://localhost:1234",
    enabled: false,
    status: "disconnected",
  },
  {
    id: "openwebui",
    name: "Open WebUI",
    url: "http://localhost:3000",
    enabled: false,
    status: "disconnected",
  },
  {
    id: "openai-compatible",
    name: "OpenAI Compatible",
    url: "http://localhost:8080/v1",
    enabled: false,
    status: "disconnected",
  },
];

export default function AISettings() {
  const { toast } = useToast();
  const [providers, setProviders] = useState<AIProvider[]>(defaultProviders);
  const [defaultModel, setDefaultModel] = useState("llama3");
  const [saving, setSaving] = useState(false);
  const [useAI, setUseAI] = useState(true);

  const testConnection = async (providerId: string) => {
    setProviders(prev => prev.map(p =>
      p.id === providerId ? { ...p, status: "testing" } : p
    ));

    // Simulate API test
    await new Promise(resolve => setTimeout(resolve, 2000));

    const success = Math.random() > 0.3;
    
    setProviders(prev => prev.map(p =>
      p.id === providerId ? { ...p, status: success ? "connected" : "disconnected" } : p
    ));

    toast({
      title: success ? "Connexion réussie" : "Échec de connexion",
      description: success
        ? `${providers.find(p => p.id === providerId)?.name} est accessible`
        : "Impossible de se connecter au serveur",
      variant: success ? "default" : "destructive",
    });
  };

  const updateProviderUrl = (providerId: string, url: string) => {
    setProviders(prev => prev.map(p =>
      p.id === providerId ? { ...p, url, status: "disconnected" } : p
    ));
  };

  const toggleProvider = (providerId: string, enabled: boolean) => {
    setProviders(prev => prev.map(p =>
      p.id === providerId ? { ...p, enabled } : p
    ));
  };

  const saveSettings = async () => {
    setSaving(true);
    
    // Simulate save
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setSaving(false);
    toast({
      title: "Paramètres enregistrés",
      description: "Vos préférences IA ont été sauvegardées",
    });
  };

  const getStatusIcon = (status: AIProvider["status"]) => {
    switch (status) {
      case "connected":
        return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case "testing":
        return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
      default:
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" />
          Configuration IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Configurez vos fournisseurs d'IA locaux pour le nettoyage intelligent
        </p>
      </div>

      {/* Main Toggle */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                useAI ? "bg-primary/10" : "bg-muted"
              )}>
                <Zap className={cn("h-6 w-6", useAI ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div>
                <h3 className="font-semibold">Nettoyage assisté par IA</h3>
                <p className="text-sm text-muted-foreground">
                  Utiliser l'IA pour améliorer le nettoyage du code
                </p>
              </div>
            </div>
            <Switch checked={useAI} onCheckedChange={setUseAI} />
          </div>
          
          {!useAI && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2"
            >
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Sans IA, le nettoyage utilisera uniquement des règles statiques. Certains patterns complexes pourraient ne pas être détectés.
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Providers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Fournisseurs IA
          </CardTitle>
          <CardDescription>
            Configurez les endpoints de vos modèles IA locaux
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {providers.map((provider, index) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "p-4 rounded-lg border transition-colors",
                provider.enabled ? "bg-card border-border" : "bg-muted/50 border-transparent"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    provider.enabled ? "bg-primary/10" : "bg-muted"
                  )}>
                    <Cpu className={cn(
                      "h-5 w-5",
                      provider.enabled ? "text-primary" : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {provider.name}
                      {getStatusIcon(provider.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {provider.status === "connected" ? "Connecté" : "Non connecté"}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={(checked) => toggleProvider(provider.id, checked)}
                />
              </div>

              {provider.enabled && (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>URL du serveur</Label>
                    <div className="flex gap-2">
                      <Input
                        value={provider.url}
                        onChange={(e) => updateProviderUrl(provider.id, e.target.value)}
                        placeholder="http://localhost:11434"
                      />
                      <Button
                        variant="outline"
                        onClick={() => testConnection(provider.id)}
                        disabled={provider.status === "testing"}
                        className="shrink-0"
                      >
                        {provider.status === "testing" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {provider.models && provider.models.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {provider.models.map(model => (
                        <Badge key={model} variant="outline">
                          {model}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Default Model */}
      <Card>
        <CardHeader>
          <CardTitle>Modèle par défaut</CardTitle>
          <CardDescription>
            Sélectionnez le modèle à utiliser pour le nettoyage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Modèle</Label>
              <Select value={defaultModel} onValueChange={setDefaultModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="llama3">Llama 3 (8B)</SelectItem>
                  <SelectItem value="codellama">CodeLlama (13B)</SelectItem>
                  <SelectItem value="mistral">Mistral (7B)</SelectItem>
                  <SelectItem value="deepseek">DeepSeek Coder</SelectItem>
                  <SelectItem value="qwen">Qwen2.5 Coder</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-2">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Tous les modèles s'exécutent localement sur votre machine. Aucune donnée n'est envoyée vers des serveurs externes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setProviders(defaultProviders)}>
          Réinitialiser
        </Button>
        <Button onClick={saveSettings} disabled={saving} className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Enregistrer
            </>
          )}
        </Button>
      </div>

      {/* Help Links */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Besoin d'aide pour installer un fournisseur IA?
            </div>
            <div className="flex gap-2">
              <Button variant="link" size="sm" className="gap-1" asChild>
                <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer">
                  Ollama <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
              <Button variant="link" size="sm" className="gap-1" asChild>
                <a href="https://lmstudio.ai" target="_blank" rel="noopener noreferrer">
                  LM Studio <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
