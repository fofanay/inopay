import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ArrowRight, Sparkles, Rocket, RefreshCw, Activity, Server, Loader2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";

interface PurchaseDetails {
  serviceType: string;
  serviceName: string;
  isSubscription: boolean;
}

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

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<PurchaseDetails | null>(null);
  const { checkSubscription, session } = useAuth();

  useEffect(() => {
    // Try to get service info from URL params
    const serviceType = searchParams.get("service") || searchParams.get("type");
    
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
    setTimeout(() => setLoading(false), 500);
  }, [searchParams, session?.access_token, checkSubscription]);

  if (loading) {
    return (
      <Layout>
        <section className="py-24 lg:py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-lg mx-auto flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  const serviceInfo = purchase?.serviceType ? SERVICE_INFO[purchase.serviceType] : null;

  return (
    <Layout>
      <section className="py-24 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-lg mx-auto">
            <Card className="card-shadow-lg border border-border">
              <CardContent className="pt-12 pb-10 text-center">
                <div className="mx-auto h-20 w-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                
                <h1 className="text-3xl font-bold mb-4 text-foreground">
                  Paiement réussi !
                </h1>

                {serviceInfo ? (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {serviceInfo.icon}
                      </div>
                      <span className="text-lg font-semibold text-foreground">
                        {serviceInfo.name}
                      </span>
                    </div>
                    <p className="text-muted-foreground mb-8">
                      {serviceInfo.description}
                    </p>
                  </>
                ) : (
                  <p className="text-lg text-muted-foreground mb-8">
                    Merci pour votre confiance. Votre compte a été mis à jour et vous pouvez maintenant libérer vos projets.
                  </p>
                )}

                <div className="space-y-4">
                  <Link to={serviceInfo?.link || "/dashboard"}>
                    <Button size="lg" className="w-full rounded-xl shadow-lg">
                      <Sparkles className="h-5 w-5 mr-2" />
                      {serviceInfo?.action || "Libérer mon projet"}
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </Link>
                  
                  <Link to="/dashboard?tab=services">
                    <Button variant="outline" size="lg" className="w-full rounded-xl">
                      Voir mes crédits et abonnements
                    </Button>
                  </Link>
                  
                  <Link to="/">
                    <Button variant="ghost" size="lg" className="w-full rounded-xl">
                      Retour à l'accueil
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default PaymentSuccess;
