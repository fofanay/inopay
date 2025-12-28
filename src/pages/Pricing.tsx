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

  const mainOffers = [
    {
      id: "free",
      name: t("pricingPage.free.name"),
      price: "0$",
      period: "",
      description: t("pricingPage.free.description"),
      icon: Sparkles,
      popular: false,
      features: [
        "Score de souveraineté complet",
        "Audit des dépendances propriétaires",
        "Prévisualisation du nettoyage IA",
        "Recommandations personnalisées",
      ],
      cta: user ? t("pricingPage.free.cta") : t("pricingPage.free.ctaLoggedIn"),
      action: () => navigate(user ? "/dashboard" : "/auth"),
    },
    {
      id: "liberationPack",
      name: "Liberation Pack",
      price: "79$",
      period: "one-time",
      description: "ZIP autonome prêt à déployer sur n'importe quel VPS",
      icon: FolderArchive,
      popular: true,
      features: [
        "Nettoyage IA exhaustif (10 passes)",
        "Score de souveraineté garanti > 95%",
        "ZIP autonome téléchargeable",
        "docker-compose.yml inclus",
        "Guide de déploiement HTML",
        "Polyfills générés automatiquement",
      ],
      cta: "Générer mon Liberation Pack",
      action: () => handleCheckout(STRIPE_PRICES.liberationPack, "liberationPack"),
    },
    {
      id: "enterprise",
      name: "Sur Mesure",
      price: "Sur devis",
      period: "",
      description: "Pour les gros projets (+50 fichiers) ou besoins spécifiques",
      icon: FileText,
      popular: false,
      features: [
        "Supplément calculé automatiquement",
        "Support dédié pendant migration",
        "Configuration backend incluse",
        "Migration base de données",
        "Consultation architecture",
        "SLA personnalisé",
      ],
      cta: "Nous contacter",
      action: () => window.open("mailto:support@inopay.io?subject=Liberation Pack Enterprise", "_blank"),
    },
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/5" />
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
            <Gift className="h-3 w-3 mr-1" />
            Modèle Simple & Transparent
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            <span className="text-foreground">Un prix. </span>
            <span className="text-primary">Une libération.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Pas d'abonnement mensuel obligatoire. Payez une fois, possédez votre code pour toujours.
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
                    POPULAIRE
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
                        {offer.period === "one-time" ? "paiement unique" : `/${offer.period}`}
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
                        Chargement...
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
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Comment ça marche ?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              De l'analyse à la production en 10 minutes
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: "1", title: "Analysez", desc: "Upload votre ZIP ou connectez GitHub", icon: Sparkles },
              { step: "2", title: "Nettoyez", desc: "L'IA supprime les dépendances propriétaires", icon: Zap },
              { step: "3", title: "Téléchargez", desc: "ZIP autonome prêt à déployer", icon: Download },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="relative inline-flex items-center justify-center mb-4">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-8 w-8 text-primary" />
                  </div>
                  <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's Included Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-muted text-muted-foreground">Liberation Pack</Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Ce que vous obtenez</h2>
            <p className="text-muted-foreground">Un pack autonome prêt à déployer n'importe où</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { icon: FolderArchive, title: "ZIP complet", desc: "Frontend + Backend + Config" },
              { icon: FileText, title: "docker-compose.yml", desc: "Déploiement en une commande" },
              { icon: Shield, title: "Code nettoyé", desc: "Aucune dépendance propriétaire" },
              { icon: Download, title: "Guide HTML", desc: "Instructions pas à pas" },
            ].map((item, index) => (
              <Card key={index} className="border-border hover:border-primary/50 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 items-center">
            {[
              { icon: Shield, text: "Zero-Knowledge" },
              { icon: Clock, text: "Déploiement en 10 min" },
              { icon: Package, text: "Code 100% à vous" },
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
            Prêt à libérer votre création ?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Analysez gratuitement votre projet et découvrez votre Vibe-Score™
          </p>
          <Link to={user ? "/dashboard" : "/auth"}>
            <Button size="lg" className="rounded-full px-8">
              {user ? "Aller au Dashboard" : "Commencer gratuitement"}
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
