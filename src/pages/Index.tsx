import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Upload, Search, FileText, Sparkles, Zap, Code2, Rocket, Quote, Unlock } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user } = useAuth();

  const platforms = [
    { name: "Lovable", icon: "💜" },
    { name: "Bolt", icon: "⚡" },
    { name: "v0", icon: "🔮" },
    { name: "Cursor", icon: "🖱️" },
    { name: "Replit", icon: "🔁" },
  ];

  const steps = [
    {
      icon: Upload,
      title: "Source",
      description: "Connectez votre GitHub ou déposez votre fichier .zip exporté",
    },
    {
      icon: Search,
      title: "Analyse",
      description: "Notre IA détecte les dépendances propriétaires et verrous technologiques",
    },
    {
      icon: FileText,
      title: "Nettoyage",
      description: "Remplacement automatique par des standards Open Source universels",
    },
    {
      icon: Rocket,
      title: "Export",
      description: "Téléchargez votre projet 100% autonome avec configuration Docker",
    },
  ];

  const features = [
    {
      icon: Code2,
      title: "Détection intelligente",
      description: "Identifie automatiquement les imports, configurations et dépendances spécifiques à chaque plateforme.",
    },
    {
      icon: Zap,
      title: "Nettoyage IA",
      description: "Notre intelligence artificielle remplace les composants verrouillés par des alternatives Open Source.",
    },
    {
      icon: Rocket,
      title: "Déploiement universel",
      description: "Exportez avec Docker, déployez sur n'importe quel hébergeur. Votre code, vos règles.",
    },
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        {/* Background Effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
              <Unlock className="h-4 w-4" />
              Libération de code IA
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-fade-in-up text-foreground">
              Votre code vous appartient{" "}
              <span className="text-primary">enfin.</span>
              <br />
              <span className="text-muted-foreground">Reprenez le contrôle.</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              FreedomCode transforme vos projets Lovable en applications standards et 100% indépendantes.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <Link to={user ? "/dashboard" : "/auth"}>
                <Button size="lg" className="text-lg px-8 py-7 rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Libérer mon premier projet (Gratuit)
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section className="py-16 border-y border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Compatible avec les principales plateformes IA no-code
          </p>
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {platforms.map((platform) => (
              <div 
                key={platform.name}
                className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border bg-card hover:border-primary/30 transition-all card-shadow"
              >
                <span className="text-xl">{platform.icon}</span>
                <span className="font-medium text-foreground">{platform.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Comment ça marche ?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              En quatre étapes simples, transformez votre projet IA en application autonome
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {steps.map((step, index) => (
              <div 
                key={step.title}
                className="relative group"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-full h-px bg-border" />
                )}
                
                <div className="flex flex-col items-center text-center p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all card-shadow card-hover">
                  {/* Step number */}
                  <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {index + 1}
                  </div>
                  
                  {/* Icon */}
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <step.icon className="h-7 w-7" />
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-2 text-foreground">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 lg:py-32 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Pourquoi choisir FreedomCode ?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Une solution conçue pour les entrepreneurs qui veulent garder le contrôle
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((feature) => (
              <div 
                key={feature.title}
                className="p-8 rounded-2xl border border-border bg-card card-shadow card-hover group"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card className="card-shadow-lg border border-border bg-card overflow-hidden">
              <CardContent className="p-10 md:p-12 text-center">
                <Quote className="h-10 w-10 text-primary/30 mx-auto mb-6" />
                <blockquote className="text-xl md:text-2xl font-medium text-foreground mb-6 leading-relaxed">
                  "Indispensable pour passer d'une idée générée par IA à une véritable entreprise sans dépendre d'un abonnement mensuel."
                </blockquote>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">M</span>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">Marie Dupont</p>
                    <p className="text-sm text-muted-foreground">Fondatrice, TechStartup</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 lg:py-32 bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
              Prêt à reprendre le contrôle ?
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Libérez gratuitement votre premier projet et découvrez la vraie indépendance technologique.
            </p>
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button size="lg" className="text-lg px-10 py-7 rounded-xl shadow-lg hover:shadow-xl transition-all">
                <Sparkles className="mr-2 h-5 w-5" />
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

export default Index;
