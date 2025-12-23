import { Link, useNavigate } from "react-router-dom";
import { Check, Sparkles, Zap, Crown, ArrowRight, Loader2, Globe, Server, Rocket, Database, Shield, RefreshCw, Lock, Activity, Plus, Palette, Terminal, Briefcase, Infinity } from "lucide-react";
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
import { useTranslation } from "react-i18next";

// Stripe Price IDs par devise - Services à l'acte + Portfolio
const STRIPE_PRICES = {
  CAD: {
    deploy: "price_1Sgr7NBYLQpzPb0ym7lV0WLF",       // 99 CAD
    redeploy: "price_1Sgr89BYLQpzPb0yTaGeD7uk",    // 49 CAD
    monitoring: "price_1Sgr8iBYLQpzPb0yo15IvGVU",  // 19 CAD/mois
    server: "price_1Sgr9zBYLQpzPb0yZJS7N412",      // 79 CAD
    portfolio: "price_1SgxUoBYLQpzPb0yLXch6nNE",   // 299 CAD/mois
  },
  USD: {
    deploy: "price_1Sgr7ZBYLQpzPb0yh5SJNTJE",      // 75 USD
    redeploy: "price_1Sgr8LBYLQpzPb0yX0NHl6PS",    // 39 USD
    monitoring: "price_1Sgr8rBYLQpzPb0yReXWuS1J",  // 15 USD/mois
    server: "price_1SgrAsBYLQpzPb0ybNWYjt2p",      // 59 USD
    portfolio: "price_1SgxVQBYLQpzPb0yrDdpeaAA",   // 225 USD/mois
  },
  EUR: {
    deploy: "price_1Sgr7jBYLQpzPb0yGr6Sx9uC",      // 69 EUR
    redeploy: "price_1Sgr8VBYLQpzPb0y3MKtI4Gh",    // 35 EUR
    monitoring: "price_1Sgr9VBYLQpzPb0yX1LCrf4N",  // 13 EUR/mois
    server: "price_1SgrC6BYLQpzPb0yvYbly0EL",      // 55 EUR
    portfolio: "price_1SgxVcBYLQpzPb0yKFI4yyEd",   // 199 EUR/mois
  },
};

// Prix affichés par devise
const PRICES = {
  CAD: { 
    deploy: "99 $", 
    redeploy: "49 $", 
    monitoring: "19 $",
    server: "79 $",
    portfolio: "299 $",
    symbol: "CAD" 
  },
  USD: { 
    deploy: "75 $", 
    redeploy: "39 $", 
    monitoring: "15 $",
    server: "59 $",
    portfolio: "225 $",
    symbol: "USD" 
  },
  EUR: { 
    deploy: "69 €", 
    redeploy: "35 €", 
    monitoring: "13 €",
    server: "55 €",
    portfolio: "199 €",
    symbol: "EUR" 
  },
};

type ServiceType = "deploy" | "redeploy" | "monitoring" | "server" | "portfolio";

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
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
      
      const isSubscription = serviceType === "monitoring" || serviceType === "portfolio";
      
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
        title: t('common.error'),
        description: t('errors.checkoutFailed'),
        variant: "destructive",
      });
    } finally {
      setLoadingService(null);
    }
  };

  const services = [
    {
      id: "portfolio" as ServiceType,
      name: t('pricing.portfolio.name'),
      description: t('pricing.portfolio.description'),
      price: PRICES[currency].portfolio,
      period: `${PRICES[currency].symbol} / ${t('common.month') || 'mois'}`,
      icon: Briefcase,
      badge: t('pricing.portfolio.badge'),
      popular: true,
      features: [
        t('pricing.portfolio.feature1'),
        t('pricing.portfolio.feature2'),
        t('pricing.portfolio.feature3'),
        t('pricing.portfolio.feature4'),
        t('pricing.portfolio.feature5'),
        t('pricing.portfolio.feature6'),
      ],
      buttonText: t('pricing.portfolio.cta'),
    },
    {
      id: "deploy" as ServiceType,
      name: t('pricing.deploy.name'),
      description: t('pricing.deploy.description'),
      price: PRICES[currency].deploy,
      period: `${PRICES[currency].symbol} / ${t('pricing.perDeployment') || 'déploiement'}`,
      icon: Rocket,
      badge: t('pricing.deploy.badge'),
      popular: false,
      features: [
        t('pricing.deploy.feature1'),
        t('pricing.deploy.feature2'),
        t('pricing.deploy.feature3'),
        t('pricing.deploy.feature4'),
        t('pricing.deploy.feature5'),
        t('pricing.deploy.feature6'),
      ],
      buttonText: t('pricing.deploy.cta'),
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
      <section className="py-16 md:py-24 lg:py-32">
        <div className="container mx-auto px-4">
          {/* Header - Vibecoder */}
          <div className="text-center mb-10 md:mb-16">
            <Badge className="mb-4 md:mb-6 bg-primary/10 text-primary border-primary/20">
              <Palette className="h-3 w-3 mr-1" />
              🎨 Vibe-to-Production
            </Badge>
            <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6 text-foreground">
              {t('pricing.title')}
            </h1>
            <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto mb-3 md:mb-4">
              {t('pricing.subtitle')}
            </p>
            <p className="text-sm md:text-lg text-primary font-medium">
              {t('pricing.features')}
            </p>
            
            {/* Currency Selector */}
            <div className="flex items-center justify-center gap-3 mt-6 md:mt-8">
              <Globe className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
              <Select value={currency} onValueChange={(value: Currency) => setCurrency(value)}>
                <SelectTrigger className="w-[120px] md:w-[140px]">
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

          {/* Service Cards Grid - Stack on mobile, 2 cols on tablet, 5 on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 max-w-7xl mx-auto">
            {services.map((service) => (
              <Card 
                key={service.id}
                className={`relative card-shadow border-2 transition-all duration-300 ${
                  service.popular 
                    ? "border-primary bg-card sm:scale-105" 
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {service.badge && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                    <Badge className={`px-2 md:px-3 py-0.5 md:py-1 text-xs ${service.popular ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {service.badge}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pt-6 md:pt-8 pb-3 md:pb-4">
                  <div className="mx-auto h-10 w-10 md:h-12 md:w-12 rounded-lg md:rounded-xl bg-primary/10 flex items-center justify-center mb-3 md:mb-4">
                    <service.icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg md:text-xl text-foreground">{service.name}</CardTitle>
                  <CardDescription className="text-muted-foreground text-xs md:text-sm">
                    {service.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pb-4 md:pb-6">
                  {/* Price */}
                  <div className="text-center mb-4 md:mb-6">
                    <span className="text-3xl md:text-4xl font-bold text-foreground">{service.price}</span>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1">{service.period}</p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                    {service.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <div className="h-3.5 w-3.5 md:h-4 md:w-4 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-2 w-2 md:h-2.5 md:w-2.5 text-success" />
                        </div>
                        <span className="text-xs md:text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button with Badge */}
                  <Button
                    variant={service.popular ? "default" : "outline"}
                    size="sm"
                    className="w-full rounded-lg md:rounded-xl text-xs md:text-sm"
                    onClick={() => handleCheckout(service.id)}
                    disabled={loadingService !== null}
                  >
                    {loadingService === service.id ? (
                      <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin mr-2" />
                    ) : service.popular ? (
                      <Badge variant="secondary" className="mr-1 md:mr-2 text-[10px] md:text-xs bg-primary-foreground/20 text-primary-foreground border-0 hidden sm:inline-flex">
                        <Terminal className="h-2.5 w-2.5 md:h-3 md:w-3 mr-0.5 md:mr-1" />
                        Zéro Terminal
                      </Badge>
                    ) : null}
                    <span className="truncate">{service.buttonText}</span>
                    <ArrowRight className="h-2.5 w-2.5 md:h-3 md:w-3 ml-1 md:ml-2 shrink-0" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Value Comparison - Vibecoder */}
          <div className="mt-12 md:mt-20 max-w-4xl mx-auto">
            <div className="text-center mb-8 md:mb-10">
              <Badge className="mb-3 md:mb-4 bg-primary/10 text-primary border-primary/20">
                <Sparkles className="h-3 w-3 mr-1" />
                {t('hero.benefits.divideCosts')}
              </Badge>
              <h2 className="text-xl md:text-3xl font-bold mb-3 md:mb-4 text-foreground">
                {t('pricing.comparison.title')}
              </h2>
              <p className="text-sm md:text-base text-muted-foreground">
                {t('pricing.comparison.subtitle')}
              </p>
            </div>

            <Card className="overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[150px] md:w-[200px] text-xs md:text-sm">{t('pricing.comparison.solution')}</TableHead>
                    <TableHead className="text-center text-xs md:text-sm">{t('pricing.comparison.price')}</TableHead>
                    <TableHead className="text-center text-xs md:text-sm hidden sm:table-cell">{t('pricing.comparison.ownership')}</TableHead>
                    <TableHead className="text-center text-xs md:text-sm">{t('pricing.comparison.time')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-primary/5">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1 md:gap-2">
                        <Rocket className="h-3 w-3 md:h-4 md:w-4 text-primary" />
                        <span className="font-semibold text-primary text-xs md:text-sm">Inopay</span>
                        <Badge variant="secondary" className="text-[8px] md:text-[10px] bg-primary/10 text-primary border-0 hidden md:inline-flex">Vibe-Friendly</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-primary text-xs md:text-sm">{PRICES[currency].deploy}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell"><Check className="h-3 w-3 md:h-4 md:w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center text-success font-medium text-xs md:text-sm">~10 min</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-xs md:text-sm">{t('pricing.comparison.devops')}</TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs md:text-sm">150-300 $/h</TableCell>
                    <TableCell className="text-center hidden sm:table-cell"><Check className="h-3 w-3 md:h-4 md:w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs md:text-sm">4-8h</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-xs md:text-sm">{t('pricing.comparison.heroku')}</TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs md:text-sm">20-50 $/mois</TableCell>
                    <TableCell className="text-center text-destructive hidden sm:table-cell text-xs md:text-sm">Non</TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs md:text-sm">Variable</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-xs md:text-sm">{t('pricing.comparison.manual')}</TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs md:text-sm">{t('pricing.comparison.yourTime')}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell"><Check className="h-3 w-3 md:h-4 md:w-4 text-success mx-auto" /></TableCell>
                    <TableCell className="text-center text-muted-foreground text-xs md:text-sm">1-2 jours</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Features Table */}
          <div className="mt-20 max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold mb-4 text-foreground">
                {t('pricing.included.title')}
              </h2>
              <p className="text-muted-foreground">
                {t('pricing.included.subtitle')}
              </p>
            </div>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px]">{t('pricing.included.feature')}</TableHead>
                    <TableHead className="text-center">{t('pricing.included.free')}</TableHead>
                    <TableHead className="text-center bg-primary/5">{t('pricing.included.deployment')}</TableHead>
                    <TableHead className="text-center">{t('pricing.included.withMonitoring')}</TableHead>
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
    </Layout>
  );
};

export default Pricing;
