import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Ban,
  Eye,
  RefreshCw,
  AlertTriangle,
  Clock,
  Globe,
  Server,
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface SecurityEvent {
  id: string;
  event_type: string;
  ip_address: unknown;
  user_id: string | null;
  endpoint: string | null;
  details: unknown;
  severity: string;
  created_at: string;
}

interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string;
  blocked_at: string;
  expires_at: string | null;
}

interface SecurityStats {
  totalEvents: number;
  criticalEvents: number;
  blockedIPs: number;
  rateLimitHits: number;
  lastHourEvents: number;
  trend: "up" | "down" | "stable";
}

export function AdminSecurityDashboard() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  const fetchData = async () => {
    try {
      // Fetch security events
      const { data: eventsData, error: eventsError } = await supabase
        .from("security_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (eventsError) throw eventsError;
      setEvents((eventsData as SecurityEvent[]) || []);

      // Fetch blocked IPs
      const { data: blockedData, error: blockedError } = await supabase
        .from("blocked_ips")
        .select("*")
        .order("blocked_at", { ascending: false });

      if (blockedError) throw blockedError;
      setBlockedIPs((blockedData as BlockedIP[]) || []);

      // Calculate stats
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const typedEvents = (eventsData || []) as SecurityEvent[];
      
      const lastHourEvents = typedEvents.filter(
        (e) => new Date(e.created_at) > hourAgo
      ).length;

      const criticalEvents = typedEvents.filter(
        (e) => e.severity === "critical" || e.severity === "error"
      ).length;

      const rateLimitHits = typedEvents.filter(
        (e) => e.event_type === "rate_limit_exceeded"
      ).length;

      // Simple trend calculation
      const previousHour = typedEvents.filter(
        (e) => {
          const date = new Date(e.created_at);
          return date > dayAgo && date < hourAgo;
        }
      ).length;

      let trend: "up" | "down" | "stable" = "stable";
      if (lastHourEvents > previousHour * 1.2) trend = "up";
      else if (lastHourEvents < previousHour * 0.8) trend = "down";

      setStats({
        totalEvents: (eventsData || []).length,
        criticalEvents,
        blockedIPs: (blockedData || []).length,
        rateLimitHits,
        lastHourEvents,
        trend,
      });
    } catch (error) {
      console.error("Error fetching security data:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de sécurité",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Rafraîchir toutes les 30 secondes
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleUnblockIP = async (id: string, ip: string) => {
    try {
      const { error } = await supabase
        .from("blocked_ips")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setBlockedIPs((prev) => prev.filter((b) => b.id !== id));
      toast({
        title: "IP débloquée",
        description: `L'IP ${ip} a été débloquée avec succès`,
      });
    } catch (error) {
      console.error("Error unblocking IP:", error);
      toast({
        title: "Erreur",
        description: "Impossible de débloquer l'IP",
        variant: "destructive",
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "error":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "warn":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case "rate_limit_exceeded":
        return <Activity className="h-4 w-4" />;
      case "blocked_ip_attempt":
        return <Ban className="h-4 w-4" />;
      case "suspicious_request":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Tableau de Bord Sécurité
          </h2>
          <p className="text-muted-foreground">
            Surveillance en temps réel des menaces et protections
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setRefreshing(true);
            fetchData();
          }}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Événements (1h)</p>
                <p className="text-2xl font-bold">{stats?.lastHourEvents || 0}</p>
              </div>
              <div className={`p-2 rounded-full ${
                stats?.trend === "up" 
                  ? "bg-red-500/10" 
                  : stats?.trend === "down" 
                    ? "bg-green-500/10" 
                    : "bg-blue-500/10"
              }`}>
                {stats?.trend === "up" ? (
                  <TrendingUp className="h-5 w-5 text-red-500" />
                ) : stats?.trend === "down" ? (
                  <TrendingDown className="h-5 w-5 text-green-500" />
                ) : (
                  <Activity className="h-5 w-5 text-blue-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alertes critiques</p>
                <p className="text-2xl font-bold text-red-500">
                  {stats?.criticalEvents || 0}
                </p>
              </div>
              <div className="p-2 rounded-full bg-red-500/10">
                <ShieldAlert className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">IPs bloquées</p>
                <p className="text-2xl font-bold text-orange-500">
                  {stats?.blockedIPs || 0}
                </p>
              </div>
              <div className="p-2 rounded-full bg-orange-500/10">
                <Ban className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rate limits</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {stats?.rateLimitHits || 0}
                </p>
              </div>
              <div className="p-2 rounded-full bg-yellow-500/10">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Protection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            État des Protections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
              <Lock className="h-4 w-4 text-green-500" />
              <span className="text-sm">Rate Limiting DB</span>
              <Badge variant="outline" className="ml-auto text-green-500">Actif</Badge>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
              <Globe className="h-4 w-4 text-green-500" />
              <span className="text-sm">CORS</span>
              <Badge variant="outline" className="ml-auto text-green-500">Actif</Badge>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
              <Server className="h-4 w-4 text-green-500" />
              <span className="text-sm">RLS Supabase</span>
              <Badge variant="outline" className="ml-auto text-green-500">Actif</Badge>
            </div>
            <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg">
              <Shield className="h-4 w-4 text-green-500" />
              <span className="text-sm">Helmet.js</span>
              <Badge variant="outline" className="ml-auto text-green-500">Actif</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Events and Blocked IPs */}
      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">
            Événements ({events.length})
          </TabsTrigger>
          <TabsTrigger value="blocked">
            IPs Bloquées ({blockedIPs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Événements de sécurité récents</CardTitle>
              <CardDescription>
                Les 100 derniers événements de sécurité détectés
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ShieldCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Aucun événement de sécurité récent</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map((event) => (
                      <div
                        key={event.id}
                        className={`p-3 rounded-lg border ${getSeverityColor(event.severity)}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getEventIcon(event.event_type)}
                            <span className="font-medium">{event.event_type}</span>
                            <Badge variant="outline" className="text-xs">
                              {event.severity}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(event.created_at), {
                              addSuffix: true,
                              locale: i18n.language === "fr" ? fr : undefined,
                            })}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {event.ip_address && (
                            <span className="mr-3">
                              IP: <code className="bg-muted px-1 rounded">{String(event.ip_address)}</code>
                            </span>
                          )}
                          {event.endpoint && (
                            <span>
                              Endpoint: <code className="bg-muted px-1 rounded">{event.endpoint}</code>
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked">
          <Card>
            <CardHeader>
              <CardTitle>Adresses IP bloquées</CardTitle>
              <CardDescription>
                IPs actuellement bloquées par le système de sécurité
              </CardDescription>
            </CardHeader>
            <CardContent>
              {blockedIPs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Aucune IP bloquée actuellement</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blockedIPs.map((blocked) => (
                    <div
                      key={blocked.id}
                      className="flex items-center justify-between p-3 bg-red-500/5 rounded-lg border border-red-500/20"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <Ban className="h-4 w-4 text-red-500" />
                          <code className="font-mono">{blocked.ip_address}</code>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {blocked.reason}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bloquée {formatDistanceToNow(new Date(blocked.blocked_at), {
                            addSuffix: true,
                            locale: i18n.language === "fr" ? fr : undefined,
                          })}
                          {blocked.expires_at && (
                            <> • Expire {format(new Date(blocked.expires_at), "PPp", {
                              locale: i18n.language === "fr" ? fr : undefined,
                            })}</>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnblockIP(blocked.id, blocked.ip_address)}
                      >
                        <Unlock className="h-4 w-4 mr-1" />
                        Débloquer
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recommendations */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Recommandations de sécurité</AlertTitle>
        <AlertDescription className="mt-2">
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Activez Cloudflare WAF pour une protection DDoS avancée</li>
            <li>Configurez fail2ban sur vos serveurs de production</li>
            <li>Surveillez régulièrement les événements de sécurité</li>
            <li>Mettez à jour les dépendances régulièrement</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
