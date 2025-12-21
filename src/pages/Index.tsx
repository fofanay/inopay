import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Upload, Search, FileText, Sparkles, Zap, Code2, Rocket, Quote, Unlock, HelpCircle, Check, Shield, Github, Download, Server, Database, Lock, RefreshCw, Settings, Key, PiggyBank, Terminal, Palette } from "lucide-react";
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

  const hosters = [
    { name: "IONOS", icon: "🌐" },
    { name: "OVH", icon: "☁️" },
    { name: "Hetzner", icon: "🖥️" },
    { name: "DigitalOcean", icon: "🌊" },
    { name: "Scaleway", icon: "⚡" },
  ];

  const steps = [
    {
      icon: Upload,
      title: "Source",
      description: "Connectez votre GitHub ou déposez votre fichier .zip",
    },
    {
      icon: Search,
      title: "Analyse",
      description: "Détection des dépendances propriétaires et verrous",
    },
    {
      icon: FileText,
      title: "Nettoyage",
      description: "Remplacement automatique par des alternatives Open Source",
    },
    {
      icon: Settings,
      title: "Config VPS",
      description: "Entrez l'IP de votre serveur IONOS, OVH ou Hetzner",
    },
    {
      icon: Rocket,
      title: "Déploiement",
      description: "Docker, PostgreSQL et SSL installés automatiquement",
    },
    {
      icon: RefreshCw,
      title: "Monitoring",
      description: "Health checks toutes les 5 min + auto-restart",
    },
  ];

  // Features Vibe-Friendly
  const vibeFeatures = [
    {
      icon: Terminal,
      title: "Zéro ligne de commande",
      description: "Si vous savez copier-coller une URL, vous savez déployer avec Inopay. On s'occupe de la plomberie technique (Docker, SSH, SSL).",
      badge: "Vibe-Friendly",
    },
    {
      icon: PiggyBank,
      title: "Divisez vos factures par 3",
      description: "Pourquoi payer un abonnement Pro + des frais cachés ? Passez sur votre hébergement et gardez vos profits pour vous.",
      badge: null,
    },
    {
      icon: Key,
      title: "Propriété Intellectuelle Réelle",
      description: "Un code sur Lovable est emprunté. Un code Inopay sur votre VPS est un actif que vous pouvez revendre.",
      badge: null,
    },
    {
      icon: Database,
      title: "Base de données managée",
      description: "PostgreSQL configuré et sécurisé automatiquement, prêt pour la production.",
      badge: null,
    },
    {
      icon: Lock,
      title: "SSL Automatique",
      description: "Let's Encrypt provisionné sans intervention. HTTPS garanti dès le premier déploiement.",
      badge: null,
    },
    {
      icon: RefreshCw,
      title: "Monitoring Pro",
      description: "Health checks toutes les 5 minutes + redémarrage automatique en cas de panne.",
      badge: null,
    },
  ];

  const faqs = [
    {
      question: "Comment fonctionne le déploiement automatique ?",
      answer: "Vous fournissez simplement l'IP de votre VPS et vos identifiants SSH. Inopay se connecte, installe Docker et Coolify, configure PostgreSQL, provisionne un certificat SSL, et déploie votre application. Tout est automatique, aucune commande à taper."
    },
    {
      question: "Quels hébergeurs VPS sont supportés ?",
      answer: "Inopay est compatible avec tous les principaux hébergeurs : IONOS, OVH, Hetzner, DigitalOcean, Scaleway, Linode, Vultr, et tout serveur Ubuntu accessible en SSH. Si vous avez un VPS avec accès root, ça marche."
    },
    {
      question: "Mes secrets sont-ils en sécurité ? (Zero-Knowledge)",
      answer: "Absolument. Vos credentials SSH et clés API sont utilisés uniquement pendant le déploiement puis effacés de nos serveurs. Nous ne stockons aucun secret après l'installation. C'est le principe Zero-Knowledge."
    },
    {
      question: "Que se passe-t-il si mon serveur tombe en panne ?",
      answer: "Notre système de monitoring vérifie la santé de votre application toutes les 5 minutes. En cas de défaillance, un redémarrage automatique est déclenché. Vous recevez une notification par email pour chaque incident."
    },
    {
      question: "Puis-je utiliser mon propre nom de domaine ?",
      answer: "Oui ! Configurez simplement un enregistrement DNS pointant vers l'IP de votre VPS. Inopay configure automatiquement le SSL Let's Encrypt pour votre domaine personnalisé."
    },
    {
      question: "La base de données PostgreSQL est-elle incluse ?",
      answer: "Oui, une instance PostgreSQL est automatiquement installée et configurée sur votre VPS. Vos données restent sur votre infrastructure, avec des sauvegardes automatiques possibles."
    },
    {
      question: "Quelles plateformes IA sont compatibles ?",
      answer: "Inopay est compatible avec Lovable, Bolt, v0, Cursor, Replit et toutes les plateformes générant du code React/Vue/JavaScript moderne. Le nettoyage IA adapte le code à votre infrastructure."
    },
    {
      question: "Combien de temps prend le déploiement complet ?",
      answer: "Environ 10 minutes du début à la fin : analyse (2 min), nettoyage IA (2 min), configuration VPS (3-4 min), et mise en ligne (2 min). Votre app est en production avec SSL et base de données en moins d'un quart d'heure."
    }
  ];

  const heroBenefits = [
    "Zéro ligne de commande requise",
    "Divisez vos factures par 3",
    "Propriété intellectuelle réelle",
    "Du prototype IA à la vraie entreprise",
  ];

  return (
    <Layout>
      {/* Hero Section - Vibecoder */}
      <section className="relative overflow-hidden py-20 lg:py-28">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/5" />
        
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column - Content */}
            <div className="max-w-xl">
              {/* Badge Vibe-Friendly */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
                <Palette className="h-4 w-4" />
                🎨 Vibe-Friendly
              </div>

              {/* Title - Vibecoder */}
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight mb-6 animate-fade-in-up text-foreground leading-tight">
                Gardez le Vibe.{" "}
                <span className="text-primary">Reprenez le Code.</span>
              </h1>

              {/* Subtitle - Vibecoder */}
              <p className="text-lg text-muted-foreground mb-8 animate-fade-in-up leading-relaxed" style={{ animationDelay: "0.1s" }}>
                Vous avez passé des nuits à itérer avec Lovable, Bolt ou Cursor. 
                Vous avez créé quelque chose de grand. <strong className="text-foreground">Inopay le rend libre.</strong>
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
                    <Badge variant="secondary" className="mr-2 text-xs bg-primary-foreground/20 text-primary-foreground border-0">
                      Zéro Terminal
                    </Badge>
                    Libérer mon projet
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                
                {/* Trust indicator */}
                <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Unlock className="h-4 w-4" />
                  Analyse gratuite, sans carte bancaire
                </p>
              </div>
            </div>

            {/* Right Column - Visual Mockup */}
            <div className="relative lg:pl-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
              {/* Main visual card - Deployment flow */}
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
                    <span className="text-xs text-muted-foreground ml-2">mon-app.com</span>
                  </div>
                  
                  {/* Deployment flow visualization */}
                  <div className="p-6 space-y-4 bg-gradient-to-br from-card to-primary/5">
                    {/* Vibe Score Preview */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <span className="text-sm font-medium text-foreground">Vibe-Score™</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-primary">95%</p>
                          <p className="text-[10px] text-muted-foreground">Vibe</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-accent">12%</p>
                          <p className="text-[10px] text-muted-foreground">Liberté</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-lg font-bold text-success">100%</p>
                          <p className="text-[10px] text-muted-foreground">Après</p>
                        </div>
                      </div>
                    </div>

                    {/* Flow diagram */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                          <Code2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground">Code IA</span>
                      </div>
                      <ArrowRight className="h-5 w-5 text-primary" />
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Sparkles className="h-6 w-6 text-primary" />
                        </div>
                        <span className="text-xs text-muted-foreground">Inopay</span>
                      </div>
                      <ArrowRight className="h-5 w-5 text-primary" />
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                          <Server className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground">Votre VPS</span>
                      </div>
                    </div>
                    
                    {/* Status indicators */}
                    <div className="grid grid-cols-3 gap-2 pt-4">
                      <div className="p-3 rounded-xl bg-primary/10 text-center">
                        <Check className="h-4 w-4 text-primary mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">Docker</p>
                      </div>
                      <div className="p-3 rounded-xl bg-primary/10 text-center">
                        <Check className="h-4 w-4 text-primary mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">SSL</p>
                      </div>
                      <div className="p-3 rounded-xl bg-primary/10 text-center">
                        <Check className="h-4 w-4 text-primary mx-auto mb-1" />
                        <p className="text-xs text-muted-foreground">PostgreSQL</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <div className="flex-1 p-3 rounded-xl bg-accent/10 text-center">
                        <p className="text-2xl font-bold text-accent">10 min</p>
                        <p className="text-xs text-muted-foreground">Déploiement</p>
                      </div>
                      <div className="flex-1 p-3 rounded-xl bg-primary/10 text-center">
                        <p className="text-2xl font-bold text-primary">24/7</p>
                        <p className="text-xs text-muted-foreground">Monitoring</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badges */}
                <div className="absolute -top-4 -right-4 px-4 py-2 rounded-xl bg-card border border-border shadow-lg flex items-center gap-2 animate-bounce" style={{ animationDuration: "3s" }}>
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Zero-Knowledge</span>
                </div>
                
                <div className="absolute top-1/3 -right-6 px-4 py-2 rounded-xl bg-card border border-border shadow-lg flex items-center gap-2" style={{ animation: "bounce 3s infinite", animationDelay: "0.5s" }}>
                  <Terminal className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Zéro Terminal</span>
                </div>
                
                <div className="absolute -bottom-4 right-1/4 px-4 py-2 rounded-xl bg-primary text-primary-foreground shadow-lg flex items-center gap-2" style={{ animation: "bounce 3s infinite", animationDelay: "1s" }}>
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-medium">Vibe-to-Prod</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Manifeste du Vibecoder */}
      <section className="py-16 bg-muted/50 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-2xl md:text-3xl font-semibold text-foreground italic mb-6">
              "Vous n'êtes pas développeur ? On s'en fiche. Vous êtes un créateur."
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Votre projet est prisonnier d'un écosystème qui vous facture au succès.
              Inopay est l'outil ultime pour passer du <span className="text-primary font-semibold">'Prototype IA'</span> à 
              la <span className="text-primary font-semibold">'Véritable Entreprise'</span>.
            </p>
            <p className="text-lg text-foreground font-medium mt-4">
              Pas de technique. Pas de terminal. Juste votre vision, enfin libre.
            </p>
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section className="py-16 border-b border-border bg-background">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Compatible avec les principales plateformes IA no-code
          </p>
          <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-10">
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
          
          <p className="text-center text-sm text-muted-foreground mb-8">
            Déployez sur votre hébergeur préféré
          </p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {hosters.map((hoster) => (
              <div 
                key={hoster.name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all"
              >
                <span className="text-lg">{hoster.icon}</span>
                <span className="text-sm font-medium text-foreground">{hoster.name}</span>
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
              En six étapes, votre app IA est en production sur votre propre infrastructure
            </p>
          </div>

          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-7xl mx-auto">
            {steps.map((step, index) => (
              <div 
                key={step.title}
                className="relative group"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-[60%] w-full h-px bg-border" />
                )}
                
                <div className="flex flex-col items-center text-center p-4 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all card-shadow card-hover h-full">
                  {/* Step number */}
                  <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    {index + 1}
                  </div>
                  
                  {/* Icon */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <step.icon className="h-6 w-6" />
                  </div>
                  
                  <h3 className="text-sm font-semibold mb-2 text-foreground">{step.title}</h3>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section - Vibe-Friendly */}
      <section className="py-24 lg:py-32 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              Vibe-Friendly
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Pourquoi les Vibecoders choisissent Inopay
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Vous créez par instinct. Nous libérons par expertise.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {vibeFeatures.map((feature) => (
              <div 
                key={feature.title}
                className="relative p-6 rounded-2xl border border-border bg-card card-shadow card-hover group"
              >
                {feature.badge && (
                  <Badge className="absolute -top-3 right-4 bg-primary/10 text-primary border-primary/20">
                    {feature.badge}
                  </Badge>
                )}
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-5 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial Section - Vibecoder */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <Card className="card-shadow-lg border border-border bg-card overflow-hidden">
              <CardContent className="p-10 md:p-12 text-center">
                <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Vibecodeur depuis 2024
                </Badge>
                <Quote className="h-10 w-10 text-primary/30 mx-auto mb-6" />
                <blockquote className="text-xl md:text-2xl font-medium text-foreground mb-6 leading-relaxed">
                  "J'ai créé mon SaaS en vibant avec Lovable pendant 3 semaines. Le jour où j'ai voulu scaler, les coûts ont explosé. 
                  Inopay m'a permis de tout migrer sur mon IONOS en 10 minutes. <span className="text-primary">Maintenant je paie 5€/mois au lieu de 50€.</span>"
                </blockquote>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">M</span>
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">Marie L.</p>
                    <p className="text-sm text-muted-foreground">Créatrice de TaskFlow.app</p>
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
              Des réponses claires sur le déploiement, la sécurité et le monitoring
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

      {/* CTA Section - Vibecoder */}
      <section className="py-24 lg:py-32 bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="mb-6 bg-primary/10 text-primary border-primary/20">
              <Palette className="h-3 w-3 mr-1" />
              Vibe-to-Production
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
              Prêt à libérer votre création ?
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Analysez votre projet gratuitement et découvrez votre <span className="text-primary font-semibold">Vibe-Score™</span>. 
              Passez du prototype IA à votre propre infrastructure en 10 minutes.
            </p>
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button size="lg" className="text-lg px-10 py-7 rounded-xl shadow-lg hover:shadow-xl transition-all">
                <Badge variant="secondary" className="mr-2 text-xs bg-primary-foreground/20 text-primary-foreground border-0">
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

export default Index;
