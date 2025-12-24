import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Rocket, 
  RefreshCw, 
  Server, 
  Activity, 
  Loader2, 
  DollarSign,
  TrendingUp,
  Package,
  Filter,
  Crown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { SERVICE_LABELS } from "@/lib/constants";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";

interface Purchase {
  id: string;
  user_id: string;
  service_type: string;
  amount: number;
  currency: string;
  status: string;
  is_subscription: boolean;
  subscription_status: string | null;
  used: boolean;
  created_at: string;
}

interface ServiceStats {
  type: string;
  count: number;
  revenue: number;
  usedCount: number;
  enterpriseCount: number;
}

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6'];

const AdminPurchases = () => {
  const { t } = useTranslation();
  const { formatCurrency, formatDateTime, locale } = useLocaleFormat();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [serviceStats, setServiceStats] = useState<ServiceStats[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEnterprise, setFilterEnterprise] = useState<string>("all");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [mrr, setMrr] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  const [dailyRevenue, setDailyRevenue] = useState<any[]>([]);
  const [usersWithEnterprise, setUsersWithEnterprise] = useState(0);

  const formatAmount = (amount: number) => {
    return formatCurrency(amount / 100, 'CAD');
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_purchases")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setPurchases(data || []);

      // Calculate stats
      const stats: Record<string, ServiceStats> = {};
      let total = 0;
      let monthly = 0;
      let usedCredits = 0;
      let totalCredits = 0;

      // Check for enterprise access (deploy purchases within 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const enterpriseUsers = new Set<string>();

      for (const p of data || []) {
        // Track enterprise users
        if (p.service_type === 'deploy' && p.status === 'completed' && new Date(p.created_at) >= sevenDaysAgo) {
          enterpriseUsers.add(p.user_id);
        }

        if (p.status !== "refunded") {
          total += p.amount;
          
          if (!stats[p.service_type]) {
            stats[p.service_type] = { type: p.service_type, count: 0, revenue: 0, usedCount: 0, enterpriseCount: 0 };
          }
          stats[p.service_type].count++;
          stats[p.service_type].revenue += p.amount;

          if (p.service_type === 'deploy' && new Date(p.created_at) >= sevenDaysAgo) {
            stats[p.service_type].enterpriseCount++;
          }

          if (p.is_subscription && p.subscription_status === "active") {
            monthly += p.amount;
          }

          if (!p.is_subscription) {
            totalCredits++;
            if (p.used) {
              usedCredits++;
              stats[p.service_type].usedCount++;
            }
          }
        }
      }

      setUsersWithEnterprise(enterpriseUsers.size);
      setServiceStats(Object.values(stats));
      setTotalRevenue(total);
      setMrr(monthly);
      setConversionRate(totalCredits > 0 ? Math.round((usedCredits / totalCredits) * 100) : 0);

      // Calculate daily revenue for chart
      const daily: Record<string, number> = {};
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        daily[key] = 0;
      }

      for (const p of data || []) {
        if (p.status !== "refunded") {
          const date = new Date(p.created_at).toISOString().split('T')[0];
          if (daily[date] !== undefined) {
            daily[date] += p.amount;
          }
        }
      }

      setDailyRevenue(Object.entries(daily).map(([date, revenue]) => ({
        date: new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(date)),
        revenue: revenue / 100,
      })));

    } catch (error) {
      console.error("Error fetching purchases:", error);
      toast.error(t('adminPurchases.loadingError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, []);

  const getServiceLabel = (type: string) => SERVICE_LABELS[type] || type;

  const getServiceIcon = (type: string) => {
    switch (type) {
      case "deploy": return <Rocket className="h-4 w-4" />;
      case "redeploy": return <RefreshCw className="h-4 w-4" />;
      case "monitoring": return <Activity className="h-4 w-4" />;
      case "server": return <Server className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (purchase: Purchase) => {
    if (purchase.status === "refunded") {
      return <Badge variant="destructive">{t('adminPurchases.refunded')}</Badge>;
    }
    if (purchase.is_subscription) {
      if (purchase.subscription_status === "active") {
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{t('adminPurchases.active')}</Badge>;
      }
      return <Badge variant="secondary">{purchase.subscription_status}</Badge>;
    }
    if (purchase.used) {
      return <Badge variant="secondary">{t('adminPurchases.usedStatus')}</Badge>;
    }
    return <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">{t('adminPurchases.available')}</Badge>;
  };

  // Check if purchase grants enterprise limits
  const hasEnterpriseLimits = (purchase: Purchase) => {
    if (purchase.service_type !== 'deploy') return false;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return new Date(purchase.created_at) >= sevenDaysAgo;
  };

  // Filter purchases
  let filteredPurchases = purchases;
  if (filterType !== "all") {
    filteredPurchases = filteredPurchases.filter(p => p.service_type === filterType);
  }
  if (filterEnterprise === "enterprise") {
    filteredPurchases = filteredPurchases.filter(p => hasEnterpriseLimits(p));
  } else if (filterEnterprise === "standard") {
    filteredPurchases = filteredPurchases.filter(p => !hasEnterpriseLimits(p));
  }

  const pieData = serviceStats.map((s, i) => ({
    name: getServiceLabel(s.type),
    value: s.revenue / 100,
    color: COLORS[i % COLORS.length],
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{formatAmount(totalRevenue)}</p>
                <p className="text-xs text-zinc-400">{t('adminPurchases.totalRevenue')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-400">{formatAmount(mrr)}</p>
                <p className="text-xs text-zinc-400">{t('adminPurchases.mrr')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Package className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-400">{purchases.length}</p>
                <p className="text-xs text-zinc-400">{t('adminPurchases.totalPurchases')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Rocket className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">{conversionRate}%</p>
                <p className="text-xs text-zinc-400">{t('adminPurchases.usageRate')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Crown className="h-5 w-5 text-pink-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-pink-400">{usersWithEnterprise}</p>
                <p className="text-xs text-zinc-400">{t('adminPurchases.enterpriseUsers')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">{t('adminPurchases.revenueByDay')}</CardTitle>
            <CardDescription className="text-zinc-400">{t('adminPurchases.last7Days')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRevenue}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    formatter={(value: number) => [formatCurrency(value, 'CAD'), t('adminPurchases.revenue')]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revenueGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100">{t('adminPurchases.serviceDistribution')}</CardTitle>
            <CardDescription className="text-zinc-400">{t('adminPurchases.revenueDistribution')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                    formatter={(value: number) => [formatCurrency(value, 'CAD'), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {pieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm text-zinc-400">{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Stats */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">{t('adminPurchases.serviceStats')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {serviceStats.map((stat) => (
              <div key={stat.type} className="p-4 bg-zinc-800/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {getServiceIcon(stat.type)}
                  <span className="font-medium text-zinc-200">{getServiceLabel(stat.type)}</span>
                  {stat.type === 'deploy' && stat.enterpriseCount > 0 && (
                    <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs">
                      <Crown className="h-3 w-3 mr-1" />
                      {stat.enterpriseCount}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-zinc-100">{stat.count} {t('adminPurchases.sales')}</p>
                  <p className="text-sm text-emerald-400">{formatAmount(stat.revenue)}</p>
                  {!stat.type.includes("monitoring") && (
                    <p className="text-xs text-zinc-500">
                      {stat.usedCount}/{stat.count} {t('adminPurchases.used')} ({stat.count > 0 ? Math.round((stat.usedCount / stat.count) * 100) : 0}%)
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Purchases Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-zinc-100">{t('adminPurchases.allPurchases')}</CardTitle>
            <CardDescription className="text-zinc-400">{t('adminPurchases.purchasesCount', { count: filteredPurchases.length })}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('adminPurchases.service')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('adminPurchases.allServices')}</SelectItem>
                <SelectItem value="deploy">{t('adminPurchases.deployment')}</SelectItem>
                <SelectItem value="redeploy">{t('adminPurchases.redeployment')}</SelectItem>
                <SelectItem value="monitoring">{t('adminPurchases.monitoring')}</SelectItem>
                <SelectItem value="server">{t('adminPurchases.server')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEnterprise} onValueChange={setFilterEnterprise}>
              <SelectTrigger className="w-40 bg-zinc-800 border-zinc-700">
                <Crown className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('adminPurchases.limits')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('adminPurchases.all')}</SelectItem>
                <SelectItem value="enterprise">{t('adminPurchases.enterprise')}</SelectItem>
                <SelectItem value="standard">{t('adminPurchases.standard')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={fetchPurchases} className="border-zinc-700">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">{t('adminPurchases.service')}</TableHead>
                <TableHead className="text-zinc-400">{t('adminPurchases.amount')}</TableHead>
                <TableHead className="text-zinc-400">{t('adminPurchases.date')}</TableHead>
                <TableHead className="text-zinc-400">{t('adminPurchases.limits')}</TableHead>
                <TableHead className="text-zinc-400">{t('adminPurchases.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPurchases.slice(0, 50).map((purchase) => (
                <TableRow key={purchase.id} className="border-zinc-800">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getServiceIcon(purchase.service_type)}
                      <span className="font-medium text-zinc-200">
                        {getServiceLabel(purchase.service_type)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-300">
                    {formatAmount(purchase.amount)}
                  </TableCell>
                  <TableCell className="text-zinc-400">
                    {formatDateTime(purchase.created_at)}
                  </TableCell>
                  <TableCell>
                    {hasEnterpriseLimits(purchase) ? (
                      <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                        <Crown className="h-3 w-3 mr-1" />
                        {t('adminPurchases.enterprise')}
                      </Badge>
                    ) : (
                      <span className="text-zinc-500">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(purchase)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPurchases;