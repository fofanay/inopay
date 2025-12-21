import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Loader2,
  Target,
  FileText,
  BarChart3,
  CreditCard,
  Rocket,
  Users,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { formatAmount } from "@/lib/constants";

const AdminKPIs = () => {
  const [loading, setLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    // Revenus Pay-per-Service
    totalRevenuePayPerService: 0,
    monthlyRevenuePayPerService: 0,
    weeklyRevenuePayPerService: 0,
    // Revenus Abonnements (monitoring uniquement)
    mrrMonitoring: 0,
    // Métriques
    successRate: 0,
    totalDeployments: 0,
    successfulDeployments: 0,
    failedDeployments: 0,
    totalFilesExported: 0,
    totalProjectsCleaned: 0,
    // LTV
    ltvMoyen: 0,
    tauxUtilisationCredits: 0,
    usersAvecEnterprise: 0,
  });

  const fetchKPIs = async () => {
    setLoading(true);
    try {
      // Fetch all purchases
      const { data: purchases, error: purchasesError } = await supabase
        .from('user_purchases')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      
      if (purchasesError) throw purchasesError;

      // Calculate Pay-per-Service revenue (non-subscription)
      const payPerServicePurchases = purchases?.filter(p => !p.is_subscription) || [];
      const totalRevenuePayPerService = payPerServicePurchases.reduce((sum, p) => sum + p.amount, 0);
      
      // Calculate monitoring MRR (subscriptions only)
      const activeMonitoring = purchases?.filter(p => 
        p.is_subscription && 
        p.subscription_status === 'active' && 
        p.service_type === 'monitoring'
      ) || [];
      const mrrMonitoring = activeMonitoring.reduce((sum, p) => sum + p.amount, 0);

      // Calculate usage rate
      const usedCredits = payPerServicePurchases.filter(p => p.used).length;
      const tauxUtilisationCredits = payPerServicePurchases.length > 0 
        ? Math.round((usedCredits / payPerServicePurchases.length) * 100) 
        : 0;

      // Count unique users with recent deploy purchase (enterprise access)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const usersWithEnterprise = new Set(
        purchases?.filter(p => 
          p.service_type === 'deploy' && 
          new Date(p.created_at) >= sevenDaysAgo
        ).map(p => p.user_id) || []
      ).size;

      // Calculate LTV (total revenue / unique users)
      const uniqueUsers = new Set(purchases?.map(p => p.user_id) || []);
      const totalRevenue = purchases?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const ltvMoyen = uniqueUsers.size > 0 ? Math.round(totalRevenue / uniqueUsers.size) : 0;

      // Monthly/weekly calculations
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgoPurchases = new Date(now);
      sevenDaysAgoPurchases.setDate(sevenDaysAgoPurchases.getDate() - 7);

      const monthlyPayPerService = payPerServicePurchases
        .filter(p => new Date(p.created_at) >= thirtyDaysAgo)
        .reduce((sum, p) => sum + p.amount, 0);

      const weeklyPayPerService = payPerServicePurchases
        .filter(p => new Date(p.created_at) >= sevenDaysAgoPurchases)
        .reduce((sum, p) => sum + p.amount, 0);

      // Fetch deployments stats
      const { data: deployments, error: depError } = await supabase
        .from('deployment_history')
        .select('status, files_uploaded, created_at');
      
      if (depError) throw depError;

      const total = deployments?.length || 0;
      const successful = deployments?.filter(d => d.status === 'success').length || 0;
      const failed = deployments?.filter(d => d.status === 'failed').length || 0;
      const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;
      const totalFiles = deployments?.reduce((sum, d) => sum + (d.files_uploaded || 0), 0) || 0;

      // Fetch projects analysis
      const { data: projects, error: projError } = await supabase
        .from('projects_analysis')
        .select('id, created_at');
      
      if (projError) throw projError;

      // Generate daily revenue data for charts
      const dailyData: Record<string, { payPerService: number; monitoring: number; deployments: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        dailyData[key] = { payPerService: 0, monitoring: 0, deployments: 0 };
      }

      payPerServicePurchases.forEach(p => {
        const date = new Date(p.created_at).toISOString().split('T')[0];
        if (dailyData[date] !== undefined) {
          dailyData[date].payPerService += p.amount;
        }
      });

      deployments?.forEach(d => {
        const date = new Date(d.created_at).toISOString().split('T')[0];
        if (dailyData[date] !== undefined) {
          dailyData[date].deployments++;
        }
      });

      setRevenueData(Object.entries(dailyData).map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' }),
        payPerService: data.payPerService / 100,
        deployments: data.deployments,
      })));

      setStats({
        totalRevenuePayPerService,
        monthlyRevenuePayPerService: monthlyPayPerService,
        weeklyRevenuePayPerService: weeklyPayPerService,
        mrrMonitoring,
        successRate,
        totalDeployments: total,
        successfulDeployments: successful,
        failedDeployments: failed,
        totalFilesExported: totalFiles,
        totalProjectsCleaned: projects?.length || 0,
        ltvMoyen,
        tauxUtilisationCredits,
        usersAvecEnterprise: usersWithEnterprise,
      });

    } catch (error) {
      console.error('Error fetching KPIs:', error);
      toast.error("Erreur lors du chargement des KPIs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Stats - Pay-per-Service Focus */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{formatAmount(stats.monthlyRevenuePayPerService)}</p>
                <p className="text-xs text-zinc-400">Pay-per-Service (30j)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <CreditCard className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{formatAmount(stats.mrrMonitoring)}</p>
                <p className="text-xs text-zinc-400">MRR Monitoring</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Users className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-400">{formatAmount(stats.ltvMoyen)}</p>
                <p className="text-xs text-zinc-400">LTV Moyen</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">{stats.usersAvecEnterprise}</p>
                <p className="text-xs text-zinc-400">Users Enterprise actif</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Target className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-400">{stats.successRate}%</p>
                <p className="text-xs text-zinc-400">Taux de succès</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Rocket className="h-5 w-5 text-pink-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-pink-400">{stats.tauxUtilisationCredits}%</p>
                <p className="text-xs text-zinc-400">Taux utilisation crédits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <FileText className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-400">{stats.totalFilesExported.toLocaleString()}</p>
                <p className="text-xs text-zinc-400">Fichiers libérés</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <DollarSign className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-indigo-400">{formatAmount(stats.totalRevenuePayPerService)}</p>
                <p className="text-xs text-zinc-400">Total Pay-per-Service</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-zinc-100">Revenus Pay-per-Service</CardTitle>
                <CardDescription className="text-zinc-400">Évolution hebdomadaire</CardDescription>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={fetchKPIs}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="payPerServiceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(value: number) => [`${value.toFixed(2)} $`, 'Pay-per-Service']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="payPerService" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    fill="url(#payPerServiceGradient)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">Déploiements</CardTitle>
            <CardDescription className="text-zinc-400">Volume quotidien</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: '#a1a1aa' }}
                  />
                  <Bar dataKey="deployments" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deployment Stats */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Performance des Déploiements</CardTitle>
          <CardDescription className="text-zinc-400">Statistiques détaillées</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-zinc-800/50 rounded-lg">
              <div className="relative inline-flex mb-4">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-zinc-700"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${stats.successRate * 2.51} 251`}
                    className="text-emerald-400 transition-all duration-500"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-zinc-100">{stats.successRate}%</span>
                </div>
              </div>
              <p className="text-sm text-zinc-400">Taux de réussite</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-emerald-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-zinc-200">Réussis</span>
                </div>
                <span className="text-xl font-bold text-emerald-400">{stats.successfulDeployments}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-500/10 rounded-lg">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-400" />
                  <span className="text-zinc-200">Échoués</span>
                </div>
                <span className="text-xl font-bold text-red-400">{stats.failedDeployments}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-violet-400" />
                  <span className="text-sm text-zinc-400">Total déploiements</span>
                </div>
                <p className="text-2xl font-bold text-zinc-100">{stats.totalDeployments}</p>
              </div>
              <div className="p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-amber-400" />
                  <span className="text-sm text-zinc-400">Projets nettoyés</span>
                </div>
                <p className="text-2xl font-bold text-zinc-100">{stats.totalProjectsCleaned}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminKPIs;
