import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw,
  Database,
  Server,
  Github,
  Cloud,
  Wrench,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DiagnosticResult {
  service: string;
  status: 'ok' | 'error';
  latency: number;
  message: string;
  details?: string;
}

interface DiagnosticConfig {
  vpsIp: string;
  coolifyUrl: string;
  coolifyToken: string;
}

const serviceIcons: Record<string, React.ElementType> = {
  'Supabase Database': Database,
  'Edge Functions': Cloud,
  'VPS': Server,
  'Coolify API': Activity,
  'GitHub API': Github,
};

export default function AdminNetworkDiagnostic() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [config, setConfig] = useState<DiagnosticConfig>({
    vpsIp: '209.46.125.157',
    coolifyUrl: 'http://209.46.125.157:8000',
    coolifyToken: ''
  });
  const [showConfig, setShowConfig] = useState(false);

  // Load saved config from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('diagnostic-config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch {
        // Ignore parsing errors
      }
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem('diagnostic-config', JSON.stringify(config));
    toast.success("Configuration sauvegardée");
  };

  const runDiagnostic = async () => {
    setLoading(true);
    setResults([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée");
        return;
      }

      const { data, error } = await supabase.functions.invoke('network-diagnostic', {
        body: {
          vpsIp: config.vpsIp,
          coolifyUrl: config.coolifyUrl,
          coolifyToken: config.coolifyToken
        }
      });

      if (error) {
        toast.error("Erreur diagnostic: " + error.message);
        return;
      }

      setResults(data.results || []);
      setLastRun(new Date().toLocaleTimeString('fr-FR'));
      
      const failedCount = data.results?.filter((r: DiagnosticResult) => r.status === 'error').length || 0;
      if (failedCount === 0) {
        toast.success("Tous les services sont opérationnels");
      } else {
        toast.warning(`${failedCount} service(s) en erreur`);
      }
    } catch (err) {
      toast.error("Erreur lors du diagnostic");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRepair = async (service: string) => {
    toast.info(`Tentative de réparation: ${service}...`);
    
    // Redirect to appropriate settings based on service
    switch (service) {
      case 'GitHub API':
        toast("Mettez à jour GITHUB_PERSONAL_ACCESS_TOKEN dans les secrets Supabase");
        break;
      case 'Coolify API':
        setShowConfig(true);
        toast("Mettez à jour votre token Coolify ci-dessous");
        break;
      case 'VPS':
        setShowConfig(true);
        toast("Vérifiez l'adresse IP de votre VPS");
        break;
      default:
        toast("Vérifiez la configuration dans les paramètres");
    }
  };

  const getStatusColor = (status: 'ok' | 'error') => {
    return status === 'ok' 
      ? 'bg-green-500/20 text-green-400 border-green-500/30' 
      : 'bg-destructive/20 text-destructive border-destructive/30';
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Diagnostic Réseau
            </CardTitle>
            <CardDescription>
              Vérifiez l'état de tous les services connectés
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {lastRun && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {lastRun}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Wrench className="h-4 w-4 mr-2" />
              Config
            </Button>
            <Button
              onClick={runDiagnostic}
              disabled={loading}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Lancer le diagnostic
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Panel */}
        {showConfig && (
          <Card className="bg-secondary/50 border-border">
            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="vpsIp">IP VPS</Label>
                  <Input
                    id="vpsIp"
                    value={config.vpsIp}
                    onChange={(e) => setConfig({ ...config, vpsIp: e.target.value })}
                    placeholder="209.46.125.157"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coolifyUrl">URL Coolify</Label>
                  <Input
                    id="coolifyUrl"
                    value={config.coolifyUrl}
                    onChange={(e) => setConfig({ ...config, coolifyUrl: e.target.value })}
                    placeholder="http://IP:8000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coolifyToken">Token Coolify API</Label>
                  <Input
                    id="coolifyToken"
                    type="password"
                    value={config.coolifyToken}
                    onChange={(e) => setConfig({ ...config, coolifyToken: e.target.value })}
                    placeholder="Votre token API Coolify"
                  />
                </div>
              </div>
              <Button onClick={saveConfig} variant="secondary" size="sm">
                Sauvegarder la configuration
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results Grid */}
        {results.length > 0 ? (
          <div className="grid gap-3">
            {results.map((result, index) => {
              const Icon = serviceIcons[result.service] || Activity;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${result.status === 'ok' ? 'bg-green-500/20' : 'bg-destructive/20'}`}>
                      <Icon className={`h-5 w-5 ${result.status === 'ok' ? 'text-green-400' : 'text-destructive'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.service}</span>
                        <Badge variant="outline" className={getStatusColor(result.status)}>
                          {result.status === 'ok' ? (
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {result.status === 'ok' ? 'OK' : 'Erreur'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      {result.details && (
                        <p className="text-xs text-destructive/80 mt-1">{result.details}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-lg font-mono">
                        {result.latency > 0 ? `${result.latency}ms` : '-'}
                      </span>
                      <p className="text-xs text-muted-foreground">Latence</p>
                    </div>
                    {result.status === 'error' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRepair(result.service)}
                      >
                        <Wrench className="h-4 w-4 mr-1" />
                        Réparer
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Cliquez sur "Lancer le diagnostic" pour vérifier l'état des services</p>
          </div>
        )}

        {/* Summary */}
        {results.length > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-sm">
                  {results.filter(r => r.status === 'ok').length} opérationnel(s)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-sm">
                  {results.filter(r => r.status === 'error').length} en erreur
                </span>
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              Latence moyenne: {Math.round(results.reduce((acc, r) => acc + r.latency, 0) / results.length)}ms
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
