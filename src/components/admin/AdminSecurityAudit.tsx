import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Shield, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Key,
  Lock,
  Unlock,
  Eye,
  Clock,
  Zap,
  Bell
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { hasSecret, getCleanupAge } from "@/lib/constants";

interface AuditLog {
  id: string;
  action: string;
  details: any;
  server_id: string | null;
  deployment_id: string | null;
  created_at: string;
}

interface ServerSecurityStatus {
  id: string;
  name: string;
  ip_address: string;
  db_password: string | null;
  jwt_secret: string | null;
  service_role_key: string | null;
  setup_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DeploymentSecurityStatus {
  id: string;
  project_name: string;
  server_id: string;
  secrets_cleaned: boolean;
  secrets_cleaned_at: string | null;
  created_at: string;
  status: string;
}

interface SecurityAlert {
  id: string;
  type: 'uncleaned_secrets' | 'cleanup_failed' | 'old_secrets';
  severity: 'warning' | 'critical';
  message: string;
  serverId?: string;
  serverName?: string;
  deploymentId?: string;
  createdAt: Date;
}

const AdminSecurityAudit = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [servers, setServers] = useState<ServerSecurityStatus[]>([]);
  const [deployments, setDeployments] = useState<DeploymentSecurityStatus[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch audit logs
      const { data: logs, error: logsError } = await supabase
        .from('security_audit_logs')
        .select('id, action, details, server_id, deployment_id, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (logsError) throw logsError;
      setAuditLogs(logs || []);

      // Fetch servers - NE PAS RÉCUPÉRER LES SECRETS EN CLAIR
      // On vérifie juste si les champs sont non-null
      const { data: serverData, error: serversError } = await supabase
        .from('user_servers')
        .select('id, name, ip_address, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (serversError) throw serversError;

      // Pour chaque serveur, vérifier si les secrets existent (sans les récupérer)
      const serversWithSecretStatus = await Promise.all(
        (serverData || []).map(async (server) => {
          // On fait une requête qui vérifie juste la présence, pas la valeur
          const { data: secretCheck } = await supabase
            .from('user_servers')
            .select('id')
            .eq('id', server.id)
            .not('db_password', 'is', null)
            .single();
          
          const { data: jwtCheck } = await supabase
            .from('user_servers')
            .select('id')
            .eq('id', server.id)
            .not('jwt_secret', 'is', null)
            .single();
          
          const { data: serviceRoleCheck } = await supabase
            .from('user_servers')
            .select('id')
            .eq('id', server.id)
            .not('service_role_key', 'is', null)
            .single();
          
          const { data: setupIdCheck } = await supabase
            .from('user_servers')
            .select('id')
            .eq('id', server.id)
            .not('setup_id', 'is', null)
            .single();

          return {
            ...server,
            db_password: secretCheck ? 'PRESENT' : null,
            jwt_secret: jwtCheck ? 'PRESENT' : null,
            service_role_key: serviceRoleCheck ? 'PRESENT' : null,
            setup_id: setupIdCheck ? 'PRESENT' : null,
          };
        })
      );

      setServers(serversWithSecretStatus);

      // Fetch deployments with security status
      const { data: deploymentData, error: deploymentsError } = await supabase
        .from('server_deployments')
        .select('id, project_name, server_id, secrets_cleaned, secrets_cleaned_at, created_at, status')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!deploymentsError) {
        setDeployments(deploymentData || []);
      }

      // Generate security alerts
      const newAlerts: SecurityAlert[] = [];
      const now = new Date();

      for (const server of serversWithSecretStatus) {
        const hasExposedSecrets = server.db_password || server.jwt_secret || 
                                   server.service_role_key || server.setup_id;
        
        if (hasExposedSecrets) {
          const serverAge = differenceInMinutes(now, new Date(server.created_at));
          
          if (serverAge > 60) {
            newAlerts.push({
              id: `alert-${server.id}-old`,
              type: 'old_secrets',
              severity: 'critical',
              message: `Secrets non nettoyés depuis > 1h`,
              serverId: server.id,
              serverName: server.name,
              createdAt: now,
            });
          } else if (serverAge > 15) {
            newAlerts.push({
              id: `alert-${server.id}-uncleaned`,
              type: 'uncleaned_secrets',
              severity: 'warning',
              message: `Secrets en attente de nettoyage (${serverAge} min)`,
              serverId: server.id,
              serverName: server.name,
              createdAt: now,
            });
          }
        }
      }

      setAlerts(newAlerts);

    } catch (error) {
      console.error('Error fetching security data:', error);
      toast.error("Erreur lors du chargement des données de sécurité");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const runSecurityScan = async () => {
    setScanning(true);
    toast.info("Scan de sécurité en cours...");
    
    await fetchData();
    
    const exposedCount = servers.filter(s => 
      s.db_password || s.jwt_secret || s.service_role_key || s.setup_id
    ).length;

    if (exposedCount === 0) {
      toast.success("✅ Audit terminé: Tous les secrets sont nettoyés");
    } else {
      toast.warning(`⚠️ ${exposedCount} serveur(s) avec secrets non nettoyés`);
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
      
      toast.success("Nettoyage forcé déclenché");
      await fetchData();
    } catch (error) {
      console.error('Force cleanup error:', error);
      toast.error("Erreur lors du nettoyage forcé");
    }
  };

  const getSecurityStatus = (server: ServerSecurityStatus) => {
    const hasSecrets = server.db_password || server.jwt_secret || server.service_role_key || server.setup_id;
    
    if (!hasSecrets) {
      return {
        status: 'secure',
        label: 'Zero-Knowledge',
        icon: Lock,
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      };
    }
    
    return {
      status: 'exposed',
      label: 'Secrets présents',
      icon: Unlock,
      color: 'bg-red-500/10 text-red-400 border-red-500/20'
    };
  };

  const getSecretIndicator = (hasValue: boolean) => {
    if (!hasValue) {
      return (
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-emerald-400">Nettoyé</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <span className="text-xs text-amber-400">Présent</span>
      </div>
    );
  };

  const stats = {
    total: servers.length,
    secure: servers.filter(s => !s.db_password && !s.jwt_secret && !s.service_role_key && !s.setup_id).length,
    exposed: servers.filter(s => s.db_password || s.jwt_secret || s.service_role_key || s.setup_id).length,
    audits: auditLogs.filter(l => l.action === 'secrets_cleaned').length,
    cleanupRate: deployments.length > 0 
      ? Math.round((deployments.filter(d => d.secrets_cleaned).length / deployments.length) * 100)
      : 100,
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
      {/* Security Alerts */}
      {alerts.length > 0 && (
        <Card className="bg-red-900/20 border-red-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-red-400" />
              <CardTitle className="text-red-400">Alertes de Sécurité ({alerts.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    alert.severity === 'critical' ? 'bg-red-500/10' : 'bg-amber-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`h-4 w-4 ${
                      alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'
                    }`} />
                    <div>
                      <p className={`text-sm font-medium ${
                        alert.severity === 'critical' ? 'text-red-300' : 'text-amber-300'
                      }`}>
                        {alert.serverName}
                      </p>
                      <p className="text-xs text-zinc-400">{alert.message}</p>
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => alert.serverId && forceCleanup(alert.serverId)}
                    className="border-red-700 text-red-400 hover:bg-red-500/20"
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    Forcer nettoyage
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">{stats.total}</p>
                <p className="text-xs text-zinc-400">Serveurs totaux</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Lock className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{stats.secure}</p>
                <p className="text-xs text-zinc-400">Zero-Knowledge</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <Unlock className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{stats.exposed}</p>
                <p className="text-xs text-zinc-400">À nettoyer</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Key className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-400">{stats.audits}</p>
                <p className="text-xs text-zinc-400">Nettoyages</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <CheckCircle2 className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-400">{stats.cleanupRate}%</p>
                <p className="text-xs text-zinc-400">Taux nettoyage</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Status - MASQUAGE DES SECRETS */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-zinc-100">État de Sécurité Zero-Knowledge</CardTitle>
            <CardDescription className="text-zinc-400">
              Vérification des secrets (valeurs masquées pour sécurité)
            </CardDescription>
          </div>
          <Button 
            onClick={runSecurityScan}
            disabled={scanning}
            className="bg-violet-600 hover:bg-violet-700"
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
          {servers.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucun serveur à auditer</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Serveur</TableHead>
                  <TableHead className="text-zinc-400">IP</TableHead>
                  <TableHead className="text-zinc-400">db_password</TableHead>
                  <TableHead className="text-zinc-400">jwt_secret</TableHead>
                  <TableHead className="text-zinc-400">service_role</TableHead>
                  <TableHead className="text-zinc-400">setup_id</TableHead>
                  <TableHead className="text-zinc-400">Status</TableHead>
                  <TableHead className="text-zinc-400">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((server) => {
                  const security = getSecurityStatus(server);
                  const hasExposedSecrets = server.db_password || server.jwt_secret || 
                                            server.service_role_key || server.setup_id;
                  return (
                    <TableRow key={server.id} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell className="text-zinc-200 font-medium">{server.name}</TableCell>
                      <TableCell className="text-zinc-400">{server.ip_address}</TableCell>
                      <TableCell>{getSecretIndicator(!!server.db_password)}</TableCell>
                      <TableCell>{getSecretIndicator(!!server.jwt_secret)}</TableCell>
                      <TableCell>{getSecretIndicator(!!server.service_role_key)}</TableCell>
                      <TableCell>{getSecretIndicator(!!server.setup_id)}</TableCell>
                      <TableCell>
                        <Badge className={security.color}>
                          <security.icon className="h-3 w-3 mr-1" />
                          {security.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {hasExposedSecrets && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => forceCleanup(server.id)}
                            className="border-amber-700 text-amber-400 hover:bg-amber-500/20"
                          >
                            <Zap className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Deployment Security History */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Historique Nettoyage Déploiements</CardTitle>
          <CardDescription className="text-zinc-400">
            Statut du nettoyage par déploiement
          </CardDescription>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <div className="text-center py-6 text-zinc-400">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucun déploiement récent</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {deployments.slice(0, 20).map((deployment) => {
                const cleanupInfo = getCleanupAge(deployment.secrets_cleaned_at);
                return (
                  <div key={deployment.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                    {deployment.secrets_cleaned ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200 truncate">
                        {deployment.project_name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {deployment.secrets_cleaned 
                          ? `Nettoyé ${cleanupInfo.ageText}`
                          : 'En attente de nettoyage'}
                      </p>
                    </div>
                    <Badge variant="outline" className={
                      deployment.secrets_cleaned 
                        ? 'border-emerald-500/30 text-emerald-400' 
                        : 'border-amber-500/30 text-amber-400'
                    }>
                      {deployment.secrets_cleaned ? 'Zero-Knowledge' : 'Pending'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit History */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100">Historique des Audits</CardTitle>
          <CardDescription className="text-zinc-400">
            Derniers nettoyages de secrets effectués
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLogs.filter(l => l.action === 'secrets_cleaned').length === 0 ? (
            <div className="text-center py-6 text-zinc-400">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucun audit de nettoyage enregistré</p>
            </div>
          ) : (
            <div className="space-y-2">
              {auditLogs.filter(l => l.action === 'secrets_cleaned').slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <div className="flex-1">
                    <p className="text-sm text-zinc-200">
                      Secrets nettoyés: {(log.details?.cleaned_fields as string[])?.join(', ') || 'N/A'}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: fr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSecurityAudit;
