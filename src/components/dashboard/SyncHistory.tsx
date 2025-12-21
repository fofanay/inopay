import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw,
  FileCode,
  GitCommit,
  Timer
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SyncHistoryItem {
  id: string;
  commit_sha: string;
  commit_message: string | null;
  files_changed: string[] | null;
  files_cleaned: string[] | null;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

interface SyncHistoryProps {
  syncConfigId: string;
  onBack: () => void;
}

export function SyncHistory({ syncConfigId, onBack }: SyncHistoryProps) {
  const { toast } = useToast();
  const [history, setHistory] = useState<SyncHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<SyncHistoryItem | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [syncConfigId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sync_history")
        .select("*")
        .eq("sync_config_id", syncConfigId)
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error("Error fetching sync history:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "processing":
      case "deploying":
        return <RefreshCw className="h-5 w-5 text-info animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success/20 text-success border-success/30">Complété</Badge>;
      case "failed":
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Échoué</Badge>;
      case "processing":
        return <Badge className="bg-info/20 text-info border-info/30">Traitement</Badge>;
      case "deploying":
        return <Badge className="bg-warning/20 text-warning border-warning/30">Déploiement</Badge>;
      default:
        return <Badge className="bg-muted/20 text-muted-foreground border-muted/30">En attente</Badge>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return "-";
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  };

  if (selectedItem) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedItem(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-semibold">Détails de la synchronisation</h2>
            <p className="text-muted-foreground font-mono text-sm">
              {selectedItem.commit_sha.substring(0, 7)}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitCommit className="h-5 w-5" />
                Commit
              </CardTitle>
              {getStatusBadge(selectedItem.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">SHA</p>
              <p className="font-mono">{selectedItem.commit_sha}</p>
            </div>
            {selectedItem.commit_message && (
              <div>
                <p className="text-sm text-muted-foreground">Message</p>
                <p>{selectedItem.commit_message}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Démarré</p>
                <p>{formatDate(selectedItem.started_at)}</p>
              </div>
              {selectedItem.completed_at && (
                <div>
                  <p className="text-sm text-muted-foreground">Terminé</p>
                  <p>{formatDate(selectedItem.completed_at)}</p>
                </div>
              )}
            </div>
            {selectedItem.duration_ms && (
              <div>
                <p className="text-sm text-muted-foreground">Durée</p>
                <p className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  {formatDuration(selectedItem.duration_ms)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedItem.files_changed && selectedItem.files_changed.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileCode className="h-5 w-5" />
                Fichiers modifiés ({selectedItem.files_changed.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-48">
                <div className="space-y-1">
                  {selectedItem.files_changed.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50"
                    >
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-mono">{file}</span>
                      {selectedItem.files_cleaned?.includes(file) && (
                        <Badge className="ml-auto bg-success/20 text-success border-success/30 text-xs">
                          Nettoyé
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {selectedItem.error_message && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Erreur</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{selectedItem.error_message}</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Historique des synchronisations</h2>
          <p className="text-muted-foreground">{history.length} synchronisation(s)</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune synchronisation pour le moment</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedItem(item)}
                >
                  {getStatusIcon(item.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{item.commit_sha.substring(0, 7)}</span>
                      {getStatusBadge(item.status)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {item.commit_message || "Pas de message"}
                    </p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{formatDate(item.started_at)}</p>
                    {item.duration_ms && (
                      <p className="flex items-center gap-1 justify-end">
                        <Timer className="h-3 w-3" />
                        {formatDuration(item.duration_ms)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default SyncHistory;
