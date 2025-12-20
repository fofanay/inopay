import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, Users, FileText, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend 
} from "recharts";

interface AnalyticsData {
  signups: Array<{ date: string; count: number }>;
  exports: Array<{ date: string; count: number }>;
  deployments: Array<{ date: string; count: number }>;
  planDistribution: Array<{ name: string; value: number }>;
  providerDistribution: Array<{ name: string; value: number }>;
}

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [data, setData] = useState<AnalyticsData>({
    signups: [],
    exports: [],
    deployments: [],
    planDistribution: [],
    providerDistribution: [],
  });

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const daysAgo = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch subscriptions for plan distribution
      const { data: subscriptions } = await supabase
        .from("subscriptions")
        .select("plan_type, created_at")
        .gte("created_at", startDate.toISOString());

      // Fetch projects for export stats
      const { data: projects } = await supabase
        .from("projects_analysis")
        .select("created_at, status")
        .gte("created_at", startDate.toISOString());

      // Fetch deployments
      const { data: deployments } = await supabase
        .from("deployment_history")
        .select("created_at, provider, deployment_type")
        .gte("created_at", startDate.toISOString());

      // Process signups by day
      const signupsByDay: Record<string, number> = {};
      const exportsByDay: Record<string, number> = {};
      const deploymentsByDay: Record<string, number> = {};

      // Initialize days
      for (let i = 0; i < daysAgo; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        signupsByDay[key] = 0;
        exportsByDay[key] = 0;
        deploymentsByDay[key] = 0;
      }

      // Count subscriptions
      subscriptions?.forEach((s) => {
        const key = s.created_at.split("T")[0];
        if (signupsByDay[key] !== undefined) signupsByDay[key]++;
      });

      // Count exports
      projects?.forEach((p) => {
        const key = p.created_at.split("T")[0];
        if (exportsByDay[key] !== undefined) exportsByDay[key]++;
      });

      // Count deployments
      deployments?.forEach((d) => {
        const key = d.created_at.split("T")[0];
        if (deploymentsByDay[key] !== undefined) deploymentsByDay[key]++;
      });

      // Plan distribution
      const planCounts: Record<string, number> = { free: 0, pack: 0, pro: 0, tester: 0 };
      subscriptions?.forEach((s) => {
        const plan = s.plan_type || "free";
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      });

      // Provider distribution
      const providerCounts: Record<string, number> = {};
      deployments?.forEach((d) => {
        const provider = d.provider || d.deployment_type || "unknown";
        providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      });

      setData({
        signups: Object.entries(signupsByDay)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        exports: Object.entries(exportsByDay)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        deployments: Object.entries(deploymentsByDay)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        planDistribution: Object.entries(planCounts)
          .filter(([, v]) => v > 0)
          .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })),
        providerDistribution: Object.entries(providerCounts)
          .filter(([, v]) => v > 0)
          .map(([name, value]) => ({ name, value })),
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Erreur lors du chargement des analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  };

  const totalSignups = data.signups.reduce((sum, d) => sum + d.count, 0);
  const totalExports = data.exports.reduce((sum, d) => sum + d.count, 0);
  const totalDeployments = data.deployments.reduce((sum, d) => sum + d.count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
              <SelectItem value="90">90 derniers jours</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={fetchAnalytics} className="border-border/50 hover:bg-muted">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-primary to-primary/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80">Nouveaux abonnements</p>
                <p className="text-3xl font-bold text-primary-foreground">{totalSignups}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary-foreground/20">
                <Users className="h-6 w-6 text-primary-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-success to-success/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-success-foreground/80">Exports analysés</p>
                <p className="text-3xl font-bold text-success-foreground">{totalExports}</p>
              </div>
              <div className="p-3 rounded-xl bg-success-foreground/20">
                <FileText className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="card-hover border-0 shadow-md gradient-inopay">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/80">Déploiements</p>
                <p className="text-3xl font-bold text-white">{totalDeployments}</p>
              </div>
              <div className="p-3 rounded-xl bg-white/20">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signups Chart */}
        <Card className="card-hover border-0 shadow-md">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              Nouveaux abonnements
            </CardTitle>
            <CardDescription>Évolution sur la période</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.signups}>
                  <defs>
                    <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    labelFormatter={(label) => formatDate(label as string)}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--primary))" 
                    fill="url(#colorSignups)" 
                    strokeWidth={2}
                    name="Abonnements"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Exports Chart */}
        <Card className="card-hover border-0 shadow-md">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-success/10">
                <FileText className="h-5 w-5 text-success" />
              </div>
              Exports analysés
            </CardTitle>
            <CardDescription>Projets traités par jour</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.exports}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    labelFormatter={(label) => formatDate(label as string)}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--success))" 
                    radius={[4, 4, 0, 0]}
                    name="Exports"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deployments Chart */}
        <Card className="card-hover border-0 shadow-md">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-accent/10">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
              Déploiements
            </CardTitle>
            <CardDescription>Par jour</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.deployments}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    labelFormatter={(label) => formatDate(label as string)}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    dot={false}
                    name="Déploiements"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card className="card-hover border-0 shadow-md">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              Répartition par plan
            </CardTitle>
            <CardDescription>Abonnements actifs</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.planDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {data.planDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Provider Distribution */}
        <Card className="card-hover border-0 shadow-md">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-warning/10">
                <FileText className="h-5 w-5 text-warning" />
              </div>
              Hébergeurs utilisés
            </CardTitle>
            <CardDescription>Déploiements par provider</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.providerDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {data.providerDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalytics;
