import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Activity, 
  Server, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  Database,
  GitBranch,
  Container,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  ExternalLink,
  Terminal,
  FileCode,
  Calendar,
  TrendingUp,
  Zap
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Deployment {
  id: string;
  project_name: string;
  status: 'pending' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed';
  health_status: 'healthy' | 'unhealthy' | 'unknown';
  deployed_url: string | null;
  created_at: string;
  updated_at: string;
  server_id: string;
  github_repo_url: string | null;
  coolify_app_uuid: string | null;
  error_message: string | null;
  consecutive_failures: number;
  last_health_check: string | null;
}

interface Server {
  id: string;
  name: string;
  ip_address: string;
  status: 'active' | 'pending' | 'error';
  coolify_url: string | null;
  provider: string | null;
}

interface BackupInfo {
  last_backup: string;
  backup_type: string;
  status: 'success' | 'pending' | 'failed';
}

interface PipelineRun {
  id: string;
  workflow: string;
  status: 'success' | 'failure' | 'pending' | 'running';
  branch: string;
  commit: string;
  duration: string;
  started_at: string;
}

export default function DeploymentMonitoring() {
  const navigate = useNavigate();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Stats
  const [stats, setStats] = useState({
    totalDeployments: 0,
    runningDeployments: 0,
    healthyDeployments: 0,
    failedDeployments: 0,
    totalServers: 0,
    activeServers: 0
  });

  // Mock pipeline runs (en production, récupérer via GitHub API)
  const [pipelineRuns] = useState<PipelineRun[]>([
    {
      id: '1',
      workflow: 'Deploy Supabase',
      status: 'success',
      branch: 'main',
      commit: 'abc1234',
      duration: '2m 34s',
      started_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: '2',
      workflow: 'Backup Database',
      status: 'success',
      branch: 'main',
      commit: 'def5678',
      duration: '1m 12s',
      started_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: '3',
      workflow: 'Release v1.2.0',
      status: 'running',
      branch: 'main',
      commit: 'ghi9012',
      duration: '5m 23s',
      started_at: new Date(Date.now() - 300000).toISOString()
    }
  ]);

  // Mock backup info
  const [backupInfo] = useState<BackupInfo>({
    last_backup: new Date(Date.now() - 3600000).toISOString(),
    backup_type: 'full',
    status: 'success'
  });

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch deployments
      const { data: deploymentsData } = await supabase
        .from('server_deployments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch servers
      const { data: serversData } = await supabase
        .from('user_servers')
        .select('*')
        .eq('user_id', user.id);

      if (deploymentsData) {
        setDeployments(deploymentsData as Deployment[]);
        
        // Calculate stats
        setStats({
          totalDeployments: deploymentsData.length,
          runningDeployments: deploymentsData.filter(d => d.status === 'running').length,
          healthyDeployments: deploymentsData.filter(d => d.health_status === 'healthy').length,
          failedDeployments: deploymentsData.filter(d => d.status === 'failed').length,
          totalServers: serversData?.length || 0,
          activeServers: serversData?.filter(s => s.status === 'active').length || 0
        });
      }

      if (serversData) {
        setServers(serversData as Server[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 30 seconds
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchData, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchData, autoRefresh]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
      running: { variant: "default", icon: <Play className="h-3 w-3" /> },
      pending: { variant: "secondary", icon: <Clock className="h-3 w-3" /> },
      building: { variant: "secondary", icon: <Cpu className="h-3 w-3 animate-spin" /> },
      deploying: { variant: "secondary", icon: <ArrowUpRight className="h-3 w-3" /> },
      stopped: { variant: "outline", icon: <Pause className="h-3 w-3" /> },
      failed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const getHealthBadge = (health: string) => {
    if (health === 'healthy') {
      return (
        <Badge variant="outline" className="gap-1 border-green-500/50 text-green-500">
          <Wifi className="h-3 w-3" />
          Healthy
        </Badge>
      );
    } else if (health === 'unhealthy') {
      return (
        <Badge variant="outline" className="gap-1 border-red-500/50 text-red-500">
          <WifiOff className="h-3 w-3" />
          Unhealthy
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Unknown
      </Badge>
    );
  };

  const handleViewLogs = async (deployment: Deployment) => {
    setSelectedDeployment(deployment);
    setLogs([
      `[${new Date().toISOString()}] Fetching logs for ${deployment.project_name}...`,
      `[${new Date().toISOString()}] Container started successfully`,
      `[${new Date().toISOString()}] Health check passed`,
      `[${new Date().toISOString()}] Application listening on port 3000`,
    ]);
    setLogsDialogOpen(true);
  };

  const handleRestartDeployment = async (deployment: Deployment) => {
    toast.promise(
      (async () => {
        await supabase
          .from('server_deployments')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', deployment.id);
        
        await fetchData();
      })(),
      {
        loading: 'Redémarrage en cours...',
        success: `${deployment.project_name} redémarré`,
        error: 'Erreur lors du redémarrage'
      }
    );
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getPipelineStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failure': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoring</h1>
          <p className="text-muted-foreground">
            Surveillance en temps réel de vos déploiements et pipelines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={autoRefresh ? "text-green-500" : ""}
          >
            {autoRefresh ? (
              <>
                <Activity className="h-4 w-4 mr-2 animate-pulse" />
                Auto-refresh ON
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Auto-refresh OFF
              </>
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Déploiements</CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDeployments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.runningDeployments} en cours d'exécution
            </p>
            <Progress 
              value={stats.totalDeployments > 0 ? (stats.runningDeployments / stats.totalDeployments) * 100 : 0} 
              className="mt-2 h-1" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Santé</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {stats.healthyDeployments}/{stats.totalDeployments}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.failedDeployments > 0 && (
                <span className="text-red-500">{stats.failedDeployments} en échec</span>
              )}
              {stats.failedDeployments === 0 && "Tous les services sont sains"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Serveurs</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeServers}/{stats.totalServers}</div>
            <p className="text-xs text-muted-foreground">
              Serveurs actifs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dernier Backup</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {backupInfo.status === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              <span className="text-lg font-medium">
                {formatTimeAgo(backupInfo.last_backup)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Type: {backupInfo.backup_type}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="deployments" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deployments" className="gap-2">
            <Container className="h-4 w-4" />
            Déploiements
          </TabsTrigger>
          <TabsTrigger value="pipelines" className="gap-2">
            <GitBranch className="h-4 w-4" />
            Pipelines CI/CD
          </TabsTrigger>
          <TabsTrigger value="servers" className="gap-2">
            <Server className="h-4 w-4" />
            Serveurs
          </TabsTrigger>
          <TabsTrigger value="backups" className="gap-2">
            <Database className="h-4 w-4" />
            Backups
          </TabsTrigger>
        </TabsList>

        {/* Deployments Tab */}
        <TabsContent value="deployments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Déploiements Actifs</CardTitle>
              <CardDescription>
                Gérez vos applications déployées
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deployments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Container className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun déploiement trouvé</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate('/liberator/upload')}
                  >
                    Créer un déploiement
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Projet</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Santé</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Dernière MAJ</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deployments.map((deployment) => (
                      <TableRow key={deployment.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4 text-muted-foreground" />
                            {deployment.project_name}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(deployment.status)}</TableCell>
                        <TableCell>{getHealthBadge(deployment.health_status)}</TableCell>
                        <TableCell>
                          {deployment.deployed_url ? (
                            <a 
                              href={deployment.deployed_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ouvrir
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatTimeAgo(deployment.updated_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                •••
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewLogs(deployment)}>
                                <Terminal className="h-4 w-4 mr-2" />
                                Voir les logs
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleRestartDeployment(deployment)}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Redémarrer
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-500">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipelines Tab */}
        <TabsContent value="pipelines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipelines CI/CD</CardTitle>
              <CardDescription>
                Historique des workflows GitHub Actions / GitLab CI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Branche</TableHead>
                    <TableHead>Commit</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>Démarré</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pipelineRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-muted-foreground" />
                          {run.workflow}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getPipelineStatusIcon(run.status)}
                          <span className="capitalize">{run.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <GitBranch className="h-3 w-3" />
                          {run.branch}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {run.commit}
                      </TableCell>
                      <TableCell>{run.duration}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTimeAgo(run.started_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Servers Tab */}
        <TabsContent value="servers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Flotte de Serveurs</CardTitle>
              <CardDescription>
                Vos serveurs VPS configurés
              </CardDescription>
            </CardHeader>
            <CardContent>
              {servers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun serveur configuré</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate('/liberator/self-host')}
                  >
                    Ajouter un serveur
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {servers.map((server) => (
                    <Card key={server.id} className="border-border/50">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold">{server.name}</h3>
                            <p className="text-sm text-muted-foreground font-mono">
                              {server.ip_address}
                            </p>
                          </div>
                          <Badge 
                            variant={server.status === 'active' ? 'default' : 'secondary'}
                          >
                            {server.status}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Provider</span>
                            <span>{server.provider || 'Custom'}</span>
                          </div>
                          {server.coolify_url && (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Coolify</span>
                              <a 
                                href={server.coolify_url} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Dashboard
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Resource Usage (mock) */}
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1">
                              <Cpu className="h-3 w-3" /> CPU
                            </span>
                            <span>45%</span>
                          </div>
                          <Progress value={45} className="h-1" />
                          
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1">
                              <HardDrive className="h-3 w-3" /> RAM
                            </span>
                            <span>62%</span>
                          </div>
                          <Progress value={62} className="h-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backups Tab */}
        <TabsContent value="backups" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Backup Automatique</CardTitle>
                <CardDescription>
                  Configuration du backup vers GitHub
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/10">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Backup activé</p>
                      <p className="text-sm text-muted-foreground">
                        Quotidien à 03:00 UTC
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Configurer
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Dernier backup</span>
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      {formatTimeAgo(backupInfo.last_backup)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Type</span>
                    <Badge variant="outline">{backupInfo.backup_type}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Branche GitHub</span>
                    <span className="font-mono">backups</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Rétention</span>
                    <span>7j / 4sem / 12mois</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button className="flex-1" variant="outline">
                    <Play className="h-4 w-4 mr-2" />
                    Backup manuel
                  </Button>
                  <Button className="flex-1" variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restaurer
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Historique des Backups</CardTitle>
                <CardDescription>
                  7 derniers jours
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2">
                    {[...Array(7)].map((_, i) => {
                      const date = new Date();
                      date.setDate(date.getDate() - i);
                      const isSuccess = Math.random() > 0.1;
                      
                      return (
                        <div 
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isSuccess ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {date.toLocaleDateString('fr-FR', { 
                                  weekday: 'short', 
                                  day: 'numeric',
                                  month: 'short'
                                })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                03:00 UTC • full backup
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Logs - {selectedDeployment?.project_name}
            </DialogTitle>
            <DialogDescription>
              Logs en temps réel du conteneur
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] rounded-lg bg-black/90 p-4">
            <div className="font-mono text-sm text-green-400 space-y-1">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
