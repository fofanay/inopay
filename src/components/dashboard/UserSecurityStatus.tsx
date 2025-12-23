import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle,
  Lock,
  Unlock,
  Server
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ServerSecurityStatus {
  id: string;
  name: string;
  ip_address: string;
  hasSecrets: boolean;
  created_at: string;
}

export function UserSecurityStatus() {
  const [servers, setServers] = useState<ServerSecurityStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServers = async () => {
    try {
      // Fetch user's servers and check if secrets are present
      const { data: serverData, error } = await supabase
        .from('user_servers')
        .select('id, name, ip_address, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // For each server, check if sensitive secrets are still present
      const serversWithStatus = await Promise.all(
        (serverData || []).map(async (server) => {
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

      setServers(serversWithStatus);
    } catch (error) {
      console.error('Error fetching security data:', error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  const stats = {
    total: servers.length,
    secure: servers.filter(s => !s.hasSecrets).length,
    exposed: servers.filter(s => s.hasSecrets).length,
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
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Server className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Serveurs</p>
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
                <p className="text-2xl font-bold text-emerald-500">{stats.secure}</p>
                <p className="text-xs text-muted-foreground">Zero-Knowledge</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className={stats.exposed > 0 ? "border-amber-500/20 bg-amber-500/5" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Unlock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${stats.exposed > 0 ? "text-amber-500" : ""}`}>
                  {stats.exposed}
                </p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Server List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            État de Sécurité
          </CardTitle>
          <CardDescription>
            Vérification Zero-Knowledge de vos serveurs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {servers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Aucun serveur configuré</p>
              <p className="text-sm">Ajoutez un serveur pour voir son état de sécurité</p>
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map((server) => (
                <div 
                  key={server.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${server.hasSecrets ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                      {server.hasSecrets ? (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{server.name}</p>
                      <p className="text-sm text-muted-foreground">{server.ip_address}</p>
                    </div>
                  </div>
                  <Badge 
                    className={server.hasSecrets 
                      ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    }
                  >
                    {server.hasSecrets ? (
                      <>
                        <Unlock className="h-3 w-3 mr-1" />
                        En cours de nettoyage
                      </>
                    ) : (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        Zero-Knowledge
                      </>
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            🔒 <strong>Zero-Knowledge</strong> signifie qu'aucun secret sensible n'est stocké sur notre plateforme. 
            Vos mots de passe et clés API sont automatiquement nettoyés après la configuration de votre serveur.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default UserSecurityStatus;
