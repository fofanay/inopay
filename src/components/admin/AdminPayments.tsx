import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, TrendingUp, DollarSign, CreditCard, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";

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
  const { t } = useTranslation();
  const { formatCurrency, formatDateTime, locale } = useLocaleFormat();
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
      toast.error(t("adminPayments.loadingError"));
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

      toast.success(t("adminPayments.refundSuccess"));
      setRefundDialog({ open: false, payment: null });
      fetchPayments();
    } catch (error) {
      console.error("Error refunding:", error);
      toast.error(t("adminPayments.refundError"));
    } finally {
      setRefunding(false);
    }
  };

  const formatAmount = (amount: number) => {
    return formatCurrency(amount / 100, "CAD");
  };

  const formatDate = (timestamp: number) => {
    return formatDateTime(new Date(timestamp * 1000));
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
      date: new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(new Date(p.created * 1000)),
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
                <p className="text-sm font-medium text-primary-foreground/80">{t("adminPayments.availableBalance")}</p>
                <p className="text-2xl font-bold text-primary-foreground">
                  {balance?.available?.[0] ? formatAmount(balance.available[0].amount) : formatCurrency(0, "CAD")}
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
                <p className="text-sm font-medium text-success-foreground/80">{t("adminPayments.monthlyRevenue")}</p>
                <p className="text-2xl font-bold text-success-foreground">
                  {stats ? formatAmount(stats.monthly_revenue) : formatCurrency(0, "CAD")}
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
                <p className="text-sm font-medium text-white/80">{t("adminPayments.successfulPayments")}</p>
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
                <p className="text-sm font-medium text-warning-foreground/80">{t("adminPayments.totalRefunds")}</p>
                <p className="text-2xl font-bold text-warning-foreground">
                  {stats ? formatAmount(stats.total_refunds) : formatCurrency(0, "CAD")}
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
              {t("adminPayments.revenueEvolution")}
            </CardTitle>
            <CardDescription>{t("adminPayments.last30Payments")}</CardDescription>
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
                  <YAxis className="text-xs" tickFormatter={(v) => formatCurrency(v, "CAD")} />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value, "CAD"), t("adminPayments.amount")]}
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
              {t("adminPayments.paymentHistory")}
            </CardTitle>
            <CardDescription className="mt-1">{t("adminPayments.paymentsCount", { count: payments.length })}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchPayments} className="border-border/50 hover:bg-muted">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("adminPayments.refresh")}
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">{t("adminPayments.date")}</TableHead>
                  <TableHead className="font-semibold">{t("adminPayments.client")}</TableHead>
                  <TableHead className="font-semibold">{t("adminPayments.amount")}</TableHead>
                  <TableHead className="font-semibold">{t("adminPayments.status")}</TableHead>
                  <TableHead className="font-semibold">{t("adminPayments.actions")}</TableHead>
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
                        <p className="font-medium">{payment.customer_name || t("adminPayments.na")}</p>
                        <p className="text-sm text-muted-foreground">{payment.customer_email || t("adminPayments.na")}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatAmount(payment.amount)}
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
                          {t("adminPayments.refund")}
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
            <DialogTitle>{t("adminPayments.refundPayment")}</DialogTitle>
            <DialogDescription>
              {t("adminPayments.originalAmount")} : {refundDialog.payment && formatAmount(refundDialog.payment.amount)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("adminPayments.amountToRefund")}</Label>
              <Input
                type="number"
                placeholder={`${t("adminPayments.leaveEmptyForFull")} (${refundDialog.payment?.amount || 0})`}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t("adminPayments.leaveEmptyForFull")}
              </p>
            </div>
            <div>
              <Label>{t("adminPayments.reason")}</Label>
              <Select value={refundReason} onValueChange={setRefundReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="requested_by_customer">{t("adminPayments.requestedByCustomer")}</SelectItem>
                  <SelectItem value="duplicate">{t("adminPayments.duplicate")}</SelectItem>
                  <SelectItem value="fraudulent">{t("adminPayments.fraudulent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog({ open: false, payment: null })}>
              {t("adminPayments.cancel")}
            </Button>
            <Button onClick={handleRefund} disabled={refunding}>
              {refunding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("adminPayments.confirmRefund")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPayments;