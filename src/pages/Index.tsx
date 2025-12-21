import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Upload, Sparkles, Zap, Code2, Rocket, Quote, Unlock, HelpCircle, Check, Shield, Server, Key, PiggyBank, Terminal, Palette } from "lucide-react";
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

  // 3 Features Vibe-Friendly essentielles
  const vibeFeatures = [
    {
      icon: Terminal,
      title: "Zéro ligne de commande",
      description: "Si vous savez copier-coller une URL, vous savez déployer avec Inopay. On s'occupe de Docker, SSH et SSL.",
      badge: "Vibe-Friendly",
    },
    {
      icon: PiggyBank,
      title: "Divisez vos factures par 3",
      description: "Pourquoi payer un abonnement Pro + des frais cachés ? Passez sur votre hébergement et gardez vos profits.",
      badge: null,
    },
    {
      icon: Key,
      title: "Propriété Intellectuelle Réelle",
      description: "Un code sur Lovable est emprunté. Un code Inopay sur votre VPS est un actif que vous pouvez revendre.",
      badge: null,
    },
  ];

  // 4 FAQs essentielles
  const faqs = [
    {
      question: "Comment fonctionne le déploiement automatique ?",
      answer: "Vous fournissez l'IP de votre VPS et vos identifiants SSH. Inopay installe Docker, configure PostgreSQL, provisionne SSL et déploie votre app. Tout est automatique, aucune commande à taper."
    },
    {
      question: "Mes secrets sont-ils en sécurité ? (Zero-Knowledge)",
      answer: "Vos credentials SSH et clés API sont utilisés uniquement pendant le déploiement puis effacés. Nous ne stockons aucun secret après l'installation."
    },
    {
      question: "Combien de temps prend le déploiement ?",
      answer: "Environ 10 minutes : analyse, nettoyage IA, configuration VPS et mise en ligne. Votre app est en production avec SSL et base de données en moins d'un quart d'heure."
    },
    {
      question: "Quelles plateformes IA sont compatibles ?",
      answer: "Lovable, Bolt, v0, Cursor, Replit et toutes les plateformes générant du code React/Vue/JavaScript moderne. Le nettoyage IA adapte le code à votre infrastructure."
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
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/5" />
        
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column - Content */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8 animate-fade-in">
                <Palette className="h-4 w-4" />
                🎨 Vibe-Friendly
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight mb-6 animate-fade-in-up text-foreground leading-tight">
                Gardez le Vibe.{" "}
                <span className="text-primary">Reprenez le Code.</span>
              </h1>

              <p className="text-lg text-muted-foreground mb-8 animate-fade-in-up leading-relaxed" style={{ animationDelay: "0.1s" }}>
                Vous avez passé des nuits à itérer avec Lovable, Bolt ou Cursor. 
                Vous avez créé quelque chose de grand. <strong className="text-foreground">Inopay le rend libre.</strong>
              </p>

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
                
                <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2">
                  <Unlock className="h-4 w-4" />
                  Analyse gratuite, sans carte bancaire
                </p>
              </div>
            </div>

            {/* Right Column - Visual Mockup */}
            <div className="relative lg:pl-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-60" />
                
                <div className="relative rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-destructive/60" />
                      <div className="w-3 h-3 rounded-full bg-warning/60" />
                      <div className="w-3 h-3 rounded-full bg-primary/60" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">mon-app.com</span>
                  </div>
                  
                  <div className="p-6 space-y-4 bg-gradient-to-br from-card to-primary/5">
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

      {/* Plateformes + Process Compact */}
      <section className="py-12 border-b border-border bg-muted/30">
        <div className="container mx-auto px-4">
          {/* Plateformes inline */}
          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {platforms.map((platform) => (
              <span 
                key={platform.name}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground"
              >
                <span>{platform.icon}</span>
                {platform.name}
              </span>
            ))}
          </div>

          {/* 3 étapes visuelles */}
          <div className="flex items-center justify-center gap-4 max-w-lg mx-auto mb-6">
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Votre code</span>
            </div>
            <ArrowRight className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <span className="text-xs text-primary font-medium">Inopay</span>
            </div>
            <ArrowRight className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
                <Server className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xs text-muted-foreground font-medium">Votre VPS</span>
            </div>
          </div>

          {/* Hébergeurs inline */}
          <div className="flex flex-wrap justify-center gap-2">
            {hosters.map((hoster) => (
              <span 
                key={hoster.name}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground rounded-md bg-background border border-border"
              >
                <span>{hoster.icon}</span>
                {hoster.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Features Vibe-Friendly */}
      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              Vibe-Friendly
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Pourquoi les Vibecoders choisissent Inopay
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {vibeFeatures.map((feature) => (
              <div 
                key={feature.title}
                className="relative p-6 rounded-2xl border border-border bg-card card-shadow card-hover group"
              >
                {feature.badge && (
                  <Badge className="absolute -top-3 right-4 bg-primary/10 text-primary border-primary/20 text-xs">
                    {feature.badge}
                  </Badge>
                )}
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Compact - 4 questions */}
      <section className="py-16 lg:py-20 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background text-muted-foreground text-sm font-medium mb-4">
              <HelpCircle className="h-4 w-4" />
              FAQ
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Questions fréquentes
            </h2>
          </div>

          <div className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="border border-border rounded-xl px-5 bg-card data-[state=open]:border-primary/30"
                >
                  <AccordionTrigger className="text-left font-medium text-foreground hover:text-primary py-4 text-sm">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-4 text-sm leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA + Mini-Témoignage intégré */}
      <section className="py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            {/* Mini témoignage inline */}
            <div className="flex items-center justify-center gap-3 mb-8 p-4 rounded-xl bg-muted/50 border border-border">
              <Quote className="h-5 w-5 text-primary/50 flex-shrink-0" />
            <p className="text-sm text-muted-foreground italic">
                "Inopay m'a permis de migrer sur mon IONOS en 10 min. Maintenant je paie 5$/mois au lieu de 50$."
              </p>
              <span className="text-xs text-muted-foreground whitespace-nowrap">— Marie L.</span>
            </div>

            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Palette className="h-3 w-3 mr-1" />
              Vibe-to-Production
            </Badge>
            
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-foreground">
              Prêt à libérer votre création ?
            </h2>
            
            <p className="text-muted-foreground mb-8">
              Analysez votre projet gratuitement et découvrez votre Vibe-Score™.
            </p>
            
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button size="lg" className="text-lg px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all">
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
