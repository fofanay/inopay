import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Server, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Clock,
  Globe,
  Activity,
  RotateCcw,
  GitBranch
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import AdminCoolifyDiagnostic from "./AdminCoolifyDiagnostic";

interface ServerDeployment {
  id: string;
  project_name: string;
  status: string;
  deployed_url: string | null;
  health_status: string | null;
  last_health_check: string | null;
  consecutive_failures: number;
  auto_restart_count: number;
  secrets_cleaned: boolean;
  created_at: string;
  server: {
    id: string;
    name: string;
    ip_address: string;
    provider: string | null;
    status: string;
  };
}

const AdminServerFleet = () => {
  const [deployments, setDeployments] = useState<ServerDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uniqueServers, setUniqueServers] = useState<Array<{id: string; name: string}>>([]);

  const fetchDeployments = async () => {
    try {
      const { data, error } = await supabase
        .from('server_deployments')
        .select(`
          id,
          project_name,
          status,
          deployed_url,
          health_status,
          last_health_check,
          consecutive_failures,
          auto_restart_count,
          secrets_cleaned,
          created_at,
          server:user_servers!server_id (
            id,
            name,
            ip_address,
            provider,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform data to handle the nested server object
      const transformedData = (data || []).map(d => ({
        ...d,
        server: Array.isArray(d.server) ? d.server[0] : d.server
      })).filter(d => d.server);
      
      setDeployments(transformedData as ServerDeployment[]);
      
      // Extract unique servers
      const serversMap = new Map<string, {id: string; name: string}>();
      transformedData.forEach(d => {
        if (d.server && !serversMap.has(d.server.id)) {
          serversMap.set(d.server.id, { id: d.server.id, name: d.server.name });
        }
      });
      setUniqueServers(Array.from(serversMap.values()));
    } catch (error) {
      console.error('Error fetching deployments:', error);
      toast.error("Erreur lors du chargement des déploiements");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeployments();
    
    // Real-time subscription
    const channel = supabase
      .channel('server-deployments-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'server_deployments'
      }, () => {
        fetchDeployments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDeployments();
  };

  const handleForceHealthCheck = async () => {
    toast.info("Lancement du health check...");
    try {
      const { data, error } = await supabase.functions.invoke('health-monitor');
      if (error) throw error;
      toast.success(`Health check terminé: ${data.checked || 0} déploiements vérifiés`);
      fetchDeployments();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const handleForceRestart = async (deploymentId: string, serverId: string) => {
    toast.info("Redémarrage en cours...");
    try {
      const { error } = await supabase.functions.invoke('auto-restart-container', {
        body: { deployment_id: deploymentId, server_id: serverId }
      });
      if (error) throw error;
      toast.success("Redémarrage déclenché");
      fetchDeployments();
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`);
    }
  };

  const getHealthBadge = (status: string | null, consecutiveFailures: number) => {
    if (status === 'healthy') {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          En ligne
        </Badge>
      );
    }
    if (status === 'recovering') {
      return (
        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Récupération
        </Badge>
      );
    }
    if (status === 'unhealthy' || consecutiveFailures > 0) {
      return (
        <Badge className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
          <XCircle className="h-3 w-3" />
          Hors ligne ({consecutiveFailures})
        </Badge>
      );
    }
    return (
      <Badge className="bg-zinc-500/10 text-zinc-400 border-zinc-500/20 gap-1">
        <AlertCircle className="h-3 w-3" />
        Inconnu
      </Badge>
    );
  };

  const stats = {
    total: deployments.length,
    healthy: deployments.filter(d => d.health_status === 'healthy').length,
    unhealthy: deployments.filter(d => d.health_status === 'unhealthy' || (d.consecutive_failures || 0) > 0).length,
    cleaned: deployments.filter(d => d.secrets_cleaned).length,
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Server className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-zinc-100">{stats.total}</p>
                <p className="text-xs text-zinc-400">Déploiements actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-400">{stats.healthy}</p>
                <p className="text-xs text-zinc-400">En ligne</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-400">{stats.unhealthy}</p>
                <p className="text-xs text-zinc-400">Problèmes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <Activity className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-violet-400">{stats.cleaned}</p>
                <p className="text-xs text-zinc-400">Secrets nettoyés</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-zinc-100">Flotte de Serveurs</CardTitle>
            <CardDescription className="text-zinc-400">
              Vue temps réel de tous les déploiements clients
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleForceHealthCheck}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Activity className="h-4 w-4 mr-2" />
              Health Check Global
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deployments.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucun déploiement actif</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-800 hover:bg-transparent">
                    <TableHead className="text-zinc-400">Projet</TableHead>
                    <TableHead className="text-zinc-400">Serveur / IP</TableHead>
                    <TableHead className="text-zinc-400">Hébergeur</TableHead>
                    <TableHead className="text-zinc-400">Statut</TableHead>
                    <TableHead className="text-zinc-400">Dernier Check</TableHead>
                    <TableHead className="text-zinc-400">Sécurité</TableHead>
                    <TableHead className="text-zinc-400">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.map((deployment) => (
                    <TableRow key={deployment.id} className="border-zinc-800 hover:bg-zinc-800/50">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-zinc-500" />
                          <div>
                            <p className="font-medium text-zinc-200">{deployment.project_name}</p>
                            {deployment.deployed_url && (
                              <a 
                                href={deployment.deployed_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:underline"
                              >
                                {new URL(deployment.deployed_url).hostname}
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-zinc-200">{deployment.server?.name}</p>
                          <code className="text-xs text-zinc-500">{deployment.server?.ip_address}</code>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                          {deployment.server?.provider || 'Non spécifié'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getHealthBadge(deployment.health_status, deployment.consecutive_failures || 0)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-zinc-400 text-sm">
                          <Clock className="h-3 w-3" />
                          {deployment.last_health_check 
                            ? formatDistanceToNow(new Date(deployment.last_health_check), { addSuffix: true, locale: fr })
                            : 'Jamais'
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        {deployment.secrets_cleaned ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            🔒 Nettoyé
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
                            ⚠️ En attente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleForceRestart(deployment.id, deployment.server?.id)}
                          className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coolify Diagnostic for each server */}
      {uniqueServers.map(server => (
        <AdminCoolifyDiagnostic 
          key={server.id} 
          serverId={server.id} 
          serverName={server.name}
        />
      ))}
    </div>
  );
};

export default AdminServerFleet;
