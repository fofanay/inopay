import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Check, 
  Sparkles, 
  Zap, 
  Key, 
  Shield, 
  ArrowRight, 
  Loader2,
  Calculator,
  Building2,
  User,
  Infinity,
  FileCode,
  Rocket,
  Lock,
  SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Stripe Price IDs (actual IDs from Stripe)
const STRIPE_PRICES = {
  confort: "price_1ShZJ0BYLQpzPb0yKitTVhTg",
  souverain: "price_1ShZLLBYLQpzPb0yZIYAEbhA",
};

// Cost calculation constants
const COST_PER_FILE_CONFORT = 0.04; // Cost per file for Confort plan (includes margin)
const COST_PER_FILE_BYOK = 0.018; // Estimated token cost per file for BYOK
const PLATFORM_FEE_SOUVERAIN = 29; // Monthly platform fee for Souverain

const Upgrade = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
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

  const handleSelectPlan = async (plan: "confort" | "souverain") => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingPlan(plan);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      // If user selects "souverain", update their settings to unlock BYOK
      if (plan === "souverain") {
        await supabase
          .from("user_settings")
          .upsert({
            user_id: user.id,
            preferred_deploy_platform: "byok",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });
        
        toast({
          title: "Mode Souverain activé !",
          description: "Configurez votre clé API dans les paramètres",
        });
        
        // Navigate to settings to configure API key
        navigate("/parametres");
        return;
      }

      // For "confort" plan, create checkout session
      const response = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: STRIPE_PRICES[plan],
          mode: "subscription",
          serviceType: plan,
        },
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
      console.error("Checkout error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la session de paiement",
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
              <Sparkles className="h-3 w-3 mr-1" />
              Choisissez votre niveau de souveraineté
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold mb-4 text-foreground">
              Deux chemins vers la liberté
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Que vous préfériez la simplicité ou le contrôle total, Inopay s'adapte à vos besoins
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 max-w-5xl mx-auto">
            {/* Pack Confort */}
            <Card className="relative border-2 border-emerald-500/30 bg-gradient-to-b from-emerald-500/5 to-transparent hover:border-emerald-500/50 transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-emerald-500 text-white px-4 py-1">
                  <Zap className="h-3 w-3 mr-1" />
                  Recommandé
                </Badge>
              </div>

              <CardHeader className="text-center pt-10 pb-6">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Zap className="h-8 w-8 text-emerald-500" />
                </div>
                <CardTitle className="text-2xl md:text-3xl font-bold">Pack Confort</CardTitle>
                <CardDescription className="text-base flex items-center justify-center gap-2 mt-2">
                  <User className="h-4 w-4" />
                  Indépendants & Petits projets
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Price */}
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold text-foreground">49$</span>
                    <span className="text-muted-foreground">/ mois</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">ou par libération</p>
                </div>

                <Separator />

                {/* Features */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">Nettoyage automatique</p>
                      <p className="text-sm text-muted-foreground">Propulsé par DeepSeek V3</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <FileCode className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">Jusqu'à 500 fichiers</p>
                      <p className="text-sm text-muted-foreground">Idéal pour la plupart des projets</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Rocket className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">Déploiement IONOS en 1 clic</p>
                      <p className="text-sm text-muted-foreground">Configuration automatique</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-medium">Audit Zero Shadow Door</p>
                      <p className="text-sm text-muted-foreground">Certificat de souveraineté inclus</p>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-500/10 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-emerald-400">
                    ✨ Rien à configurer, on s'occupe des coûts d'IA
                  </p>
                </div>

                <Button 
                  className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleSelectPlan("confort")}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === "confort" ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Zap className="h-5 w-5 mr-2" />
                  )}
                  Commencer facilement
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* Pack Souverain */}
            <Card className="relative border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent hover:border-amber-500/50 transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 px-4 py-1">
                  <Key className="h-3 w-3 mr-1" />
                  BYOK -30%
                </Badge>
              </div>

              <CardHeader className="text-center pt-10 pb-6">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
                  <Key className="h-8 w-8 text-amber-500" />
                </div>
                <CardTitle className="text-2xl md:text-3xl font-bold">Pack Souverain</CardTitle>
                <CardDescription className="text-base flex items-center justify-center gap-2 mt-2">
                  <Building2 className="h-4 w-4" />
                  Agences, Startups & Gros projets
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Price */}
                <div className="text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold text-foreground">29$</span>
                    <span className="text-muted-foreground">/ mois</span>
                  </div>
                  <p className="text-sm text-amber-400 mt-1">Frais de plateforme réduits</p>
                </div>

                <Separator />

                {/* Features */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Infinity className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium">Volume Illimité</p>
                      <p className="text-sm text-muted-foreground">Vous payez vos tokens à la source</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Key className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium">Votre propre clé API</p>
                      <p className="text-sm text-muted-foreground">Claude, GPT-4, DeepSeek</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Shield className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium">Audit Zero Shadow Door avancé</p>
                      <p className="text-sm text-muted-foreground">Rapport détaillé complet</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Lock className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium">Chiffrement AES-256</p>
                      <p className="text-sm text-muted-foreground">Clés stockées via Supabase Vault</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/10 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-amber-400">
                    💰 Économisez jusqu'à 70% sur les gros volumes
                  </p>
                </div>

                <Button 
                  className="w-full h-12 text-base bg-amber-600 hover:bg-amber-700"
                  onClick={() => handleSelectPlan("souverain")}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === "souverain" ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Key className="h-5 w-5 mr-2" />
                  )}
                  Choisir la Souveraineté
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Cost Comparison Calculator */}
          <div className="mt-16 max-w-3xl mx-auto">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Comparateur de coûts interactif</h3>
                    <p className="text-sm text-muted-foreground">Ajustez le nombre de fichiers pour voir les économies en temps réel</p>
                  </div>
                </div>

                {/* Interactive File Count Slider */}
                <div className="bg-background rounded-lg p-4 border mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Nombre de fichiers</span>
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
                    <span>100 fichiers</span>
                    <span>5000 fichiers</span>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-background rounded-lg p-4 border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Pack Confort</span>
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                        <Zap className="h-3 w-3 mr-1" />
                        Simple
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">~{costs.confortTotal}$</p>
                    <p className="text-xs text-muted-foreground">Prix tout inclus</p>
                  </div>

                  <div className="bg-background rounded-lg p-4 border border-amber-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Pack Souverain</span>
                      <Badge className="bg-amber-500/20 text-amber-400 border-0">
                        <Key className="h-3 w-3 mr-1" />
                        BYOK
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">~{costs.souverainTotal}$</p>
                    <p className="text-xs text-muted-foreground">29$ + vos tokens (~{costs.byokTokens}$)</p>
                  </div>
                </div>

                {costs.savings > 0 ? (
                  <div className="mt-4 p-3 bg-success/10 rounded-lg text-center">
                    <p className="text-sm font-medium text-success">
                      ✅ L'option BYOK vous fait économiser <strong>~{costs.savings}$</strong> ({costs.savingsPercent}% d'économie)
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-emerald-500/10 rounded-lg text-center">
                    <p className="text-sm font-medium text-emerald-400">
                      ✨ Pour ce volume, le Pack Confort est optimal !
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Features List */}
          <div className="mt-12 max-w-3xl mx-auto">
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <div className="space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium">Zero Shadow Door</h4>
                <p className="text-sm text-muted-foreground">Audit de sécurité inclus sur chaque libération</p>
              </div>
              <div className="space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Rocket className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium">Déploiement automatisé</h4>
                <p className="text-sm text-muted-foreground">GitHub + VPS en quelques clics</p>
              </div>
              <div className="space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <h4 className="font-medium">Propriété totale</h4>
                <p className="text-sm text-muted-foreground">Votre code, vos serveurs, vos données</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-16 text-center">
            <Separator className="max-w-md mx-auto mb-6" />
            <p className="text-sm text-muted-foreground">
              Propulsé par l'infrastructure sécurisée de <strong>Inovaq Canada Inc.</strong>
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                SOC 2 Type II
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Chiffrement AES-256
              </Badge>
              <Badge variant="outline" className="text-xs">
                🇨🇦 Hébergé au Canada
              </Badge>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Upgrade;
