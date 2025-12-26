import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Upload, Sparkles, Zap, Code2, Rocket, Quote, Unlock, HelpCircle, Check, Shield, Server, Key, PiggyBank, Terminal, Palette, Globe, Cloud, Droplets, Activity, Package } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useParallax, useMouseParallax } from "@/hooks/useParallax";
import ROICalculator from "@/components/landing/ROICalculator";
import { useTranslation } from "react-i18next";
import FofyChat from "@/components/FofyChat";

// Import platform logos
import lovableLogo from "@/assets/platforms/lovable-logo.png";
import boltLogo from "@/assets/platforms/bolt-logo.png";
import v0Logo from "@/assets/platforms/v0-logo.jpg";
import cursorLogo from "@/assets/platforms/cursor-logo.jpg";
import replitLogo from "@/assets/platforms/replit-logo.png";

const Index = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const scrollOffset = useParallax(0.3);
  const mousePosition = useMouseParallax(15);

  const platforms = [
    { name: "Lovable", logo: lovableLogo },
    { name: "Bolt", logo: boltLogo },
    { name: "v0", logo: v0Logo },
    { name: "Cursor", logo: cursorLogo },
    { name: "Replit", logo: replitLogo },
  ];

  const hosters = [
    { name: "Hetzner", icon: Server, color: "text-red-500" },
    { name: "OVH", icon: Cloud, color: "text-sky-500" },
    { name: "DigitalOcean", icon: Droplets, color: "text-blue-400" },
    { name: "Scaleway", icon: Zap, color: "text-purple-500" },
    { name: "Your VPS", icon: Globe, color: "text-green-500" },
  ];

  // 3 Features Vibe-Friendly essentielles
  const vibeFeatures = [
    {
      icon: Terminal,
      title: t('features.noTerminal.title'),
      description: t('features.noTerminal.description'),
      badge: t('features.noTerminal.badge'),
    },
    {
      icon: PiggyBank,
      title: t('features.divideCosts.title'),
      description: t('features.divideCosts.description'),
      badge: null,
    },
    {
      icon: Key,
      title: t('features.realIP.title'),
      description: t('features.realIP.description'),
      badge: null,
    },
  ];

  // 4 FAQs essentielles
  const faqs = [
    {
      question: t('faq.q1.question'),
      answer: t('faq.q1.answer')
    },
    {
      question: t('faq.q2.question'),
      answer: t('faq.q2.answer')
    },
    {
      question: t('faq.q3.question'),
      answer: t('faq.q3.answer')
    },
    {
      question: t('faq.q4.question'),
      answer: t('faq.q4.answer')
    }
  ];

  const heroBenefits = [
    t('hero.benefits.noTerminal'),
    t('hero.benefits.divideCosts'),
    t('hero.benefits.realIP'),
    t('hero.benefits.prototypeToEnterprise'),
  ];

  return (
    <>
    <Layout>
      {/* Hero Section - Style Mexlife avec couleurs Inopay + Parallax */}
      <section className="relative overflow-hidden pt-6 pb-12 md:pt-8 md:pb-20 lg:pt-12 lg:pb-28">
        {/* Background avec dégradé subtil + parallax */}
        <div 
          className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-primary/5"
          style={{ transform: `translateY(${scrollOffset * 0.5}px)` }}
        />
        
        {/* Floating shapes avec parallax - hidden on mobile for performance */}
        <div 
          className="hidden md:block absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl -z-10"
          style={{ 
            transform: `translate(${mousePosition.x * 0.5}px, ${mousePosition.y * 0.5 - scrollOffset * 0.2}px)` 
          }}
        />
        <div 
          className="hidden md:block absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl -z-10"
          style={{ 
            transform: `translate(${-mousePosition.x * 0.3}px, ${-mousePosition.y * 0.3 + scrollOffset * 0.1}px)` 
          }}
        />
        
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            {/* Left Column - Visual Mockup (hidden on mobile, shown on tablet+) */}
            <div 
              className="relative hidden md:block order-2 lg:order-1 animate-fade-in-up" 
              style={{ 
                animationDelay: "0.25s",
                transform: `translateY(${-scrollOffset * 0.1}px)`
              }}
            >
              <div className="relative">
                <div 
                  className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 rounded-3xl blur-2xl opacity-60"
                  style={{ 
                    transform: `translate(${mousePosition.x * 0.3}px, ${mousePosition.y * 0.3}px)` 
                  }}
                />
                
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
                        <span className="text-sm font-medium text-foreground">{t('hero.vibeScore')}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-center">
                          <p className="text-lg font-bold text-primary">95%</p>
                          <p className="text-[10px] text-muted-foreground">Vibe</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-accent">12%</p>
                          <p className="text-[10px] text-muted-foreground">{t('pulse.score')}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="text-center">
                          <p className="text-lg font-bold text-success">100%</p>
                          <p className="text-[10px] text-muted-foreground">{t('hero.after')}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                          <Code2 className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <span className="text-xs text-muted-foreground">{t('process.step1.description')}</span>
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
                        <span className="text-xs text-muted-foreground">{t('process.step3.description')}</span>
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
                        <p className="text-2xl font-bold text-accent">{t('hero.tenMinutes').split(' ')[0]} {t('hero.tenMinutes').split(' ')[1]}</p>
                        <p className="text-xs text-muted-foreground">{t('hero.deploymentIn')}</p>
                      </div>
                      <div className="flex-1 p-3 rounded-xl bg-primary/10 text-center">
                        <p className="text-2xl font-bold text-primary">24/7</p>
                        <p className="text-xs text-muted-foreground">{t('hero.monitoring')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating badges - hidden on tablet, shown on desktop */}
                <div 
                  className="hidden lg:flex absolute -top-4 -right-4 px-4 py-2 rounded-xl bg-card border border-border shadow-lg items-center gap-2"
                  style={{ 
                    transform: `translate(${mousePosition.x * 0.8}px, ${mousePosition.y * 0.8}px)`,
                    transition: 'transform 0.1s ease-out'
                  }}
                >
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{t('hero.zeroKnowledge')}</span>
                </div>
                
                <div 
                  className="hidden lg:flex absolute top-1/3 -right-6 px-4 py-2 rounded-xl bg-card border border-border shadow-lg items-center gap-2"
                  style={{ 
                    transform: `translate(${mousePosition.x * -0.5}px, ${mousePosition.y * -0.5}px)`,
                    transition: 'transform 0.15s ease-out'
                  }}
                >
                  <Terminal className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{t('hero.benefits.noTerminal').split(' ').slice(0, 2).join(' ')}</span>
                </div>
                
                <div 
                  className="hidden lg:flex absolute -bottom-4 right-1/4 px-4 py-2 rounded-xl bg-primary text-primary-foreground shadow-lg items-center gap-2"
                  style={{ 
                    transform: `translate(${mousePosition.x * 0.6}px, ${mousePosition.y * -0.6}px)`,
                    transition: 'transform 0.12s ease-out'
                  }}
                >
                  <Zap className="h-4 w-4" />
                  <span className="text-sm font-medium">{t('hero.vibeToProd')}</span>
                </div>
              </div>
            </div>

            {/* Right Column - Content (style Mexlife) avec parallax scroll */}
            <div 
              className="max-w-xl order-1 lg:order-2"
              style={{ transform: `translateY(${scrollOffset * 0.05}px)` }}
            >
              {/* Badge arrondi style Mexlife */}
              <div className="inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-full border-2 border-accent text-accent text-xs md:text-sm font-semibold uppercase tracking-wide mb-6 md:mb-8 animate-fade-in">
                <Palette className="h-3 w-3 md:h-4 md:w-4" />
                {t('hero.badge')}
              </div>

              {/* Titre principal style Mexlife */}
              <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-[3.5rem] font-bold tracking-tight mb-3 md:mb-4 animate-fade-in-up leading-tight">
                <span className="text-accent">{t('hero.titleLine1')}</span>
                <br />
                <span className="text-primary">{t('hero.titleLine2')}</span>
              </h1>

              {/* Sous-titre en italique */}
              <p className="text-lg md:text-xl text-primary italic font-medium mb-6 md:mb-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                {t('hero.subtitle')}
              </p>

              {/* Description */}
              <p className="text-base md:text-lg text-muted-foreground mb-6 md:mb-8 animate-fade-in-up leading-relaxed" style={{ animationDelay: "0.15s" }}>
                {t('hero.description')} <strong className="text-foreground">{t('hero.descriptionBold')}</strong>
              </p>

              {/* Liste des avantages */}
              <ul className="space-y-3 md:space-y-4 mb-8 md:mb-10 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                {heroBenefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground font-medium">{benefit}</span>
                  </li>
                ))}
              </ul>

              {/* Section "Call Now" style - avec icône Rocket animée */}
              <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                  <Rocket className="h-6 w-6 md:h-8 md:w-8 text-primary" />
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground">{t('hero.deploymentIn')}</p>
                  <p className="text-xl md:text-2xl font-bold text-accent">{t('hero.tenMinutes')}</p>
                </div>
              </div>

              {/* CTA Button arrondi style Mexlife */}
              <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                <Link to={user ? "/dashboard" : "/auth"}>
                  <Button 
                    size="lg" 
                    className="text-base md:text-lg px-6 py-5 md:px-10 md:py-7 rounded-full shadow-xl hover:shadow-2xl transition-all bg-primary hover:bg-primary/90 uppercase font-semibold tracking-wide w-full sm:w-auto"
                  >
                    {t('hero.cta')}
                    <ArrowRight className="ml-2 md:ml-3 h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </Link>
                
                <p className="mt-3 md:mt-4 text-xs md:text-sm text-muted-foreground flex items-center gap-2">
                  <Unlock className="h-3 w-3 md:h-4 md:w-4" />
                  {t('hero.ctaSubtext')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plateformes + Process Compact - Premium Design */}
      <section className="py-12 md:py-16 border-b border-border bg-gradient-to-b from-muted/40 via-background to-muted/30 relative overflow-hidden">
        {/* Decorative background elements - hidden on mobile */}
        <div className="hidden md:block absolute top-0 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="hidden md:block absolute bottom-0 right-1/4 w-48 h-48 bg-accent/5 rounded-full blur-3xl -z-10" />
        
        <div className="container mx-auto px-4">
          {/* Section title */}
          <p className="text-center text-xs md:text-sm text-muted-foreground mb-6 md:mb-8 uppercase tracking-widest font-medium">
            {t('platforms.title')}
          </p>
          
          {/* Plateformes avec vrais logos */}
          <div className="flex flex-nowrap md:flex-wrap justify-start md:justify-center gap-3 md:gap-4 mb-8 md:mb-12 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
            {platforms.map((platform, index) => (
              <div 
                key={platform.name}
                className="inline-flex items-center justify-center px-5 py-3 md:px-6 md:py-4 rounded-2xl bg-card border border-border/60 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 hover:scale-105 transition-all duration-300 cursor-default group animate-fade-in shrink-0"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <img 
                  src={platform.logo} 
                  alt={`${platform.name} logo`}
                  className="h-6 w-auto md:h-8 object-contain group-hover:scale-110 transition-transform"
                />
              </div>
            ))}
          </div>

          {/* 3 étapes visuelles - Premium - Stacked on mobile */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 max-w-2xl mx-auto mb-8 md:mb-12 relative">
            {/* Connecting line - horizontal on desktop, vertical on mobile */}
            <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-border via-primary/30 to-primary -translate-y-1/2 -z-10" />
            <div className="md:hidden absolute top-1/4 bottom-1/4 left-1/2 w-0.5 bg-gradient-to-b from-border via-primary/30 to-primary -translate-x-1/2 -z-10" />
            
            {/* Étape 1 - Votre code */}
            <div className="flex flex-row md:flex-col items-center gap-3 animate-fade-in w-full md:w-auto" style={{ animationDelay: '200ms' }}>
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-background border border-border/60 shadow-lg shadow-black/5 flex items-center justify-center hover:shadow-xl hover:border-border transition-all duration-300 group shrink-0">
                <Upload className="h-6 w-6 md:h-8 md:w-8 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <span className="text-sm text-muted-foreground font-medium">{t('process.step1.description')}</span>
            </div>
            
            {/* Flèche 1 - Rotated on mobile */}
            <div className="flex items-center animate-fade-in rotate-90 md:rotate-0" style={{ animationDelay: '300ms' }}>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowRight className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
            </div>
            
            {/* Étape 2 - Inopay (highlight) */}
            <div className="flex flex-row md:flex-col items-center gap-3 animate-fade-in w-full md:w-auto" style={{ animationDelay: '400ms' }}>
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/40 shadow-lg shadow-primary/20 flex items-center justify-center relative overflow-hidden group shrink-0">
                <div className="absolute inset-0 bg-primary/10 animate-pulse" />
                <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-primary relative z-10" />
              </div>
              <span className="text-sm text-primary font-semibold">Inopay</span>
            </div>
            
            {/* Flèche 2 - Rotated on mobile */}
            <div className="flex items-center animate-fade-in rotate-90 md:rotate-0" style={{ animationDelay: '500ms' }}>
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ArrowRight className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
            </div>
            
            {/* Étape 3 - Votre VPS */}
            <div className="flex flex-row md:flex-col items-center gap-3 animate-fade-in w-full md:w-auto" style={{ animationDelay: '600ms' }}>
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 group shrink-0">
                <Server className="h-6 w-6 md:h-8 md:w-8 text-primary-foreground group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-sm text-foreground font-medium">{t('process.step3.description')}</span>
            </div>
          </div>

          {/* Hébergeurs - Modern badges - scrollable on mobile */}
          <div className="flex flex-nowrap md:flex-wrap justify-start md:justify-center gap-2 md:gap-3 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
            {hosters.map((hoster, index) => (
              <div 
                key={hoster.name}
                className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm rounded-full bg-background border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300 cursor-default group animate-fade-in shrink-0"
                style={{ animationDelay: `${700 + index * 100}ms` }}
              >
                <hoster.icon className={`h-3 w-3 md:h-4 md:w-4 ${hoster.color} group-hover:scale-110 transition-transform`} />
                <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors whitespace-nowrap">{hoster.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Features Vibe-Friendly */}
      <section className="py-12 md:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <Badge className="mb-3 md:mb-4 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" />
              {t('hero.badge')}
            </Badge>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
              {t('features.title')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto">
            {vibeFeatures.map((feature) => (
              <div 
                key={feature.title}
                className="relative p-4 md:p-6 rounded-xl md:rounded-2xl border border-border bg-card card-shadow card-hover group"
              >
                {feature.badge && (
                  <Badge className="absolute -top-2.5 md:-top-3 right-3 md:right-4 bg-primary/10 text-primary border-primary/20 text-[10px] md:text-xs">
                    {feature.badge}
                  </Badge>
                )}
                <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg md:rounded-xl bg-primary/10 text-primary mb-3 md:mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <feature.icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <h3 className="text-base md:text-lg font-semibold mb-1.5 md:mb-2 text-foreground">{feature.title}</h3>
                <p className="text-xs md:text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section - After Features */}
      <section className="py-12 md:py-16 lg:py-20 bg-gradient-to-b from-muted/30 to-transparent border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-12">
            <Badge className="mb-3 md:mb-4 bg-primary/10 text-primary border-primary/20">
              <Package className="h-3 w-3 mr-1" />
              {t('services.badge', 'Services')}
            </Badge>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground mb-2">
              {t('services.title', 'On vous accompagne après la libération')}
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
              {t('services.subtitle', 'Déploiement, serveurs et monitoring pour mettre votre vibe en production')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 md:gap-6 max-w-4xl mx-auto mb-8">
            {/* Déploiement */}
            <div className="relative p-5 md:p-6 rounded-xl border-2 border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                <Rocket className="h-6 w-6 text-emerald-500 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('services.deploy.title', 'Déploiement Assisté')}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {t('services.deploy.desc', 'On déploie votre projet sur votre serveur avec Docker, SSL et DNS')}
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-emerald-500" />
                  Docker automatisé
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-emerald-500" />
                  SSL/HTTPS inclus
                </li>
              </ul>
            </div>

            {/* Monitoring */}
            <div className="relative p-5 md:p-6 rounded-xl border-2 border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <Activity className="h-6 w-6 text-blue-500 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('services.monitoring.title', 'Monitoring 24/7')}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {t('services.monitoring.desc', 'Surveillance continue avec alertes et rapports de performance')}
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-blue-500" />
                  Alertes en temps réel
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-blue-500" />
                  Détection de pannes
                </li>
              </ul>
            </div>

            {/* Serveur */}
            <div className="relative p-5 md:p-6 rounded-xl border-2 border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40 transition-all group">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-4 group-hover:bg-amber-500 group-hover:text-white transition-all">
                <Server className="h-6 w-6 text-amber-500 group-hover:text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t('services.server.title', 'Serveur VPS')}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {t('services.server.desc', 'On configure votre propre serveur Hetzner avec Coolify')}
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-amber-500" />
                  VPS optimisé
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-amber-500" />
                  Accès root complet
                </li>
              </ul>
            </div>
          </div>

          {/* Offres Principales */}
          <div className="max-w-3xl mx-auto">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Libération Unique */}
              <div className="relative p-5 md:p-6 rounded-xl border-2 border-primary/50 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 hover:border-primary transition-all">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-lg">{t('pricing.liberation.title', 'Libération Unique')}</h4>
                  <span className="text-2xl font-bold text-primary">99$</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('pricing.liberation.desc', 'Nettoyage IA + Déploiement sur votre serveur')}
                </p>
                <Link to="/pricing">
                  <Button variant="outline" className="w-full">
                    <Rocket className="h-4 w-4 mr-2" />
                    {t('common.learnMore', 'En savoir plus')}
                  </Button>
                </Link>
              </div>

              {/* Pack Pro */}
              <div className="relative p-5 md:p-6 rounded-xl border-2 border-primary bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
                <Badge className="absolute -top-3 left-4 bg-primary text-primary-foreground">
                  <Package className="h-3 w-3 mr-1" />
                  {t('pricing.packPro.badge', 'ÉCONOMISEZ 68$')}
                </Badge>
                <div className="flex items-center justify-between mb-3 pt-2">
                  <h4 className="font-semibold text-lg">{t('pricing.packPro.title', 'Pack Pro')}</h4>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-primary">149$</span>
                    <span className="text-sm text-muted-foreground line-through ml-2">217$</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('pricing.packPro.desc', 'Libération + VPS + Monitoring 1 an')}
                </p>
                <Link to="/pricing">
                  <Button className="w-full">
                    <Zap className="h-4 w-4 mr-2" />
                    {t('pricing.packPro.cta', 'Choisir le Pack Pro')}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <ROICalculator currency="CAD" />

      {/* FAQ Compact - 4 questions */}
      <section className="py-12 md:py-16 lg:py-20 bg-muted/30 border-y border-border">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 md:mb-10">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full border border-border bg-background text-muted-foreground text-xs md:text-sm font-medium mb-3 md:mb-4">
              <HelpCircle className="h-3 w-3 md:h-4 md:w-4" />
              FAQ
            </div>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-foreground">
              {t('faq.title')}
            </h2>
          </div>

          <div className="max-w-2xl mx-auto">
            <Accordion type="single" collapsible className="space-y-2 md:space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem 
                  key={index} 
                  value={`item-${index}`}
                  className="border border-border rounded-lg md:rounded-xl px-4 md:px-5 bg-card data-[state=open]:border-primary/30"
                >
                  <AccordionTrigger className="text-left font-medium text-foreground hover:text-primary py-3 md:py-4 text-xs md:text-sm">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-3 md:pb-4 text-xs md:text-sm leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA + Mini-Témoignage intégré */}
      <section className="py-12 md:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            {/* Mini témoignage inline */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 md:gap-3 mb-6 md:mb-8 p-3 md:p-4 rounded-lg md:rounded-xl bg-muted/50 border border-border">
              <Quote className="h-4 w-4 md:h-5 md:w-5 text-primary/50 flex-shrink-0" />
              <p className="text-xs md:text-sm text-muted-foreground italic text-center sm:text-left">
                {t('cta.testimonial')}
              </p>
              <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">{t('cta.testimonialAuthor')}</span>
            </div>

            <Badge className="mb-3 md:mb-4 bg-primary/10 text-primary border-primary/20">
              <Palette className="h-3 w-3 mr-1" />
              {t('hero.vibeToProduction')}
            </Badge>
            
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold mb-3 md:mb-4 text-foreground">
              {t('cta.title')}
            </h2>
            
            <p className="text-sm md:text-base text-muted-foreground mb-6 md:mb-8">
              {t('cta.description')}
            </p>
            
            <Link to={user ? "/dashboard" : "/auth"}>
              <Button size="lg" className="text-base md:text-lg px-6 py-4 md:px-8 md:py-6 rounded-xl shadow-lg hover:shadow-xl transition-all w-full sm:w-auto">
                <Rocket className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                {user ? t('cta.buttonLoggedIn') : t('cta.button')}
                <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
    
    {/* FOFY - AI Assistant */}
    <FofyChat />
    </>
  );
};

export default Index;
