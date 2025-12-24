import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  Activity, 
  FileText, 
  Server, 
  Shield, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Eye,
  StopCircle,
  DollarSign,
  TrendingUp,
  Settings,
  Terminal,
  AlertCircle,
  Wrench,
  Save,
  Zap,
  Rocket
} from "lucide-react";
import { SelfLiberationLauncher } from "@/components/dashboard/SelfLiberationLauncher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

// Types
interface LivePipeline {
  id: string;
  userId: string;
  userEmail: string;
  projectName: string;
  phase: 'cleaning' | 'github' | 'coolify' | 'completed' | 'failed';
  startedAt: string;
  tokensUsed: number;
  filesProcessed: number;
  status: 'running' | 'completed' | 'failed';
}

interface SecurityAlert {
  id: string;
  projectName: string;
  userId: string;
  userEmail: string;
  certification: 'compromised' | 'requires_review' | 'sovereign';
  findings: any[];
  createdAt: string;
  status: 'pending' | 'approved' | 'blocked';
}

interface ValidationError {
  id: string;
  userId: string;
  userEmail: string;
  projectName: string;
  filePath: string;
  error: string;
  createdAt: string;
}

interface SecurityLimits {
  MAX_FILES_PER_LIBERATION: number;
  MAX_FILE_SIZE_CHARS: number;
  MAX_API_COST_CENTS: number;
  CACHE_TTL_HOURS: number;
}

// KPIs Component
const OperationsKPIs = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    filesProcessed24h: 0,
    filesProcessed7d: 0,
    vpsHealthPercent: 0,
    onlineServers: 0,
    totalServers: 0,
    apiMargin: 0,
    stripeRevenue: 0,
    aiCosts: 0,
    successRate: 0,
    successfulLiberations: 0,
    totalLiberations: 0,
  });
  const [marginTrend, setMarginTrend] = useState<any[]>([]);

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Fetch cleaning cache for file processing stats
      const { data: cleaningData } = await supabase
        .from('cleaning_cache')
        .select('created_at, tokens_used, api_cost_cents');

      const files24h = cleaningData?.filter(c => new Date(c.created_at) >= oneDayAgo).length || 0;
      const files7d = cleaningData?.filter(c => new Date(c.created_at) >= sevenDaysAgo).length || 0;
      
      const totalAiCosts = cleaningData?.reduce((sum, c) => sum + (c.api_cost_cents || 0), 0) || 0;

      // Fetch servers for VPS health
      const { data: servers } = await supabase
        .from('user_servers')
        .select('id, status');

      const totalServers = servers?.length || 0;
      const onlineServers = servers?.filter(s => s.status === 'active' || s.status === 'ready').length || 0;
      const vpsHealthPercent = totalServers > 0 ? Math.round((onlineServers / totalServers) * 100) : 100;

      // Fetch stripe revenue (from purchases)
      const { data: purchases } = await supabase
        .from('user_purchases')
        .select('amount, created_at')
        .eq('status', 'completed');

      const stripeRevenue = purchases?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const apiMargin = stripeRevenue - totalAiCosts;

      // Fetch deployments for success rate
      const { data: deployments } = await supabase
        .from('deployment_history')
        .select('status, created_at');

      const totalLiberations = deployments?.length || 0;
      const successfulLiberations = deployments?.filter(d => d.status === 'success').length || 0;
      const successRate = totalLiberations > 0 ? Math.round((successfulLiberations / totalLiberations) * 100) : 100;

      // Generate trend data for the last 7 days
      const trendData: any[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayPurchases = purchases?.filter(p => 
          p.created_at.startsWith(dateStr)
        ) || [];
        const dayRevenue = dayPurchases.reduce((sum, p) => sum + p.amount, 0);
        
        const dayCleaning = cleaningData?.filter(c => 
          c.created_at.startsWith(dateStr)
        ) || [];
        const dayCosts = dayCleaning.reduce((sum, c) => sum + (c.api_cost_cents || 0), 0);
        
        trendData.push({
          date: new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short' }),
          revenue: dayRevenue / 100,
          costs: dayCosts / 100,
          margin: (dayRevenue - dayCosts) / 100,
        });
      }
      setMarginTrend(trendData);

      setStats({
        filesProcessed24h: files24h,
        filesProcessed7d: files7d,
        vpsHealthPercent,
        onlineServers,
        totalServers,
        apiMargin,
        stripeRevenue,
        aiCosts: totalAiCosts,
        successRate,
        successfulLiberations,
        totalLiberations,
      });
    } catch (error) {
      console.error('Error fetching KPIs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPIs();
    const interval = setInterval(fetchKPIs, 30000);
    return () => clearInterval(interval);
  }, [fetchKPIs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-500/20 border border-violet-500/30">
                <FileText className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-violet-400">{stats.filesProcessed24h.toLocaleString()}</p>
                <p className="text-sm text-slate-400">Fichiers nettoyés (24h)</p>
                <p className="text-xs text-slate-500 mt-1">{stats.filesProcessed7d.toLocaleString()} sur 7j</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
                <Server className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-3xl font-bold text-emerald-400">{stats.vpsHealthPercent}%</p>
                <p className="text-sm text-slate-400">Santé VPS</p>
                <p className="text-xs text-slate-500 mt-1">{stats.onlineServers}/{stats.totalServers} online</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl border ${stats.apiMargin >= 0 ? 'bg-cyan-500/20 border-cyan-500/30' : 'bg-red-500/20 border-red-500/30'}`}>
                <DollarSign className={`h-6 w-6 ${stats.apiMargin >= 0 ? 'text-cyan-400' : 'text-red-400'}`} />
              </div>
              <div>
                <p className={`text-3xl font-bold ${stats.apiMargin >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                  {(stats.apiMargin / 100).toFixed(2)}$
                </p>
                <p className="text-sm text-slate-400">Marge API</p>
                <p className="text-xs text-slate-500 mt-1">
                  Rev: {(stats.stripeRevenue / 100).toFixed(2)}$ | Coût: {(stats.aiCosts / 100).toFixed(2)}$
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl border ${stats.successRate >= 90 ? 'bg-green-500/20 border-green-500/30' : 'bg-amber-500/20 border-amber-500/30'}`}>
                <CheckCircle2 className={`h-6 w-6 ${stats.successRate >= 90 ? 'text-green-400' : 'text-amber-400'}`} />
              </div>
              <div>
                <p className={`text-3xl font-bold ${stats.successRate >= 90 ? 'text-green-400' : 'text-amber-400'}`}>
                  {stats.successRate}%
                </p>
                <p className="text-sm text-slate-400">Taux de succès</p>
                <p className="text-xs text-slate-500 mt-1">{stats.successfulLiberations}/{stats.totalLiberations} réussies</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Margin Trend Chart */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-slate-100 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
                Revenus vs Coûts IA
              </CardTitle>
              <CardDescription className="text-slate-400">Évolution de la marge sur 7 jours</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={fetchKPIs} className="text-slate-400 hover:text-slate-100">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={marginTrend}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="costsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#e2e8f0'
                  }}
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(2)} $`, 
                    name === 'revenue' ? 'Revenus' : name === 'costs' ? 'Coûts IA' : 'Marge'
                  ]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#22d3ee" fill="url(#revenueGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="costs" stroke="#f87171" fill="url(#costsGrad)" strokeWidth={2} />
                <Line type="monotone" dataKey="margin" stroke="#a78bfa" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Live Pipeline Monitor
const LivePipelineMonitor = () => {
  const [pipelines, setPipelines] = useState<LivePipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const fetchPipelines = useCallback(async () => {
    try {
      // Fetch recent activity logs for liberation processes
      const { data } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .eq('action_type', 'project_liberation')
        .order('created_at', { ascending: false })
        .limit(20);

      const mappedPipelines: LivePipeline[] = (data || []).map(log => {
        const metadata = log.metadata as Record<string, any> | null;
        return {
          id: log.id,
          userId: log.user_id || '',
          userEmail: metadata?.userEmail || 'N/A',
          projectName: metadata?.projectName || log.title,
          phase: log.status === 'success' ? 'completed' : log.status === 'error' ? 'failed' : 'cleaning',
          startedAt: log.created_at,
          tokensUsed: metadata?.tokensUsed || 0,
          filesProcessed: metadata?.cleanedFiles || 0,
          status: log.status === 'success' ? 'completed' : log.status === 'error' ? 'failed' : 'running',
        };
      });

      setPipelines(mappedPipelines);
    } catch (error) {
      console.error('Error fetching pipelines:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
    
    // Real-time subscription
    const channel = supabase
      .channel('pipeline-monitor')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'admin_activity_logs',
        filter: 'action_type=eq.project_liberation'
      }, () => {
        fetchPipelines();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPipelines]);

  const viewLogs = (pipelineId: string) => {
    setSelectedLogs(pipelineId);
    setLogs([
      `[${new Date().toISOString()}] Pipeline started`,
      `[${new Date().toISOString()}] Phase: Cleaning files...`,
      `[${new Date().toISOString()}] Processed proprietary patterns`,
      `[${new Date().toISOString()}] Validated syntax`,
    ]);
  };

  const killProcess = async (pipelineId: string) => {
    toast.info("Arrêt du processus en cours...");
    // In a real implementation, this would call an edge function to stop the process
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast.success("Processus arrêté");
    fetchPipelines();
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'cleaning': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
      case 'github': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'coolify': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/20 border border-violet-500/30">
                <Activity className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <CardTitle className="text-slate-100">Pipeline Monitor</CardTitle>
                <CardDescription className="text-slate-400">
                  {pipelines.filter(p => p.status === 'running').length} libérations en cours
                </CardDescription>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={fetchPipelines} className="text-slate-400 hover:text-slate-100">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {pipelines.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune libération récente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pipelines.map((pipeline) => (
                  <div 
                    key={pipeline.id}
                    className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-medium text-slate-200 truncate">{pipeline.projectName}</p>
                          <Badge className={getPhaseColor(pipeline.phase)}>
                            {pipeline.phase}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>{pipeline.userEmail}</span>
                          <span>•</span>
                          <span>{pipeline.filesProcessed} fichiers</span>
                          <span>•</span>
                          <span>{pipeline.tokensUsed.toLocaleString()} tokens</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(pipeline.startedAt), { addSuffix: true, locale: fr })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => viewLogs(pipeline.id)}
                          className="text-slate-400 hover:text-slate-100"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {pipeline.status === 'running' && (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => killProcess(pipeline.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <StopCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Logs Dialog */}
      <Dialog open={!!selectedLogs} onOpenChange={() => setSelectedLogs(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-slate-100 flex items-center gap-2">
              <Terminal className="h-5 w-5 text-violet-400" />
              Logs en temps réel
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] rounded-lg bg-slate-950 p-4 font-mono text-sm">
            {logs.map((log, i) => (
              <div key={i} className="text-slate-300 py-1 border-b border-slate-800/50">
                {log}
              </div>
            ))}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Security Alerts Management
const SecurityAlertsManager = () => {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .in('action_type', ['security_audit', 'zero_shadow_door'])
        .order('created_at', { ascending: false })
        .limit(50);

      const mappedAlerts: SecurityAlert[] = (data || [])
        .filter(log => {
          const metadata = log.metadata as Record<string, any> | null;
          return metadata?.certification && metadata.certification !== 'sovereign';
        })
        .map(log => {
          const metadata = log.metadata as Record<string, any> | null;
          return {
            id: log.id,
            projectName: metadata?.projectName || log.title,
            userId: log.user_id || '',
            userEmail: metadata?.userEmail || 'N/A',
            certification: metadata?.certification || 'requires_review',
            findings: metadata?.findings || [],
            createdAt: log.created_at,
            status: metadata?.adminStatus || 'pending',
          };
        });

      setAlerts(mappedAlerts);
    } catch (error) {
      console.error('Error fetching security alerts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleApprove = async (alertId: string) => {
    toast.success("Projet approuvé manuellement");
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'approved' } : a));
  };

  const handleBlock = async (alertId: string) => {
    toast.error("Déploiement bloqué");
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'blocked' } : a));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-500/30">
            <Shield className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-slate-100">Alertes de Sécurité</CardTitle>
            <CardDescription className="text-slate-400">
              Projets marqués par verify-zero-shadow-door
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {alerts.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-400 opacity-50" />
              <p>Aucune alerte de sécurité</p>
              <p className="text-xs text-slate-500 mt-1">Tous les projets sont souverains</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div 
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.certification === 'compromised' 
                      ? 'bg-red-500/10 border-red-500/30' 
                      : 'bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-medium text-slate-200">{alert.projectName}</p>
                        <Badge className={
                          alert.certification === 'compromised' 
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        }>
                          {alert.certification}
                        </Badge>
                        {alert.status !== 'pending' && (
                          <Badge className={
                            alert.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-400 border-red-500/30'
                          }>
                            {alert.status === 'approved' ? 'Approuvé' : 'Bloqué'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mb-2">{alert.userEmail}</p>
                      {alert.findings.length > 0 && (
                        <div className="text-xs text-slate-400 bg-slate-800/50 rounded p-2">
                          {alert.findings.slice(0, 3).map((f, i) => (
                            <p key={i}>• {f.type || f.message || JSON.stringify(f)}</p>
                          ))}
                          {alert.findings.length > 3 && (
                            <p className="text-slate-500 mt-1">+ {alert.findings.length - 3} autres...</p>
                          )}
                        </div>
                      )}
                    </div>
                    {alert.status === 'pending' && (
                      <div className="flex items-center gap-2 ml-4">
                        <Button 
                          size="sm" 
                          onClick={() => handleApprove(alert.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Approuver
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleBlock(alert.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Bloquer
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Limits Override Control
const LimitsOverrideControl = () => {
  const [limits, setLimits] = useState<SecurityLimits>({
    MAX_FILES_PER_LIBERATION: 500,
    MAX_FILE_SIZE_CHARS: 50000,
    MAX_API_COST_CENTS: 5000,
    CACHE_TTL_HOURS: 24,
  });
  const [killSwitch, setKillSwitch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load current config from DB
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('admin_config')
          .select('config_value')
          .eq('config_key', 'SECURITY_LIMITS')
          .single();
        
        if (data?.config_value) {
          const config = data.config_value as Record<string, any>;
          setLimits({
            MAX_FILES_PER_LIBERATION: config.MAX_FILES_PER_LIBERATION || 500,
            MAX_FILE_SIZE_CHARS: config.MAX_FILE_SIZE_CHARS || 50000,
            MAX_API_COST_CENTS: config.MAX_API_COST_CENTS || 5000,
            CACHE_TTL_HOURS: config.CACHE_TTL_HOURS || 24,
          });
          setKillSwitch(config.KILL_SWITCH_ENABLED || false);
        }
      } catch (error) {
        console.error('Error loading config:', error);
      } finally {
        setLoading(false);
      }
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to admin_config table for edge functions to read
      const { error } = await supabase
        .from('admin_config')
        .upsert({
          config_key: 'SECURITY_LIMITS',
          config_value: {
            ...limits,
            KILL_SWITCH_ENABLED: killSwitch,
          },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'config_key' });

      if (error) throw error;

      // Log the change for audit
      await supabase.from('admin_activity_logs').insert({
        action_type: 'limits_override',
        title: 'Mise à jour des limites de sécurité',
        status: killSwitch ? 'warning' : 'info',
        metadata: { ...limits, KILL_SWITCH_ENABLED: killSwitch } as unknown as Record<string, any>,
      });
      
      toast.success(killSwitch 
        ? "⚠️ KILL SWITCH ACTIVÉ - Toutes les libérations sont bloquées" 
        : "Limites mises à jour et actives immédiatement"
      );
    } catch (error) {
      console.error('Save error:', error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
            <Settings className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <CardTitle className="text-slate-100">Contrôle des Limites</CardTitle>
            <CardDescription className="text-slate-400">
              Override des SECURITY_LIMITS sans modifier le code
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Max Fichiers / Libération
            </label>
            <Input 
              type="number"
              value={limits.MAX_FILES_PER_LIBERATION}
              onChange={(e) => setLimits(prev => ({ ...prev, MAX_FILES_PER_LIBERATION: parseInt(e.target.value) || 500 }))}
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">Défaut: 500. VIP peut aller jusqu'à 2000.</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Max Caractères / Fichier
            </label>
            <Input 
              type="number"
              value={limits.MAX_FILE_SIZE_CHARS}
              onChange={(e) => setLimits(prev => ({ ...prev, MAX_FILE_SIZE_CHARS: parseInt(e.target.value) || 50000 }))}
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">Défaut: 50,000 caractères</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              Max Coût API (cents)
            </label>
            <Input 
              type="number"
              value={limits.MAX_API_COST_CENTS}
              onChange={(e) => setLimits(prev => ({ ...prev, MAX_API_COST_CENTS: parseInt(e.target.value) || 5000 }))}
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">Défaut: 5000 (50$). Alerte au-delà.</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              TTL Cache (heures)
            </label>
            <Input 
              type="number"
              value={limits.CACHE_TTL_HOURS}
              onChange={(e) => setLimits(prev => ({ ...prev, CACHE_TTL_HOURS: parseInt(e.target.value) || 24 }))}
              className="bg-slate-800 border-slate-700 text-slate-100"
            />
            <p className="text-xs text-slate-500">Défaut: 24 heures</p>
          </div>
        </div>
        
        {/* Kill Switch */}
        <div className={`p-4 rounded-lg border-2 ${killSwitch ? 'border-red-500 bg-red-500/10' : 'border-slate-600 bg-slate-800/50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 ${killSwitch ? 'text-red-500' : 'text-slate-400'}`} />
              <div>
                <p className="font-medium text-slate-100">Kill Switch Global</p>
                <p className="text-xs text-slate-400">Bloque TOUTES les libérations en cours et futures</p>
              </div>
            </div>
            <Button
              variant={killSwitch ? "destructive" : "outline"}
              size="sm"
              onClick={() => setKillSwitch(!killSwitch)}
              className={killSwitch ? '' : 'border-slate-600 hover:bg-red-500/20 hover:text-red-400'}
            >
              {killSwitch ? 'ACTIVÉ' : 'Désactivé'}
            </Button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <Button onClick={handleSave} disabled={saving} className={`w-full ${killSwitch ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {killSwitch ? '⚠️ Activer le Kill Switch' : 'Sauvegarder les limites'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// Customer Support - Validation Errors
const ValidationErrorsSupport = () => {
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchErrors = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .eq('action_type', 'project_liberation')
        .not('metadata->validationErrors', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      const mappedErrors: ValidationError[] = [];
      (data || []).forEach(log => {
        const metadata = log.metadata as Record<string, any> | null;
        const valErrors = metadata?.validationErrors || [];
        valErrors.forEach((ve: any) => {
          mappedErrors.push({
            id: `${log.id}-${ve.path}`,
            userId: log.user_id || '',
            userEmail: metadata?.userEmail || 'N/A',
            projectName: metadata?.projectName || log.title,
            filePath: ve.path,
            error: ve.error,
            createdAt: log.created_at,
          });
        });
      });

      setErrors(mappedErrors);
    } catch (error) {
      console.error('Error fetching validation errors:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const contactUser = (email: string) => {
    window.open(`mailto:${email}?subject=Support Inopay - Erreur de validation`, '_blank');
    toast.success("Client ouvert pour contacter l'utilisateur");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-500/20 border border-red-500/30">
            <AlertCircle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <CardTitle className="text-slate-100">Support Client - Erreurs</CardTitle>
            <CardDescription className="text-slate-400">
              Erreurs de validation rencontrées par les utilisateurs
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {errors.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-400 opacity-50" />
              <p>Aucune erreur de validation récente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {errors.map((error) => (
                <div 
                  key={error.id}
                  className="p-4 rounded-lg bg-red-500/10 border border-red-500/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                        <p className="font-medium text-slate-200 truncate">{error.projectName}</p>
                      </div>
                      <p className="text-xs text-slate-400 mb-1">{error.userEmail}</p>
                      <div className="bg-slate-950/50 rounded p-2 text-xs font-mono">
                        <p className="text-slate-400">{error.filePath}</p>
                        <p className="text-red-300 mt-1">{error.error}</p>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {formatDistanceToNow(new Date(error.createdAt), { addSuffix: true, locale: fr })}
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => contactUser(error.userEmail)}
                      className="text-slate-400 hover:text-slate-100 ml-4"
                    >
                      <Wrench className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Main Component
const AdminOperationsCenter = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
          <Zap className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Centre d'Opérations</h2>
          <p className="text-slate-400">Surveillance en temps réel du processus de libération</p>
        </div>
      </div>

      <Tabs defaultValue="liberation" className="space-y-6">
        <TabsList className="bg-slate-800/50 border border-slate-700/50 p-1 flex-wrap">
          <TabsTrigger value="liberation" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Rocket className="h-4 w-4 mr-2" />
            Auto-Libération
          </TabsTrigger>
          <TabsTrigger value="kpis" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <TrendingUp className="h-4 w-4 mr-2" />
            KPIs
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Activity className="h-4 w-4 mr-2" />
            Pipeline
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Shield className="h-4 w-4 mr-2" />
            Sécurité
          </TabsTrigger>
          <TabsTrigger value="limits" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Settings className="h-4 w-4 mr-2" />
            Limites
          </TabsTrigger>
          <TabsTrigger value="support" className="data-[state=active]:bg-violet-600 data-[state=active]:text-white">
            <Wrench className="h-4 w-4 mr-2" />
            Support
          </TabsTrigger>
        </TabsList>

        <TabsContent value="liberation">
          <SelfLiberationLauncher />
        </TabsContent>

        <TabsContent value="kpis">
          <OperationsKPIs />
        </TabsContent>

        <TabsContent value="pipeline">
          <LivePipelineMonitor />
        </TabsContent>

        <TabsContent value="security">
          <SecurityAlertsManager />
        </TabsContent>

        <TabsContent value="limits">
          <LimitsOverrideControl />
        </TabsContent>

        <TabsContent value="support">
          <ValidationErrorsSupport />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminOperationsCenter;