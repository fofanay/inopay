import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowRight, Upload, Search, FileText, Sparkles, Zap, Code2, Rocket, Quote, Unlock, HelpCircle, Check, Shield, Github, Download } from "lucide-react";
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

  const faqs = [
    {
      question: "Quelles plateformes IA sont compatibles avec FreedomCode ?",
      answer: "FreedomCode est compatible avec toutes les principales plateformes de génération de code IA : Lovable, Bolt, v0 by Vercel, Cursor, Replit et bien d'autres. Si votre projet utilise React, Vue, ou tout framework JavaScript moderne, nous pouvons le libérer."
    },
    {
      question: "Mon code original est-il modifié sur GitHub ?",
      answer: "Non, jamais. FreedomCode crée une copie optimisée de votre projet. Votre code source original reste intact sur GitHub. Vous pouvez continuer à utiliser la plateforme IA tout en ayant une version autonome en parallèle."
    },
    {
      question: "Que signifie « libérer » mon code exactement ?",
      answer: "Libérer votre code signifie remplacer toutes les dépendances propriétaires (SDK spécifiques, imports verrouillés, configurations cloud) par des alternatives Open Source standards. Le résultat est un projet que vous pouvez déployer sur n'importe quel hébergeur sans abonnement obligatoire."
    },
    {
      question: "Est-ce que je perds des fonctionnalités après la libération ?",
      answer: "Non. Notre IA remplace chaque composant propriétaire par un équivalent fonctionnel Open Source. Les fonctionnalités restent identiques, seule la dépendance à la plateforme disparaît. Vous gardez 100% des capacités de votre application."
    },
    {
      question: "Combien de temps prend le processus de libération ?",
      answer: "Le processus complet prend généralement moins de 5 minutes : connexion GitHub (30 sec), analyse du projet (1-2 min), nettoyage IA (1-2 min), et export final (30 sec). Les projets plus complexes peuvent prendre un peu plus de temps."
    },
    {
      question: "Le service est-il vraiment gratuit ?",
      answer: "Oui, la libération de votre premier projet est entièrement gratuite. Cela inclut l'analyse complète, le nettoyage IA et l'export avec configuration Docker. Pour les équipes avec de nombreux projets, nous proposons des forfaits adaptés."
    },
    {
      question: "Puis-je déployer mon projet libéré sur n'importe quel hébergeur ?",
      answer: "Absolument. Votre projet exporté inclut une configuration Docker prête à l'emploi. Vous pouvez le déployer sur Vercel, Netlify, Railway, DigitalOcean, AWS, votre propre serveur, ou tout autre hébergeur de votre choix."
    },
    {
      question: "Que se passe-t-il si la libération échoue ou pose problème ?",
      answer: "Notre équipe technique est disponible pour vous accompagner. Si un composant spécifique pose problème, nous analysons le cas et proposons une solution adaptée. Votre satisfaction et votre autonomie sont notre priorité."
    }
  ];

  const heroBenefits = [
    "Libérez votre code en moins de 5 minutes",
    "Zéro dépendance aux plateformes IA",
    "Déployez sur n'importe quel hébergeur",
  ];

  return (
    <Layout>
      {/* Hero Section - Inspired by AppBuilder design */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/5" />
        
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column - Content */}
            <div className="max-w-xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
                <Shield className="h-4 w-4" />
                100% Indépendance Garantie
              </div>

              {/* Title */}
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight mb-6 animate-fade-in-up text-foreground leading-tight">
                Libérez Votre Code IA en{" "}
                <span className="text-primary">Open Source</span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg text-muted-foreground mb-8 animate-fade-in-up leading-relaxed" style={{ animationDelay: "0.1s" }}>
                Vous avez créé une application géniale avec Lovable, Bolt ou Cursor. Maintenant, rendez-la totalement autonome et déployable partout.
              </p>

              {/* Benefits list with checkmarks */}
              <ul className="space-y-4 mb-10 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
                {heroBenefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground font-medium">{benefit}</span>
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                <Link to={user ? "/dashboard" : "/auth"}>
                  <Button size="lg" className="text-lg px-8 py-7 rounded-xl shadow-lg hover:shadow-xl transition-all bg-primary hover:bg-primary/90">
                    Libérer mon projet
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                
                {/* Trust indicator */}
                <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Unlock className="h-4 w-4" />
                  Premier projet gratuit, sans carte bancaire
                </p>
              </div>
            </div>

            {/* Right Column - Visual Mockup */}
            <div className="relative lg:pl-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
              {/* Main visual card - Code editor mockup */}
              <div className="relative">
                {/* Glow effect behind */}
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-60" />
                
                {/* Main card */}
                <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                  {/* Window header */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-destructive/60" />
                      <div className="w-3 h-3 rounded-full bg-warning/60" />
                      <div className="w-3 h-3 rounded-full bg-primary/60" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">mon-projet-libere/</span>
                  </div>
                  
                  {/* Code content simulation */}
                  <div className="p-6 space-y-4 bg-gradient-to-br from-card to-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Code2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">Projet Nettoyé</p>
                        <p className="text-sm text-muted-foreground">100% Open Source</p>
                      </div>
                    </div>
                    
                    {/* Progress bars */}
                    <div className="space-y-3 pt-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Dépendances propriétaires</span>
                        <span className="text-primary font-medium">0 restantes</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full w-full" />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <div className="flex-1 p-3 rounded-xl bg-primary/10 text-center">
                        <p className="text-2xl font-bold text-primary">42</p>
                        <p className="text-xs text-muted-foreground">Fichiers</p>
                      </div>
                      <div className="flex-1 p-3 rounded-xl bg-accent/10 text-center">
                        <p className="text-2xl font-bold text-accent">100%</p>
                        <p className="text-xs text-muted-foreground">Portable</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute -top-4 -right-4 px-4 py-2 rounded-xl bg-card border border-border shadow-lg flex items-center gap-2 animate-bounce" style={{ animationDuration: "3s" }}>
                  <Github className="h-4 w-4 text-foreground" />
                  <span className="text-sm font-medium">GitHub</span>
                </div>
                
                <div className="absolute top-1/3 -right-6 px-4 py-2 rounded-xl bg-card border border-border shadow-lg flex items-center gap-2" style={{ animation: "bounce 3s infinite", animationDelay: "0.5s" }}>
                  <Download className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Docker Ready</span>
                </div>
                
                <div className="absolute -bottom-4 right-1/4 px-4 py-2 rounded-xl bg-primary text-primary-foreground shadow-lg flex items-center gap-2" style={{ animation: "bounce 3s infinite", animationDelay: "1s" }}>
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-medium">En 5 min</span>
                </div>
              </div>
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

      {/* FAQ Section */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-muted text-muted-foreground text-sm font-medium mb-6">
              <HelpCircle className="h-4 w-4" />
              Questions fréquentes
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Tout ce que vous devez savoir
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Des réponses claires aux questions les plus courantes sur la libération de code
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="border border-border rounded-xl px-6 bg-card card-shadow data-[state=open]:border-primary/30"
                >
                  <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
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
