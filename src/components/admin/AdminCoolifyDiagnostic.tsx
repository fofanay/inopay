import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  Loader2, 
  GitBranch,
  Globe,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CoolifyApp {
  uuid: string;
  name: string;
  fqdn: string | null;
  git_repository: string | null;
  git_branch: string | null;
  build_pack: string | null;
  status: string | null;
  description: string | null;
}

interface Props {
  serverId: string;
  serverName: string;
}

const AdminCoolifyDiagnostic = ({ serverId, serverName }: Props) => {
  const [loading, setLoading] = useState(false);
  const [apps, setApps] = useState<CoolifyApp[]>([]);
  const [inopayApps, setInopayApps] = useState<CoolifyApp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-coolify-app-details', {
        body: { server_id: serverId }
      });

      if (fnError) throw fnError;
      
      if (data.error) {
        setError(data.error);
      } else {
        setApps(data.apps || []);
        setInopayApps(data.inopay_apps || []);
        setLastCheck(new Date());
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la récupération');
      toast.error(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [serverId]);

  const getGitSourceStatus = (app: CoolifyApp) => {
    if (!app.git_repository) {
      return (
        <Badge className="bg-red-500/10 text-red-400 border-red-500/20 gap-1">
          <XCircle className="h-3 w-3" />
          Pas de source Git
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Configuré
      </Badge>
    );
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Server className="h-5 w-5 text-violet-400" />
            Diagnostic Coolify - {serverName}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Configuration des sources Git des applications Coolify
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchApps}
          disabled={loading}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !apps.length ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        ) : (
          <>
            {/* Inopay Apps - Priority display */}
            {inopayApps.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-violet-500"></span>
                  Applications Inopay détectées ({inopayApps.length})
                </h4>
                
                {inopayApps.map((app) => (
                  <div key={app.uuid} className="p-4 rounded-lg bg-violet-500/5 border border-violet-500/20">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-100">{app.name}</span>
                          {getGitSourceStatus(app)}
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2 text-zinc-400">
                            <GitBranch className="h-3 w-3" />
                            <span>Repository:</span>
                            {app.git_repository ? (
                              <a 
                                href={app.git_repository}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline flex items-center gap-1"
                              >
                                {app.git_repository.replace('https://github.com/', '')}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-red-400 font-medium">⚠️ NON CONFIGURÉ</span>
                            )}
                          </div>
                          
                          {app.git_branch && (
                            <div className="flex items-center gap-2 text-zinc-500">
                              <span className="ml-5">Branch: {app.git_branch}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Globe className="h-3 w-3" />
                            <span>Domain:</span>
                            {app.fqdn ? (
                              <a 
                                href={app.fqdn}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:underline flex items-center gap-1"
                              >
                                {app.fqdn}
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="text-zinc-500">Non configuré</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-zinc-500">
                            <span className="font-mono text-xs bg-zinc-800 px-2 py-0.5 rounded">
                              UUID: {app.uuid}
                            </span>
                            {app.build_pack && (
                              <Badge variant="outline" className="text-xs border-zinc-700">
                                {app.build_pack}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {!app.git_repository && (
                      <div className="mt-3 p-3 rounded bg-amber-500/10 border border-amber-500/20">
                        <p className="text-amber-400 text-sm">
                          ⚠️ Cette application n'a pas de source Git configurée. Le code poussé vers GitHub ne sera pas déployé automatiquement.
                          Configurez un repository dans Coolify &gt; {app.name} &gt; Source.
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* All apps summary */}
            <div className="pt-4 border-t border-zinc-800">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Total applications Coolify: {apps.length}</span>
                {lastCheck && (
                  <span>Dernière vérification: {lastCheck.toLocaleTimeString('fr-FR')}</span>
                )}
              </div>
              
              {apps.length > 0 && inopayApps.length === 0 && (
                <div className="mt-3 p-3 rounded bg-amber-500/10 border border-amber-500/20">
                  <p className="text-amber-400 text-sm">
                    ⚠️ Aucune application Inopay trouvée. Assurez-vous qu'une application avec "inopay" ou "getinopay" dans le nom existe.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminCoolifyDiagnostic;
