import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, TrendingUp, Euro, CreditCard, RotateCcw, Eye } from "lucide-react";
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

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: currency.toUpperCase(),
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
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Solde disponible</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Euro className="h-5 w-5 text-primary" />
              {balance?.available?.[0] ? formatAmount(balance.available[0].amount, balance.available[0].currency) : "0 €"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Revenus ce mois</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              {stats ? formatAmount(stats.monthly_revenue, "eur") : "0 €"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paiements réussis</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-500" />
              {stats?.successful_payments || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total remboursements</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-500" />
              {stats ? formatAmount(stats.total_refunds, "eur") : "0 €"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Évolution des revenus</CardTitle>
            <CardDescription>30 derniers paiements réussis</CardDescription>
          </CardHeader>
          <CardContent>
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
                  <YAxis className="text-xs" tickFormatter={(v) => `${v}€`} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(2)}€`, "Montant"]}
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
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Historique des paiements</CardTitle>
            <CardDescription>{payments.length} paiements</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPayments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
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
