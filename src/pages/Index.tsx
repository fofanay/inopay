import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, Search, FileText, Sparkles, Zap, Code2, Rocket } from "lucide-react";
import Layout from "@/components/layout/Layout";

const Index = () => {
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
      title: "Upload",
      description: "Déposez votre fichier .zip exporté de votre plateforme IA préférée",
    },
    {
      icon: Search,
      title: "Analyse",
      description: "Notre outil détecte les dépendances spécifiques et les points de blocage",
    },
    {
      icon: FileText,
      title: "Rapport",
      description: "Recevez un guide de migration personnalisé avec un score de portabilité",
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
      title: "Analyse rapide",
      description: "Obtenez votre rapport de portabilité en quelques secondes, pas en heures.",
    },
    {
      icon: Rocket,
      title: "Migration simplifiée",
      description: "Des recommandations claires et actionnables pour rendre votre code portable.",
    },
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 lg:py-32">
        {/* Background Effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
              <Sparkles className="h-4 w-4" />
              Analysez la portabilité de vos projets IA
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 animate-fade-in-up">
              Libérez votre code des{" "}
              <span className="text-primary">plateformes IA</span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              Le vendor lock-in vous empêche de migrer vos projets vers vos propres serveurs. 
              Inopay analyse votre code et vous guide vers une migration réussie.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              <Link to="/dashboard">
                <Button size="lg" className="glow-primary text-lg px-8 py-6">
                  Analyser mon projet
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/a-propos">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  En savoir plus
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section className="py-16 border-y border-border/50 bg-card/30">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Compatible avec les principales plateformes IA no-code
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {platforms.map((platform) => (
              <div 
                key={platform.name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 hover:border-primary/30 transition-all"
              >
                <span className="text-xl">{platform.icon}</span>
                <span className="font-medium text-muted-foreground">{platform.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              En trois étapes simples, analysez et préparez votre projet pour la migration
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((step, index) => (
              <div 
                key={step.title}
                className="relative group"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-full h-px bg-gradient-to-r from-primary/50 to-transparent" />
                )}
                
                <div className="flex flex-col items-center text-center p-6 rounded-2xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 transition-all group-hover:glow-sm">
                  {/* Step number */}
                  <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {index + 1}
                  </div>
                  
                  {/* Icon */}
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <step.icon className="h-8 w-8" />
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 lg:py-32 bg-card/30 border-y border-border/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Pourquoi choisir Inopay ?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Une solution conçue pour les développeurs qui veulent garder le contrôle
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((feature) => (
              <div 
                key={feature.title}
                className="p-8 rounded-2xl border border-border/50 bg-background/50 hover:border-primary/30 transition-all group"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Prêt à reprendre le contrôle ?
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Analysez gratuitement votre premier projet et découvrez son niveau de portabilité.
            </p>
            <Link to="/dashboard">
              <Button size="lg" className="glow-primary text-lg px-10 py-6">
                Commencer maintenant
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
