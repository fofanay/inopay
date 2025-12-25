import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Unlock,
  Eye,
  Zap,
  Bell,
  Server,
  TrendingUp,
  LogOut,
  Users
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInMinutes } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AdminPipelineDiagnostic from "./AdminPipelineDiagnostic";

interface SecurityAlert {
  id: string;
  type: 'uncleaned_secrets' | 'old_secrets';
  severity: 'warning' | 'critical';
  message: string;
  serverId: string;
  serverName: string;
}

interface GlobalSecurityStats {
  totalServers: number;
  secureServers: number;
  exposedServers: number;
  cleanupRate: number;
  alerts: SecurityAlert[];
}

const AdminSecurityAudit = () => {
  const [stats, setStats] = useState<GlobalSecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch all servers (admin sees all)
      const { data: servers, error: serversError } = await supabase
        .from('user_servers')
        .select('id, name, ip_address, created_at')
        .order('created_at', { ascending: false });

      if (serversError) throw serversError;

      // Check secret presence for each server
      const serversWithStatus = await Promise.all(
        (servers || []).map(async (server) => {
          const { data: secretCheck } = await supabase
            .from('user_servers')
            .select('id')
            .eq('id', server.id)
            .not('db_password', 'is', null)
            .single();

          return {
            ...server,
            hasSecrets: !!secretCheck
          };
        })
      );

      // Generate alerts
      const alerts: SecurityAlert[] = [];
      const now = new Date();

      for (const server of serversWithStatus) {
        if (server.hasSecrets) {
          const serverAge = differenceInMinutes(now, new Date(server.created_at));
          
          if (serverAge > 60) {
            alerts.push({
              id: `alert-${server.id}-critical`,
              type: 'old_secrets',
              severity: 'critical',
              message: `Secrets non nettoyés depuis > 1h`,
              serverId: server.id,
              serverName: server.name,
            });
          } else if (serverAge > 15) {
            alerts.push({
              id: `alert-${server.id}-warning`,
              type: 'uncleaned_secrets',
              severity: 'warning',
              message: `Secrets en attente (${serverAge} min)`,
              serverId: server.id,
              serverName: server.name,
            });
          }
        }
      }

      // Fetch deployments for cleanup rate
      const { data: deployments } = await supabase
        .from('server_deployments')
        .select('id, secrets_cleaned');

      const cleanupRate = deployments && deployments.length > 0
        ? Math.round((deployments.filter(d => d.secrets_cleaned).length / deployments.length) * 100)
        : 100;

      setStats({
        totalServers: serversWithStatus.length,
        secureServers: serversWithStatus.filter(s => !s.hasSecrets).length,
        exposedServers: serversWithStatus.filter(s => s.hasSecrets).length,
        cleanupRate,
        alerts: alerts.sort((a, b) => a.severity === 'critical' ? -1 : 1)
      });
    } catch (error) {
      console.error('Error fetching security data:', error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const runSecurityScan = async () => {
    setScanning(true);
    toast.info("Scan de sécurité en cours...");
    await fetchData();
    
    if (stats?.exposedServers === 0) {
      toast.success("✅ Tous les secrets sont nettoyés");
    } else {
      toast.warning(`⚠️ ${stats?.exposedServers} serveur(s) exposés`);
    }
    setScanning(false);
  };

  const forceCleanup = async (serverId: string) => {
    try {
      toast.info("Nettoyage forcé en cours...");
      const { error } = await supabase.functions.invoke('cleanup-secrets', {
        body: { serverId, force: true }
      });
      if (error) throw error;
      toast.success("Nettoyage déclenché");
      await fetchData();
    } catch (error) {
      console.error('Force cleanup error:', error);
      toast.error("Erreur lors du nettoyage");
    }
  };

  const handleSignOutAllUsers = async () => {
    setSigningOutAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-signout-all');
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`${data.signedOutCount} utilisateurs déconnectés`);
      } else {
        throw new Error(data?.error || "Erreur inconnue");
      }
    } catch (error) {
      console.error('Sign out all error:', error);
      toast.error("Erreur lors de la déconnexion des utilisateurs");
    } finally {
      setSigningOutAll(false);
    }
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
      {/* Critical Alerts Banner */}
      {stats && stats.alerts.filter(a => a.severity === 'critical').length > 0 && (
        <Card className="bg-red-900/20 border-red-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-red-400" />
              <CardTitle className="text-red-400">
                Alertes Critiques ({stats.alerts.filter(a => a.severity === 'critical').length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.alerts.filter(a => a.severity === 'critical').map((alert) => (
                <div 
                  key={alert.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-red-500/10"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <div>
                      <p className="text-sm font-medium text-red-300">{alert.serverName}</p>
                      <p className="text-xs text-red-400/80">{alert.message}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => forceCleanup(alert.serverId)}
                    className="border-red-700 text-red-400 hover:bg-red-500/20"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Forcer
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalServers || 0}</p>
                <p className="text-xs text-muted-foreground">Serveurs totaux</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Lock className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-500">{stats?.secureServers || 0}</p>
                <p className="text-xs text-muted-foreground">Zero-Knowledge</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={stats?.exposedServers ? "border-red-500/20 bg-red-500/5" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Unlock className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${stats?.exposedServers ? "text-red-500" : ""}`}>
                  {stats?.exposedServers || 0}
                </p>
                <p className="text-xs text-muted-foreground">À nettoyer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-cyan-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <TrendingUp className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-500">{stats?.cleanupRate || 100}%</p>
                <p className="text-xs text-muted-foreground">Taux nettoyage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Panel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Audit de Sécurité Plateforme
            </CardTitle>
            <CardDescription>
              Vue globale de l'état Zero-Knowledge
            </CardDescription>
          </div>
          <Button 
            onClick={runSecurityScan}
            disabled={scanning}
          >
            {scanning ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Lancer l'audit
          </Button>
        </CardHeader>
        <CardContent>
          {/* Warning Alerts */}
          {stats && stats.alerts.filter(a => a.severity === 'warning').length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-400 mb-3">
                Alertes en attente ({stats.alerts.filter(a => a.severity === 'warning').length})
              </p>
              {stats.alerts.filter(a => a.severity === 'warning').map((alert) => (
                <div 
                  key={alert.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <div>
                      <p className="text-sm font-medium">{alert.serverName}</p>
                      <p className="text-xs text-muted-foreground">{alert.message}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => forceCleanup(alert.serverId)}
                  >
                    <Zap className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-500" />
              <p className="font-medium text-emerald-500">Tous les secrets sont nettoyés</p>
              <p className="text-sm text-muted-foreground">
                Aucune alerte de sécurité active
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Management */}
      <Card className="border-orange-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-500">
            <Users className="h-5 w-5" />
            Gestion des Sessions
          </CardTitle>
          <CardDescription>
            Actions de sécurité sur les sessions utilisateurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <div>
              <p className="font-medium">Déconnecter tous les utilisateurs</p>
              <p className="text-sm text-muted-foreground">
                Force la déconnexion de tous les utilisateurs (sauf vous)
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  disabled={signingOutAll}
                  className="gap-2"
                >
                  {signingOutAll ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  Déconnecter tous
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la déconnexion</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action va déconnecter <strong>tous les utilisateurs</strong> de la plateforme 
                    (sauf vous). Ils devront se reconnecter pour accéder à leur compte.
                    <br /><br />
                    Êtes-vous sûr de vouloir continuer ?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleSignOutAllUsers}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Oui, déconnecter tous
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Diagnostic */}
      <AdminPipelineDiagnostic />

      {/* Admin Note */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            🔒 <strong>Vue Admin</strong> : Surveillance globale Zero-Knowledge. 
            Les utilisateurs voient uniquement l'état de leurs propres serveurs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSecurityAudit;
