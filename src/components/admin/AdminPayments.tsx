import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, TrendingUp, DollarSign, CreditCard, RotateCcw, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  customer_email: string | null;
  customer_name: string | null;
  description: string | null;
}

interface PaymentStats {
  monthly_revenue: number;
  total_refunds: number;
  successful_payments: number;
  total_payments: number;
}

interface Balance {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}

const AdminPayments = () => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [refundDialog, setRefundDialog] = useState<{ open: boolean; payment: Payment | null }>({ open: false, payment: null });
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("requested_by_customer");
  const [refunding, setRefunding] = useState(false);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("admin-list-payments", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
      });

      if (error) throw error;

      setPayments(data.payments || []);
      setStats(data.stats || null);
      setBalance(data.balance || null);
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast.error("Erreur lors du chargement des paiements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleRefund = async () => {
    if (!refundDialog.payment) return;
    setRefunding(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.functions.invoke("admin-manage-subscription", {
        headers: { Authorization: `Bearer ${session.session.access_token}` },
        body: {
          action: "refund",
          payment_intent_id: refundDialog.payment.id,
          amount: refundAmount ? parseInt(refundAmount) : undefined,
          reason: refundReason,
        },
      });

      if (error) throw error;

      toast.success("Remboursement effectué");
      setRefundDialog({ open: false, payment: null });
      fetchPayments();
    } catch (error) {
      console.error("Error refunding:", error);
      toast.error("Erreur lors du remboursement");
    } finally {
      setRefunding(false);
    }
  };

  const formatAmount = (amount: number, currency: string = "cad") => {
    return new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      succeeded: "default",
      processing: "secondary",
      requires_payment_method: "outline",
      canceled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  // Generate chart data from payments
  const chartData = payments
    .filter(p => p.status === "succeeded")
    .slice(0, 30)
    .reverse()
    .map(p => ({
      date: new Date(p.created * 1000).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      amount: p.amount / 100,
    }));

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
        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-primary to-primary/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80">Solde disponible</p>
                <p className="text-2xl font-bold text-primary-foreground">
                  {balance?.available?.[0] ? formatAmount(balance.available[0].amount) : "0,00 $CA"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary-foreground/20">
                <DollarSign className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-success to-success/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-success-foreground/80">Revenus ce mois</p>
                <p className="text-2xl font-bold text-success-foreground">
                  {stats ? formatAmount(stats.monthly_revenue) : "0,00 $CA"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-success-foreground/20">
                <TrendingUp className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-0 shadow-md gradient-inopay">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Paiements réussis</p>
                <p className="text-2xl font-bold text-white">{stats?.successful_payments || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/20">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-warning to-warning/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-warning-foreground/80">Total remboursements</p>
                <p className="text-2xl font-bold text-warning-foreground">
                  {stats ? formatAmount(stats.total_refunds) : "0,00 $CA"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-warning-foreground/20">
                <RotateCcw className="h-6 w-6 text-warning-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="card-hover border-0 shadow-md">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              Évolution des revenus
            </CardTitle>
            <CardDescription>30 derniers paiements réussis</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `${v} $`} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(2)} $CA`, "Montant"]}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="hsl(var(--primary))" 
                    fill="url(#colorRevenue)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payments Table */}
      <Card className="card-hover border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              Historique des paiements
            </CardTitle>
            <CardDescription className="mt-1">{payments.length} paiements</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPayments} className="border-border/50 hover:bg-muted">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Client</TableHead>
                  <TableHead className="font-semibold">Montant</TableHead>
                  <TableHead className="font-semibold">Statut</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} className="hover:bg-muted/20">
                    <TableCell className="font-mono text-sm">
                      {formatDate(payment.created)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{payment.customer_name || "N/A"}</p>
                        <p className="text-sm text-muted-foreground">{payment.customer_email || "N/A"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAmount(payment.amount, payment.currency)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell>
                      {payment.status === "succeeded" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRefundDialog({ open: true, payment });
                            setRefundAmount("");
                          }}
                          className="border-border/50 hover:bg-muted"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Rembourser
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

      {/* Refund Dialog */}
      <Dialog open={refundDialog.open} onOpenChange={(open) => setRefundDialog({ open, payment: open ? refundDialog.payment : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rembourser le paiement</DialogTitle>
            <DialogDescription>
              Montant original : {refundDialog.payment && formatAmount(refundDialog.payment.amount, refundDialog.payment.currency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Montant à rembourser (en centimes)</Label>
              <Input
                type="number"
                placeholder={`Laisser vide pour remboursement total (${refundDialog.payment?.amount || 0})`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Laisser vide pour un remboursement total
              </p>
            </div>
            <div>
              <Label>Raison</Label>
              <Select value={refundReason} onValueChange={setRefundReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requested_by_customer">Demandé par le client</SelectItem>
                  <SelectItem value="duplicate">Paiement en double</SelectItem>
                  <SelectItem value="fraudulent">Fraude</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog({ open: false, payment: null })}>
              Annuler
            </Button>
            <Button onClick={handleRefund} disabled={refunding}>
              {refunding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer le remboursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPayments;
