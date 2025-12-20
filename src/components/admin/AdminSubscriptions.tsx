import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, Users, XCircle, CheckCircle, Clock, Percent, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Subscription {
  id: string;
  status: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_id: string;
  plan_name: string;
  amount: number;
  currency: string;
  interval: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  created: number;
}

interface Coupon {
  id: string;
  name: string;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  times_redeemed: number;
  valid: boolean;
}

interface SubStats {
  active: number;
  canceled: number;
  trialing: number;
  mrr: number;
}

const AdminSubscriptions = () => {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stats, setStats] = useState<SubStats | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionDialog, setActionDialog] = useState<{ open: boolean; sub: Subscription | null; action: string }>({ open: false, sub: null, action: "" });
  const [couponDialog, setCouponDialog] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ name: "", percent_off: "", amount_off: "", duration: "once" });
  const [processing, setProcessing] = useState(false);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("admin-list-subscriptions", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (error) throw error;

      setSubscriptions(data.subscriptions || []);
      setCoupons(data.coupons || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      toast.error("Erreur lors du chargement des abonnements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleAction = async () => {
    if (!actionDialog.sub) return;
    setProcessing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("admin-manage-subscription", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        body: {
          action: actionDialog.action,
          subscription_id: actionDialog.sub.id,
        },
      });

      if (error) throw error;

      toast.success("Action effectuée");
      setActionDialog({ open: false, sub: null, action: "" });
      fetchSubscriptions();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur lors de l'action");
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateCoupon = async () => {
    if (!newCoupon.name) {
      toast.error("Le nom est requis");
      return;
    }
    setProcessing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("admin-manage-subscription", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        body: {
          action: "create_coupon",
          coupon_name: newCoupon.name,
          percent_off: newCoupon.percent_off ? parseFloat(newCoupon.percent_off) : undefined,
          amount_off: newCoupon.amount_off ? parseInt(newCoupon.amount_off) : undefined,
          duration: newCoupon.duration,
        },
      });

      if (error) throw error;

      toast.success("Coupon créé");
      setCouponDialog(false);
      setNewCoupon({ name: "", percent_off: "", amount_off: "", duration: "once" });
      fetchSubscriptions();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur lors de la création");
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("admin-manage-subscription", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        body: {
          action: "delete_coupon",
          coupon_id: couponId,
        },
      });

      if (error) throw error;

      toast.success("Coupon supprimé");
      fetchSubscriptions();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("fr-FR");
  };

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/20">Annulation prévue</Badge>;
    }
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trialing: "secondary",
      canceled: "destructive",
      past_due: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  const filteredSubs = statusFilter === "all" 
    ? subscriptions 
    : subscriptions.filter(s => s.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Abonnements actifs</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {stats?.active || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>En essai</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              {stats?.trialing || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Annulés</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              {stats?.canceled || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>MRR estimé</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {stats ? formatAmount(stats.mrr, "eur") : "0 €"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Abonnements Stripe</CardTitle>
                <CardDescription>{filteredSubs.length} abonnements</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="active">Actifs</SelectItem>
                    <SelectItem value="trialing">En essai</SelectItem>
                    <SelectItem value="canceled">Annulés</SelectItem>
                    <SelectItem value="past_due">Impayés</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={fetchSubscriptions}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Fin période</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubs.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sub.customer_name || "N/A"}</p>
                          <p className="text-sm text-muted-foreground">{sub.customer_email || "N/A"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{sub.plan_name}</Badge>
                      </TableCell>
                      <TableCell>
                        {formatAmount(sub.amount, sub.currency)}/{sub.interval === "month" ? "mois" : "an"}
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status, sub.cancel_at_period_end)}</TableCell>
                      <TableCell>{formatDate(sub.current_period_end)}</TableCell>
                      <TableCell>
                        {sub.status === "active" && !sub.cancel_at_period_end && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActionDialog({ open: true, sub, action: "cancel_at_period_end" })}
                          >
                            Annuler à échéance
                          </Button>
                        )}
                        {sub.status === "active" && sub.cancel_at_period_end && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setActionDialog({ open: true, sub, action: "reactivate_subscription" })}
                          >
                            Réactiver
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coupons" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Codes Promo</CardTitle>
                <CardDescription>{coupons.length} coupons</CardDescription>
              </div>
              <Button onClick={() => setCouponDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau coupon
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Réduction</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Utilisations</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-mono text-sm">{coupon.id}</TableCell>
                      <TableCell>{coupon.name || "-"}</TableCell>
                      <TableCell>
                        {coupon.percent_off 
                          ? `${coupon.percent_off}%` 
                          : coupon.amount_off 
                            ? formatAmount(coupon.amount_off, coupon.currency || "eur")
                            : "-"
                        }
                      </TableCell>
                      <TableCell>{coupon.duration}</TableCell>
                      <TableCell>{coupon.times_redeemed}</TableCell>
                      <TableCell>
                        <Badge variant={coupon.valid ? "default" : "destructive"}>
                          {coupon.valid ? "Actif" : "Expiré"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteCoupon(coupon.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={actionDialog.open} onOpenChange={(open) => setActionDialog({ open, sub: open ? actionDialog.sub : null, action: actionDialog.action })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'action</DialogTitle>
            <DialogDescription>
              {actionDialog.action === "cancel_at_period_end" && "L'abonnement sera annulé à la fin de la période en cours."}
              {actionDialog.action === "reactivate_subscription" && "L'abonnement sera réactivé et continuera normalement."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ open: false, sub: null, action: "" })}>
              Annuler
            </Button>
            <Button onClick={handleAction} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coupon Dialog */}
      <Dialog open={couponDialog} onOpenChange={setCouponDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un coupon</DialogTitle>
            <DialogDescription>Définissez les paramètres du code promo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom du coupon</Label>
              <Input
                value={newCoupon.name}
                onChange={(e) => setNewCoupon({ ...newCoupon, name: e.target.value })}
                placeholder="PROMO2024"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>% de réduction</Label>
                <Input
                  type="number"
                  value={newCoupon.percent_off}
                  onChange={(e) => setNewCoupon({ ...newCoupon, percent_off: e.target.value, amount_off: "" })}
                  placeholder="20"
                  disabled={!!newCoupon.amount_off}
                />
              </div>
              <div>
                <Label>Montant fixe (centimes)</Label>
                <Input
                  type="number"
                  value={newCoupon.amount_off}
                  onChange={(e) => setNewCoupon({ ...newCoupon, amount_off: e.target.value, percent_off: "" })}
                  placeholder="500"
                  disabled={!!newCoupon.percent_off}
                />
              </div>
            </div>
            <div>
              <Label>Durée</Label>
              <Select value={newCoupon.duration} onValueChange={(v) => setNewCoupon({ ...newCoupon, duration: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Une fois</SelectItem>
                  <SelectItem value="repeating">Plusieurs mois</SelectItem>
                  <SelectItem value="forever">Permanent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCouponDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateCoupon} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSubscriptions;
