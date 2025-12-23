import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Loader2, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Calculator,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Area
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface CleaningEstimate {
  id: string;
  user_id: string;
  project_name: string;
  total_files: number;
  total_lines: number;
  estimated_tokens: number;
  estimated_cost_cents: number;
  actual_cost_cents: number | null;
  sale_price_cents: number | null;
  margin_cents: number | null;
  margin_percentage: number | null;
  requires_admin_approval: boolean;
  admin_approved: boolean | null;
  status: string;
  created_at: string;
}

interface MarginStats {
  totalEstimates: number;
  pendingApproval: number;
  averageMargin: number;
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
}

const AdminCleaningMargins = () => {
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState<CleaningEstimate[]>([]);
  const [stats, setStats] = useState<MarginStats | null>(null);
  const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; estimate: CleaningEstimate | null }>({ 
    open: false, 
    estimate: null 
  });
  const [approving, setApproving] = useState(false);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from('cleaning_estimates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Type assertion since we know the shape
      const typedData = (data || []) as unknown as CleaningEstimate[];
      setEstimates(typedData);

      // Calculate stats
      const pendingApproval = typedData.filter(e => e.requires_admin_approval && !e.admin_approved).length;
      const completedEstimates = typedData.filter(e => e.margin_cents !== null);
      const averageMargin = completedEstimates.length > 0
        ? completedEstimates.reduce((sum, e) => sum + (e.margin_percentage || 0), 0) / completedEstimates.length
        : 0;
      const totalRevenue = typedData.reduce((sum, e) => sum + (e.sale_price_cents || 0), 0);
      const totalCost = typedData.reduce((sum, e) => sum + (e.actual_cost_cents || e.estimated_cost_cents), 0);

      setStats({
        totalEstimates: typedData.length,
        pendingApproval,
        averageMargin,
        totalRevenue,
        totalCost,
        netProfit: totalRevenue - totalCost,
      });
    } catch (error) {
      console.error("Error fetching estimates:", error);
      toast.error("Erreur lors du chargement des estimations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstimates();
  }, []);

  const handleApproval = async (approved: boolean) => {
    if (!approvalDialog.estimate) return;
    setApproving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from('cleaning_estimates')
        .update({
          admin_approved: approved,
          admin_approved_by: session.session.user.email,
          admin_approved_at: new Date().toISOString(),
          status: approved ? 'approved' : 'rejected',
        })
        .eq('id', approvalDialog.estimate.id);

      if (error) throw error;

      toast.success(approved ? "Nettoyage approuvé" : "Nettoyage rejeté");
      setApprovalDialog({ open: false, estimate: null });
      fetchEstimates();
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Erreur lors de l'approbation");
    } finally {
      setApproving(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('fr-CA', {
      style: 'currency',
      currency: 'CAD',
    }).format(cents / 100);
  };

  // Chart data - margin per cleaning
  const chartData = estimates
    .slice(0, 20)
    .reverse()
    .map((e, i) => ({
      name: e.project_name.substring(0, 15),
      margin: e.margin_cents ? e.margin_cents / 100 : 0,
      cost: e.estimated_cost_cents / 100,
      revenue: (e.sale_price_cents || 0) / 100,
    }));

  // Margin distribution
  const marginDistribution = estimates.reduce((acc, e) => {
    const marginPct = e.margin_percentage || 0;
    if (marginPct < 20) acc['0-20%']++;
    else if (marginPct < 40) acc['20-40%']++;
    else if (marginPct < 60) acc['40-60%']++;
    else if (marginPct < 80) acc['60-80%']++;
    else acc['80-100%']++;
    return acc;
  }, { '0-20%': 0, '20-40%': 0, '40-60%': 0, '60-80%': 0, '80-100%': 0 } as Record<string, number>);

  const distributionChartData = Object.entries(marginDistribution).map(([range, count]) => ({
    range,
    count,
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
        <Card className="border-0 shadow-md bg-gradient-to-br from-primary to-primary/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80">Profit net</p>
                <p className="text-2xl font-bold text-primary-foreground">
                  {stats ? formatCurrency(stats.netProfit) : "0,00 $CA"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary-foreground/20">
                <DollarSign className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-success to-success/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-success-foreground/80">Marge moyenne</p>
                <p className="text-2xl font-bold text-success-foreground">
                  {stats ? `${stats.averageMargin.toFixed(1)}%` : "0%"}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-success-foreground/20">
                <TrendingUp className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md gradient-inopay">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Estimations</p>
                <p className="text-2xl font-bold text-white">{stats?.totalEstimates || 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/20">
                <Calculator className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-warning to-warning/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-warning-foreground/80">En attente</p>
                <p className="text-2xl font-bold text-warning-foreground">
                  {stats?.pendingApproval || 0}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-warning-foreground/20">
                <AlertTriangle className="h-6 w-6 text-warning-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Margin per Cleaning Chart */}
        <Card className="border-0 shadow-md">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              Marge par nettoyage
            </CardTitle>
            <CardDescription>Comparaison coût API vs revenu</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={60} />
                  <YAxis className="text-xs" tickFormatter={(v) => `${v}$`} />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      `${value.toFixed(2)} $CA`, 
                      name === 'margin' ? 'Marge' : name === 'cost' ? 'Coût API' : 'Revenu'
                    ]}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--destructive))" name="cost" opacity={0.7} />
                  <Bar dataKey="margin" fill="hsl(var(--success))" name="margin" />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" name="revenue" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Margin Distribution */}
        <Card className="border-0 shadow-md">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              Distribution des marges
            </CardTitle>
            <CardDescription>Répartition par tranche de marge</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distributionChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="range" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: number) => [value, 'Nettoyages']}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Approvals */}
      {estimates.some(e => e.requires_admin_approval && !e.admin_approved) && (
        <Card className="border-2 border-warning">
          <CardHeader className="bg-warning/10">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Nettoyages en attente d'approbation
            </CardTitle>
            <CardDescription>
              Ces projets nécessitent une validation manuelle (coût API {">"} 60% du prix)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>Fichiers</TableHead>
                  <TableHead>Coût estimé</TableHead>
                  <TableHead>Marge</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates
                  .filter(e => e.requires_admin_approval && !e.admin_approved)
                  .map(estimate => (
                    <TableRow key={estimate.id}>
                      <TableCell className="font-medium">{estimate.project_name}</TableCell>
                      <TableCell>{estimate.total_files}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(estimate.estimated_cost_cents)}</TableCell>
                      <TableCell>
                        <Badge variant={estimate.margin_percentage && estimate.margin_percentage > 40 ? "default" : "destructive"}>
                          {estimate.margin_percentage?.toFixed(1)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(estimate.created_at), { addSuffix: true, locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => setApprovalDialog({ open: true, estimate })}
                        >
                          Examiner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Estimates Table */}
      <Card className="border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              Historique des estimations
            </CardTitle>
            <CardDescription className="mt-1">{estimates.length} estimations</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchEstimates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Projet</TableHead>
                  <TableHead>Fichiers</TableHead>
                  <TableHead>Lignes</TableHead>
                  <TableHead>Coût API</TableHead>
                  <TableHead>Revenu</TableHead>
                  <TableHead>Marge</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {estimates.map(estimate => (
                  <TableRow key={estimate.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">{estimate.project_name}</TableCell>
                    <TableCell>{estimate.total_files}</TableCell>
                    <TableCell>{estimate.total_lines.toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-destructive">
                      {formatCurrency(estimate.actual_cost_cents || estimate.estimated_cost_cents)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {estimate.sale_price_cents ? formatCurrency(estimate.sale_price_cents) : '-'}
                    </TableCell>
                    <TableCell>
                      {estimate.margin_cents !== null ? (
                        <Badge variant={estimate.margin_percentage && estimate.margin_percentage > 40 ? "default" : "destructive"}>
                          {formatCurrency(estimate.margin_cents)} ({estimate.margin_percentage?.toFixed(1)}%)
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={
                          estimate.status === 'approved' ? 'default' : 
                          estimate.status === 'rejected' ? 'destructive' : 
                          'secondary'
                        }
                      >
                        {estimate.status === 'approved' ? 'Approuvé' :
                         estimate.status === 'rejected' ? 'Rejeté' :
                         estimate.status === 'pending_approval' ? 'En attente' :
                         estimate.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog.open} onOpenChange={(open) => setApprovalDialog({ open, estimate: open ? approvalDialog.estimate : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Examiner la demande de nettoyage</DialogTitle>
            <DialogDescription>
              Projet : {approvalDialog.estimate?.project_name}
            </DialogDescription>
          </DialogHeader>
          
          {approvalDialog.estimate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Fichiers</p>
                  <p className="font-medium">{approvalDialog.estimate.total_files}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Lignes</p>
                  <p className="font-medium">{approvalDialog.estimate.total_lines.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Coût API estimé</p>
                  <p className="font-medium text-destructive">
                    {formatCurrency(approvalDialog.estimate.estimated_cost_cents)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prix de vente</p>
                  <p className="font-medium">
                    {approvalDialog.estimate.sale_price_cents 
                      ? formatCurrency(approvalDialog.estimate.sale_price_cents) 
                      : '-'}
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="flex items-center gap-2 text-destructive mb-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">Marge faible détectée</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  La marge estimée ({approvalDialog.estimate.margin_percentage?.toFixed(1)}%) est inférieure à 40%.
                  Approuver ce nettoyage réduira la rentabilité.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleApproval(false)}
              disabled={approving}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Rejeter
            </Button>
            <Button 
              onClick={() => handleApproval(true)}
              disabled={approving}
            >
              {approving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approuver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCleaningMargins;
