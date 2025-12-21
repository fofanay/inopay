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
        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-success to-success/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-success-foreground/80">Abonnements actifs</p>
                <p className="text-3xl font-bold text-success-foreground">{stats?.active || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-success-foreground/20">
                <CheckCircle className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-accent to-accent/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-accent-foreground/80">En essai</p>
                <p className="text-3xl font-bold text-accent-foreground">{stats?.trialing || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-accent-foreground/20">
                <Clock className="h-6 w-6 text-accent-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-destructive/80 to-destructive/60">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-destructive-foreground/80">Annulés</p>
                <p className="text-3xl font-bold text-destructive-foreground">{stats?.canceled || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-destructive-foreground/20">
                <XCircle className="h-6 w-6 text-destructive-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-0 shadow-md gradient-inopay">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">MRR estimé</p>
                <p className="text-2xl font-bold text-white">
                  {stats ? formatAmount(stats.mrr, "cad") : "0 $"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/20">
                <Users className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="subscriptions">
        <TabsList className="bg-muted/50 border border-border/50">
          <TabsTrigger value="subscriptions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Abonnements</TabsTrigger>
          <TabsTrigger value="coupons" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Coupons</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card className="card-hover border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  Abonnements Stripe
                </CardTitle>
                <CardDescription className="mt-1">{filteredSubs.length} abonnements</CardDescription>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 border-border/50">
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
                <Button variant="outline" size="sm" onClick={fetchSubscriptions} className="border-border/50 hover:bg-muted">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Client</TableHead>
                      <TableHead className="font-semibold">Plan</TableHead>
                      <TableHead className="font-semibold">Montant</TableHead>
                      <TableHead className="font-semibold">Statut</TableHead>
                      <TableHead className="font-semibold">Fin période</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubs.map((sub) => (
                      <TableRow key={sub.id} className="hover:bg-muted/20">
                        <TableCell>
                          <div>
                            <p className="font-medium">{sub.customer_name || "N/A"}</p>
                            <p className="text-sm text-muted-foreground">{sub.customer_email || "N/A"}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">{sub.plan_name}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
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
                              className="border-border/50 hover:bg-muted"
                            >
                              Annuler à échéance
                            </Button>
                          )}
                          {sub.status === "active" && sub.cancel_at_period_end && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setActionDialog({ open: true, sub, action: "reactivate_subscription" })}
                              className="border-primary/50 text-primary hover:bg-primary/10"
                            >
                              Réactiver
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coupons" className="space-y-4">
          <Card className="card-hover border-0 shadow-md">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Percent className="h-5 w-5 text-primary" />
                  </div>
                  Codes Promo
                </CardTitle>
                <CardDescription className="mt-1">{coupons.length} coupons</CardDescription>
              </div>
              <Button onClick={() => setCouponDialog(true)} className="bg-primary hover:bg-primary/90">
                <Plus className="h-4 w-4 mr-2" />
                Nouveau coupon
              </Button>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">ID</TableHead>
                      <TableHead className="font-semibold">Nom</TableHead>
                      <TableHead className="font-semibold">Réduction</TableHead>
                      <TableHead className="font-semibold">Durée</TableHead>
                      <TableHead className="font-semibold">Utilisations</TableHead>
                      <TableHead className="font-semibold">Statut</TableHead>
                      <TableHead className="font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map((coupon) => (
                      <TableRow key={coupon.id} className="hover:bg-muted/20">
                        <TableCell className="font-mono text-sm">{coupon.id}</TableCell>
                        <TableCell className="font-medium">{coupon.name || "-"}</TableCell>
                        <TableCell>
                          <Badge className="bg-success/10 text-success border-success/20">
                            {coupon.percent_off 
                              ? `${coupon.percent_off}%` 
                              : coupon.amount_off 
                                ? formatAmount(coupon.amount_off, coupon.currency || "eur")
                                : "-"
                            }
                          </Badge>
                        </TableCell>
                        <TableCell>{coupon.duration}</TableCell>
                        <TableCell>
                          <span className="font-medium">{coupon.times_redeemed}</span>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={coupon.valid 
                              ? "bg-success/10 text-success border-success/20" 
                              : "bg-destructive/10 text-destructive border-destructive/20"
                            }
                          >
                            {coupon.valid ? "Actif" : "Expiré"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCoupon(coupon.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
