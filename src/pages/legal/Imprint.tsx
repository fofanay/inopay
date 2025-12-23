import Layout from "@/components/layout/Layout";
import FofyChat from "@/components/FofyChat";
import { Building2, Mail, Globe, Shield, MapPin } from "lucide-react";

const Imprint = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-accent text-white py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">Mentions Légales</h1>
            </div>
            <p className="text-white/70 max-w-2xl">
              Informations légales et contact
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            
            {/* Company Information */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-6">
                <Building2 className="h-6 w-6 text-primary" />
                Éditeur du Site
              </h2>
              <div className="bg-muted/50 rounded-xl p-8 border border-border">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Raison Sociale
                      </h3>
                      <p className="text-lg font-semibold text-foreground">Inovaq Canada Inc.</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Forme Juridique
                      </h3>
                      <p className="text-foreground">Société par actions (Canada)</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Juridiction
                      </h3>
                      <p className="text-foreground">Province de Québec, Canada</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Siège Social
                        </h3>
                        <p className="text-foreground">Québec, Canada</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Email de Contact
                        </h3>
                        <a 
                          href="mailto:contact@getinopay.com" 
                          className="text-primary hover:underline font-medium"
                        >
                          contact@getinopay.com
                        </a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Globe className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
                          Site Web
                        </h3>
                        <a 
                          href="https://getinopay.com" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          getinopay.com
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Support */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-6">
                <Mail className="h-6 w-6 text-primary" />
                Support et Assistance
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-muted/50 rounded-xl p-6 border border-border">
                  <h3 className="font-semibold text-foreground mb-3">Support Technique</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Pour toute question technique concernant nos services de déploiement 
                    et de nettoyage de code.
                  </p>
                  <a 
                    href="mailto:contact@getinopay.com" 
                    className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                  >
                    <Mail className="h-4 w-4" />
                    contact@getinopay.com
                  </a>
                </div>
                <div className="bg-muted/50 rounded-xl p-6 border border-border">
                  <h3 className="font-semibold text-foreground mb-3">Support Commercial</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Pour les questions relatives à la facturation, aux abonnements 
                    et aux partenariats.
                  </p>
                  <a 
                    href="mailto:contact@getinopay.com" 
                    className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                  >
                    <Mail className="h-4 w-4" />
                    contact@getinopay.com
                  </a>
                </div>
              </div>
            </section>

            {/* Hosting */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-6">
                <Globe className="h-6 w-6 text-primary" />
                Hébergement
              </h2>
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Infrastructure
                    </h3>
                    <p className="text-foreground">
                      Ce site est hébergé sur une infrastructure cloud sécurisée 
                      avec des serveurs répartis mondialement.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Base de données
                    </h3>
                    <p className="text-foreground">Supabase (infrastructure AWS)</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      Paiements
                    </h3>
                    <p className="text-foreground">Stripe Inc. (certifié PCI-DSS)</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Intellectual Property */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-6">
                <Shield className="h-6 w-6 text-primary" />
                Propriété Intellectuelle
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  L'ensemble du contenu de ce site (textes, images, logos, graphismes, 
                  icônes, logiciels) est la propriété exclusive d'Inovaq Canada Inc. 
                  ou de ses partenaires et est protégé par les lois canadiennes et 
                  internationales relatives à la propriété intellectuelle.
                </p>
                <p className="leading-relaxed">
                  Toute reproduction, représentation, modification, publication, transmission, 
                  ou plus généralement toute exploitation non autorisée du site ou de l'un 
                  quelconque de ses éléments est interdite et constitue une contrefaçon.
                </p>
              </div>
            </section>

            {/* Trademark */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-6">
                Marques
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  <strong>Inopay</strong> est une marque d'Inovaq Canada Inc. 
                  Toutes les autres marques mentionnées sur ce site appartiennent 
                  à leurs propriétaires respectifs.
                </p>
              </div>
            </section>

            {/* Made in Quebec Badge */}
            <section className="mb-12">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-8 border border-primary/20 text-center">
                <p className="text-2xl font-bold text-foreground mb-2">
                  🍁 Fait avec passion au Québec
                </p>
                <p className="text-muted-foreground">
                  © 2025 Inovaq Canada Inc. Tous droits réservés.
                </p>
              </div>
            </section>

          </div>
        </div>
      </div>
      <FofyChat />
    </Layout>
  );
};

export default Imprint;
