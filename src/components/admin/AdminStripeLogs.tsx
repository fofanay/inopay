import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2, Clock, Search, Webhook, Filter, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ActivityLog {
  id: string;
  action_type: string;
  title: string;
  description: string | null;
  status: string;
  metadata: any;
  created_at: string;
  user_id: string | null;
}

const AdminStripeLogs = () => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState<"all" | "success" | "error">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  
  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      let query = supabase
        .from("admin_activity_logs")
        .select("*")
        .or("action_type.eq.stripe_webhook_success,action_type.eq.stripe_webhook_error")
        .order("created_at", { ascending: false })
        .limit(200);

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Erreur lors du chargement des logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  const filteredLogs = logs.filter((log) => {
    // Filter by status
    if (filter === "success" && log.status !== "success") return false;
    if (filter === "error" && log.status !== "error") return false;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = log.title.toLowerCase().includes(query);
      const matchesDescription = log.description?.toLowerCase().includes(query);
      const matchesMetadata = JSON.stringify(log.metadata).toLowerCase().includes(query);
      if (!matchesTitle && !matchesDescription && !matchesMetadata) return false;
    }

    return true;
  });

  const stats = {
    total: logs.length,
    success: logs.filter((l) => l.status === "success").length,
    error: logs.filter((l) => l.status === "error").length,
    today: logs.filter((l) => {
      const logDate = new Date(l.created_at);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    }).length,
  };

  const getStatusBadge = (status: string) => {
    if (status === "success") {
      return (
        <Badge variant="default" className="bg-success text-success-foreground">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Succès
        </Badge>
      );
    }
    return (
      <Badge variant="destructive">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Erreur
      </Badge>
    );
  };

  const getEventType = (title: string) => {
    if (title.includes("checkout.session.completed")) return "Paiement";
    if (title.includes("subscription.updated")) return "Abonnement MàJ";
    if (title.includes("subscription.deleted")) return "Abonnement Annulé";
    if (title.includes("charge.refunded")) return "Remboursement";
    if (title.includes("invoice.payment_failed")) return "Échec Paiement";
    if (title.includes("invoice.payment_action_required")) return "Action Requise";
    return "Webhook";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-hover border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Webhooks</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <Webhook className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-success to-success/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-success-foreground/80">Succès</p>
                <p className="text-2xl font-bold text-success-foreground">{stats.success}</p>
              </div>
              <div className="p-3 rounded-xl bg-success-foreground/20">
                <CheckCircle2 className="h-6 w-6 text-success-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 shadow-md bg-gradient-to-br from-destructive to-destructive/80">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-destructive-foreground/80">Erreurs</p>
                <p className="text-2xl font-bold text-destructive-foreground">{stats.error}</p>
              </div>
              <div className="p-3 rounded-xl bg-destructive-foreground/20">
                <AlertTriangle className="h-6 w-6 text-destructive-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover border-0 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aujourd'hui</p>
                <p className="text-2xl font-bold text-foreground">{stats.today}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card className="card-hover border-0 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <Webhook className="h-5 w-5 text-primary" />
              </div>
              Logs Webhook Stripe
            </CardTitle>
            <CardDescription className="mt-1">
              Historique des événements Stripe traités
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLogs} className="border-border/50 hover:bg-muted">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("ui.searchLogs")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-auto">
              <TabsList>
                <TabsTrigger value="all">Tous</TabsTrigger>
                <TabsTrigger value="success">Succès</TabsTrigger>
                <TabsTrigger value="error">Erreurs</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Logs List */}
          <div className="space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun log trouvé</p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <Collapsible key={log.id} open={expandedLogs.has(log.id)}>
                  <div className={`rounded-lg border ${log.status === "error" ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-card"}`}>
                    <CollapsibleTrigger
                      onClick={() => toggleExpand(log.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        {getStatusBadge(log.status)}
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {getEventType(log.title)}
                            </Badge>
                            <span className="text-sm font-medium text-foreground">
                              {log.title.replace("Webhook Processed: ", "").replace("Webhook Error: ", "")}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.created_at), "dd MMM yyyy à HH:mm:ss", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      {expandedLogs.has(log.id) ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-2 border-t border-border/50">
                        {log.description && (
                          <div className="mb-3">
                            <p className="text-sm font-medium text-muted-foreground">Description</p>
                            <p className="text-sm text-foreground">{log.description}</p>
                          </div>
                        )}
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground mb-2">Métadonnées</p>
                            <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.metadata?.invoiceId && (
                          <a
                            href={`https://dashboard.stripe.com/invoices/${log.metadata.invoiceId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Voir dans Stripe
                          </a>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminStripeLogs;