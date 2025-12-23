import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  Database, 
  FileCode, 
  Loader2, 
  CheckCircle2,
  Copy,
  ExternalLink,
  Server,
  Key,
  FileText,
  Users,
  Activity,
  TrendingUp,
  Calendar
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MigrationStats {
  totalUsers: number;
  usersWithServers: number;
  totalDeployments: number;
  successfulDeployments: number;
  totalProjects: number;
  recentMigrations: number;
}

export const AdminMigrationTools = () => {
  const [exportingSchema, setExportingSchema] = useState(false);
  const [schemaSQL, setSchemaSQL] = useState<string | null>(null);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Load platform stats
  useEffect(() => {
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        // Get total users (from subscriptions as proxy)
        const { count: totalUsers } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true });

        // Get users with servers
        const { count: usersWithServers } = await supabase
          .from('user_servers')
          .select('user_id', { count: 'exact', head: true });

        // Get total deployments
        const { count: totalDeployments } = await supabase
          .from('deployment_history')
          .select('*', { count: 'exact', head: true });

        // Get successful deployments
        const { count: successfulDeployments } = await supabase
          .from('deployment_history')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'success');

        // Get total projects
        const { count: totalProjects } = await supabase
          .from('projects_analysis')
          .select('*', { count: 'exact', head: true });

        // Get recent migrations (last 7 days)
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { count: recentMigrations } = await supabase
          .from('deployment_history')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', weekAgo.toISOString());

        setStats({
          totalUsers: totalUsers || 0,
          usersWithServers: usersWithServers || 0,
          totalDeployments: totalDeployments || 0,
          successfulDeployments: successfulDeployments || 0,
          totalProjects: totalProjects || 0,
          recentMigrations: recentMigrations || 0,
        });
      } catch (error) {
        console.error('Error loading stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    loadStats();
  }, []);

  const handleExportSchema = async () => {
    setExportingSchema(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-schema');
      
      if (error) throw error;
      
      if (data?.sql) {
        setSchemaSQL(data.sql);
        toast.success(`Schéma exporté: ${data.summary?.tables || 0} tables`);
      } else {
        throw new Error('Aucun SQL retourné');
      }
    } catch (error) {
      console.error('Error exporting schema:', error);
      toast.error("Erreur lors de l'export du schéma");
    } finally {
      setExportingSchema(false);
    }
  };

  const downloadSQL = (sql: string, filename: string) => {
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Fichier ${filename} téléchargé`);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copié dans le presse-papier');
  };

  const successRate = stats && stats.totalDeployments > 0 
    ? Math.round((stats.successfulDeployments / stats.totalDeployments) * 100)
    : 0;

  const adoptionRate = stats && stats.totalUsers > 0
    ? Math.round((stats.usersWithServers / stats.totalUsers) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Outils Admin - Migration</h2>
          <p className="text-muted-foreground">
            Statistiques plateforme et export du schéma global
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Server className="h-3 w-3" />
          Admin Only
        </Badge>
      </div>

      {/* Platform Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs Totaux</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.usersWithServers || 0} avec serveurs ({adoptionRate}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projets Analysés</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalProjects}
            </div>
            <p className="text-xs text-muted-foreground">
              Projets en attente de migration
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Déploiements</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalDeployments}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={successRate} className="h-1.5" />
              <span className="text-xs text-muted-foreground">{successRate}% succès</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cette Semaine</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.recentMigrations}
            </div>
            <p className="text-xs text-muted-foreground">
              Migrations récentes (7j)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Adoption Progress */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Taux d'Adoption Souveraineté
          </CardTitle>
          <CardDescription>
            Pourcentage d'utilisateurs ayant configuré leur propre infrastructure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={adoptionRate} className="flex-1 h-3" />
            <span className="text-2xl font-bold">{adoptionRate}%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {stats?.usersWithServers || 0} utilisateurs sur {stats?.totalUsers || 0} ont un serveur VPS configuré
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Platform Schema Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Export Schéma Plateforme
            </CardTitle>
            <CardDescription>
              Exporte le schéma complet (23 tables, RLS, fonctions)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleExportSchema} 
              disabled={exportingSchema}
              className="w-full"
            >
              {exportingSchema ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Export en cours...
                </>
              ) : (
                <>
                  <FileCode className="h-4 w-4 mr-2" />
                  Exporter le schéma SQL
                </>
              )}
            </Button>

            {schemaSQL && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Schéma exporté avec succès
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadSQL(schemaSQL, `inopay-schema-${new Date().toISOString().split('T')[0]}.sql`)}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(schemaSQL)}
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copier
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform Secrets */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              Secrets Plateforme
            </CardTitle>
            <CardDescription>
              Secrets nécessaires pour la plateforme complète
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { name: 'STRIPE_SECRET_KEY', desc: 'Paiements' },
                { name: 'STRIPE_WEBHOOK_SECRET', desc: 'Webhooks Stripe' },
                { name: 'RESEND_API_KEY', desc: 'Emails' },
                { name: 'ANTHROPIC_API_KEY', desc: 'IA Nettoyage' },
                { name: 'GITHUB_PERSONAL_ACCESS_TOKEN', desc: 'GitHub API' },
              ].map((secret) => (
                <div key={secret.name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  <code className="font-mono text-xs">{secret.name}</code>
                  <span className="text-muted-foreground text-xs ml-auto">{secret.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Ressources Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <a 
              href="https://supabase.com/dashboard" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <Database className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Supabase Dashboard</div>
                <div className="text-xs text-muted-foreground">Gestion BDD</div>
              </div>
            </a>
            <a 
              href="https://dashboard.stripe.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <Activity className="h-5 w-5 text-purple-500" />
              <div>
                <div className="font-medium text-sm">Stripe Dashboard</div>
                <div className="text-xs text-muted-foreground">Paiements</div>
              </div>
            </a>
            <a 
              href="/MIGRATION_GUIDE.md" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <FileText className="h-5 w-5 text-amber-500" />
              <div>
                <div className="font-medium text-sm">Guide Migration</div>
                <div className="text-xs text-muted-foreground">Documentation</div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMigrationTools;
