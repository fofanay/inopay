import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Rocket, 
  Activity, 
  Server, 
  Package, 
  Check, 
  Star, 
  Quote, 
  ArrowRight,
  Clock,
  Shield,
  Zap,
  Users,
  HeartHandshake,
  Sparkles,
  Globe,
  Lock
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";

const Services = () => {
  const { user } = useAuth();

  const services = [
    {
      id: "deployment",
      icon: Rocket,
      title: "Déploiement Assisté",
      subtitle: "De Lovable à votre serveur en 10 minutes",
      description: "Notre équipe vous accompagne de A à Z pour déployer votre application sur votre propre infrastructure. Fini les contraintes des hébergeurs propriétaires.",
      price: "39$",
      priceNote: "paiement unique",
      features: [
        "Configuration Dockerfile optimisée",
        "Setup SSL automatique (Let's Encrypt)",
        "Configuration DNS guidée",
        "Variables d'environnement sécurisées",
        "Test de déploiement en direct",
        "Support prioritaire 48h post-déploiement"
      ],
      benefits: [
        { icon: Clock, text: "Gain de 4-8 heures de configuration" },
        { icon: Shield, text: "Sécurité best-practices intégrée" },
        { icon: Zap, text: "Déploiement sans downtime" }
      ],
      highlight: "Le plus populaire",
      color: "primary"
    },
    {
      id: "monitoring",
      icon: Activity,
      title: "Monitoring 24/7",
      subtitle: "Votre app surveillée en continu",
      description: "Surveillance proactive de votre application avec alertes instantanées et redémarrage automatique. Dormez tranquille, on veille.",
      price: "12$",
      priceNote: "/mois",
      features: [
        "Vérification uptime toutes les 60 secondes",
        "Alertes push & email instantanées",
        "Redémarrage automatique en cas de crash",
        "Dashboard temps réel",
        "Historique des incidents 90 jours",
        "Rapports hebdomadaires de performance"
      ],
      benefits: [
        { icon: Activity, text: "99.9% uptime garanti" },
        { icon: Zap, text: "Temps de réponse < 100ms" },
        { icon: HeartHandshake, text: "Support technique inclus" }
      ],
      highlight: null,
      color: "accent"
    },
    {
      id: "vps",
      icon: Server,
      title: "Serveur VPS Dédié",
      subtitle: "Votre infrastructure souveraine",
      description: "Un serveur VPS configuré et optimisé pour vos applications. Hébergement européen, performances garanties, contrôle total.",
      price: "25$",
      priceNote: "/mois",
      features: [
        "VPS 2 vCPU / 4 Go RAM / 40 Go SSD",
        "Hébergement européen (RGPD)",
        "Coolify pré-installé",
        "Backup automatique hebdomadaire",
        "Bande passante illimitée",
        "IP dédiée incluse"
      ],
      benefits: [
        { icon: Globe, text: "Hébergement souverain EU" },
        { icon: Lock, text: "Vos données vous appartiennent" },
        { icon: Sparkles, text: "Performances optimisées" }
      ],
      highlight: null,
      color: "success"
    }
  ];

  const testimonials = [
    {
      quote: "J'ai économisé 500$/mois en passant de Vercel Pro + Supabase à mon propre VPS avec Inopay. Le déploiement assisté m'a fait gagner une journée entière.",
      author: "Thomas L.",
      role: "Fondateur, SaaS B2B",
      avatar: "TL",
      rating: 5,
      savings: "500$/mois économisés"
    },
    {
      quote: "Le monitoring m'a alerté d'un problème à 3h du matin et a redémarré mon app automatiquement. Mes clients n'ont rien remarqué. Ça vaut largement les 12$/mois.",
      author: "Marie D.",
      role: "CTO, Startup HealthTech",
      avatar: "MD",
      rating: 5,
      savings: "0 downtime client"
    },
    {
      quote: "En tant que vibe-coder, je ne voulais pas toucher au terminal. L'équipe Inopay a tout configuré en 15 minutes. Mon app tourne depuis 6 mois sans souci.",
      author: "Pierre K.",
      role: "Indie Maker",
      avatar: "PK",
      rating: 5,
      savings: "8h de config économisées"
    },
    {
      quote: "Le Pack Complet est un no-brainer. Déploiement + VPS + Monitoring pour moins cher qu'un abonnement Lovable Teams. Et mes données restent en France.",
      author: "Sophie M.",
      role: "Freelance Developer",
      avatar: "SM",
      rating: 5,
      savings: "RGPD compliant"
    }
  ];

  const faq = [
    {
      question: "Ai-je besoin de compétences techniques ?",
      answer: "Non ! Notre service de déploiement assisté est conçu pour les vibe-coders. Vous n'avez pas besoin de toucher au terminal. Notre équipe s'occupe de tout."
    },
    {
      question: "Que se passe-t-il si mon app a un problème ?",
      answer: "Avec le Monitoring 24/7, nous détectons les problèmes en moins de 60 secondes et redémarrons automatiquement votre application. Vous recevez une alerte, et dans 90% des cas, le problème est résolu avant que vous ne le remarquiez."
    },
    {
      question: "Où sont hébergées mes données ?",
      answer: "Nos serveurs VPS sont hébergés en Europe (France/Allemagne) avec des fournisseurs certifiés RGPD. Vos données ne quittent jamais l'UE et vous en gardez le contrôle total."
    },
    {
      question: "Puis-je migrer depuis Vercel/Netlify/Railway ?",
      answer: "Absolument ! Notre service de déploiement assisté inclut la migration depuis n'importe quel hébergeur cloud. Nous nous occupons de tout, y compris la configuration DNS."
    }
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-primary/5 to-accent/5" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl -z-10" />
        
        <div className="container mx-auto px-4 text-center">
          <Badge variant="outline" className="mb-6 px-4 py-2 text-sm border-primary/50">
            <Sparkles className="h-4 w-4 mr-2 text-primary" />
            Services Premium
          </Badge>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 tracking-tight">
            <span className="text-foreground">Des services pour</span>
            <br />
            <span className="text-primary">libérer votre potentiel</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Déploiement, monitoring, hébergement. Tout ce dont vous avez besoin pour faire 
            tourner vos apps en production, sans vous soucier de l'infrastructure.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/tarifs">
              <Button size="lg" className="rounded-full px-8">
                <Package className="h-5 w-5 mr-2" />
                Voir le Pack Complet -20%
              </Button>
            </Link>
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button size="lg" variant="outline" className="rounded-full px-8">
                Commencer gratuitement
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Services Detail Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nos Services</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Chaque service est conçu pour vous faire gagner du temps et de l'argent
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {services.map((service) => {
              const IconComponent = service.icon;
              return (
                <Card key={service.id} className="relative overflow-hidden hover:shadow-xl transition-all duration-300 group">
                  {service.highlight && (
                    <div className="absolute top-4 right-4">
                      <Badge className="bg-primary text-primary-foreground">
                        <Star className="h-3 w-3 mr-1" />
                        {service.highlight}
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="pb-4">
                    <div className={`w-14 h-14 rounded-2xl bg-${service.color}/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <IconComponent className={`h-7 w-7 text-${service.color}`} />
                    </div>
                    <CardTitle className="text-2xl">{service.title}</CardTitle>
                    <CardDescription className="text-base">{service.subtitle}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    <p className="text-muted-foreground">{service.description}</p>
                    
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-foreground">{service.price}</span>
                      <span className="text-muted-foreground">{service.priceNote}</span>
                    </div>

                    <div className="space-y-3">
                      {service.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-border space-y-3">
                      {service.benefits.map((benefit, idx) => {
                        const BenefitIcon = benefit.icon;
                        return (
                          <div key={idx} className="flex items-center gap-3 text-sm">
                            <BenefitIcon className="h-4 w-4 text-primary" />
                            <span className="font-medium">{benefit.text}</span>
                          </div>
                        );
                      })}
                    </div>

                    <Link to="/tarifs" className="block pt-4">
                      <Button className="w-full rounded-full" variant={service.highlight ? "default" : "outline"}>
                        Choisir ce service
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pack Complet CTA */}
      <section className="py-16 md:py-20">
        <div className="container mx-auto px-4">
          <Card className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/30">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -z-10" />
            
            <CardContent className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <Badge className="mb-4 bg-accent text-accent-foreground">
                    <Zap className="h-3 w-3 mr-1" />
                    Économisez 20%
                  </Badge>
                  <h3 className="text-3xl md:text-4xl font-bold mb-4">
                    Pack Complet
                  </h3>
                  <p className="text-lg text-muted-foreground mb-6">
                    Déploiement + VPS + Monitoring. Tout ce qu'il faut pour passer en production 
                    avec tranquillité d'esprit, à prix réduit.
                  </p>
                  
                  <div className="flex items-baseline gap-4 mb-6">
                    <span className="text-5xl font-bold text-primary">76$</span>
                    <div className="text-muted-foreground">
                      <span className="line-through">95$</span>
                      <span className="ml-2">première année</span>
                    </div>
                  </div>

                  <Link to="/tarifs">
                    <Button size="lg" className="rounded-full px-8">
                      <Package className="h-5 w-5 mr-2" />
                      Obtenir le Pack Complet
                    </Button>
                  </Link>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
                    <Rocket className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-semibold">Déploiement Assisté</p>
                      <p className="text-sm text-muted-foreground">Valeur 39$</p>
                    </div>
                    <Check className="h-6 w-6 text-primary ml-auto" />
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
                    <Server className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-semibold">Serveur VPS 12 mois</p>
                      <p className="text-sm text-muted-foreground">Valeur 300$/an</p>
                    </div>
                    <Check className="h-6 w-6 text-primary ml-auto" />
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border">
                    <Activity className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-semibold">Monitoring 12 mois</p>
                      <p className="text-sm text-muted-foreground">Valeur 144$/an</p>
                    </div>
                    <Check className="h-6 w-6 text-primary ml-auto" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              <Users className="h-4 w-4 mr-2" />
              Témoignages clients
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ils ont fait le saut
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Des développeurs et entrepreneurs qui ont repris le contrôle de leur infrastructure
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  
                  <Quote className="h-8 w-8 text-primary/20 mb-3" />
                  
                  <p className="text-foreground mb-6 leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {testimonial.avatar}
                      </div>
                      <div>
                        <p className="font-semibold">{testimonial.author}</p>
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {testimonial.savings}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Questions fréquentes</h2>
              <p className="text-muted-foreground">Tout ce que vous devez savoir sur nos services</p>
            </div>

            <div className="space-y-4">
              {faq.map((item, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-6">
                    <h4 className="font-semibold text-lg mb-3">{item.question}</h4>
                    <p className="text-muted-foreground">{item.answer}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Prêt à reprendre le contrôle ?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Rejoignez les développeurs qui ont dit adieu au vendor lock-in et économisent 
            des centaines d'euros chaque mois.
          </p>
          
          <div className="flex flex-wrap justify-center gap-4">
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button size="lg" className="rounded-full px-10">
                Commencer maintenant
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <Link to="/tarifs">
              <Button size="lg" variant="outline" className="rounded-full px-10">
                Voir les tarifs
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Services;
