import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, FolderArchive, Gift, ArrowRight, Zap, Shield, Clock, Package, FileText, Download } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import PricingFAQ from "@/components/pricing/PricingFAQ";
import FofyChat from "@/components/FofyChat";

// Stripe Price ID pour Liberation Pack
const STRIPE_PRICES = {
  liberationPack: "price_1SidiQBYLQpzPb0ylzyXYhjj", // Liberation Pack 79$
};

const Pricing = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleCheckout = async (priceId: string, planName: string, mode: "payment" | "subscription" = "payment") => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingPlan(planName);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId, mode, serviceType: planName },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || "Erreur lors de la création du checkout",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  // Get translated features arrays
  const freeFeatures = t("pricingPage.free.features", { returnObjects: true }) as string[];
  const liberationFeatures = t("pricingPage.liberationPack.features", { returnObjects: true }) as string[];
  const enterpriseFeatures = t("pricingPage.enterprise.features", { returnObjects: true }) as string[];
  const processSteps = t("pricingPage.process.steps", { returnObjects: true }) as Array<{ step: string; title: string; desc: string }>;
  const whatsIncludedItems = t("pricingPage.whatsIncluded.items", { returnObjects: true }) as Array<{ title: string; desc: string }>;

  const mainOffers = [
    {
      id: "free",
      name: t("pricingPage.free.name"),
      price: "0$",
      period: "",
      description: t("pricingPage.free.description"),
      icon: Sparkles,
      popular: false,
      features: freeFeatures,
      cta: user ? t("pricingPage.free.ctaLoggedIn") : t("pricingPage.free.cta"),
      action: () => navigate(user ? "/dashboard" : "/auth"),
    },
    {
      id: "liberationPack",
      name: t("pricingPage.liberationPack.name"),
      price: t("pricingPage.liberationPack.price"),
      period: t("pricingPage.liberationPack.period"),
      description: t("pricingPage.liberationPack.description"),
      icon: FolderArchive,
      popular: true,
      features: liberationFeatures,
      cta: t("pricingPage.liberationPack.cta"),
      action: () => handleCheckout(STRIPE_PRICES.liberationPack, "liberationPack"),
    },
    {
      id: "enterprise",
      name: t("pricingPage.enterprise.name"),
      price: t("pricingPage.enterprise.price"),
      period: "",
      description: t("pricingPage.enterprise.description"),
      icon: FileText,
      popular: false,
      features: enterpriseFeatures,
      cta: t("pricingPage.enterprise.cta"),
      action: () => window.open("mailto:support@inopay.io?subject=Liberation Pack Enterprise", "_blank"),
    },
  ];

  const stepIcons = [Sparkles, Zap, Download];
  const includedIcons = [FolderArchive, FileText, Shield, Download];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
            <Gift className="h-3 w-3 mr-1" />
            {t("pricingPage.hero.badge")}
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            <span className="text-foreground">{t("pricingPage.hero.title1")} </span>
            <span className="text-primary">{t("pricingPage.hero.title2")}</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {t("pricingPage.hero.subtitle")}
          </p>
        </div>
      </section>

      {/* Main Offers */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {mainOffers.map((offer) => (
              <Card
                key={offer.id}
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl ${
                  offer.popular
                    ? "border-2 border-primary shadow-lg scale-[1.02]"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {offer.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-xs font-semibold rounded-bl-lg">
                    {t("pricingPage.popular")}
                  </div>
                )}
                <CardHeader className="pb-4 pt-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                      offer.popular ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                    }`}>
                      <offer.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{offer.name}</CardTitle>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-foreground">{offer.price}</span>
                    {offer.period && (
                      <span className="text-sm text-muted-foreground">
                        {offer.period === "one-time" ? t("pricingPage.oneTimePayment") : `/${offer.period}`}
                      </span>
                    )}
                  </div>
                  <CardDescription className="mt-3">{offer.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {offer.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={offer.action}
                    disabled={loadingPlan === offer.id}
                    className={`w-full ${
                      offer.popular
                        ? "bg-primary hover:bg-primary/90"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    }`}
                    size="lg"
                  >
                    {loadingPlan === offer.id ? (
                      <span className="flex items-center gap-2">
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        {t("pricingPage.loading")}
                      </span>
                    ) : (
                      <>
                        {offer.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section - 3 Steps */}
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">{t("pricingPage.process.title")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {t("pricingPage.process.subtitle")}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {processSteps.map((item, index) => {
              const IconComponent = stepIcons[index];
              return (
                <div key={index} className="text-center">
                  <div className="relative inline-flex items-center justify-center mb-4">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <IconComponent className="h-8 w-8 text-primary" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-muted text-muted-foreground">{t("pricingPage.whatsIncluded.badge")}</Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">{t("pricingPage.whatsIncluded.title")}</h2>
            <p className="text-muted-foreground">{t("pricingPage.whatsIncluded.subtitle")}</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {whatsIncludedItems.map((item, index) => {
              const IconComponent = includedIcons[index];
              return (
                <Card key={index} className="border-border hover:border-primary/50 transition-colors">
                  <CardContent className="p-6 text-center">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 items-center">
            {[
              { icon: Shield, text: t("pricingPage.trust.zeroKnowledge") },
              { icon: Clock, text: t("pricingPage.trust.deployment") },
              { icon: Package, text: t("pricingPage.trust.ownership") },
            ].map((badge, index) => (
              <div key={index} className="flex items-center gap-2 text-muted-foreground">
                <badge.icon className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{badge.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4 max-w-3xl">
          <PricingFAQ />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            {t("pricingPage.finalCta.title")}
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            {t("pricingPage.finalCta.subtitle")}
          </p>
          <Link to={user ? "/dashboard" : "/auth"}>
            <Button size="lg" className="rounded-full px-8">
              {user ? t("pricingPage.finalCta.buttonLoggedIn") : t("pricingPage.finalCta.button")}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      <FofyChat />
    </Layout>
  );
};

export default Pricing;
