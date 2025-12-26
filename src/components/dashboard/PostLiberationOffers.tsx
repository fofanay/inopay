import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Rocket,
  Activity,
  Server,
  Package,
  Loader2,
  ArrowRight,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useCurrencyDetection, type Currency } from "@/hooks/useCurrencyDetection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Stripe Price IDs - Add-ons par devise
const STRIPE_ADDONS = {
  CAD: {
    redeploy: "price_1Sgr89BYLQpzPb0yTaGeD7uk",
    monitoring: "price_1Sgr8iBYLQpzPb0yo15IvGVU",
    server: "price_1Sgr9zBYLQpzPb0yZJS7N412",
  },
  USD: {
    redeploy: "price_1Sgr8LBYLQpzPb0yX0NHl6PS",
    monitoring: "price_1Sgr8rBYLQpzPb0yReXWuS1J",
    server: "price_1SgrAsBYLQpzPb0ybNWYjt2p",
  },
  EUR: {
    redeploy: "price_1Sgr8VBYLQpzPb0y3MKtI4Gh",
    monitoring: "price_1Sgr9VBYLQpzPb0yX1LCrf4N",
    server: "price_1SgrC6BYLQpzPb0yvYbly0EL",
  },
};

// Prix affichés par devise
const ADDON_PRICES = {
  CAD: { redeploy: 49, monitoring: 19, server: 79, symbol: "$", suffix: "CAD" },
  USD: { redeploy: 39, monitoring: 15, server: 59, symbol: "$", suffix: "USD" },
  EUR: { redeploy: 35, monitoring: 13, server: 55, symbol: "€", suffix: "EUR" },
};

type AddonType = "redeploy" | "monitoring" | "server";

interface PostLiberationOffersProps {
  projectName: string;
  filesCount: number;
  onDismiss?: () => void;
}

interface OfferCard {
  id: AddonType;
  icon: typeof Rocket;
  title: string;
  description: string;
  features: string[];
  color: string;
  bgColor: string;
  isSubscription: boolean;
}

const OFFERS: OfferCard[] = [
  {
    id: "redeploy",
    icon: Rocket,
    title: "Déploiement Assisté",
    description: "On déploie votre projet sur votre serveur",
    features: [
      "Configuration Docker automatisée",
      "Mise en place SSL/HTTPS",
      "DNS et domaine configuré",
      "Support technique inclus",
    ],
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    isSubscription: false,
  },
  {
    id: "monitoring",
    icon: Activity,
    title: "Monitoring 24/7",
    description: "Surveillance continue de votre app",
    features: [
      "Alertes en temps réel",
      "Rapports de performance",
      "Détection de pannes",
      "Logs centralisés",
    ],
    color: "text-blue-500",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    isSubscription: true,
  },
  {
    id: "server",
    icon: Server,
    title: "Serveur VPS",
    description: "On configure votre propre serveur",
    features: [
      "VPS Hetzner optimisé",
      "Coolify pré-installé",
      "Backups automatiques",
      "Accès root complet",
    ],
    color: "text-amber-500",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    isSubscription: false,
  },
];

export function PostLiberationOffers({ projectName, filesCount, onDismiss }: PostLiberationOffersProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currency } = useCurrencyDetection();
  const [loadingOffer, setLoadingOffer] = useState<AddonType | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const prices = ADDON_PRICES[currency];

  const handleCheckout = async (addonType: AddonType) => {
    if (!user) {
      toast.error("Connectez-vous pour continuer");
      navigate("/auth");
      return;
    }

    setLoadingOffer(addonType);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const isSubscription = addonType === "monitoring";

      const response = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: STRIPE_ADDONS[currency][addonType],
          mode: isSubscription ? "subscription" : "payment",
          serviceType: addonType,
          metadata: {
            projectName,
            filesCount,
            source: "post_liberation",
          },
        },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.url) {
        window.open(response.data.url, "_blank");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error("Erreur lors de la création du paiement");
    } finally {
      setLoadingOffer(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  // Calculer le prix du pack complet avec réduction
  const packPrice = prices.redeploy + prices.server;
  const packDiscount = Math.round(packPrice * 0.20);
  const packFinal = packPrice - packDiscount;

  return (
    <Card className="relative overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      
      {/* Dismiss button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
      </Button>

      <CardHeader className="text-center pb-4">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-xl">
          🎉 Félicitations! Votre projet est libéré
        </CardTitle>
        <CardDescription className="text-base">
          Besoin d'aide pour la suite? Nos services vous accompagnent.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Service Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {OFFERS.map((offer) => {
            const Icon = offer.icon;
            const price = prices[offer.id];
            
            return (
              <div
                key={offer.id}
                className={`relative p-4 rounded-xl border-2 ${offer.bgColor} transition-all hover:scale-[1.02]`}
              >
                <div className={`h-10 w-10 rounded-lg ${offer.bgColor} flex items-center justify-center mb-3`}>
                  <Icon className={`h-5 w-5 ${offer.color}`} />
                </div>
                
                <h4 className="font-semibold mb-1">{offer.title}</h4>
                <p className="text-sm text-muted-foreground mb-3">{offer.description}</p>
                
                <ul className="space-y-1 mb-4">
                  {offer.features.slice(0, 3).map((feature, idx) => (
                    <li key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                      <Check className={`h-3 w-3 ${offer.color}`} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-bold">{price}{prices.symbol}</span>
                  {offer.isSubscription && (
                    <span className="text-sm text-muted-foreground">/mois</span>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleCheckout(offer.id)}
                  disabled={loadingOffer !== null}
                >
                  {loadingOffer === offer.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  {offer.isSubscription ? "S'abonner" : "Acheter"}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Pack Complet Promo */}
        <div className="relative p-5 rounded-xl border-2 border-primary bg-gradient-to-r from-primary/10 to-primary/5">
          <Badge className="absolute -top-3 left-4 bg-primary text-primary-foreground">
            <Package className="h-3 w-3 mr-1" />
            PACK COMPLET -20%
          </Badge>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h4 className="font-semibold text-lg mb-1">Déploiement + Serveur VPS</h4>
              <p className="text-sm text-muted-foreground">
                Tout pour démarrer: serveur configuré et projet déployé en 24h
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-muted-foreground line-through">
                  {packPrice}{prices.symbol}
                </div>
                <div className="text-2xl font-bold text-primary">
                  {packFinal}{prices.symbol}
                </div>
              </div>
              
              <Button
                onClick={() => {
                  // D'abord le serveur, puis le déploiement
                  handleCheckout("server");
                }}
                disabled={loadingOffer !== null}
                className="whitespace-nowrap"
              >
                {loadingOffer ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Rocket className="h-4 w-4 mr-2" />
                )}
                Commander
              </Button>
            </div>
          </div>
        </div>

        {/* Subtle CTA */}
        <p className="text-center text-sm text-muted-foreground">
          Des questions? <a href="mailto:support@inopay.app" className="text-primary hover:underline">Contactez-nous</a>
        </p>
      </CardContent>
    </Card>
  );
}
