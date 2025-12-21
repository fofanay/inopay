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
  XCircle, 
  AlertTriangle,
  Key,
  Lock,
  Unlock,
  Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

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
}

const AdminSecurityAudit = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [servers, setServers] = useState<ServerSecurityStatus[]>([]);
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

      // Fetch servers with their security status
      const { data: serverData, error: serversError } = await supabase
        .from('user_servers')
        .select('id, name, ip_address, db_password, jwt_secret, service_role_key, setup_id, created_at')
        .order('created_at', { ascending: false });

      if (serversError) throw serversError;
      setServers(serverData || []);
    } catch (error) {
      console.error('Error fetching security data:', error);
      toast.error("Erreur lors du chargement des données de sécurité");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runSecurityScan = async () => {
    setScanning(true);
    toast.info("Scan de sécurité en cours...");
    
    // Simulate security scan
    await new Promise(resolve => setTimeout(resolve, 2000));
    await fetchData();
    
    const unsecuredServers = servers.filter(s => 
      s.db_password || s.jwt_secret || s.service_role_key || s.setup_id
    );

    if (unsecuredServers.length === 0) {
      toast.success("✅ Audit terminé: Tous les secrets sont nettoyés");
    } else {
      toast.warning(`⚠️ ${unsecuredServers.length} serveur(s) avec secrets non nettoyés`);
    }
    
    setScanning(false);
  };

  const getSecurityStatus = (server: ServerSecurityStatus) => {
    const hasSecrets = server.db_password || server.jwt_secret || server.service_role_key || server.setup_id;
    
    if (!hasSecrets) {
      return {
        status: 'secure',
        label: 'Sécurisé',
        icon: Lock,
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      };
    }
    
    return {
      status: 'exposed',
      label: 'Secrets exposés',
      icon: Unlock,
      color: 'bg-red-500/10 text-red-400 border-red-500/20'
    };
  };

  const stats = {
    total: servers.length,
    secure: servers.filter(s => !s.db_password && !s.jwt_secret && !s.service_role_key && !s.setup_id).length,
    exposed: servers.filter(s => s.db_password || s.jwt_secret || s.service_role_key || s.setup_id).length,
    audits: auditLogs.filter(l => l.action === 'secrets_cleaned').length,
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
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                <p className="text-xs text-zinc-400">Secrets exposés</p>
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
                <p className="text-xs text-zinc-400">Nettoyages effectués</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Status */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-zinc-100">État de Sécurité Zero-Knowledge</CardTitle>
            <CardDescription className="text-zinc-400">
              Vérification des secrets stockés sur les serveurs Inopay
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {servers.map((server) => {
                  const security = getSecurityStatus(server);
                  return (
                    <TableRow key={server.id} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell className="text-zinc-200 font-medium">{server.name}</TableCell>
                      <TableCell className="text-zinc-400">{server.ip_address}</TableCell>
                      <TableCell>
                        {server.db_password ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        {server.jwt_secret ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        {server.service_role_key ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        {server.setup_id ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={security.color}>
                          <security.icon className="h-3 w-3 mr-1" />
                          {security.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
