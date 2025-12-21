import { useState, useEffect, useCallback } from "react";
import { Clock, Zap, ExternalLink, RefreshCw } from "lucide-react";
import { StatusIndicator } from "./StatusIndicator";
import { ActivityFeed } from "./ActivityFeed";
import { QuickActions } from "./QuickActions";
import { ZenModeToggle } from "./ZenModeToggle";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface WidgetData {
  status: 'synced' | 'cleaning' | 'deploying' | 'error';
  sync_enabled: boolean;
  zen_mode: boolean;
  last_sync_at: string | null;
  sync_count: number;
  time_saved_minutes: number;
  deployment: {
    project_name: string;
    deployed_url: string;
    status: string;
    health_status: string;
    coolify_url?: string;
  } | null;
  recent_activity: Array<{
    id: string;
    title: string;
    description?: string;
    status: string;
    created_at: string;
  }>;
}

interface VibeMonitorWidgetProps {
  token: string;
}

export function VibeMonitorWidget({ token }: VibeMonitorWidgetProps) {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const { data: result, error: fetchError } = await supabase.functions.invoke('widget-auth', {
        body: {},
        headers: {},
      });
      
      // Use query param approach since it's a public endpoint
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/widget-auth?token=${token}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch widget data');
      }

      const widgetData = await response.json();
      setData(widgetData);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Widget fetch error:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleZenModeToggle = async (enabled: boolean) => {
    if (!data) return;
    setData({ ...data, zen_mode: enabled });
    // Note: This would need to update the database via an authenticated call
  };

  const formatTimeSaved = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-500/30 animate-ping" />
          <p className="text-white/60">Chargement du widget...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900/20 to-slate-900 flex items-center justify-center p-4">
        <div className="glass-widget p-6 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Erreur</h2>
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={fetchData} variant="outline" className="border-red-500/30">
            <RefreshCw className="w-4 h-4 mr-2" />
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 pb-safe">
      {/* Background glow effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
      </div>
      
      <div className="relative max-w-md mx-auto space-y-4">
        {/* Header with project name */}
        <div className="glass-widget p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-400" />
              <span className="text-sm font-medium text-green-400">VIBE MONITOR</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchData}
              className="h-8 w-8 text-muted-foreground hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          
          {data.deployment && (
            <div className="mb-4">
              <h1 className="text-xl font-bold text-white truncate">
                {data.deployment.project_name}
              </h1>
              {data.deployment.deployed_url && (
                <a 
                  href={data.deployment.deployed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-green-400 flex items-center gap-1 mt-1"
                >
                  {new URL(data.deployment.deployed_url).hostname}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
          
          {/* Status Indicator */}
          <StatusIndicator status={data.status} />
        </div>

        {/* Time Saved Counter */}
        <div className="glass-widget p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <Clock className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Temps gagné grâce à l'automatisation</p>
              <p className="text-2xl font-bold text-white">
                {formatTimeSaved(data.time_saved_minutes)}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-1000"
              style={{ width: `${Math.min((data.sync_count / 100) * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {data.sync_count} synchronisations effectuées
          </p>
        </div>

        {/* Activity Feed */}
        <div className="glass-widget p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            ACTIVITÉ LIVE
          </h3>
          <ActivityFeed activities={data.recent_activity} />
        </div>

        {/* Quick Actions */}
        <QuickActions 
          syncConfigId={token}
          coolifyUrl={data.deployment?.coolify_url}
          onForceSync={fetchData}
        />

        {/* Zen Mode Toggle */}
        <ZenModeToggle 
          enabled={data.zen_mode} 
          onToggle={handleZenModeToggle}
        />

        {/* Last refresh indicator */}
        <p className="text-center text-xs text-muted-foreground/50">
          Dernière mise à jour : {lastRefresh.toLocaleTimeString('fr-FR')}
        </p>
      </div>
    </div>
  );
}
