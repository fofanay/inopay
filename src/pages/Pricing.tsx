import { Link, useNavigate } from "react-router-dom";
import { Check, Sparkles, Zap, Crown, ArrowRight, Loader2, Globe, Server, Rocket, Database, Shield, RefreshCw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useCurrencyDetection, type Currency } from "@/hooks/useCurrencyDetection";

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
  const { currency, setCurrency } = useCurrencyDetection();

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
      description: "Un déploiement VPS complet",
      price: PRICES[currency].pack,
      period: `${PRICES[currency].symbol} / déploiement`,
      badge: null,
      features: [
        "1 déploiement VPS complet",
        "Nettoyage IA du code",
        "Docker + Coolify installés",
        "SSL Let's Encrypt inclus",
        "PostgreSQL configuré",
        "Monitoring 7 jours",
        "Support par email",
      ],
      buttonText: "Déployer maintenant",
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
        "Déploiements VPS illimités",
        "Nettoyage IA prioritaire",
        "Docker + Coolify installés",
        "SSL Let's Encrypt inclus",
        "PostgreSQL configuré",
        "Monitoring permanent 24/7",
        "Auto-restart prioritaire",
        "Support dédié",
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
              Du code à la production
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Analyse gratuite. Payez uniquement pour déployer sur votre VPS.
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
                      <Rocket className="h-7 w-7 text-primary" />
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

          {/* Comparison Table */}
          <div className="mt-24 max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4 text-foreground">
                Comparaison détaillée
              </h2>
              <p className="text-muted-foreground">
                Toutes les fonctionnalités incluses par plan
              </p>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px]">Fonctionnalité</TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold">Gratuit</span>
                        <span className="text-xs text-muted-foreground">0 €</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold">Pack Liberté</span>
                        <span className="text-xs text-muted-foreground">{PRICES[currency].pack}</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center bg-primary/5">
                      <div className="flex flex-col items-center gap-1">
                        <Badge className="bg-primary text-primary-foreground text-xs">Populaire</Badge>
                        <span className="font-semibold">Pro</span>
                        <span className="text-xs text-muted-foreground">{PRICES[currency].pro}/mois</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        Analyse & Nettoyage IA
                      </div>
                    </TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center bg-primary/5"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        Déploiement VPS
                      </div>
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">1 déploiement</TableCell>
                    <TableCell className="text-center bg-primary/5 font-semibold">Illimité</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        PostgreSQL configuré
                      </div>
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center bg-primary/5"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        SSL Let's Encrypt
                      </div>
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center bg-primary/5"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        Monitoring
                      </div>
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center">7 jours</TableCell>
                    <TableCell className="text-center bg-primary/5 font-semibold">Permanent 24/7</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        Auto-restart
                      </div>
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center bg-primary/5 font-semibold">Prioritaire</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        Zero-Knowledge
                      </div>
                    </TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center bg-primary/5"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-16">
            <p className="text-muted-foreground mb-4">
              Pas encore sûr ? Analysez votre projet gratuitement.
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
