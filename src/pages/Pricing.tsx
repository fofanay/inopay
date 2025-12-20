import { Link, useNavigate } from "react-router-dom";
import { Check, Sparkles, Zap, Crown, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

// Stripe Price IDs
const STRIPE_PRICES = {
  pack: "price_1SgSlkBYLQpzPb0ynIeiT8Sg",
  pro: "price_1SgSm5BYLQpzPb0yq4oeLe5l",
};

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

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
          priceId: STRIPE_PRICES[plan],
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
      price: "19€",
      period: "par export",
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
      price: "39€",
      period: "/mois",
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
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Le scan et l'analyse sont gratuits. Payez uniquement pour libérer votre code.
            </p>
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
