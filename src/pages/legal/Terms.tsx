import Layout from "@/components/layout/Layout";
import FofyChat from "@/components/FofyChat";
import { FileText, AlertCircle, Shield, CreditCard, Scale } from "lucide-react";

const Terms = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-accent text-white py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">Conditions de Service</h1>
            </div>
            <p className="text-white/70 max-w-2xl">
              Dernière mise à jour : 21 décembre 2025
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto prose prose-lg prose-slate dark:prose-invert">
            
            {/* Introduction */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-4">
                <Scale className="h-6 w-6 text-primary" />
                1. Informations Légales
              </h2>
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Les présentes Conditions de Service (« Conditions ») régissent votre utilisation 
                  des services fournis par <strong>Inovaq Canada Inc.</strong>, société constituée 
                  en vertu des lois de la province de Québec, Canada.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  En utilisant nos services, vous acceptez d'être lié par ces Conditions. 
                  Si vous n'acceptez pas ces Conditions, veuillez ne pas utiliser nos services.
                </p>
              </div>
            </section>

            {/* Services Description */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-4">
                <Shield className="h-6 w-6 text-primary" />
                2. Description des Services
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  Inopay offre les services suivants :
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Nettoyage automatique du code généré par IA</li>
                  <li>Déploiement sur serveurs VPS (Hetzner, OVH, DigitalOcean, etc.)</li>
                  <li>Configuration SSL et monitoring 24/7</li>
                  <li>Synchronisation GitHub automatique</li>
                  <li>Services de redéploiement et maintenance</li>
                </ul>
              </div>
            </section>

            {/* Refund Policy - IMPORTANT */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-4">
                <CreditCard className="h-6 w-6 text-primary" />
                3. Politique de Remboursement
              </h2>
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      Services à l'Acte - Ventes Finales
                    </h3>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      <strong>Les ventes de « Services à l'acte » (déploiements, nettoyage de code, 
                      configurations) sont finales et non remboursables une fois le processus 
                      de nettoyage entamé.</strong>
                    </p>
                    <p className="text-muted-foreground leading-relaxed">
                      Cette politique s'explique par la nature irréversible du travail effectué : 
                      dès que le processus de nettoyage commence, des ressources serveur sont 
                      allouées et le travail technique est initié. Nous vous encourageons à 
                      bien évaluer vos besoins avant tout achat.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-muted-foreground">
                <h3 className="font-semibold text-foreground">Exceptions :</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>
                    <strong>Échec technique de notre part :</strong> Si nous ne parvenons pas 
                    à déployer votre application pour des raisons techniques imputables à 
                    notre service, un remboursement complet sera effectué.
                  </li>
                  <li>
                    <strong>Abonnements :</strong> Les abonnements de monitoring peuvent être 
                    annulés à tout moment. L'accès reste actif jusqu'à la fin de la période 
                    de facturation en cours.
                  </li>
                </ul>
              </div>
            </section>

            {/* User Obligations */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                4. Obligations de l'Utilisateur
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">En utilisant nos services, vous vous engagez à :</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Fournir des informations exactes et à jour</li>
                  <li>Maintenir la confidentialité de vos identifiants</li>
                  <li>Ne pas utiliser nos services à des fins illégales</li>
                  <li>Respecter les droits de propriété intellectuelle</li>
                  <li>Ne pas tenter de compromettre la sécurité de nos systèmes</li>
                </ul>
              </div>
            </section>

            {/* Limitation of Liability */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                5. Limitation de Responsabilité
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  Dans les limites permises par la loi, Inovaq Canada Inc. ne pourra être tenue 
                  responsable des dommages indirects, accessoires, spéciaux ou consécutifs 
                  résultant de l'utilisation de nos services.
                </p>
                <p className="leading-relaxed">
                  Notre responsabilité totale ne saurait excéder le montant que vous avez 
                  payé pour les services au cours des douze (12) derniers mois.
                </p>
              </div>
            </section>

            {/* Governing Law */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                6. Droit Applicable
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  Les présentes Conditions sont régies par les lois de la province de Québec 
                  et les lois fédérales du Canada applicables. Tout litige sera soumis à 
                  la compétence exclusive des tribunaux du Québec.
                </p>
              </div>
            </section>

            {/* Modifications */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                7. Modifications
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  Nous nous réservons le droit de modifier ces Conditions à tout moment. 
                  Les modifications prendront effet dès leur publication sur notre site. 
                  Votre utilisation continue de nos services après la publication des 
                  modifications constitue votre acceptation de ces changements.
                </p>
              </div>
            </section>

            {/* Contact */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                8. Contact
              </h2>
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <p className="text-muted-foreground leading-relaxed">
                  Pour toute question concernant ces Conditions de Service, veuillez nous contacter :
                </p>
                <div className="mt-4 space-y-2">
                  <p className="font-medium text-foreground">Inovaq Canada Inc.</p>
                  <p className="text-muted-foreground">
                    Email : <a href="mailto:contact@getinopay.com" className="text-primary hover:underline">
                      contact@getinopay.com
                    </a>
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>
      <FofyChat />
    </Layout>
  );
};

export default Terms;
