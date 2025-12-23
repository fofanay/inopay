import Layout from "@/components/layout/Layout";
import FofyChat from "@/components/FofyChat";
import { Shield, Database, CreditCard, UserCheck, Lock, Mail } from "lucide-react";

const Privacy = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-accent text-white py-16">
          <div className="container mx-auto px-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-primary/20">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">Politique de Confidentialité</h1>
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
                <Lock className="h-6 w-6 text-primary" />
                1. Introduction
              </h2>
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  <strong>Inovaq Canada Inc.</strong> (« nous », « notre », « nos ») s'engage à 
                  protéger la vie privée de ses utilisateurs conformément à la <strong>Loi 25 
                  du Québec</strong> (Loi modernisant des dispositions législatives en matière 
                  de protection des renseignements personnels).
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Cette politique décrit comment nous collectons, utilisons et protégeons 
                  vos renseignements personnels lorsque vous utilisez nos services.
                </p>
              </div>
            </section>

            {/* Data Controller */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-4">
                <UserCheck className="h-6 w-6 text-primary" />
                2. Responsable de la Protection des Données
              </h2>
              <div className="bg-primary/10 border border-primary/30 rounded-xl p-6">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Conformément à la Loi 25 du Québec, nous avons désigné un responsable 
                  de la protection des renseignements personnels que vous pouvez contacter 
                  pour toute question relative à vos données :
                </p>
                <div className="flex items-center gap-3 bg-background/50 rounded-lg p-4">
                  <Mail className="h-5 w-5 text-primary" />
                  <a href="mailto:contact@getinopay.com" className="text-primary font-medium hover:underline">
                    contact@getinopay.com
                  </a>
                </div>
              </div>
            </section>

            {/* Data Collection */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-4">
                <Database className="h-6 w-6 text-primary" />
                3. Données Collectées
              </h2>
              <div className="space-y-6 text-muted-foreground">
                <p className="leading-relaxed">
                  Nous collectons les types de données suivantes :
                </p>
                
                <div className="grid gap-4">
                  <div className="bg-muted/50 rounded-lg p-4 border border-border">
                    <h3 className="font-semibold text-foreground mb-2">Données d'identification</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Adresse email</li>
                      <li>Nom d'utilisateur</li>
                      <li>Mot de passe (chiffré)</li>
                    </ul>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-4 border border-border">
                    <h3 className="font-semibold text-foreground mb-2">Données techniques</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Adresse IP</li>
                      <li>Informations sur le navigateur</li>
                      <li>Logs de connexion</li>
                      <li>Données de synchronisation GitHub (tokens)</li>
                    </ul>
                  </div>
                  
                  <div className="bg-muted/50 rounded-lg p-4 border border-border">
                    <h3 className="font-semibold text-foreground mb-2">Données de paiement</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Historique des transactions</li>
                      <li>Informations de facturation (traitées par Stripe)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Supabase Usage */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-4">
                <Database className="h-6 w-6 text-primary" />
                4. Stockage des Données - Supabase
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  Vos données sont stockées de manière sécurisée via <strong>Supabase</strong>, 
                  une plateforme de base de données conforme aux normes de sécurité internationales.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <h3 className="font-semibold text-foreground mb-2">Mesures de sécurité :</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Chiffrement des données au repos et en transit (TLS 1.3)</li>
                    <li>Politiques de sécurité au niveau des lignes (RLS)</li>
                    <li>Authentification sécurisée avec tokens JWT</li>
                    <li>Sauvegardes automatiques quotidiennes</li>
                    <li>Hébergement sur infrastructure AWS conforme SOC 2</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Stripe Usage */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground flex items-center gap-2 mb-4">
                <CreditCard className="h-6 w-6 text-primary" />
                5. Traitement des Paiements - Stripe
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  Les paiements sont traités de manière sécurisée par <strong>Stripe</strong>, 
                  un prestataire de services de paiement certifié PCI-DSS Level 1.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 border border-border">
                  <h3 className="font-semibold text-foreground mb-2">Informations importantes :</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Nous ne stockons jamais vos numéros de carte bancaire</li>
                    <li>Stripe gère toutes les informations de paiement sensibles</li>
                    <li>Toutes les transactions sont chiffrées de bout en bout</li>
                    <li>Conformité PCI-DSS garantie par Stripe</li>
                  </ul>
                </div>
                <p className="text-sm">
                  Pour plus d'informations, consultez la{" "}
                  <a 
                    href="https://stripe.com/privacy" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    politique de confidentialité de Stripe
                  </a>.
                </p>
              </div>
            </section>

            {/* Your Rights */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                6. Vos Droits (Loi 25 du Québec)
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  Conformément à la Loi 25, vous disposez des droits suivants :
                </p>
                <div className="grid gap-3">
                  <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4 border border-border">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">1</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Droit d'accès</h3>
                      <p className="text-sm">Obtenir une copie de vos renseignements personnels</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4 border border-border">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">2</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Droit de rectification</h3>
                      <p className="text-sm">Corriger des informations inexactes ou incomplètes</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4 border border-border">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">3</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Droit de suppression</h3>
                      <p className="text-sm">Demander l'effacement de vos données personnelles</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4 border border-border">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">4</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Droit de retrait du consentement</h3>
                      <p className="text-sm">Retirer votre consentement à tout moment</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-muted/50 rounded-lg p-4 border border-border">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-sm">5</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Droit à la portabilité</h3>
                      <p className="text-sm">Recevoir vos données dans un format structuré</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm mt-4">
                  Pour exercer ces droits, contactez-nous à{" "}
                  <a href="mailto:contact@getinopay.com" className="text-primary hover:underline">
                    contact@getinopay.com
                  </a>. 
                  Nous répondrons dans un délai de 30 jours.
                </p>
              </div>
            </section>

            {/* Data Retention */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                7. Conservation des Données
              </h2>
              <div className="space-y-4 text-muted-foreground">
                <p className="leading-relaxed">
                  Nous conservons vos données personnelles aussi longtemps que nécessaire 
                  pour fournir nos services et respecter nos obligations légales :
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li><strong>Données de compte :</strong> Pendant la durée de votre abonnement + 3 ans</li>
                  <li><strong>Données de facturation :</strong> 7 ans (obligations fiscales)</li>
                  <li><strong>Logs techniques :</strong> 12 mois</li>
                </ul>
              </div>
            </section>

            {/* Contact */}
            <section className="mb-12">
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                8. Contact
              </h2>
              <div className="bg-muted/50 rounded-xl p-6 border border-border">
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Pour toute question concernant cette politique ou pour exercer vos droits :
                </p>
                <div className="space-y-2">
                  <p className="font-medium text-foreground">
                    Responsable de la protection des données
                  </p>
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

export default Privacy;
