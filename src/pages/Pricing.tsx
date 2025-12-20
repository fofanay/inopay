import { Link, useNavigate } from "react-router-dom";
import { Check, Sparkles, Zap, Crown, ArrowRight, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

type Currency = "CAD" | "USD" | "EUR";

// Stripe Price IDs par devise
const STRIPE_PRICES = {
  CAD: {
    pack: "price_1SgW6QBYLQpzPb0yYfYxAJi9",
    pro: "price_1SgW77BYLQpzPb0yxdMiBRH7",
  },
  USD: {
    pack: "price_1SgW8wBYLQpzPb0yGCJTwpfm",
    pro: "price_1SgW9BBYLQpzPb0yiSXKXl15",
  },
  EUR: {
    pack: "price_1SgSlkBYLQpzPb0ynIeiT8Sg",
    pro: "price_1SgSm5BYLQpzPb0yq4oeLe5l",
  },
};

// Prix affichés par devise
const PRICES = {
  CAD: { pack: "29 $", pro: "59 $", symbol: "CAD" },
  USD: { pack: "21 $", pro: "43 $", symbol: "USD" },
  EUR: { pack: "19 €", pro: "39 €", symbol: "EUR" },
};

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("CAD");

  const handleCheckout = async (plan: "pack" | "pro") => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingPlan(plan);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: STRIPE_PRICES[currency][plan],
          mode: plan === "pro" ? "subscription" : "payment",
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

  const plans = [
    {
      id: "pack",
      name: "Pack Liberté",
      description: "Parfait pour un projet unique",
      price: PRICES[currency].pack,
      period: `${PRICES[currency].symbol} / export`,
      badge: null,
      features: [
        "1 export de projet complet",
        "Nettoyage IA inclus",
        "Configuration Docker",
        "Support par email",
      ],
      buttonText: "Acheter le Pack",
      buttonVariant: "outline" as const,
      popular: false,
    },
    {
      id: "pro",
      name: "Pro Illimité",
      description: "Pour les créateurs prolifiques",
      price: PRICES[currency].pro,
      period: `${PRICES[currency].symbol} / mois`,
      badge: "Populaire",
      features: [
        "Exports illimités",
        "Nettoyage IA prioritaire",
        "Configuration Docker",
        "Push vers GitHub",
        "Support prioritaire",
        "Nouvelles fonctionnalités en avant-première",
      ],
      buttonText: "Devenir Pro",
      buttonVariant: "default" as const,
      popular: true,
    },
  ];

  return (
    <Layout>
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
              <Crown className="h-3 w-3 mr-1" />
              Tarification simple
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Choisissez votre liberté
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Le scan et l'analyse sont gratuits. Payez uniquement pour libérer votre code.
            </p>
            
            {/* Currency Selector */}
            <div className="flex items-center justify-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <Select value={currency} onValueChange={(value: Currency) => setCurrency(value)}>
                <SelectTrigger className="w-[140px]">
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

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <Card 
                key={plan.id}
                className={`relative card-shadow border-2 transition-all duration-300 ${
                  plan.popular 
                    ? "border-primary bg-card scale-105 md:scale-110" 
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      {plan.badge}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pt-8 pb-4">
                  <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    {plan.popular ? (
                      <Zap className="h-7 w-7 text-primary" />
                    ) : (
                      <Sparkles className="h-7 w-7 text-primary" />
                    )}
                  </div>
                  <CardTitle className="text-2xl text-foreground">{plan.name}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pb-8">
                  {/* Price */}
                  <div className="text-center mb-8">
                    <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground ml-1">{plan.period}</span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3">
                        <div className="h-5 w-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                          <Check className="h-3 w-3 text-success" />
                        </div>
                        <span className="text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <Button
                    variant={plan.buttonVariant}
                    size="lg"
                    className={`w-full rounded-xl ${
                      plan.popular ? "shadow-lg hover:shadow-xl" : ""
                    }`}
                    onClick={() => handleCheckout(plan.id as "pack" | "pro")}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === plan.id ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : null}
                    {plan.buttonText}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-16">
            <p className="text-muted-foreground mb-4">
              Pas encore sûr ? Testez gratuitement le scan de votre projet.
            </p>
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button variant="outline" size="lg" className="rounded-xl">
                Analyser mon projet gratuitement
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Pricing;
