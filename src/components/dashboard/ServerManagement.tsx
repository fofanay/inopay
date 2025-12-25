import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SecurityBadge } from '@/components/ui/security-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Server, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Settings2,
  Wifi
} from 'lucide-react';
import { VPSOnboarding } from './VPSOnboarding';
import { ServerSetupWizard } from './ServerSetupWizard';
import { CoolifyTokenConfig } from './CoolifyTokenConfig';
import { FirstDeploymentWizard } from './FirstDeploymentWizard';
import { ServerSettingsDialog } from './ServerSettingsDialog';
import { ServerConnectionTest } from './ServerConnectionTest';
import { useTranslation } from 'react-i18next';

interface UserServer {
  id: string;
  name: string;
  ip_address: string;
  provider: string | null;
  status: string;
  coolify_url: string | null;
  coolify_token: string | null;
  setup_id: string | null;
  error_message: string | null;
  created_at: string;
}

interface ServerDeployment {
  id: string;
  project_name: string;
  status: string;
  deployed_url: string | null;
  created_at: string;
  secrets_cleaned: boolean | null;
  secrets_cleaned_at: string | null;
  github_repo_url: string | null;
  server_id: string;
}

export function ServerManagement() {
  const { t, i18n } = useTranslation();
  const [servers, setServers] = useState<UserServer[]>([]);
  const [deployments, setDeployments] = useState<Record<string, ServerDeployment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showAddServer, setShowAddServer] = useState(false);
  const [deleteServerId, setDeleteServerId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingsServer, setSettingsServer] = useState<UserServer | null>(null);
  const [retryingDeploymentId, setRetryingDeploymentId] = useState<string | null>(null);
  const { toast } = useToast();

  const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
    ready: { label: t('serverManagement.status.ready'), variant: 'default', icon: CheckCircle2 },
    installing: { label: t('serverManagement.status.installing'), variant: 'secondary', icon: Clock },
    pending: { label: t('serverManagement.status.pending'), variant: 'outline', icon: Clock },
    error: { label: t('serverManagement.status.error'), variant: 'destructive', icon: AlertCircle },
  };

  const fetchServers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: serversData, error: serversError } = await supabase
        .from('user_servers')
        .select('*')
        .order('created_at', { ascending: false });

      if (serversError) throw serversError;

      setServers(serversData || []);

      if (serversData && serversData.length > 0) {
        const { data: deploymentsData, error: deploymentsError } = await supabase
          .from('server_deployments')
          .select('id, project_name, status, deployed_url, created_at, server_id, secrets_cleaned, secrets_cleaned_at, github_repo_url')
          .in('server_id', serversData.map(s => s.id))
          .order('created_at', { ascending: false });

        if (!deploymentsError && deploymentsData) {
          const grouped = deploymentsData.reduce((acc, d) => {
            if (!acc[d.server_id]) acc[d.server_id] = [];
            acc[d.server_id].push(d);
            return acc;
          }, {} as Record<string, ServerDeployment[]>);
          setDeployments(grouped);
        }
      }
    } catch (error: any) {
      console.error('Error fetching servers:', error);
      toast({
        title: t('common.error'),
        description: t('serverManagement.loadError'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const handleDeleteServer = async () => {
    if (!deleteServerId) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('user_servers')
        .delete()
        .eq('id', deleteServerId);

      if (error) throw error;

      setServers(prev => prev.filter(s => s.id !== deleteServerId));
      toast({
        title: t('serverManagement.serverDeleted'),
        description: t('serverManagement.serverDeletedDesc'),
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: t('common.error'),
        description: t('serverManagement.deleteError'),
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setDeleteServerId(null);
    }
  };

  const handleRetryDeployment = async (deployment: ServerDeployment) => {
    setRetryingDeploymentId(deployment.id);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('deploy-coolify', {
        body: {
          server_id: deployment.server_id,
          project_name: deployment.project_name,
          github_repo_url: deployment.github_repo_url || null,
          domain: null,
          retry_deployment_id: deployment.id
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t('serverManagement.deploymentRetried'),
          description: t('serverManagement.appBuilding'),
        });
        fetchServers();
      } else {
        throw new Error(data.error || 'Deployment failed');
      }
    } catch (error: any) {
      console.error('Retry deployment error:', error);
      toast({
        title: t('serverManagement.deploymentError'),
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setRetryingDeploymentId(null);
    }
  };

  if (showAddServer) {
    return (
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setShowAddServer(false)}>
          ← {t('serverManagement.backToList')}
        </Button>
        <VPSOnboarding />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('serverManagement.title')}</h2>
          <p className="text-muted-foreground">
            {t('serverManagement.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={fetchServers} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowAddServer(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('serverManagement.addServer')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : servers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('serverManagement.noServers')}</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              {t('serverManagement.noServersDesc')}
            </p>
            <Button onClick={() => setShowAddServer(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('serverManagement.addFirstServer')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="servers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="servers" className="gap-2">
              <Server className="h-4 w-4" />
              Serveurs ({servers.length})
            </TabsTrigger>
            <TabsTrigger value="diagnostic" className="gap-2">
              <Wifi className="h-4 w-4" />
              Diagnostic Connexion
            </TabsTrigger>
          </TabsList>

          <TabsContent value="servers">
            <div className="grid gap-4">
          {servers.map((server) => {
            const statusConfig = STATUS_CONFIG[server.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;
            const serverDeployments = deployments[server.id] || [];

            return (
              <Card key={server.id}>
                {/* Header toujours visible avec bouton supprimer */}
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Server className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{server.name}</CardTitle>
                        <CardDescription>{server.ip_address}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={statusConfig.variant} className="flex items-center gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {statusConfig.label}
                      </Badge>
                      {server.status === 'ready' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSettingsServer(server)}
                          title={t('settings.title')}
                        >
                          <Settings2 className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteServerId(server.id)}
                        title={t('serverManagement.deleteServer')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {/* Show setup wizard for pending/installing/error servers */}
                {server.status !== 'ready' ? (
                  <CardContent>
                    <ServerSetupWizard server={server} onRefresh={fetchServers} />
                  </CardContent>
                ) : (
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-4 text-sm">
                      {server.provider && (
                        <div>
                          <span className="text-muted-foreground">{t('serverManagement.provider')}:</span>{' '}
                          <span className="font-medium capitalize">{server.provider}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">{t('serverManagement.addedOn')}:</span>{' '}
                        <span className="font-medium">
                          {new Date(server.created_at).toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')}
                        </span>
                      </div>
                      {server.coolify_url && (
                        <Button
                          variant="link"
                          className="p-0 h-auto"
                          onClick={() => window.open(server.coolify_url!, '_blank')}
                        >
                          {t('serverManagement.openCoolify')} <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>

                    {/* Coolify token configuration */}
                    <CoolifyTokenConfig
                      serverId={server.id}
                      serverIp={server.ip_address}
                      coolifyUrl={server.coolify_url}
                      currentToken={server.coolify_token}
                      onSuccess={fetchServers}
                    />

                    {/* First deployment wizard - show only if token is configured */}
                    {server.coolify_token && serverDeployments.length === 0 && (
                      <FirstDeploymentWizard
                        serverId={server.id}
                        serverName={server.name}
                        onDeploymentComplete={fetchServers}
                      />
                    )}

                    {serverDeployments.length > 0 && (
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-2">{t('serverManagement.recentDeployments')}</h4>
                        <div className="space-y-2">
                          {serverDeployments.slice(0, 3).map((deployment) => (
                            <div 
                              key={deployment.id}
                              className="flex items-center justify-between text-sm bg-muted/50 rounded-lg p-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{deployment.project_name}</span>
                                {/* Security badges */}
                                {deployment.secrets_cleaned ? (
                                  <SecurityBadge type="zero-knowledge" size="default" />
                                ) : deployment.status !== 'failed' && (
                                  <Badge variant="outline" className="text-xs gap-1 text-warning border-warning/30 bg-warning/10">
                                    <AlertTriangle className="h-3 w-3" />
                                    {t('serverManagement.temporarySecrets')}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={deployment.status === 'failed' ? 'destructive' : 'outline'} 
                                  className="text-xs"
                                >
                                  {deployment.status === 'failed' ? t('serverManagement.failed') : deployment.status}
                                </Badge>
                                {deployment.status === 'failed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-xs"
                                    disabled={retryingDeploymentId === deployment.id}
                                    onClick={() => handleRetryDeployment(deployment)}
                                  >
                                    {retryingDeploymentId === deployment.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <>
                                        <RefreshCw className="w-3 h-3 mr-1" />
                                        {t('serverManagement.retry')}
                                      </>
                                    )}
                                  </Button>
                                )}
                                {deployment.deployed_url && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => window.open(deployment.deployed_url!, '_blank')}
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
            </div>
          </TabsContent>

          <TabsContent value="diagnostic">
            <ServerConnectionTest 
              servers={servers}
              onRefresh={fetchServers}
            />
          </TabsContent>
        </Tabs>
      )}
      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteServerId} onOpenChange={() => setDeleteServerId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('serverManagement.deleteServer')}</DialogTitle>
            <DialogDescription>
              {t('serverManagement.deleteServerDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteServerId(null)}>
              {t('serverManagement.cancel')}
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteServer}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('serverManagement.deleting')}
                </>
              ) : (
                t('serverManagement.delete')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Server settings dialog */}
      {settingsServer && (
        <ServerSettingsDialog
          open={!!settingsServer}
          onOpenChange={(open) => !open && setSettingsServer(null)}
          server={settingsServer}
          onSuccess={fetchServers}
        />
      )}
    </div>
  );
}