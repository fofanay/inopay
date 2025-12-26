import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Rocket, Server, Activity, Gift, ArrowRight, Zap, Shield, Clock, Package, Crown } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import PricingFAQ from "@/components/pricing/PricingFAQ";
import FofyChat from "@/components/FofyChat";

// Stripe Price IDs - Nouveaux produits one-time
const STRIPE_PRICES = {
  liberation: "price_1SidiQBYLQpzPb0ylzyXYhjj", // Libération Unique 99$
  packPro: "price_1SidifBYLQpzPb0y2rStqOJb", // Pack Pro 149$
};

// Add-ons existants (gardés)
const STRIPE_ADDONS = {
  redeploy: "price_1Sd1YtBYLQpzPb0yQJhHvF0e", // Re-déploiement 39$
  monitoring: "price_1Sd1b2BYLQpzPb0y3xqFmOYS", // Monitoring mensuel 15$/mois
  server: "price_1Sd1cpBYLQpzPb0yMnPVnfSz", // Serveur VPS 59$
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
      name: "Analyse Gratuite",
      price: "0$",
      period: "",
      description: "Découvrez votre Vibe-Score™ et identifiez les dépendances propriétaires",
      icon: Sparkles,
      popular: false,
      features: [
        "Score de portabilité complet",
        "Audit des dépendances",
        "Prévisualisation du nettoyage",
        "Recommandations personnalisées",
      ],
      cta: user ? "Analyser mon projet" : "Commencer gratuitement",
      action: () => navigate(user ? "/dashboard" : "/auth"),
    },
    {
      id: "liberation",
      name: "Libération Unique",
      price: "99$",
      period: "one-time",
      description: "Nettoyage IA complet + Déploiement sur votre serveur",
      icon: Rocket,
      popular: true,
      features: [
        "Nettoyage IA de tout le code",
        "Suppression des dépendances propriétaires",
        "Export vers GitHub personnel",
        "Déploiement VPS assisté",
        "SSL + PostgreSQL inclus",
        "Support prioritaire 48h",
      ],
      cta: "Libérer mon projet",
      action: () => handleCheckout(STRIPE_PRICES.liberation, "liberation"),
    },
    {
      id: "packPro",
      name: "Pack Pro",
      price: "149$",
      originalPrice: "217$",
      period: "one-time",
      description: "Libération + VPS dédié + Monitoring 24/7 pendant 1 an",
      icon: Crown,
      popular: false,
      badge: "Économisez 68$",
      features: [
        "Tout de la Libération Unique",
        "VPS dédié configuré pour vous",
        "Monitoring 24/7 pendant 1 an",
        "Alertes instantanées",
        "Sauvegardes automatiques",
        "Support prioritaire illimité",
      ],
      cta: "Choisir le Pack Pro",
      action: () => handleCheckout(STRIPE_PRICES.packPro, "packPro"),
    },
  ];

  const addons = [
    {
      id: "redeploy",
      name: "Re-déploiement",
      price: "39$",
      description: "Mise à jour de votre application déployée",
      icon: Zap,
      action: () => handleCheckout(STRIPE_ADDONS.redeploy, "redeploy"),
    },
    {
      id: "monitoring",
      name: "Monitoring 24/7",
      price: "15$/mois",
      description: "Surveillance et alertes en temps réel",
      icon: Activity,
      action: () => handleCheckout(STRIPE_ADDONS.monitoring, "monitoring", "subscription"),
    },
    {
      id: "server",
      name: "Serveur VPS",
      price: "59$",
      description: "Configuration VPS supplémentaire",
      icon: Server,
      action: () => handleCheckout(STRIPE_ADDONS.server, "server"),
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
                {offer.badge && (
                  <div className="absolute top-0 left-0 bg-success text-success-foreground px-3 py-1 text-xs font-semibold rounded-br-lg">
                    {offer.badge}
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
                    {offer.originalPrice && (
                      <span className="text-lg text-muted-foreground line-through">{offer.originalPrice}</span>
                    )}
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
              { step: "3", title: "Déployez", desc: "Votre code tourne sur votre VPS", icon: Rocket },
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

      {/* Add-ons Section */}
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-muted text-muted-foreground">Options</Badge>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Besoin de plus ?</h2>
            <p className="text-muted-foreground">Services additionnels à la carte</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {addons.map((addon) => (
              <Card key={addon.id} className="border-border hover:border-primary/50 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <addon.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">{addon.name}</h3>
                  <p className="text-2xl font-bold text-primary mb-2">{addon.price}</p>
                  <p className="text-sm text-muted-foreground mb-4">{addon.description}</p>
                  <Button
                    variant="outline"
                    onClick={addon.action}
                    disabled={loadingPlan === addon.id}
                    className="w-full"
                  >
                    {loadingPlan === addon.id ? "Chargement..." : "Ajouter"}
                  </Button>
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
