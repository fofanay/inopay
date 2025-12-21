import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Rocket, 
  RefreshCw, 
  Server, 
  Activity, 
  Loader2, 
  Crown,
  Package,
  CreditCard,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface Credits {
  deploy: number;
  redeploy: number;
  server: number;
  legacy: number;
}

interface ActiveMonitoring {
  id: string;
  subscription_ends_at: string | null;
  created_at: string;
}

interface Purchase {
  id: string;
  service_type: string;
  amount: number;
  currency: string;
  status: string;
  is_subscription: boolean;
  subscription_status: string | null;
  subscription_ends_at: string | null;
  used: boolean;
  deployment_id: string | null;
  created_at: string;
}

const UserPurchases = () => {
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<Credits>({ deploy: 0, redeploy: 0, server: 0, legacy: 0 });
  const [activeMonitoring, setActiveMonitoring] = useState<ActiveMonitoring[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isUnlimitedTester, setIsUnlimitedTester] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const { toast } = useToast();

  const fetchCredits = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const { data, error } = await supabase.functions.invoke("get-user-credits", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      setCredits(data.credits);
      setActiveMonitoring(data.activeMonitoring || []);
      setPurchases(data.recentPurchases || []);
      setIsUnlimitedTester(data.isUnlimitedTester);
      setIsPro(data.isPro);
    } catch (error) {
      console.error("Error fetching credits:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger vos crédits",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  const getServiceLabel = (type: string) => {
    switch (type) {
      case "deploy": return "Déploiement VPS";
      case "redeploy": return "Re-déploiement";
      case "monitoring": return "Monitoring";
      case "server": return "Serveur Supplémentaire";
      default: return type;
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "deploy": return <Rocket className="h-4 w-4" />;
      case "redeploy": return <RefreshCw className="h-4 w-4" />;
      case "monitoring": return <Activity className="h-4 w-4" />;
      case "server": return <Server className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (purchase: Purchase) => {
    if (purchase.status === "refunded") {
      return <Badge variant="destructive">Remboursé</Badge>;
    }
    if (purchase.is_subscription) {
      if (purchase.subscription_status === "active") {
        return <Badge className="bg-success/20 text-success border-success/30">Actif</Badge>;
      }
      return <Badge variant="secondary">{purchase.subscription_status}</Badge>;
    }
    if (purchase.used) {
      return <Badge variant="secondary">Utilisé</Badge>;
    }
    return <Badge className="bg-primary/20 text-primary border-primary/30">Disponible</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalCredits = credits.deploy + credits.redeploy + credits.server + credits.legacy;

  return (
    <div className="space-y-6">
      {/* Tester/Pro Badge */}
      {(isUnlimitedTester || isPro) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-primary" />
              <div>
                <p className="font-semibold text-foreground">
                  {isUnlimitedTester ? "Compte Testeur" : "Abonnement Pro"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isUnlimitedTester 
                    ? "Accès illimité à tous les services" 
                    : "Profitez de tous les avantages Pro"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credits Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Rocket className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{credits.deploy}</p>
                <p className="text-xs text-muted-foreground">Déploiements VPS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <RefreshCw className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{credits.redeploy}</p>
                <p className="text-xs text-muted-foreground">Re-déploiements</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Server className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{credits.server}</p>
                <p className="text-xs text-muted-foreground">Serveurs Supp.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info/10">
                <Activity className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeMonitoring.length}</p>
                <p className="text-xs text-muted-foreground">Monitoring Actif</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {totalCredits === 0 && activeMonitoring.length === 0 && !isUnlimitedTester && !isPro && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-foreground mb-2">Aucun crédit disponible</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Achetez des crédits pour déployer vos projets
            </p>
            <Link to="/tarifs">
              <Button>
                Voir les offres
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Active Monitoring Subscriptions */}
      {activeMonitoring.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Abonnements Monitoring Actifs
            </CardTitle>
            <CardDescription>
              Vos abonnements de surveillance en cours
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeMonitoring.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-medium text-foreground">Extension Monitoring</p>
                      <p className="text-sm text-muted-foreground">
                        Actif depuis le {formatDate(sub.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-success/20 text-success border-success/30">Actif</Badge>
                    {sub.subscription_ends_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Renouvellement: {formatDate(sub.subscription_ends_at)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Historique des achats</CardTitle>
            <CardDescription>
              Vos {purchases.length} derniers achats
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchCredits}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun achat pour le moment
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getServiceIcon(purchase.service_type)}
                        <span className="font-medium">
                          {getServiceLabel(purchase.service_type)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatAmount(purchase.amount, purchase.currency)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(purchase.created_at)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(purchase)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserPurchases;
