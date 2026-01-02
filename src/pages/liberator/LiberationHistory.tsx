import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  History,
  Search,
  MoreVertical,
  Download,
  FileSearch,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Package,
  FileCode,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface LiberationRecord {
  id: string;
  projectName: string;
  createdAt: Date;
  status: "completed" | "failed" | "in_progress";
  filesTotal: number;
  filesCleaned: number;
  sovereigntyScore: number;
  downloadUrl?: string;
  errorMessage?: string;
}

const mockHistory: LiberationRecord[] = [
  {
    id: "1",
    projectName: "e-commerce-app",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    status: "completed",
    filesTotal: 234,
    filesCleaned: 28,
    sovereigntyScore: 100,
    downloadUrl: "#",
  },
  {
    id: "2",
    projectName: "saas-dashboard",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: "completed",
    filesTotal: 189,
    filesCleaned: 15,
    sovereigntyScore: 98,
    downloadUrl: "#",
  },
  {
    id: "3",
    projectName: "mobile-pwa",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: "failed",
    filesTotal: 156,
    filesCleaned: 0,
    sovereigntyScore: 0,
    errorMessage: "Erreur lors de l'extraction du ZIP",
  },
  {
    id: "4",
    projectName: "blog-platform",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    status: "completed",
    filesTotal: 89,
    filesCleaned: 12,
    sovereigntyScore: 100,
    downloadUrl: "#",
  },
  {
    id: "5",
    projectName: "analytics-tool",
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    status: "completed",
    filesTotal: 312,
    filesCleaned: 45,
    sovereigntyScore: 95,
    downloadUrl: "#",
  },
];

export default function LiberationHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [history, setHistory] = useState<LiberationRecord[]>(mockHistory);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredHistory = history.filter(record =>
    record.projectName.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string) => {
    setHistory(prev => prev.filter(r => r.id !== id));
    toast({
      title: "Supprimé",
      description: "L'entrée a été supprimée de l'historique",
    });
  };

  const handleClearAll = () => {
    setHistory([]);
    toast({
      title: "Historique vidé",
      description: "Tout l'historique a été supprimé",
    });
  };

  const getStatusBadge = (status: LiberationRecord["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/20">
            <CheckCircle2 className="h-3 w-3" />
            Terminé
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Échoué
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="outline" className="gap-1 text-amber-500">
            <Clock className="h-3 w-3 animate-spin" />
            En cours
          </Badge>
        );
    }
  };

  // Stats
  const stats = {
    total: history.length,
    completed: history.filter(r => r.status === "completed").length,
    failed: history.filter(r => r.status === "failed").length,
    totalFiles: history.reduce((acc, r) => acc + r.filesCleaned, 0),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <History className="h-7 w-7 text-primary" />
            Historique des libérations
          </h1>
          <p className="text-muted-foreground mt-1">
            Retrouvez tous vos projets libérés
          </p>
        </div>
        <Button onClick={() => navigate("/liberator/upload")} className="gap-2">
          <Package className="h-4 w-4" />
          Nouveau projet
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Package className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Total projets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold text-primary">{stats.completed}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Réussis</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold text-destructive">{stats.failed}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Échoués</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <FileCode className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{stats.totalFiles}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Fichiers nettoyés</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Projets libérés</CardTitle>
              <CardDescription>{filteredHistory.length} projet(s)</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              {history.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Vider l'historique?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Tous les enregistrements seront supprimés.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearAll} className="bg-destructive text-destructive-foreground">
                        Vider l'historique
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-1">Aucun projet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Commencez par libérer votre premier projet
              </p>
              <Button onClick={() => navigate("/liberator/upload")}>
                Libérer un projet
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Fichiers</TableHead>
                  <TableHead className="hidden md:table-cell">Score</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.map((record, index) => (
                  <motion.tr
                    key={record.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          record.status === "completed" ? "bg-primary/10" : "bg-destructive/10"
                        )}>
                          {record.status === "completed" ? (
                            <Shield className="h-5 w-5 text-primary" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{record.projectName}</div>
                          <div className="text-sm text-muted-foreground">
                            {record.filesTotal} fichiers
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(record.createdAt, "d MMM yyyy", { locale: fr })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(record.createdAt, "HH:mm")}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">
                        {record.filesCleaned} nettoyés
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {record.status === "completed" ? (
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-primary">{record.sovereigntyScore}%</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {record.status === "completed" && (
                            <>
                              <DropdownMenuItem onClick={() => navigate(`/liberator/audit?id=${record.id}`)}>
                                <FileSearch className="h-4 w-4 mr-2" />
                                Voir l'audit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/liberator/download?id=${record.id}`)}>
                                <Download className="h-4 w-4 mr-2" />
                                Télécharger
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(record.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
