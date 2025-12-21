import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Shield, Zap, Target, Server, RefreshCw, Lock } from "lucide-react";
import Layout from "@/components/layout/Layout";

const About = () => {
  const values = [
    {
      icon: Server,
      title: "Autonomie",
      description: "Votre serveur, vos données, votre contrôle total. Aucune dépendance à une plateforme tierce.",
    },
    {
      icon: Zap,
      title: "Automatisation",
      description: "Zéro configuration manuelle. Docker, PostgreSQL et SSL installés automatiquement.",
    },
    {
      icon: Lock,
      title: "Sécurité Zero-Knowledge",
      description: "Vos credentials sont effacés après déploiement. Nous ne stockons aucun secret.",
    },
    {
      icon: RefreshCw,
      title: "Fiabilité",
      description: "Monitoring 24/7 avec auto-recovery. Votre app reste en ligne même en cas de panne.",
    },
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 animate-fade-in">
              À propos d'<span className="text-primary">Inopay</span>
            </h1>
            <p className="text-xl text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              La plateforme qui automatise le déploiement de vos projets IA 
              sur votre propre infrastructure.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 bg-card/30 border-y border-border/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-6">Notre mission</h2>
                <p className="text-muted-foreground mb-4">
                  Les plateformes IA comme Lovable, Bolt et Cursor ont révolutionné 
                  la création d'applications. Mais mettre ce code en production reste 
                  un cauchemar technique.
                </p>
                <p className="text-muted-foreground mb-4">
                  Configuration Docker, provisionnement de base de données, certificats SSL, 
                  monitoring... Autant d'obstacles entre votre idée et sa mise en ligne.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Inopay automatise tout.</strong> Du nettoyage 
                  du code propriétaire jusqu'au déploiement sur votre propre VPS, en passant 
                  par le monitoring 24/7 avec auto-recovery.
                </p>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-border/50 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">🚀</div>
                    <p className="text-lg font-medium">10 minutes</p>
                    <p className="text-sm text-muted-foreground">Du code à la production</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Nos valeurs</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Les principes qui guident notre développement
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {values.map((value) => (
              <Card key={value.title} className="border-border/50 bg-card/50 hover:border-primary/30 transition-all group">
                <CardContent className="pt-8 pb-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <value.icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-semibold mb-3">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 lg:py-32 bg-card/30 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Prêt à déployer ?
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Analysez votre projet gratuitement et mettez-le en production sur votre VPS en 10 minutes.
            </p>
            <Link to="/dashboard">
              <Button size="lg" className="glow-primary text-lg px-10 py-6">
                Déployer mon projet
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
