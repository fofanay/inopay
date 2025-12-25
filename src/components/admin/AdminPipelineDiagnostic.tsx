import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw, 
  Loader2, 
  GitBranch,
  Server,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  Shield,
  Clock,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiagnosticResult {
  service: string;
  status: 'ok' | 'error' | 'warning';
  latency_ms?: number;
  message: string;
  details?: Record<string, unknown>;
}

interface DiagnosticResponse {
  success: boolean;
  summary: {
    total_checks: number;
    ok: number;
    warnings: number;
    errors: number;
    duration_ms: number;
  };
  results: DiagnosticResult[];
  timestamp: string;
}

const AdminPipelineDiagnostic = () => {
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pipeline-diagnostic');

      if (fnError) throw fnError;
      
      if (data.error) {
        setError(data.error);
        toast.error(data.error);
      } else {
        setDiagnostic(data);
        
        if (data.summary.errors > 0) {
          toast.error(`${data.summary.errors} erreur(s) détectée(s)`);
        } else if (data.summary.warnings > 0) {
          toast.warning(`${data.summary.warnings} avertissement(s)`);
        } else {
          toast.success("Tous les connecteurs sont opérationnels");
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du diagnostic';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">OK</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">Warning</Badge>;
      case 'error':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Error</Badge>;
      default:
        return null;
    }
  };

  const getServiceIcon = (service: string) => {
    if (service.toLowerCase().includes('github')) {
      return <GitBranch className="h-4 w-4 text-zinc-400" />;
    }
    if (service.toLowerCase().includes('coolify')) {
      return <Server className="h-4 w-4 text-violet-400" />;
    }
    if (service.toLowerCase().includes('deployment')) {
      return <Zap className="h-4 w-4 text-blue-400" />;
    }
    return <Shield className="h-4 w-4 text-zinc-400" />;
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-violet-400" />
            Diagnostic Pipeline Libération
          </CardTitle>
          <CardDescription className="text-zinc-400">
            Audit technique des connecteurs GitHub et Coolify
          </CardDescription>
        </div>
        <Button 
          onClick={runDiagnostic}
          disabled={loading}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Lancer le diagnostic
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && !diagnostic && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {diagnostic && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <div className="text-2xl font-bold text-zinc-100">
                  {diagnostic.summary.total_checks}
                </div>
                <div className="text-xs text-zinc-500">Tests exécutés</div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-2xl font-bold text-emerald-400">
                  {diagnostic.summary.ok}
                </div>
                <div className="text-xs text-emerald-500/70">OK</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="text-2xl font-bold text-amber-400">
                  {diagnostic.summary.warnings}
                </div>
                <div className="text-xs text-amber-500/70">Avertissements</div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="text-2xl font-bold text-red-400">
                  {diagnostic.summary.errors}
                </div>
                <div className="text-xs text-red-500/70">Erreurs</div>
              </div>
            </div>

            {/* Timing */}
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Clock className="h-3 w-3" />
              <span>Exécuté en {diagnostic.summary.duration_ms}ms</span>
              <span className="mx-2">•</span>
              <span>{new Date(diagnostic.timestamp).toLocaleString('fr-FR')}</span>
            </div>

            {/* Results */}
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {diagnostic.results.map((result, idx) => (
                  <div 
                    key={idx}
                    className={`p-3 rounded-lg border ${
                      result.status === 'error' 
                        ? 'bg-red-500/5 border-red-500/20' 
                        : result.status === 'warning'
                          ? 'bg-amber-500/5 border-amber-500/20'
                          : 'bg-zinc-800/30 border-zinc-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1">
                        {getServiceIcon(result.service)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-zinc-200 text-sm">
                              {result.service}
                            </span>
                            {getStatusBadge(result.status)}
                            {result.latency_ms && (
                              <span className="text-xs text-zinc-500">
                                {result.latency_ms}ms
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-zinc-400 mt-1">
                            {result.message}
                          </p>
                          
                          {/* Details */}
                          {result.details && Object.keys(result.details).length > 0 && (
                            <div className="mt-2 p-2 rounded bg-zinc-900/50 text-xs font-mono">
                              {Object.entries(result.details).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="text-zinc-500">{key}:</span>
                                  <span className={
                                    key === 'action' 
                                      ? 'text-amber-400' 
                                      : key === 'error'
                                        ? 'text-red-400'
                                        : 'text-zinc-300'
                                  }>
                                    {typeof value === 'object' 
                                      ? JSON.stringify(value, null, 2)
                                      : String(value)
                                    }
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {getStatusIcon(result.status)}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        {!diagnostic && !error && !loading && (
          <div className="py-12 text-center text-zinc-500">
            <Wrench className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Cliquez sur "Lancer le diagnostic" pour analyser les connecteurs</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminPipelineDiagnostic;
