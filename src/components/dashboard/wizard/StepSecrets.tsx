import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Key, ArrowLeft, ArrowRight, Eye, EyeOff, AlertTriangle, Check,
  CreditCard, Mail, Brain, Database, Cloud, Search, Radio, Shield,
  Loader2, Sparkles
} from "lucide-react";
import { useWizard, DetectedSecret } from "@/contexts/WizardContext";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

// Patterns d'environnement pour détecter les clés API
const ENV_PATTERNS: { pattern: RegExp; name: string; category: DetectedSecret["category"] }[] = [
  // Payment
  { pattern: /STRIPE_SECRET_KEY/gi, name: "STRIPE_SECRET_KEY", category: "payment" },
  { pattern: /STRIPE_PUBLISHABLE_KEY/gi, name: "STRIPE_PUBLISHABLE_KEY", category: "payment" },
  { pattern: /STRIPE_WEBHOOK_SECRET/gi, name: "STRIPE_WEBHOOK_SECRET", category: "payment" },
  // AI
  { pattern: /OPENAI_API_KEY/gi, name: "OPENAI_API_KEY", category: "ai" },
  { pattern: /ANTHROPIC_API_KEY/gi, name: "ANTHROPIC_API_KEY", category: "ai" },
  { pattern: /DEEPSEEK_API_KEY/gi, name: "DEEPSEEK_API_KEY", category: "ai" },
  // Email
  { pattern: /SENDGRID_API_KEY/gi, name: "SENDGRID_API_KEY", category: "email" },
  { pattern: /RESEND_API_KEY/gi, name: "RESEND_API_KEY", category: "email" },
  // Auth
  { pattern: /CLERK_SECRET_KEY/gi, name: "CLERK_SECRET_KEY", category: "auth" },
  { pattern: /AUTH0_SECRET/gi, name: "AUTH0_SECRET", category: "auth" },
  { pattern: /TWILIO_AUTH_TOKEN/gi, name: "TWILIO_AUTH_TOKEN", category: "auth" },
  { pattern: /TWILIO_ACCOUNT_SID/gi, name: "TWILIO_ACCOUNT_SID", category: "auth" },
  // Database
  { pattern: /SUPABASE_URL/gi, name: "SUPABASE_URL", category: "database" },
  { pattern: /SUPABASE_ANON_KEY/gi, name: "SUPABASE_ANON_KEY", category: "database" },
  { pattern: /SUPABASE_SERVICE_ROLE_KEY/gi, name: "SUPABASE_SERVICE_ROLE_KEY", category: "database" },
  { pattern: /DATABASE_URL/gi, name: "DATABASE_URL", category: "database" },
  // Storage
  { pattern: /CLOUDINARY_URL/gi, name: "CLOUDINARY_URL", category: "storage" },
  { pattern: /CLOUDINARY_API_KEY/gi, name: "CLOUDINARY_API_KEY", category: "storage" },
  { pattern: /UPLOADTHING_SECRET/gi, name: "UPLOADTHING_SECRET", category: "storage" },
  // Search
  { pattern: /ALGOLIA_API_KEY/gi, name: "ALGOLIA_API_KEY", category: "search" },
  { pattern: /MEILISEARCH_API_KEY/gi, name: "MEILISEARCH_API_KEY", category: "search" },
  // Realtime
  { pattern: /PUSHER_APP_KEY/gi, name: "PUSHER_APP_KEY", category: "realtime" },
  { pattern: /PUSHER_APP_SECRET/gi, name: "PUSHER_APP_SECRET", category: "realtime" },
  // Other
  { pattern: /GITHUB_TOKEN/gi, name: "GITHUB_TOKEN", category: "other" },
  { pattern: /GITHUB_PERSONAL_ACCESS_TOKEN/gi, name: "GITHUB_PERSONAL_ACCESS_TOKEN", category: "other" },
];

const categoryIcons: Record<DetectedSecret["category"], React.ElementType> = {
  payment: CreditCard,
  email: Mail,
  ai: Brain,
  database: Database,
  storage: Cloud,
  search: Search,
  realtime: Radio,
  auth: Shield,
  other: Key,
};

export function StepSecrets() {
  const { t } = useTranslation();
  const { state, dispatch, nextStep, prevStep } = useWizard();
  const [isScanning, setIsScanning] = useState(false);
  const [showValues, setShowValues] = useState<Record<number, boolean>>({});

  const categoryLabels: Record<DetectedSecret["category"], string> = {
    payment: t("wizard.secrets.categories.payment"),
    email: t("wizard.secrets.categories.email"),
    ai: t("wizard.secrets.categories.ai"),
    database: t("wizard.secrets.categories.database"),
    storage: t("wizard.secrets.categories.storage"),
    search: t("wizard.secrets.categories.search"),
    realtime: t("wizard.secrets.categories.realtime"),
    auth: t("wizard.secrets.categories.auth"),
    other: t("wizard.secrets.categories.other"),
  };

  // Scanner les fichiers pour détecter les variables d'environnement
  useEffect(() => {
    if (!state.secrets.isScanned && state.cleaning.fetchedFiles.length > 0) {
      scanForSecrets();
    }
  }, [state.cleaning.fetchedFiles, state.secrets.isScanned]);

  const scanForSecrets = async () => {
    setIsScanning(true);
    const detectedMap = new Map<string, DetectedSecret>();

    for (const file of state.cleaning.fetchedFiles) {
      for (const { pattern, name, category } of ENV_PATTERNS) {
        if (pattern.test(file.content)) {
          if (!detectedMap.has(name)) {
            detectedMap.set(name, {
              name,
              category,
              value: "",
              newValue: "",
              action: "keep",
              detectedIn: [file.path],
            });
          } else {
            const existing = detectedMap.get(name)!;
            if (!existing.detectedIn.includes(file.path)) {
              existing.detectedIn.push(file.path);
            }
          }
        }
      }
    }

    // Simuler un délai pour l'effet visuel
    await new Promise(r => setTimeout(r, 1000));

    dispatch({
      type: "UPDATE_SECRETS",
      payload: {
        detectedSecrets: Array.from(detectedMap.values()),
        isScanned: true,
      },
    });
    setIsScanning(false);
  };

  const updateSecretAction = (index: number, action: DetectedSecret["action"]) => {
    dispatch({
      type: "UPDATE_SECRET_ITEM",
      payload: { index, updates: { action } },
    });
  };

  const updateSecretNewValue = (index: number, newValue: string) => {
    dispatch({
      type: "UPDATE_SECRET_ITEM",
      payload: { index, updates: { newValue } },
    });
  };

  const toggleShowValue = (index: number) => {
    setShowValues(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleContinue = () => {
    // Vérifier que tous les secrets à remplacer ont une nouvelle valeur
    const missingValues = state.secrets.detectedSecrets.filter(
      s => s.action === "replace" && !s.newValue.trim()
    );

    if (missingValues.length > 0) {
      toast.error(t("wizard.secrets.missingValues", { keys: missingValues.map(s => s.name).join(", ") }));
      return;
    }

    dispatch({
      type: "UPDATE_SECRETS",
      payload: { isValidated: true },
    });
    dispatch({
      type: "SET_STEP_STATUS",
      payload: { step: "secrets", status: "completed" },
    });
    dispatch({
      type: "SET_STEP_STATUS",
      payload: { step: "cleaning", status: "in_progress" },
    });
    nextStep();
  };

  const secretsToReplace = state.secrets.detectedSecrets.filter(s => s.action === "replace").length;
  const secretsToKeep = state.secrets.detectedSecrets.filter(s => s.action === "keep").length;
  const secretsToDelete = state.secrets.detectedSecrets.filter(s => s.action === "delete").length;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              {t("wizard.secrets.title")}
              {state.secrets.detectedSecrets.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {state.secrets.detectedSecrets.length} {t("wizard.secrets.detected")}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {t("wizard.secrets.description")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isScanning ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="relative">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-primary animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-medium">{t("wizard.secrets.scanning")}</p>
              <p className="text-sm text-muted-foreground">
                {t("wizard.secrets.scanningFiles", { count: state.cleaning.fetchedFiles.length })}
              </p>
            </div>
          </div>
        ) : state.secrets.detectedSecrets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-success" />
            </div>
            <div>
              <p className="font-medium text-lg">{t("wizard.secrets.noSecrets")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("wizard.secrets.noSecretsDescription")}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats rapides */}
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-primary">{secretsToReplace}</p>
                <p className="text-xs text-muted-foreground">{t("wizard.secrets.toReplace")}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-muted-foreground">{secretsToKeep}</p>
                <p className="text-xs text-muted-foreground">{t("wizard.secrets.toKeep")}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{secretsToDelete}</p>
                <p className="text-xs text-muted-foreground">{t("wizard.secrets.toDelete")}</p>
              </div>
            </div>

            {/* Avertissement */}
            <div className="flex items-start gap-3 rounded-lg bg-warning/10 border border-warning/30 p-4">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-warning">{t("wizard.secrets.importantWarning")}</p>
                <p className="text-muted-foreground mt-1">
                  {t("wizard.secrets.warningMessage")}
                </p>
              </div>
            </div>

            {/* Table des secrets */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">{t("wizard.secrets.variable")}</TableHead>
                    <TableHead className="w-[100px]">{t("wizard.secrets.category")}</TableHead>
                    <TableHead className="w-[120px]">{t("wizard.secrets.action")}</TableHead>
                    <TableHead>{t("wizard.secrets.newValue")}</TableHead>
                    <TableHead className="w-[80px] text-right">{t("wizard.secrets.files")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.secrets.detectedSecrets.map((secret, index) => {
                    const Icon = categoryIcons[secret.category];
                    return (
                      <TableRow key={secret.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {secret.name}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1 text-xs">
                            <Icon className="h-3 w-3" />
                            {categoryLabels[secret.category]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={secret.action}
                            onValueChange={(value) => updateSecretAction(index, value as DetectedSecret["action"])}
                          >
                            <SelectTrigger className="w-[110px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="keep">{t("wizard.secrets.keep")}</SelectItem>
                              <SelectItem value="replace">{t("wizard.secrets.replace")}</SelectItem>
                              <SelectItem value="delete">{t("wizard.secrets.delete")}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {secret.action === "replace" && (
                            <div className="flex items-center gap-2">
                              <Input
                                type={showValues[index] ? "text" : "password"}
                                placeholder={t("wizard.secrets.enterNewKey")}
                                value={secret.newValue}
                                onChange={(e) => updateSecretNewValue(index, e.target.value)}
                                className="h-8 text-xs font-mono"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => toggleShowValue(index)}
                              >
                                {showValues[index] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                          {secret.action === "keep" && (
                            <span className="text-xs text-muted-foreground italic">
                              {t("wizard.secrets.originalKept")}
                            </span>
                          )}
                          {secret.action === "delete" && (
                            <span className="text-xs text-destructive italic">
                              {t("wizard.secrets.willBeDeleted")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary" className="text-xs">
                            {secret.detectedIn.length}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={prevStep}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("wizard.secrets.back")}
          </Button>
          <Button onClick={handleContinue} disabled={isScanning}>
            {t("wizard.secrets.continueToClean")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
