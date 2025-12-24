import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Activity, 
  Server, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  Zap,
  Shield,
  Globe,
  Database,
  Key,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ActivityLog {
  id: string;
  action_type: string;
  title: string;
  description: string | null;
  status: string;
  metadata: any;
  created_at: string;
}

const iconMap: Record<string, any> = {
  docker_install: Server,
  ai_cleanup: Zap,
  ssl_activated: Shield,
  deployment: Globe,
  database_setup: Database,
  secrets_cleaned: Key,
  health_check: Activity,
  error: XCircle,
  liberation: Zap,
  project_liberation: CheckCircle2,
  default: Info,
};

const statusColors: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  processing: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const AdminActivityMonitor = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    
    // Real-time subscription
    const channel = supabase
      .channel('admin-activity-logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_activity_logs'
      }, (payload) => {
        setLogs(prev => [payload.new as ActivityLog, ...prev].slice(0, 100));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getIcon = (actionType: string) => {
    const Icon = iconMap[actionType] || iconMap.default;
    return Icon;
  };

  const errorLogs = logs.filter(l => l.status === 'error');
  const recentLogs = logs.slice(0, 50);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Activity Feed */}
      <Card className="lg:col-span-2 bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-zinc-100">Journal d'Activité</CardTitle>
              <CardDescription className="text-zinc-400">
                Événements système en temps réel
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {recentLogs.length === 0 ? (
              <div className="text-center py-8 text-zinc-400">
                <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Aucune activité récente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => {
                  const Icon = getIcon(log.action_type);
                  return (
                    <div 
                      key={log.id} 
                      className={`p-4 rounded-lg border ${
                        log.status === 'error' 
                          ? 'bg-red-500/5 border-red-500/20' 
                          : 'bg-zinc-800/50 border-zinc-700/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          log.status === 'success' ? 'bg-emerald-500/10' :
                          log.status === 'error' ? 'bg-red-500/10' :
                          log.status === 'warning' ? 'bg-amber-500/10' :
                          log.status === 'processing' ? 'bg-purple-500/10' :
                          'bg-blue-500/10'
                        }`}>
                          <Icon className={`h-4 w-4 ${
                            log.status === 'success' ? 'text-emerald-400' :
                            log.status === 'error' ? 'text-red-400' :
                            log.status === 'warning' ? 'text-amber-400' :
                            log.status === 'processing' ? 'text-purple-400' :
                            'text-blue-400'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-zinc-200 truncate">{log.title}</p>
                            <Badge className={statusColors[log.status] || statusColors.info}>
                              {log.status}
                            </Badge>
                          </div>
                          {log.description && (
                            <p className="text-sm text-zinc-400 line-clamp-2">{log.description}</p>
                          )}
                          <p className="text-xs text-zinc-500 mt-2">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Error Alerts Panel */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <CardTitle className="text-zinc-100">Alertes Erreurs</CardTitle>
              <CardDescription className="text-zinc-400">
                {errorLogs.length} erreur(s) détectée(s)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[450px]">
            {errorLogs.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-400 opacity-50" />
                <p className="text-zinc-400">Aucune erreur</p>
                <p className="text-xs text-zinc-500 mt-1">Tout fonctionne correctement</p>
              </div>
            ) : (
              <div className="space-y-3">
                {errorLogs.map((log) => (
                  <div 
                    key={log.id} 
                    className="p-3 rounded-lg bg-red-500/5 border border-red-500/20"
                  >
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-red-300 text-sm truncate">{log.title}</p>
                        {log.description && (
                          <p className="text-xs text-red-400/70 mt-1 line-clamp-3">{log.description}</p>
                        )}
                        {log.metadata?.error && (
                          <pre className="text-xs bg-red-950/50 rounded p-2 mt-2 overflow-x-auto text-red-300/80">
                            {typeof log.metadata.error === 'string' 
                              ? log.metadata.error 
                              : JSON.stringify(log.metadata.error, null, 2)
                            }
                          </pre>
                        )}
                        <p className="text-xs text-zinc-500 mt-2">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminActivityMonitor;
