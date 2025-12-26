import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Key, Save, Loader2, Eye, EyeOff, CheckCircle2, CreditCard, ExternalLink, Calendar, Sparkles, Zap, Shield, Info, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Layout from "@/components/layout/Layout";
import { SovereignExit } from "@/components/dashboard/SovereignExit";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ApiProvider = "openai" | "anthropic" | "deepseek";

interface UserSettings {
  id?: string;
  api_provider: ApiProvider;
  api_key: string;
}

const Settings = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, loading: authLoading, subscription, checkSubscription } = useAuth();
  const { toast } = useToast();
  
  const [settings, setSettings] = useState<UserSettings>({
    api_provider: "openai",
    api_key: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  const handleManageSubscription = async () => {
    if (!user) return;
    
    setOpeningPortal(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("customer-portal", {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.url) {
        window.open(response.data.url, "_blank");
      }
    } catch (error) {
      console.error("Customer portal error:", error);
      toast({
        title: t("common.error"),
        description: t("errors.portalFailed"),
        variant: "destructive",
      });
    } finally {
      setOpeningPortal(false);
    }
  };

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
      });
      setHasExistingKey(!!data.api_key);
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
        title: t("common.error"),
        description: t("errors.saveFailed"),
        variant: "destructive",
      });
    } else {
      setHasExistingKey(!!settings.api_key || hasExistingKey);
      setSettings(prev => ({ ...prev, api_key: "" }));
      toast({
        title: t("common.success"),
        description: t("settings.settingsSaved"),
      });
    }
  };

  const handleClearKey = async () => {
    if (!user || !settings.id) return;

    setSaving(true);
    const { error } = await supabase
      .from("user_settings")
      .update({ api_key: null })
      .eq("id", settings.id);

    setSaving(false);

    if (error) {
      toast({
        title: t("common.error"),
        description: t("settings.unableToDeleteKey"),
        variant: "destructive",
      });
    } else {
      setHasExistingKey(false);
      toast({
        title: t("settings.keyDeleted"),
        description: t("settings.keyDeletedDesc"),
      });
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
              {t("settings.title")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t("settings.subtitle")}
            </p>
          </div>

          {/* Default Engine Info */}
          <Card className="mb-6 border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Zap className="h-6 w-6 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-emerald-400 mb-1">
                    {t("settings.defaultEngine")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.defaultEngineDesc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BYOK Card */}
          <Card className="animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {t("settings.apiKey")}
                <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-400 border-amber-500/30">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {t("common.byok")}
                </Badge>
              </CardTitle>
              <CardDescription>
                {t("settings.apiKeyDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* BYOK Discount Banner */}
              {hasExistingKey && (
                <Alert className="bg-amber-500/10 border-amber-500/30">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <AlertDescription className="text-amber-200">
                    <strong>{t("settings.byokDiscount")}</strong>{" "}
                    <span className="text-amber-400 font-bold">{t("settings.byokDiscountValue")}</span>{" "}
                    {t("settings.byokDiscountSuffix")}
                  </AlertDescription>
                </Alert>
              )}

              {/* Provider Selection */}
              <div className="space-y-3">
                <Label>{t("settings.provider")}</Label>
                <RadioGroup
                  value={settings.api_provider}
                  onValueChange={(value: ApiProvider) => 
                    setSettings(prev => ({ ...prev, api_provider: value }))
                  }
                  className="grid grid-cols-3 gap-3"
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
                      <span className="text-xs text-muted-foreground">GPT-4o</span>
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
                      <span className="text-xs text-muted-foreground">Claude 4</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem
                      value="deepseek"
                      id="deepseek"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="deepseek"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-emerald-500 [&:has([data-state=checked])]:border-emerald-500 cursor-pointer"
                    >
                      <span className="text-lg font-semibold">DeepSeek</span>
                      <span className="text-xs text-emerald-400">{t("settings.recommended")}</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* API Key Input */}
              <div className="space-y-3">
                <Label htmlFor="api-key">
                  {settings.api_provider === "openai" ? "OpenAI" : settings.api_provider === "anthropic" ? "Anthropic" : "DeepSeek"} API Key
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{t("settings.keyConfigured")}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearKey}
                      className="text-destructive hover:text-destructive"
                    >
                      {t("settings.deleteKey")}
                    </Button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {t("settings.getKeyAt")}{" "}
                  {settings.api_provider === "openai" 
                    ? "platform.openai.com" 
                    : settings.api_provider === "anthropic"
                    ? "console.anthropic.com"
                    : "platform.deepseek.com"}
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
                    {t("common.saving")}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t("common.save")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Security Card */}
          <Card className="mt-6 border-blue-500/20 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Shield className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-400 mb-1">
                    {t("settings.fallback")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("settings.fallbackDesc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Management Card */}
          {subscription.subscribed && (
            <Card className="mt-6 animate-fade-in">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {t("settings.manageSubscription")}
                </CardTitle>
                <CardDescription>
                  {t("settings.manageSubscriptionDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t("settings.currentPlan")}</span>
                      <Badge variant="secondary" className="capitalize">
                        {subscription.planType}
                      </Badge>
                    </div>
                    {subscription.subscriptionEnd && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {t("settings.renewalDate")} {new Date(subscription.subscriptionEnd).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {subscription.creditsRemaining !== undefined && subscription.creditsRemaining > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {subscription.creditsRemaining} {t("settings.creditsRemaining")}
                      </p>
                    )}
                  </div>
                </div>
                
                <Separator />
                
                <Button 
                  onClick={handleManageSubscription}
                  disabled={openingPortal}
                  variant="outline"
                  className="w-full"
                >
                  {openingPortal ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("settings.openingPortal")}
                    </>
                  ) : (
                    <>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {t("settings.openPortal")}
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {t("settings.modifyPayment")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="mt-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-semibold mb-2">{t("settings.howItWorks")}</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li><strong>{t("settings.howItWorksDefault")}</strong> {t("settings.howItWorksDefaultDesc")}</li>
                    <li><strong>{t("settings.howItWorksByok")}</strong> {t("settings.howItWorksByokDesc")}</li>
                    <li><strong>{t("settings.howItWorksFallback")}</strong> {t("settings.howItWorksFallbackDesc")}</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sovereign Exit Card */}
          <Card className="mt-6 border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-400" />
                {t("settings.sovereignExit", "Sovereign Exit")}
              </CardTitle>
              <CardDescription>
                {t("settings.sovereignExitDesc", "Inopay garantit votre liberté : vous pouvez partir à tout moment avec vos données et votre code.")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SovereignExit />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
