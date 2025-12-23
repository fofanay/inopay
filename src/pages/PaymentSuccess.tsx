import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  Rocket, 
  RefreshCw, 
  Activity, 
  Server, 
  Loader2, 
  Briefcase,
  Calendar,
  Shield,
  FileCode,
  Cloud,
  Zap,
  Crown,
  Download,
  Settings,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";

interface PurchaseDetails {
  serviceType: string;
  serviceName: string;
  isSubscription: boolean;
}

interface PlanDetails {
  name: string;
  price: string;
  interval: string;
  icon: React.ReactNode;
  color: string;
  features: string[];
}

const PLAN_DETAILS: Record<string, PlanDetails> = {
  confort: {
    name: "Pack Confort",
    price: "49€",
    interval: "/mois",
    icon: <Zap className="h-6 w-6" />,
    color: "from-blue-500 to-cyan-500",
    features: [
      "Nettoyage automatique DeepSeek-V3",
      "Jusqu'à 500 fichiers inclus",
      "Déploiement IONOS en 1 clic",
      "Support prioritaire",
    ],
  },
  souverain: {
    name: "Pack Souverain",
    price: "29€",
    interval: "/mois",
    icon: <Crown className="h-6 w-6" />,
    color: "from-amber-500 to-orange-500",
    features: [
      "Volume illimité BYOK",
      "Votre propre clé API (Claude, GPT-4, DeepSeek)",
      "Audit Zero Shadow Door avancé",
      "Contrôle total de vos données",
    ],
  },
};

const SERVICE_INFO: Record<string, { name: string; icon: React.ReactNode; description: string; action: string; link: string }> = {
  deploy: {
    name: "Déploiement VPS",
    icon: <Rocket className="h-6 w-6" />,
    description: "Votre crédit de déploiement VPS est maintenant disponible.",
    action: "Déployer mon projet",
    link: "/dashboard",
  },
  redeploy: {
    name: "Re-déploiement",
    icon: <RefreshCw className="h-6 w-6" />,
    description: "Votre crédit de re-déploiement est prêt à être utilisé.",
    action: "Mettre à jour mon app",
    link: "/dashboard",
  },
  monitoring: {
    name: "Extension Monitoring",
    icon: <Activity className="h-6 w-6" />,
    description: "Votre abonnement monitoring est maintenant actif.",
    action: "Voir mes abonnements",
    link: "/dashboard?tab=services",
  },
  server: {
    name: "Serveur Supplémentaire",
    icon: <Server className="h-6 w-6" />,
    description: "Votre crédit serveur supplémentaire est disponible.",
    action: "Configurer mon serveur",
    link: "/dashboard",
  },
  portfolio: {
    name: "Plan Portfolio",
    icon: <Briefcase className="h-6 w-6" />,
    description: "Votre abonnement Portfolio est maintenant actif. Déploiements illimités !",
    action: "Voir mon portfolio",
    link: "/dashboard",
  },
};

const NEXT_STEPS = [
  {
    icon: <Download className="h-5 w-5" />,
    title: "1. Importez votre projet",
    description: "Uploadez votre ZIP Lovable depuis le dashboard",
    link: "/dashboard",
    action: "Aller au dashboard",
  },
  {
    icon: <FileCode className="h-5 w-5" />,
    title: "2. Lancez le nettoyage",
    description: "Notre IA analyse et nettoie votre code automatiquement",
    link: "/dashboard",
    action: "Commencer",
  },
  {
    icon: <Cloud className="h-5 w-5" />,
    title: "3. Déployez en 1 clic",
    description: "Hébergez sur votre propre serveur IONOS ou VPS",
    link: "/dashboard",
    action: "Déployer",
  },
  {
    icon: <Settings className="h-5 w-5" />,
    title: "Bonus: Configurez vos préférences",
    description: "API keys, webhooks, notifications...",
    link: "/parametres",
    action: "Paramètres",
  },
];

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<PurchaseDetails | null>(null);
  const [planType, setPlanType] = useState<string | null>(null);
  const { checkSubscription, session, subscription } = useAuth();

  useEffect(() => {
    // Try to get service info from URL params
    const serviceType = searchParams.get("service") || searchParams.get("type");
    const plan = searchParams.get("plan");
    
    if (plan) {
      setPlanType(plan);
    }
    
    if (serviceType && SERVICE_INFO[serviceType]) {
      setPurchase({
        serviceType,
        serviceName: SERVICE_INFO[serviceType].name,
        isSubscription: serviceType === "monitoring" || serviceType === "portfolio",
      });
    }
    
    // Refresh subscription status after successful payment
    if (session?.access_token) {
      // Small delay to allow Stripe webhook to process
      setTimeout(() => {
        console.log("[PAYMENT-SUCCESS] Refreshing subscription status after payment");
        checkSubscription();
      }, 2000);
    }
    
    // Small delay for visual effect
    setTimeout(() => setLoading(false), 800);
  }, [searchParams, session?.access_token, checkSubscription]);

  if (loading) {
    return (
      <Layout>
        <section className="py-24 lg:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-lg mx-auto flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground animate-pulse">Confirmation de votre paiement...</p>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  const serviceInfo = purchase?.serviceType ? SERVICE_INFO[purchase.serviceType] : null;
  const planDetails = planType ? PLAN_DETAILS[planType] : null;
  const nextBillingDate = new Date();
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

  return (
    <Layout>
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-8">
            
            {/* Success Header */}
            <div className="text-center">
              <div className="mx-auto h-24 w-24 rounded-full bg-gradient-to-br from-success/20 to-success/5 flex items-center justify-center mb-6 animate-in zoom-in duration-500">
                <CheckCircle2 className="h-12 w-12 text-success" />
              </div>
              
              <h1 className="text-4xl font-bold mb-3 text-foreground animate-in fade-in slide-in-from-bottom-4 duration-500">
                Paiement confirmé !
              </h1>
              <p className="text-xl text-muted-foreground animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                Bienvenue dans la famille Inopay 🎉
              </p>
            </div>

            {/* Subscription Recap Card */}
            {planDetails ? (
              <Card className="overflow-hidden border-2 border-primary/20 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                <div className={`h-2 bg-gradient-to-r ${planDetails.color}`} />
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${planDetails.color} text-white`}>
                        {planDetails.icon}
                      </div>
                      <div>
                        <CardTitle className="text-2xl">{planDetails.name}</CardTitle>
                        <p className="text-muted-foreground">Abonnement mensuel actif</p>
                      </div>
                    </div>
                    <Badge variant="default" className="bg-success text-success-foreground px-3 py-1">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Actif
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Billing Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Sparkles className="h-4 w-4" />
                        <span className="text-sm">Montant</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground">
                        {planDetails.price}<span className="text-base font-normal text-muted-foreground">{planDetails.interval}</span>
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">Début</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <RefreshCw className="h-4 w-4" />
                        <span className="text-sm">Prochain paiement</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        {nextBillingDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Features included */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Ce qui est inclus :</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {planDetails.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2 text-foreground">
                          <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : serviceInfo ? (
              <Card className="border border-border animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary">
                      {serviceInfo.icon}
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{serviceInfo.name}</h2>
                      <p className="text-muted-foreground">{serviceInfo.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-border animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                <CardContent className="pt-6 text-center">
                  <p className="text-lg text-muted-foreground">
                    Merci pour votre confiance. Votre compte a été mis à jour avec succès.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Next Steps */}
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" />
                  Prochaines étapes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {NEXT_STEPS.map((step, index) => (
                    <Link key={index} to={step.link} className="group">
                      <div className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/50 transition-all duration-200">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            {step.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
                              {step.title}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {step.description}
                            </p>
                          </div>
                          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-400">
              <Link to="/dashboard">
                <Button size="lg" className="w-full sm:w-auto rounded-xl shadow-lg px-8">
                  <Sparkles className="h-5 w-5 mr-2" />
                  Commencer maintenant
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
              
              <Link to="/parametres">
                <Button variant="outline" size="lg" className="w-full sm:w-auto rounded-xl">
                  <Settings className="h-5 w-5 mr-2" />
                  Gérer mon abonnement
                </Button>
              </Link>
            </div>

            {/* Help Section */}
            <div className="text-center py-6 animate-in fade-in duration-500 delay-500">
              <div className="inline-flex items-center gap-2 text-muted-foreground">
                <HelpCircle className="h-4 w-4" />
                <span className="text-sm">
                  Une question ? Contactez-nous à{" "}
                  <a href="mailto:support@inopay.fr" className="text-primary hover:underline">
                    support@inopay.fr
                  </a>
                </span>
              </div>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Shield className="h-4 w-4 text-success" />
                <span className="text-sm text-muted-foreground">
                  Paiement sécurisé par Stripe · Annulation à tout moment
                </span>
              </div>
            </div>

          </div>
        </div>
      </section>
    </Layout>
  );
};

export default PaymentSuccess;