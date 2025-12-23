import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Shield, Zap, Target, Server, RefreshCw, Lock } from "lucide-react";
import Layout from "@/components/layout/Layout";
import FofyChat from "@/components/FofyChat";
import { useTranslation } from "react-i18next";

const About = () => {
  const { t } = useTranslation();

  const values = [
    {
      icon: Server,
      title: t('about.values.autonomy.title'),
      description: t('about.values.autonomy.description'),
    },
    {
      icon: Zap,
      title: t('about.values.automation.title'),
      description: t('about.values.automation.description'),
    },
    {
      icon: Lock,
      title: t('about.values.security.title'),
      description: t('about.values.security.description'),
    },
    {
      icon: RefreshCw,
      title: t('about.values.reliability.title'),
      description: t('about.values.reliability.description'),
    },
  ];

  return (
    <Layout>
      {/* Hero */}
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 animate-fade-in">
              {t('about.heroTitle')}<span className="text-primary">Inopay</span>
            </h1>
            <p className="text-xl text-muted-foreground animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              {t('about.heroSubtitle')}
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
                <h2 className="text-3xl font-bold mb-6">{t('about.missionTitle')}</h2>
                <p className="text-muted-foreground mb-4">
                  {t('about.missionP1')}
                </p>
                <p className="text-muted-foreground mb-4">
                  {t('about.missionP2')}
                </p>
                <p className="text-muted-foreground">
                  <strong className="text-foreground">{t('about.missionP3')}</strong> {t('about.missionP3Bold')}
                </p>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-border/50 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="text-6xl mb-4">🚀</div>
                    <p className="text-lg font-medium">{t('about.missionStats')}</p>
                    <p className="text-sm text-muted-foreground">{t('about.missionStatsDesc')}</p>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('about.valuesTitle')}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t('about.valuesSubtitle')}
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
              {t('about.ctaTitle')}
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              {t('about.ctaDescription')}
            </p>
            <Link to="/dashboard">
              <Button size="lg" className="glow-primary text-lg px-10 py-6">
                {t('about.ctaButton')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <FofyChat />
    </Layout>
  );
};

export default About;
