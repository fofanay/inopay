import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Server, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Wifi,
  WifiOff,
  Trash2,
  Settings2,
  ExternalLink,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface UserServer {
  id: string;
  name: string;
  ip_address: string;
  coolify_url: string | null;
  coolify_token: string | null;
  status: string;
  provider: string | null;
}

interface ServerTestResult {
  server_id: string;
  connected: boolean;
  version?: string;
  apps_count?: number;
  error?: string;
  warning?: string;
  response_time_ms?: number;
}

interface ServerConnectionTestProps {
  servers: UserServer[];
  onRefresh: () => void;
  onServerDeleted?: (serverId: string) => void;
}

export function ServerConnectionTest({ servers, onRefresh, onServerDeleted }: ServerConnectionTestProps) {
  const { user } = useAuth();
  const [testResults, setTestResults] = useState<Record<string, ServerTestResult>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  // Detect duplicate servers (same IP)
  const duplicates = servers.reduce((acc, server) => {
    const ip = server.ip_address;
    if (!acc[ip]) acc[ip] = [];
    acc[ip].push(server);
    return acc;
  }, {} as Record<string, UserServer[]>);

  const duplicateIPs = Object.entries(duplicates).filter(([_, servers]) => servers.length > 1);

  // Validate Coolify URL format
  const validateCoolifyUrl = (url: string | null): { valid: boolean; warning?: string } => {
    if (!url) return { valid: false, warning: "URL Coolify non configurée" };
    
    try {
      const parsed = new URL(url);
      
      // Check for port
      if (!parsed.port && !url.includes(':8000')) {
        return { 
          valid: false, 
          warning: `Port manquant. Coolify utilise généralement le port 8000. Essayez: ${parsed.protocol}//${parsed.hostname}:8000`
        };
      }
      
      return { valid: true };
    } catch {
      return { valid: false, warning: "URL invalide" };
    }
  };

  const testConnection = async (server: UserServer) => {
    setTesting(prev => ({ ...prev, [server.id]: true }));
    const startTime = Date.now();

    try {
      // First validate the URL
      const urlValidation = validateCoolifyUrl(server.coolify_url);
      if (!urlValidation.valid) {
        setTestResults(prev => ({
          ...prev,
          [server.id]: {
            server_id: server.id,
            connected: false,
            warning: urlValidation.warning,
            error: urlValidation.warning
          }
        }));
        return;
      }

      if (!server.coolify_token) {
        setTestResults(prev => ({
          ...prev,
          [server.id]: {
            server_id: server.id,
            connected: false,
            error: "Token Coolify non configuré"
          }
        }));
        return;
      }

      // Call the test-coolify-connection function
      const { data, error } = await supabase.functions.invoke('test-coolify-connection', {
        body: {
          coolify_url: server.coolify_url,
          coolify_token: server.coolify_token
        }
      });

      const responseTime = Date.now() - startTime;

      if (error) {
        setTestResults(prev => ({
          ...prev,
          [server.id]: {
            server_id: server.id,
            connected: false,
            error: error.message,
            response_time_ms: responseTime
          }
        }));
        toast.error(`Échec connexion ${server.name}`);
      } else if (data.success) {
        setTestResults(prev => ({
          ...prev,
          [server.id]: {
            server_id: server.id,
            connected: true,
            apps_count: data.apps_count,
            response_time_ms: responseTime
          }
        }));
        toast.success(`${server.name}: Connexion réussie (${data.apps_count} apps)`);
      } else {
        setTestResults(prev => ({
          ...prev,
          [server.id]: {
            server_id: server.id,
            connected: false,
            error: data.error || "Connexion échouée",
            response_time_ms: responseTime
          }
        }));
        toast.error(`${server.name}: ${data.error}`);
      }
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [server.id]: {
          server_id: server.id,
          connected: false,
          error: err instanceof Error ? err.message : "Erreur inconnue"
        }
      }));
    } finally {
      setTesting(prev => ({ ...prev, [server.id]: false }));
    }
  };

  const testAllConnections = async () => {
    for (const server of servers) {
      await testConnection(server);
    }
  };

  const deleteServer = async (server: UserServer) => {
    if (!confirm(`Supprimer le serveur "${server.name}" ?`)) return;

    setDeleting(prev => ({ ...prev, [server.id]: true }));

    try {
      // Check if server has deployments
      const { count } = await supabase
        .from('server_deployments')
        .select('*', { count: 'exact', head: true })
        .eq('server_id', server.id);

      if (count && count > 0) {
        toast.error(`Impossible de supprimer: ${count} déploiements associés`);
        return;
      }

      const { error } = await supabase
        .from('user_servers')
        .delete()
        .eq('id', server.id)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast.success(`Serveur "${server.name}" supprimé`);
      onServerDeleted?.(server.id);
      onRefresh();
    } catch (err) {
      toast.error("Erreur lors de la suppression");
    } finally {
      setDeleting(prev => ({ ...prev, [server.id]: false }));
    }
  };

  const getStatusIcon = (server: UserServer) => {
    const result = testResults[server.id];
    
    if (testing[server.id]) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    
    if (!result) {
      return <Wifi className="h-4 w-4 text-muted-foreground" />;
    }
    
    if (result.connected) {
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
    
    if (result.warning) {
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
    
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getStatusBadge = (server: UserServer) => {
    const result = testResults[server.id];
    const urlValidation = validateCoolifyUrl(server.coolify_url);
    
    if (!urlValidation.valid) {
      return (
        <Badge variant="outline" className="text-warning border-warning/50 bg-warning/10">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Config requise
        </Badge>
      );
    }
    
    if (!result) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Non testé
        </Badge>
      );
    }
    
    if (result.connected) {
      return (
        <Badge variant="outline" className="text-success border-success/50 bg-success/10">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Connecté
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="text-destructive border-destructive/50 bg-destructive/10">
        <WifiOff className="h-3 w-3 mr-1" />
        Déconnecté
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Duplicates Warning */}
      {duplicateIPs.length > 0 && (
        <Alert variant="destructive" className="border-warning bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning">
            <strong>Serveurs en doublon détectés:</strong>
            <ul className="mt-2 space-y-1">
              {duplicateIPs.map(([ip, dupes]) => (
                <li key={ip}>
                  IP {ip}: {dupes.map(s => s.name).join(", ")} 
                  <span className="text-muted-foreground ml-2">
                    ({dupes.length} serveurs avec la même IP)
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm">
              Supprimez les doublons pour éviter les conflits.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Test de Connexion Serveurs</h3>
          <Badge variant="outline">{servers.length}</Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={testAllConnections}
          disabled={servers.some(s => testing[s.id])}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${servers.some(s => testing[s.id]) ? 'animate-spin' : ''}`} />
          Tester tout
        </Button>
      </div>

      {/* Server List */}
      <div className="grid gap-3">
        {servers.map(server => {
          const result = testResults[server.id];
          const urlValidation = validateCoolifyUrl(server.coolify_url);
          const isDuplicate = duplicates[server.ip_address]?.length > 1;

          return (
            <Card 
              key={server.id} 
              className={`transition-all ${isDuplicate ? 'border-warning/50' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {getStatusIcon(server)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{server.name}</span>
                        {getStatusBadge(server)}
                        {isDuplicate && (
                          <Badge variant="outline" className="text-warning border-warning/50">
                            Doublon
                          </Badge>
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground mt-1">
                        <span className="font-mono">{server.ip_address}</span>
                        {server.coolify_url && (
                          <>
                            <span className="mx-2">•</span>
                            <a 
                              href={server.coolify_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {server.coolify_url}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        )}
                      </div>

                      {/* URL Validation Warning */}
                      {!urlValidation.valid && urlValidation.warning && (
                        <p className="text-sm text-warning mt-2 flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          {urlValidation.warning}
                        </p>
                      )}

                      {/* Test Result Error */}
                      {result && !result.connected && result.error && urlValidation.valid && (
                        <p className="text-sm text-destructive mt-2 flex items-start gap-2">
                          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                          {result.error}
                        </p>
                      )}

                      {/* Test Result Success */}
                      {result && result.connected && (
                        <div className="text-sm text-success mt-2 flex items-center gap-4">
                          <span>{result.apps_count} applications</span>
                          {result.response_time_ms && (
                            <span className="text-muted-foreground">
                              {result.response_time_ms}ms
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnection(server)}
                      disabled={testing[server.id]}
                      className="gap-1"
                    >
                      {testing[server.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wifi className="h-4 w-4" />
                      )}
                      Test
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteServer(server)}
                      disabled={deleting[server.id]}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {deleting[server.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {servers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Server className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun serveur configuré</p>
              <p className="text-sm mt-1">
                Ajoutez un VPS pour commencer les déploiements souverains
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default ServerConnectionTest;
