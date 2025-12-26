import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Rocket,
  Activity,
  Server,
  Package,
  Loader2,
  ArrowRight,
  CreditCard,
  History,
  RefreshCw,
  Check,
  Crown,
  ShoppingBag,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useCurrencyDetection, type Currency } from "@/hooks/useCurrencyDetection";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// Stripe Price IDs
const STRIPE_ADDONS = {
  CAD: {
    redeploy: "price_1Sgr89BYLQpzPb0yTaGeD7uk",
    monitoring: "price_1Sgr8iBYLQpzPb0yo15IvGVU",
    server: "price_1Sgr9zBYLQpzPb0yZJS7N412",
    pack: "price_1SiRSjBYLQpzPb0y7DH2KSKV",
  },
  USD: {
    redeploy: "price_1Sgr8LBYLQpzPb0yX0NHl6PS",
    monitoring: "price_1Sgr8rBYLQpzPb0yReXWuS1J",
    server: "price_1SgrAsBYLQpzPb0ybNWYjt2p",
    pack: "price_1SiRStBYLQpzPb0yZKknxEYI",
  },
  EUR: {
    redeploy: "price_1Sgr8VBYLQpzPb0y3MKtI4Gh",
    monitoring: "price_1Sgr9VBYLQpzPb0yX1LCrf4N",
    server: "price_1SgrC6BYLQpzPb0yvYbly0EL",
    pack: "price_1SiRT4BYLQpzPb0yP3MFE0mo",
  },
};

const ADDON_PRICES = {
  CAD: { redeploy: 49, monitoring: 19, server: 79, pack: 102.40, symbol: "$", suffix: "CAD" },
  USD: { redeploy: 39, monitoring: 15, server: 59, pack: 78.40, symbol: "$", suffix: "USD" },
  EUR: { redeploy: 35, monitoring: 13, server: 55, pack: 72, symbol: "€", suffix: "EUR" },
};

type AddonType = "redeploy" | "monitoring" | "server" | "pack";

interface Credits {
  deploy: number;
  redeploy: number;
  server: number;
  monitoring: number;
}

interface Purchase {
  id: string;
  service_type: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  used: boolean;
}

const SERVICE_LABELS: Record<string, string> = {
  deploy: "Déploiement",
  redeploy: "Redéploiement",
  server: "Serveur VPS",
  monitoring: "Monitoring",
  pack: "Pack Complet",
  liberation: "Libération",
};

export function UserServicesHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currency } = useCurrencyDetection();
  const [loading, setLoading] = useState(true);
  const [loadingOffer, setLoadingOffer] = useState<AddonType | null>(null);
  const [credits, setCredits] = useState<Credits>({ deploy: 0, redeploy: 0, server: 0, monitoring: 0 });
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [activeMonitorings, setActiveMonitorings] = useState<any[]>([]);

  const prices = ADDON_PRICES[currency];

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch subscription/credits
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      // Fetch purchases
      const { data: purchasesData } = await supabase
        .from("user_purchases")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      // Count credits from purchases
      const purchasesList = purchasesData || [];
      const deployCredits = purchasesList.filter(p => p.service_type === "deploy" && !p.used && p.status === "completed").length;
      const redeployCredits = purchasesList.filter(p => p.service_type === "redeploy" && !p.used && p.status === "completed").length;
      const serverCredits = purchasesList.filter(p => p.service_type === "server" && !p.used && p.status === "completed").length;
      const activeMonitoring = purchasesList.filter(p => 
        p.service_type === "monitoring" && 
        p.is_subscription && 
        p.subscription_status === "active"
      );

      setCredits({
        deploy: deployCredits + (subData?.credits_remaining || 0),
        redeploy: redeployCredits,
        server: serverCredits,
        monitoring: activeMonitoring.length,
      });

      setActiveMonitorings(activeMonitoring);
      setPurchases(purchasesList);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const formatAmount = (amount: number, currency: string) => {
    const symbol = currency.toLowerCase() === "eur" ? "€" : "$";
    return `${(amount / 100).toFixed(2)}${symbol}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const services = [
    {
      id: "redeploy" as AddonType,
      icon: Rocket,
      title: "Déploiement Assisté",
      description: "On déploie votre projet sur votre serveur",
      features: ["Config Docker", "SSL/HTTPS", "DNS", "Support"],
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10 border-emerald-500/20",
      isSubscription: false,
    },
    {
      id: "monitoring" as AddonType,
      icon: Activity,
      title: "Monitoring 24/7",
      description: "Surveillance continue",
      features: ["Alertes", "Rapports", "Logs"],
      color: "text-blue-500",
      bgColor: "bg-blue-500/10 border-blue-500/20",
      isSubscription: true,
    },
    {
      id: "server" as AddonType,
      icon: Server,
      title: "Serveur VPS",
      description: "On configure votre serveur",
      features: ["Hetzner", "Coolify", "Backups"],
      color: "text-amber-500",
      bgColor: "bg-amber-500/10 border-amber-500/20",
      isSubscription: false,
    },
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="credits" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="credits" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Mes Crédits
          </TabsTrigger>
          <TabsTrigger value="shop" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            Boutique
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Credits Tab */}
        <TabsContent value="credits" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Vos Crédits Disponibles</h3>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-emerald-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Rocket className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{credits.deploy + credits.redeploy}</p>
                    <p className="text-xs text-muted-foreground">Déploiements</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Server className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{credits.server}</p>
                    <p className="text-xs text-muted-foreground">Serveurs VPS</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{credits.monitoring}</p>
                    <p className="text-xs text-muted-foreground">Monitoring actifs</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Crown className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{purchases.filter(p => p.status === "completed").length}</p>
                    <p className="text-xs text-muted-foreground">Achats totaux</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {credits.deploy + credits.redeploy + credits.server === 0 && credits.monitoring === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <ShoppingBag className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h4 className="font-medium mb-2">Aucun crédit actif</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Achetez des services pour commencer à déployer vos projets
                </p>
                <Button onClick={() => document.querySelector('[data-value="shop"]')?.dispatchEvent(new Event('click', { bubbles: true }))}>
                  <ShoppingBag className="h-4 w-4 mr-2" />
                  Voir la boutique
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Shop Tab */}
        <TabsContent value="shop" className="space-y-6 mt-4">
          <div className="grid md:grid-cols-3 gap-4">
            {services.map((service) => {
              const Icon = service.icon;
              const price = prices[service.id];

              return (
                <Card key={service.id} className={`relative overflow-hidden ${service.bgColor}`}>
                  <CardHeader className="pb-2">
                    <div className={`h-10 w-10 rounded-lg ${service.bgColor} flex items-center justify-center mb-2`}>
                      <Icon className={`h-5 w-5 ${service.color}`} />
                    </div>
                    <CardTitle className="text-lg">{service.title}</CardTitle>
                    <CardDescription>{service.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 mb-4">
                      {service.features.map((f, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                          <Check className={`h-3 w-3 ${service.color}`} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-2xl font-bold">{price}{prices.symbol}</span>
                      {service.isSubscription && <span className="text-sm text-muted-foreground">/mois</span>}
                    </div>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleCheckout(service.id)}
                      disabled={loadingOffer !== null}
                    >
                      {loadingOffer === service.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      {service.isSubscription ? "S'abonner" : "Acheter"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pack Complet */}
          <Card className="border-2 border-primary bg-gradient-to-r from-primary/10 to-primary/5 relative overflow-hidden">
            <Badge className="absolute top-4 right-4 bg-primary">
              <Package className="h-3 w-3 mr-1" />
              -20%
            </Badge>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Pack Complet
              </CardTitle>
              <CardDescription>
                Déploiement assisté + Serveur VPS configuré en 24h
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground line-through">
                    {prices.redeploy + prices.server}{prices.symbol}
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {prices.pack}{prices.symbol}
                  </div>
                </div>
              </div>

              <Button
                size="lg"
                onClick={() => handleCheckout("pack")}
                disabled={loadingOffer !== null}
              >
                {loadingOffer === "pack" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Rocket className="h-4 w-4 mr-2" />
                )}
                Commander le Pack
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Achats</CardTitle>
              <CardDescription>Vos 20 derniers achats de services</CardDescription>
            </CardHeader>
            <CardContent>
              {purchases.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun achat pour le moment
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Montant</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-medium">
                          {SERVICE_LABELS[purchase.service_type] || purchase.service_type}
                        </TableCell>
                        <TableCell>{formatAmount(purchase.amount, purchase.currency)}</TableCell>
                        <TableCell>
                          <Badge variant={purchase.status === "completed" ? "default" : "secondary"}>
                            {purchase.status === "completed" ? "Payé" : purchase.status}
                          </Badge>
                          {purchase.used && (
                            <Badge variant="outline" className="ml-1">Utilisé</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(purchase.created_at), { addSuffix: true, locale: fr })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}