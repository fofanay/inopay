import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  DollarSign, 
  TrendingUp, 
  FileCode, 
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PendingPayment {
  id: string;
  user_id: string;
  project_name: string;
  total_files: number;
  excess_files: number;
  supplement_amount_cents: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface PaymentStats {
  totalRevenue: number;
  paidCount: number;
  pendingCount: number;
  averageSupplement: number;
  conversionRate: number;
}

export function AdminExcessPayments() {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pending_liberation_payments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Cast the data to our expected type
      const typedPayments = (data || []) as unknown as PendingPayment[];
      setPayments(typedPayments);

      // Calculate stats
      const paid = typedPayments.filter(p => p.status === 'paid');
      const pending = typedPayments.filter(p => p.status === 'pending');
      
      const totalRevenue = paid.reduce((sum, p) => sum + p.supplement_amount_cents, 0);
      const averageSupplement = paid.length > 0 
        ? totalRevenue / paid.length 
        : 0;

      setStats({
        totalRevenue,
        paidCount: paid.length,
        pendingCount: pending.length,
        averageSupplement,
        conversionRate: typedPayments.length > 0 
          ? (paid.length / typedPayments.length) * 100 
          : 0,
      });

      // Build chart data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return format(date, 'yyyy-MM-dd');
      });

      const chartDataBuilt = last7Days.map(date => {
        const dayPayments = paid.filter(p => 
          p.paid_at && format(new Date(p.paid_at), 'yyyy-MM-dd') === date
        );
        return {
          date: format(new Date(date), 'dd MMM', { locale: fr }),
          revenue: dayPayments.reduce((sum, p) => sum + p.supplement_amount_cents, 0) / 100,
          count: dayPayments.length,
        };
      });

      setChartData(chartDataBuilt);

    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Payé</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Annulé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Revenus Suppléments</p>
                <p className="text-2xl font-bold text-green-400">
                  ${((stats?.totalRevenue || 0) / 100).toFixed(2)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projets Payés</p>
                <p className="text-2xl font-bold text-blue-400">{stats?.paidCount || 0}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-blue-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En Attente</p>
                <p className="text-2xl font-bold text-amber-400">{stats?.pendingCount || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taux Conversion</p>
                <p className="text-2xl font-bold text-purple-400">
                  {(stats?.conversionRate || 0).toFixed(1)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Revenus Suppléments (7 jours)</CardTitle>
              <CardDescription>Revenus générés par les gros projets</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchPayments}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
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
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v}`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenus']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Historique des Suppléments
          </CardTitle>
          <CardDescription>
            Paiements excédentaires pour les gros projets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projet</TableHead>
                <TableHead>Fichiers</TableHead>
                <TableHead>Excédent</TableHead>
                <TableHead>Supplément</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Aucun paiement de supplément enregistré
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.project_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{payment.total_files}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-amber-400">+{payment.excess_files}</span>
                    </TableCell>
                    <TableCell className="font-mono">
                      ${(payment.supplement_amount_cents / 100).toFixed(2)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(payment.created_at), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
