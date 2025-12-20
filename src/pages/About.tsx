import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Shield, Users, Target, Lightbulb } from "lucide-react";
import Layout from "@/components/layout/Layout";

const About = () => {
  const values = [
    {
      icon: Shield,
      title: "Liberté",
      description: "Votre code vous appartient. Nous croyons que vous devez pouvoir l'exécuter où vous voulez, quand vous voulez.",
    },
    {
      icon: Target,
      title: "Transparence",
      description: "Nous analysons votre code localement et ne stockons aucune donnée. Votre propriété intellectuelle reste privée.",
    },
    {
      icon: Lightbulb,
      title: "Simplicité",
      description: "Un outil intuitif qui donne des résultats clairs et actionnables, sans jargon technique inutile.",
    },
    {
      icon: Users,
      title: "Communauté",
      description: "Construit par des développeurs, pour des développeurs. Nous comprenons vos besoins.",
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
              Nous construisons des outils pour aider les développeurs à reprendre 
              le contrôle de leurs projets générés par IA.
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
                  Les plateformes de génération de code IA comme Lovable, Bolt, v0 et d'autres 
                  ont révolutionné la façon dont nous créons des applications. Mais elles 
                  créent aussi un nouveau type de dépendance : le <strong className="text-foreground">vendor lock-in</strong>.
                </p>
                <p className="text-muted-foreground mb-4">
                  Votre projet utilise des configurations, des imports et des dépendances 
                  spécifiques à chaque plateforme. Résultat ? Il devient difficile de migrer 
                  votre code vers vos propres serveurs.
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">Inopay résout ce problème.</strong> Notre outil analyse 
                  automatiquement votre projet et vous guide vers une migration réussie.
                </p>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-border/50 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">🔓</div>
                    <p className="text-lg font-medium">Libérez votre code</p>
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
              Prêt à essayer ?
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Analysez votre premier projet gratuitement et découvrez son niveau de portabilité.
            </p>
            <Link to="/dashboard">
              <Button size="lg" className="glow-primary text-lg px-10 py-6">
                Analyser mon projet
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
