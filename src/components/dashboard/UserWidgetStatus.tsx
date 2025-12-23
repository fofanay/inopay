import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Smartphone,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface SyncConfig {
  id: string;
  github_repo_url: string;
  sync_enabled: boolean;
  sync_count: number;
  time_saved_minutes: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  widget_token: string | null;
  widget_token_revoked: boolean | null;
  widget_token_used_at: string | null;
}

export function UserWidgetStatus() {
  const [syncConfigs, setSyncConfigs] = useState<SyncConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("sync_configurations")
        .select("id, github_repo_url, sync_enabled, sync_count, time_saved_minutes, last_sync_at, last_sync_status, widget_token, widget_token_revoked, widget_token_used_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSyncConfigs(data || []);
    } catch (error) {
      console.error("Error fetching sync configs:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const stats = {
    totalWidgets: syncConfigs.filter(c => c.widget_token && !c.widget_token_revoked).length,
    activeSyncs: syncConfigs.filter(c => c.sync_enabled).length,
    totalSyncsCount: syncConfigs.reduce((sum, c) => sum + (c.sync_count || 0), 0),
    timeSavedMinutes: syncConfigs.reduce((sum, c) => sum + (c.time_saved_minutes || 0), 0),
  };

  const getRepoName = (url: string) => {
    const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
    return match ? match[1] : url;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-primary" />
              Widgets Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.totalWidgets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Sur {syncConfigs.length} configs
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Syncs Actives
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-500">{stats.activeSyncs}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-déploiement activé
            </p>
          </CardContent>
        </Card>

        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-violet-500" />
              Total Syncs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-violet-500">{stats.totalSyncsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Déploiements auto
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Temps Économisé
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">
              {Math.round(stats.timeSavedMinutes / 60)}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.timeSavedMinutes} minutes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sync Configurations */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Mes Configurations Sync
              </CardTitle>
              <CardDescription>
                État de vos synchronisations et widgets
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {syncConfigs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucune configuration sync</p>
              <p className="text-sm">Configurez un miroir pour synchroniser automatiquement vos projets</p>
            </div>
          ) : (
            <div className="space-y-4">
              {syncConfigs.map((config) => (
                <div 
                  key={config.id}
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.sync_enabled ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                        <Zap className={`h-4 w-4 ${config.sync_enabled ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-medium">{getRepoName(config.github_repo_url)}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {config.last_sync_at ? (
                            <span>
                              Dernière sync: {formatDistanceToNow(new Date(config.last_sync_at), { addSuffix: true, locale: fr })}
                            </span>
                          ) : (
                            <span>Jamais synchronisé</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {config.widget_token && !config.widget_token_revoked && (
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          <Smartphone className="h-3 w-3 mr-1" />
                          Widget actif
                        </Badge>
                      )}
                      <Badge 
                        className={config.sync_enabled 
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                          : "bg-muted text-muted-foreground"
                        }
                      >
                        {config.sync_enabled ? (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Sync ON
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Sync OFF
                          </>
                        )}
                      </Badge>
                    </div>
                  </div>

                  {/* Stats for this config */}
                  <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Syncs effectuées</p>
                      <p className="text-lg font-semibold">{config.sync_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Temps économisé</p>
                      <p className="text-lg font-semibold">{config.time_saved_minutes || 0} min</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dernier statut</p>
                      <p className="text-lg font-semibold capitalize">
                        {config.last_sync_status === 'success' ? (
                          <span className="text-emerald-500">✓ Réussi</span>
                        ) : config.last_sync_status === 'error' ? (
                          <span className="text-red-500">✗ Erreur</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            📱 <strong>Conseil :</strong> Utilisez le widget mobile pour surveiller vos déploiements en temps réel. 
            Installez-le sur votre téléphone comme une PWA pour un accès rapide.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default UserWidgetStatus;
