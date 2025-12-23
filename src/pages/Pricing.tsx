import { Link, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { 
  Check, Sparkles, Zap, ArrowRight, Loader2, Globe, Key, 
  Shield, Rocket, Lock, Activity, Building2, User, Infinity,
  FileCode, Calculator, SlidersHorizontal, RefreshCw, Plus, 
  Palette, Terminal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import Layout from "@/components/layout/Layout";
import FofyChat from "@/components/FofyChat";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrencyDetection, type Currency } from "@/hooks/useCurrencyDetection";
import { useTranslation } from "react-i18next";

// Stripe Price IDs - Packs principaux
const STRIPE_PACKS = {
  confort: "price_1ShZJ0BYLQpzPb0yKitTVhTg",
  souverain: "price_1ShZLLBYLQpzPb0yZIYAEbhA",
};

// Stripe Price IDs - Add-ons par devise
const STRIPE_ADDONS = {
  CAD: {
    redeploy: "price_1Sgr89BYLQpzPb0yTaGeD7uk",    // 49 CAD
    monitoring: "price_1Sgr8iBYLQpzPb0yo15IvGVU",  // 19 CAD/mois
    server: "price_1Sgr9zBYLQpzPb0yZJS7N412",      // 79 CAD
  },
  USD: {
    redeploy: "price_1Sgr8LBYLQpzPb0yX0NHl6PS",    // 39 USD
    monitoring: "price_1Sgr8rBYLQpzPb0yReXWuS1J",  // 15 USD/mois
    server: "price_1SgrAsBYLQpzPb0ybNWYjt2p",      // 59 USD
  },
  EUR: {
    redeploy: "price_1Sgr8VBYLQpzPb0y3MKtI4Gh",    // 35 EUR
    monitoring: "price_1Sgr9VBYLQpzPb0yX1LCrf4N",  // 13 EUR/mois
    server: "price_1SgrC6BYLQpzPb0yvYbly0EL",      // 55 EUR
  },
};

// Prix affichés par devise pour les add-ons
const ADDON_PRICES = {
  CAD: { redeploy: "49 $", monitoring: "19 $", server: "79 $", symbol: "CAD" },
  USD: { redeploy: "39 $", monitoring: "15 $", server: "59 $", symbol: "USD" },
  EUR: { redeploy: "35 €", monitoring: "13 €", server: "55 €", symbol: "EUR" },
};

// Cost calculation constants
const COST_PER_FILE_CONFORT = 0.04;
const COST_PER_FILE_BYOK = 0.018;
const PLATFORM_FEE_SOUVERAIN = 29;

type AddonType = "redeploy" | "monitoring" | "server";

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const { currency, setCurrency } = useCurrencyDetection();
  const [fileCount, setFileCount] = useState<number[]>([2000]);

  // Calculate costs based on file count
  const costs = useMemo(() => {
    const files = fileCount[0];
    const confortTotal = Math.max(49, Math.ceil(files * COST_PER_FILE_CONFORT));
    const byokTokens = Math.ceil(files * COST_PER_FILE_BYOK);
    const souverainTotal = PLATFORM_FEE_SOUVERAIN + byokTokens;
    const savings = confortTotal - souverainTotal;
    const savingsPercent = Math.round((savings / confortTotal) * 100);
    
    return {
      confortTotal,
      souverainTotal,
      byokTokens,
      savings: Math.max(0, savings),
      savingsPercent: Math.max(0, savingsPercent),
    };
  }, [fileCount]);

  const handleSelectPack = async (plan: "confort" | "souverain") => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingPlan(plan);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (plan === "souverain") {
        await supabase
          .from("user_settings")
          .upsert({
            user_id: user.id,
            preferred_deploy_platform: "byok",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        
        toast({
          title: t('pricing.souverain.activatedTitle'),
          description: t('pricing.souverain.activatedDesc'),
        });
        
        navigate("/parametres");
        return;
      }

      const response = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: STRIPE_PACKS[plan],
          mode: "subscription",
          serviceType: plan,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.url) window.open(response.data.url, "_blank");
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: t('common.error'),
        description: t('errors.checkoutFailed'),
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleAddonCheckout = async (addonType: AddonType) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingPlan(addonType);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const isSubscription = addonType === "monitoring";
      
      const response = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: STRIPE_ADDONS[currency][addonType],
          mode: isSubscription ? "subscription" : "payment",
          serviceType: addonType,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.url) window.open(response.data.url, "_blank");
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: t('common.error'),
        description: t('errors.checkoutFailed'),
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Layout>
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-12 md:mb-16">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Palette className="h-3 w-3 mr-1" />
              🎨 {t('hero.vibeToProduction')}
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
              {t('pricing.unified.title')}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-2">
              {t('pricing.unified.subtitle')}
            </p>
            <p className="text-sm md:text-base text-primary font-medium">
              {t('pricing.features')}
            </p>
            
            {/* Currency Selector */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <Select value={currency} onValueChange={(value: Currency) => setCurrency(value)}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Devise" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">🇨🇦 CAD</SelectItem>
                  <SelectItem value="USD">🇺🇸 USD</SelectItem>
                  <SelectItem value="EUR">🇪🇺 EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Main Packs */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto mb-16">
            {/* Pack Confort */}
            <Card className="relative border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent hover:border-emerald-500/50 transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-emerald-500 text-white px-4 py-1">
                  <Zap className="h-3 w-3 mr-1" />
                  {t('pricing.confort.badge')}
                </Badge>
              </div>

              <CardHeader className="text-center pt-10 pb-6">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Zap className="h-8 w-8 text-emerald-500" />
                </div>
                <CardTitle className="text-2xl md:text-3xl font-bold">{t('pricing.confort.name')}</CardTitle>
                <CardDescription className="text-base flex items-center justify-center gap-2 mt-2">
                  <User className="h-4 w-4" />
                  {t('pricing.confort.target')}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold text-foreground">49$</span>
                    <span className="text-muted-foreground">/ {t('common.month')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{t('pricing.confort.priceNote')}</p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">{t('pricing.confort.feature1')}</p>
                      <p className="text-sm text-muted-foreground">{t('pricing.confort.feature1Desc')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <FileCode className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">{t('pricing.confort.feature2')}</p>
                      <p className="text-sm text-muted-foreground">{t('pricing.confort.feature2Desc')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Rocket className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">{t('pricing.confort.feature3')}</p>
                      <p className="text-sm text-muted-foreground">{t('pricing.confort.feature3Desc')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">{t('pricing.confort.feature4')}</p>
                      <p className="text-sm text-muted-foreground">{t('pricing.confort.feature4Desc')}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-500/10 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-emerald-400">
                    ✨ {t('pricing.confort.highlight')}
                  </p>
                </div>

                <Button 
                  className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleSelectPack("confort")}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === "confort" ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-5 w-5 mr-2" />
                  )}
                  {t('pricing.confort.cta')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Pack Souverain */}
            <Card className="relative border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent hover:border-amber-500/50 transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 px-4 py-1">
                  <Key className="h-3 w-3 mr-1" />
                  {t('pricing.souverain.badge')}
                </Badge>
              </div>

              <CardHeader className="text-center pt-10 pb-6">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                  <Key className="h-8 w-8 text-amber-500" />
                </div>
                <CardTitle className="text-2xl md:text-3xl font-bold">{t('pricing.souverain.name')}</CardTitle>
                <CardDescription className="text-base flex items-center justify-center gap-2 mt-2">
                  <Building2 className="h-4 w-4" />
                  {t('pricing.souverain.target')}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold text-foreground">29$</span>
                    <span className="text-muted-foreground">/ {t('common.month')}</span>
                  </div>
                  <p className="text-sm text-amber-400 mt-1">{t('pricing.souverain.priceNote')}</p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Infinity className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium">{t('pricing.souverain.feature1')}</p>
                      <p className="text-sm text-muted-foreground">{t('pricing.souverain.feature1Desc')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Key className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium">{t('pricing.souverain.feature2')}</p>
                      <p className="text-sm text-muted-foreground">{t('pricing.souverain.feature2Desc')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium">{t('pricing.souverain.feature3')}</p>
                      <p className="text-sm text-muted-foreground">{t('pricing.souverain.feature3Desc')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Lock className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium">{t('pricing.souverain.feature4')}</p>
                      <p className="text-sm text-muted-foreground">{t('pricing.souverain.feature4Desc')}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/10 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-amber-400">
                    💰 {t('pricing.souverain.highlight')}
                  </p>
                </div>

                <Button 
                  className="w-full h-12 text-base bg-amber-600 hover:bg-amber-700"
                  onClick={() => handleSelectPack("souverain")}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === "souverain" ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Key className="h-5 w-5 mr-2" />
                  )}
                  {t('pricing.souverain.cta')}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Cost Comparison Calculator */}
          <div className="max-w-3xl mx-auto mb-16">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{t('pricing.calculator.title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('pricing.calculator.subtitle')}</p>
                  </div>
                </div>

                <div className="bg-background rounded-lg p-4 border mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{t('pricing.calculator.fileCount')}</span>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      <FileCode className="h-4 w-4 mr-1" />
                      {fileCount[0].toLocaleString()}
                    </Badge>
                  </div>
                  <Slider
                    value={fileCount}
                    onValueChange={setFileCount}
                    min={100}
                    max={5000}
                    step={100}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>100 {t('pricing.calculator.files')}</span>
                    <span>5000 {t('pricing.calculator.files')}</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-background rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{t('pricing.confort.name')}</span>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                        <Zap className="h-3 w-3 mr-1" />
                        {t('pricing.calculator.simple')}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">~{costs.confortTotal}$</p>
                    <p className="text-xs text-muted-foreground">{t('pricing.calculator.allInclusive')}</p>
                  </div>

                  <div className="bg-background rounded-lg p-4 border border-amber-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{t('pricing.souverain.name')}</span>
                      <Badge className="bg-amber-500/20 text-amber-400 border-0">
                        <Key className="h-3 w-3 mr-1" />
                        BYOK
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">~{costs.souverainTotal}$</p>
                    <p className="text-xs text-muted-foreground">29$ + {t('pricing.calculator.yourTokens')} (~{costs.byokTokens}$)</p>
                  </div>
                </div>

                {costs.savings > 0 && (
                  <div className="mt-4 p-3 bg-success/10 rounded-lg text-center">
                    <p className="text-sm font-medium text-success">
                      🎉 {t('pricing.calculator.savingsPrefix')} {costs.savings}$ ({costs.savingsPercent}%) {t('pricing.calculator.savingsSuffix')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Add-ons Section */}
          <div className="max-w-5xl mx-auto mb-16">
            <div className="text-center mb-8">
              <Badge className="mb-4 bg-secondary/50 text-secondary-foreground border-secondary/30">
                <Plus className="h-3 w-3 mr-1" />
                {t('pricing.addons.badge')}
              </Badge>
              <h2 className="text-2xl md:text-3xl font-bold mb-2 text-foreground">
                {t('pricing.addons.title')}
              </h2>
              <p className="text-muted-foreground">
                {t('pricing.addons.subtitle')}
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Redeploy */}
              <Card className="border hover:border-primary/50 transition-all">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <RefreshCw className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{t('pricing.redeploy.name')}</CardTitle>
                  <CardDescription className="text-sm">{t('pricing.redeploy.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <span className="text-3xl font-bold">{ADDON_PRICES[currency].redeploy}</span>
                    <span className="text-sm text-muted-foreground"> / {t('common.perUpdate')}</span>
                  </div>
                  <ul className="space-y-2 mb-4 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {t('pricing.redeploy.feature1')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {t('pricing.redeploy.feature2')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {t('pricing.redeploy.feature3')}
                    </li>
                  </ul>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleAddonCheckout("redeploy")}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === "redeploy" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t('pricing.redeploy.cta')}
                  </Button>
                </CardContent>
              </Card>

              {/* Monitoring */}
              <Card className="border hover:border-primary/50 transition-all">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Activity className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{t('pricing.monitoring.name')}</CardTitle>
                  <CardDescription className="text-sm">{t('pricing.monitoring.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <span className="text-3xl font-bold">{ADDON_PRICES[currency].monitoring}</span>
                    <span className="text-sm text-muted-foreground"> / {t('common.month')} / {t('common.perApp')}</span>
                  </div>
                  <ul className="space-y-2 mb-4 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {t('pricing.monitoring.feature1')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {t('pricing.monitoring.feature2')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {t('pricing.monitoring.feature3')}
                    </li>
                  </ul>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleAddonCheckout("monitoring")}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === "monitoring" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t('pricing.monitoring.cta')}
                  </Button>
                </CardContent>
              </Card>

              {/* Server */}
              <Card className="border hover:border-primary/50 transition-all">
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{t('pricing.server.name')}</CardTitle>
                  <CardDescription className="text-sm">{t('pricing.server.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-4">
                    <span className="text-3xl font-bold">{ADDON_PRICES[currency].server}</span>
                    <span className="text-sm text-muted-foreground"> / {t('common.perServer')}</span>
                  </div>
                  <ul className="space-y-2 mb-4 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {t('pricing.server.feature1')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {t('pricing.server.feature2')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-success" />
                      {t('pricing.server.feature3')}
                    </li>
                  </ul>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleAddonCheckout("server")}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === "server" ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t('pricing.server.cta')}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* CTA Section */}
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              Vibe-to-Production
            </Badge>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              {t('cta.title')}
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              {t('cta.description')}
            </p>
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button size="lg" className="text-lg px-10 py-7 rounded-xl shadow-lg hover:shadow-xl transition-all">
                <Badge variant="secondary" className="mr-2 text-xs bg-primary-foreground/20 text-primary-foreground border-0">
                  <Terminal className="h-3 w-3 mr-1" />
                  {t('features.noTerminal.badge')}
                </Badge>
                <Rocket className="mr-2 h-5 w-5" />
                {user ? t('cta.buttonLoggedIn') : t('cta.button')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <FofyChat />
    </Layout>
  );
};

export default Pricing;
