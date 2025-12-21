import { Link, useNavigate } from "react-router-dom";
import { Check, Sparkles, Zap, Crown, ArrowRight, Loader2, Globe, Server, Rocket, Database, Shield, RefreshCw, Lock, Activity, Plus, Palette, Terminal } from "lucide-react";
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

// Stripe Price IDs par devise - Nouveaux prix à l'acte
const STRIPE_PRICES = {
  CAD: {
    deploy: "price_1Sgr7NBYLQpzPb0ym7lV0WLF",       // 99 CAD
    redeploy: "price_1Sgr89BYLQpzPb0yTaGeD7uk",    // 49 CAD
    monitoring: "price_1Sgr8iBYLQpzPb0yo15IvGVU",  // 19 CAD/mois
    server: "price_1Sgr9zBYLQpzPb0yZJS7N412",      // 79 CAD
  },
  USD: {
    deploy: "price_1Sgr7ZBYLQpzPb0yh5SJNTJE",      // 75 USD
    redeploy: "price_1Sgr8LBYLQpzPb0yX0NHl6PS",    // 39 USD
    monitoring: "price_1Sgr8rBYLQpzPb0yReXWuS1J",  // 15 USD/mois
    server: "price_1SgrAsBYLQpzPb0ybNWYjt2p",      // 59 USD
  },
  EUR: {
    deploy: "price_1Sgr7jBYLQpzPb0yGr6Sx9uC",      // 69 EUR
    redeploy: "price_1Sgr8VBYLQpzPb0y3MKtI4Gh",    // 35 EUR
    monitoring: "price_1Sgr9VBYLQpzPb0yX1LCrf4N",  // 13 EUR/mois
    server: "price_1SgrC6BYLQpzPb0yvYbly0EL",      // 55 EUR
  },
};

// Prix affichés par devise
const PRICES = {
  CAD: { 
    deploy: "99 $", 
    redeploy: "49 $", 
    monitoring: "19 $",
    server: "79 $",
    symbol: "CAD" 
  },
  USD: { 
    deploy: "75 $", 
    redeploy: "39 $", 
    monitoring: "15 $",
    server: "59 $",
    symbol: "USD" 
  },
  EUR: { 
    deploy: "69 €", 
    redeploy: "35 €", 
    monitoring: "13 €",
    server: "55 €",
    symbol: "EUR" 
  },
};

type ServiceType = "deploy" | "redeploy" | "monitoring" | "server";

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loadingService, setLoadingService] = useState<string | null>(null);
  const { currency, setCurrency } = useCurrencyDetection();

  const handleCheckout = async (serviceType: ServiceType) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setLoadingService(serviceType);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const isSubscription = serviceType === "monitoring";
      
      const response = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: STRIPE_PRICES[currency][serviceType],
          mode: isSubscription ? "subscription" : "payment",
          serviceType,
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
      setLoadingService(null);
    }
  };

  const services = [
    {
      id: "deploy" as ServiceType,
      name: "Déploiement VPS",
      description: "Du prototype IA à la production",
      price: PRICES[currency].deploy,
      period: `${PRICES[currency].symbol} / déploiement`,
      icon: Rocket,
      badge: "Vibe-to-Prod",
      popular: true,
      features: [
        "Zéro ligne de commande",
        "Docker + Coolify installés",
        "PostgreSQL configuré",
        "SSL Let's Encrypt inclus",
        "Monitoring 7 jours inclus",
        "Nettoyage IA du code",
      ],
      buttonText: "Libérer mon projet",
    },
    {
      id: "redeploy" as ServiceType,
      name: "Re-déploiement",
      description: "Mise à jour d'une app existante",
      price: PRICES[currency].redeploy,
      period: `${PRICES[currency].symbol} / mise à jour`,
      icon: RefreshCw,
      badge: null,
      popular: false,
      features: [
        "Mise à jour du code source",
        "Rebuild automatique",
        "Zero-downtime deployment",
        "Rollback si erreur",
        "Logs de déploiement",
      ],
      buttonText: "Mettre à jour",
    },
    {
      id: "monitoring" as ServiceType,
      name: "Extension Monitoring",
      description: "Surveillance continue après 7 jours",
      price: PRICES[currency].monitoring,
      period: `${PRICES[currency].symbol} / mois / app`,
      icon: Activity,
      badge: "Récurrent",
      popular: false,
      features: [
        "Monitoring 24/7 permanent",
        "Auto-restart prioritaire",
        "Alertes en temps réel",
        "Historique des pannes",
        "Support prioritaire",
      ],
      buttonText: "Étendre le monitoring",
    },
    {
      id: "server" as ServiceType,
      name: "Serveur Supplémentaire",
      description: "Ajoutez un VPS à votre compte",
      price: PRICES[currency].server,
      period: `${PRICES[currency].symbol} / serveur`,
      icon: Plus,
      badge: null,
      popular: false,
      features: [
        "Configuration complète",
        "Docker + Coolify",
        "PostgreSQL optionnel",
        "SSL automatique",
        "Monitoring 7 jours",
      ],
      buttonText: "Ajouter un serveur",
    },
  ];

  return (
    <Layout>
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          {/* Header - Vibecoder */}
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
              <Palette className="h-3 w-3 mr-1" />
              🎨 Vibe-to-Production
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Passez du prototype IA à votre infrastructure
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
              Sans abonnement piège. Sans ligne de commande. Sans complications.
            </p>
            <p className="text-lg text-primary font-medium">
              Analyse gratuite • Tarification transparente • Propriété totale
            </p>
            
            {/* Currency Selector */}
            <div className="flex items-center justify-center gap-3 mt-8">
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

          {/* Service Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {services.map((service) => (
              <Card 
                key={service.id}
                className={`relative card-shadow border-2 transition-all duration-300 ${
                  service.popular 
                    ? "border-primary bg-card scale-105" 
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {service.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className={`px-3 py-1 ${service.popular ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {service.badge}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pt-8 pb-4">
                  <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <service.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl text-foreground">{service.name}</CardTitle>
                  <CardDescription className="text-muted-foreground text-sm">
                    {service.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pb-6">
                  {/* Price */}
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold text-foreground">{service.price}</span>
                    <p className="text-sm text-muted-foreground mt-1">{service.period}</p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-6">
                    {service.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="h-4 w-4 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-2.5 w-2.5 text-success" />
                        </div>
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button with Badge */}
                  <Button
                    variant={service.popular ? "default" : "outline"}
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={() => handleCheckout(service.id)}
                    disabled={loadingService !== null}
                  >
                    {loadingService === service.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : service.popular ? (
                      <Badge variant="secondary" className="mr-2 text-xs bg-primary-foreground/20 text-primary-foreground border-0">
                        <Terminal className="h-3 w-3 mr-1" />
                        Zéro Terminal
                      </Badge>
                    ) : null}
                    {service.buttonText}
                    <ArrowRight className="h-3 w-3 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Value Comparison - Vibecoder */}
          <div className="mt-20 max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
                <Sparkles className="h-3 w-3 mr-1" />
                Divisez vos factures par 3
              </Badge>
              <h2 className="text-3xl font-bold mb-4 text-foreground">
                Comparez et économisez
              </h2>
              <p className="text-muted-foreground">
                Passez de l'abonnement mensuel au paiement unique
              </p>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px]">Solution</TableHead>
                    <TableHead className="text-center">Prix</TableHead>
                    <TableHead className="text-center">Ownership</TableHead>
                    <TableHead className="text-center">Temps</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-primary/5">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-primary">Inopay</span>
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">Vibe-Friendly</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-primary">{PRICES[currency].deploy}</TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center text-success font-medium">~10 min</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">DevOps Freelance</TableCell>
                    <TableCell className="text-center text-muted-foreground">150-300 $/h</TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center text-muted-foreground">4-8 heures</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Heroku / Railway</TableCell>
                    <TableCell className="text-center text-muted-foreground">20-50 $/mois</TableCell>
                    <TableCell className="text-center text-destructive">Non</TableCell>
                    <TableCell className="text-center text-muted-foreground">Variable</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Configuration manuelle</TableCell>
                    <TableCell className="text-center text-muted-foreground">Votre temps</TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center text-muted-foreground">1-2 jours</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Features Table */}
          <div className="mt-20 max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-4 text-foreground">
                Ce qui est inclus
              </h2>
              <p className="text-muted-foreground">
                Toutes nos fonctionnalités principales
              </p>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px]">Fonctionnalité</TableHead>
                    <TableHead className="text-center">Gratuit</TableHead>
                    <TableHead className="text-center bg-primary/5">Déploiement</TableHead>
                    <TableHead className="text-center">+ Monitoring</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        Analyse & Vibe-Score™
                      </div>
                    </TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center bg-primary/5"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        Docker + Coolify
                      </div>
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center bg-primary/5"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-muted-foreground" />
                        PostgreSQL
                      </div>
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center bg-primary/5"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-muted-foreground" />
                        SSL Let's Encrypt
                      </div>
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center bg-primary/5"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        Monitoring
                      </div>
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center bg-primary/5">7 jours</TableCell>
                    <TableCell className="text-center font-semibold text-primary">24/7 permanent</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                        Auto-restart
                      </div>
                    </TableCell>
                    <TableCell className="text-center">—</TableCell>
                    <TableCell className="text-center bg-primary/5"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center font-semibold text-primary">Prioritaire</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        Zero-Knowledge
                      </div>
                    </TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center bg-primary/5"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center"><Check className="h-4 w-4 text-success mx-auto" /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* CTA Section */}
          <div className="mt-20 max-w-3xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              Vibe-to-Production
            </Badge>
            <h2 className="text-3xl font-bold mb-6 text-foreground">
              Prêt à libérer votre création ?
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Analysez votre projet gratuitement et découvrez votre <span className="text-primary font-semibold">Vibe-Score™</span>.
            </p>
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button size="lg" className="text-lg px-10 py-7 rounded-xl shadow-lg hover:shadow-xl transition-all">
                <Badge variant="secondary" className="mr-2 text-xs bg-primary-foreground/20 text-primary-foreground border-0">
                  <Terminal className="h-3 w-3 mr-1" />
                  Zéro Terminal
                </Badge>
                <Rocket className="mr-2 h-5 w-5" />
                {user ? "Libérer mon projet" : "Commencer gratuitement"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Pricing;
