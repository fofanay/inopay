import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  FileSearch,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Sparkles,
  Download,
  Search,
  Filter,
  FileCode,
  ArrowRight,
  Zap,
  Shield,
  FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditIssue {
  id: string;
  file: string;
  line: number;
  severity: "critical" | "high" | "medium" | "low" | "info";
  pattern: string;
  description: string;
  suggestion: string;
}

interface AuditReport {
  projectName: string;
  totalFiles: number;
  totalIssues: number;
  sovereigntyScore: number;
  issues: AuditIssue[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

const severityConfig = {
  critical: { color: "text-red-600 bg-red-50 dark:bg-red-950", icon: AlertCircle, label: "Critique" },
  high: { color: "text-orange-600 bg-orange-50 dark:bg-orange-950", icon: AlertTriangle, label: "Élevée" },
  medium: { color: "text-amber-600 bg-amber-50 dark:bg-amber-950", icon: FileWarning, label: "Moyenne" },
  low: { color: "text-blue-600 bg-blue-50 dark:bg-blue-950", icon: Info, label: "Faible" },
  info: { color: "text-muted-foreground bg-muted", icon: Info, label: "Info" },
};

// Mock data for demo
const mockAuditReport: AuditReport = {
  projectName: "my-saas-project",
  totalFiles: 156,
  totalIssues: 24,
  sovereigntyScore: 67,
  summary: { critical: 2, high: 5, medium: 8, low: 6, info: 3 },
  issues: [
    { id: "1", file: "src/integrations/supabase/client.ts", line: 12, severity: "critical", pattern: "lovable-tagger", description: "Dépendance propriétaire Lovable détectée", suggestion: "Supprimer cette dépendance" },
    { id: "2", file: "src/App.tsx", line: 45, severity: "high", pattern: "GPTEngineer tracking", description: "Code de tracking GPTEngineer", suggestion: "Retirer le code de tracking" },
    { id: "3", file: "src/components/ui/button.tsx", line: 8, severity: "medium", pattern: "@lovable/ui", description: "Import depuis package Lovable", suggestion: "Remplacer par shadcn/ui standard" },
    { id: "4", file: "package.json", line: 15, severity: "high", pattern: "lovable-tagger", description: "Package propriétaire dans les dépendances", suggestion: "Supprimer de package.json" },
    { id: "5", file: "src/hooks/useAuth.tsx", line: 23, severity: "medium", pattern: "supabase cloud ref", description: "Référence à Supabase Cloud spécifique", suggestion: "Généraliser pour self-host" },
    { id: "6", file: "index.html", line: 5, severity: "low", pattern: "lovable meta", description: "Meta tag Lovable dans le HTML", suggestion: "Retirer les meta tags propriétaires" },
    { id: "7", file: "src/main.tsx", line: 3, severity: "info", pattern: "development comment", description: "Commentaire de développement Lovable", suggestion: "Nettoyer les commentaires" },
  ],
};

export default function AuditResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const jobId = searchParams.get("id");
  
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    loadAuditReport();
  }, [jobId]);

  const loadAuditReport = async () => {
    setLoading(true);
    
    // Simulate API call - in real app, fetch from supabase
    setTimeout(() => {
      setReport(mockAuditReport);
      setLoading(false);
    }, 1500);
  };

  const handleCleanAutomatically = async () => {
    setCleaning(true);
    
    toast({
      title: "Nettoyage démarré",
      description: "Le nettoyage automatique a commencé...",
    });

    // Simulate cleaning process
    setTimeout(() => {
      setCleaning(false);
      navigate(`/liberator/cleaner?id=${jobId}`);
    }, 2000);
  };

  const exportPDF = () => {
    toast({
      title: "Export PDF",
      description: "Le rapport sera téléchargé dans quelques secondes...",
    });
  };

  const filteredIssues = report?.issues.filter(issue => {
    const matchesFilter = filter === "all" || issue.severity === filter;
    const matchesSearch = search === "" || 
      issue.file.toLowerCase().includes(search.toLowerCase()) ||
      issue.pattern.toLowerCase().includes(search.toLowerCase()) ||
      issue.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  }) || [];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <FileSearch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-2xl font-bold mb-2">Aucun rapport trouvé</h2>
        <p className="text-muted-foreground mb-6">
          Uploadez un projet pour générer un rapport d'audit
        </p>
        <Button onClick={() => navigate("/liberator/upload")}>
          Libérer un projet
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileSearch className="h-7 w-7 text-primary" />
            Résultats d'audit
          </h1>
          <p className="text-muted-foreground mt-1">
            Projet: <span className="font-medium text-foreground">{report.projectName}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPDF} className="gap-2">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Button onClick={handleCleanAutomatically} disabled={cleaning} className="gap-2">
            {cleaning ? (
              <>
                <Sparkles className="h-4 w-4 animate-pulse" />
                Nettoyage...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Nettoyer automatiquement
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <FileCode className="h-5 w-5 text-muted-foreground" />
              <Badge variant="outline">{report.totalFiles}</Badge>
            </div>
            <div className="text-2xl font-bold">{report.totalFiles}</div>
            <p className="text-sm text-muted-foreground">Fichiers analysés</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <Badge variant="outline" className="text-amber-500">{report.totalIssues}</Badge>
            </div>
            <div className="text-2xl font-bold">{report.totalIssues}</div>
            <p className="text-sm text-muted-foreground">Problèmes détectés</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <Badge 
                variant="outline" 
                className={report.sovereigntyScore >= 80 ? "text-primary" : "text-amber-500"}
              >
                {report.sovereigntyScore}%
              </Badge>
            </div>
            <div className="text-2xl font-bold">{report.sovereigntyScore}%</div>
            <p className="text-sm text-muted-foreground">Score souveraineté</p>
            <Progress value={report.sovereigntyScore} className="h-1.5 mt-2" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <Zap className="h-5 w-5 text-red-500" />
              <Badge variant="destructive">{report.summary.critical + report.summary.high}</Badge>
            </div>
            <div className="text-2xl font-bold text-red-500">
              {report.summary.critical + report.summary.high}
            </div>
            <p className="text-sm text-muted-foreground">Issues critiques</p>
          </CardContent>
        </Card>
      </div>

      {/* Severity Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition par criticité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {Object.entries(report.summary).map(([severity, count]) => {
              const config = severityConfig[severity as keyof typeof severityConfig];
              return (
                <Button
                  key={severity}
                  variant="outline"
                  size="sm"
                  className={cn("gap-2", filter === severity && "ring-2 ring-primary")}
                  onClick={() => setFilter(filter === severity ? "all" : severity)}
                >
                  <config.icon className="h-4 w-4" />
                  {config.label}
                  <Badge variant="secondary">{count}</Badge>
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              className={cn(filter === "all" && "ring-2 ring-primary")}
              onClick={() => setFilter("all")}
            >
              Tous
              <Badge variant="secondary">{report.totalIssues}</Badge>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Issues Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle>Problèmes détectés</CardTitle>
              <CardDescription>
                {filteredIssues.length} problème(s) affiché(s)
              </CardDescription>
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
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Criticité</TableHead>
                  <TableHead>Fichier</TableHead>
                  <TableHead className="w-20">Ligne</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead className="hidden md:table-cell">Suggestion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIssues.map((issue, index) => {
                  const config = severityConfig[issue.severity];
                  return (
                    <motion.tr
                      key={issue.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group hover:bg-muted/50"
                    >
                      <TableCell>
                        <Badge className={cn("gap-1", config.color)}>
                          <config.icon className="h-3 w-3" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <span className="text-muted-foreground">
                          {issue.file.split('/').slice(0, -1).join('/')}/
                        </span>
                        <span className="font-medium">
                          {issue.file.split('/').pop()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">L{issue.line}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="px-2 py-1 bg-muted rounded text-xs">
                          {issue.pattern}
                        </code>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {issue.suggestion}
                      </TableCell>
                    </motion.tr>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <CardContent className="py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Prêt pour le nettoyage automatique?</h3>
                <p className="text-sm text-muted-foreground">
                  Supprimez tous les patterns propriétaires en un clic
                </p>
              </div>
            </div>
            <Button size="lg" onClick={handleCleanAutomatically} disabled={cleaning} className="gap-2">
              {cleaning ? "Nettoyage en cours..." : "Lancer le nettoyage"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
