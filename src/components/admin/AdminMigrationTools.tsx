import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Calendar,
  Search,
  AlertTriangle,
  Trash2,
  Shield,
  RefreshCw,
  XCircle,
  Github
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface MigrationStats {
  totalUsers: number;
  usersWithServers: number;
  totalDeployments: number;
  successfulDeployments: number;
  totalProjects: number;
  recentMigrations: number;
}

interface HealthCheckResult {
  timestamp: string;
  overall_status: 'healthy' | 'degraded' | 'critical';
  overall_score: number;
  checks: {
    github: { status: string; token_valid: boolean; scopes: string[]; rate_limit_remaining: number; message: string };
    coolify: { status: string; servers_total: number; servers_connected: number; servers_healthy: number; details: Array<{ server_name: string; connected: boolean; version?: string; apps_count?: number; error?: string }>; message: string };
    database: { status: string; tables_count: number; records: { users: number; servers: number; deployments: number; projects: number; sync_configs: number }; message: string };
    edge_functions: { status: string; total: number; deployed: string[]; missing: string[]; message: string };
    secrets: { status: string; configured: string[]; missing: string[]; message: string };
  };
}

interface ResetResult {
  success: boolean;
  dry_run: boolean;
  coolify: { apps_deleted: number; projects_deleted: number; servers_processed: number; errors: string[] };
  database: { [key: string]: number | string[] };
  github: { repos_deleted: number; errors: string[] };
}

export const AdminMigrationTools = () => {
  const { t } = useTranslation();
  const [exportingSchema, setExportingSchema] = useState(false);
  const [schemaSQL, setSchemaSQL] = useState<string | null>(null);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Health check state
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(null);

  // Reset state
  const [resetCoolify, setResetCoolify] = useState(false);
  const [resetDatabase, setResetDatabase] = useState(false);
  const [resetGithub, setResetGithub] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [runningReset, setRunningReset] = useState(false);
  const [resetResult, setResetResult] = useState<ResetResult | null>(null);

  // Load platform stats
  useEffect(() => {
    const loadStats = async () => {
      setLoadingStats(true);
      try {
        const { count: totalUsers } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true });

        const { count: usersWithServers } = await supabase
          .from('user_servers')
          .select('user_id', { count: 'exact', head: true });

        const { count: totalDeployments } = await supabase
          .from('deployment_history')
          .select('*', { count: 'exact', head: true });

        const { count: successfulDeployments } = await supabase
          .from('deployment_history')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'success');

        const { count: totalProjects } = await supabase
          .from('projects_analysis')
          .select('*', { count: 'exact', head: true });

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

  const handleHealthCheck = async () => {
    setRunningHealthCheck(true);
    setHealthCheckResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('pipeline-health-check', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
      });
      
      if (error) throw error;
      setHealthCheckResult(data);
      toast.success(`Diagnostic terminé: Score ${data.overall_score}/100`);
    } catch (error) {
      console.error('Error running health check:', error);
      toast.error("Erreur lors du diagnostic");
    } finally {
      setRunningHealthCheck(false);
    }
  };

  const handleReset = async (dryRun: boolean) => {
    if (!resetCoolify && !resetDatabase && !resetGithub) {
      toast.error("Sélectionnez au moins une option à réinitialiser");
      return;
    }

    if (!dryRun && !confirmReset) {
      toast.error("Veuillez confirmer le reset en cochant la case");
      return;
    }

    setRunningReset(true);
    setResetResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('global-reset', {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: {
          reset_coolify: resetCoolify,
          reset_database: resetDatabase,
          reset_github: resetGithub,
          dry_run: dryRun
        }
      });
      
      if (error) throw error;
      setResetResult(data);
      
      if (dryRun) {
        toast.info("Simulation terminée - Aucune donnée supprimée");
      } else {
        toast.success("Reset global effectué avec succès");
        // Reset checkboxes
        setResetCoolify(false);
        setResetDatabase(false);
        setResetGithub(false);
        setConfirmReset(false);
      }
    } catch (error) {
      console.error('Error running reset:', error);
      toast.error("Erreur lors du reset");
    } finally {
      setRunningReset(false);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t('adminMigration.title', 'Outils Admin - Migration')}</h2>
          <p className="text-muted-foreground">
            {t('adminMigration.subtitle', 'Diagnostic, Reset global et export du schéma')}
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
            <CardTitle className="text-sm font-medium">{t('adminMigration.totalUsers', 'Utilisateurs Totaux')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.usersWithServers || 0} {t('adminMigration.withServers', 'avec serveurs')} ({adoptionRate}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('adminMigration.analyzedProjects', 'Projets Analysés')}</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalProjects}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('adminMigration.pendingMigration', 'Projets en attente de migration')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('adminMigration.deployments', 'Déploiements')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.totalDeployments}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={successRate} className="h-1.5" />
              <span className="text-xs text-muted-foreground">{successRate}% {t('adminMigration.success', 'succès')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('adminMigration.thisWeek', 'Cette Semaine')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats?.recentMigrations}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('adminMigration.recentMigrations', 'Migrations récentes (7j)')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Health Check */}
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            🔍 {t('adminMigration.pipelineDiagnostic', 'Diagnostic Pipeline Complet')}
          </CardTitle>
          <CardDescription>
            {t('adminMigration.pipelineDiagnosticDesc', 'Vérifie GitHub, Coolify, base de données, secrets et edge functions')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleHealthCheck}
            disabled={runningHealthCheck}
            className="w-full"
            variant="default"
          >
            {runningHealthCheck ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('adminMigration.checking', 'Vérification en cours...')}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {t('adminMigration.runDiagnostic', 'Lancer le Diagnostic')}
              </>
            )}
          </Button>

          {healthCheckResult && (
            <div className="space-y-4 mt-4">
              {/* Overall Score */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-background border">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${getStatusColor(healthCheckResult.overall_status)}`}>
                  {healthCheckResult.overall_score}
                </div>
                <div>
                  <div className="font-semibold text-lg capitalize">{healthCheckResult.overall_status}</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(healthCheckResult.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Checks Grid */}
              <div className="grid gap-3 md:grid-cols-2">
                {/* GitHub */}
                <div className="p-3 rounded-lg border bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(healthCheckResult.checks.github.status)}
                    <span className="font-medium">GitHub</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{healthCheckResult.checks.github.message}</p>
                  {healthCheckResult.checks.github.scopes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {healthCheckResult.checks.github.scopes.slice(0, 3).map((scope) => (
                        <Badge key={scope} variant="secondary" className="text-xs">{scope}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coolify */}
                <div className="p-3 rounded-lg border bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(healthCheckResult.checks.coolify.status)}
                    <span className="font-medium">Coolify</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{healthCheckResult.checks.coolify.message}</p>
                </div>

                {/* Database */}
                <div className="p-3 rounded-lg border bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(healthCheckResult.checks.database.status)}
                    <span className="font-medium">Database</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{healthCheckResult.checks.database.message}</p>
                </div>

                {/* Secrets */}
                <div className="p-3 rounded-lg border bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(healthCheckResult.checks.secrets.status)}
                    <span className="font-medium">Secrets</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{healthCheckResult.checks.secrets.message}</p>
                  {healthCheckResult.checks.secrets.missing.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {healthCheckResult.checks.secrets.missing.map((secret) => (
                        <Badge key={secret} variant="destructive" className="text-xs">{secret}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Global Reset - Danger Zone */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            🔴 {t('adminMigration.globalReset', 'Reset Global du Système')}
          </CardTitle>
          <CardDescription className="text-red-600/80">
            {t('adminMigration.globalResetDesc', 'Attention : Cette action est irréversible. Utilisez le mode simulation d\'abord.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t('adminMigration.dangerZone', 'Zone Danger')}</AlertTitle>
            <AlertDescription>
              {t('adminMigration.dangerZoneDesc', 'Cette action supprimera définitivement les données sélectionnées. Lancez d\'abord une simulation.')}
            </AlertDescription>
          </Alert>

          {/* Reset Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Checkbox 
                id="reset-coolify" 
                checked={resetCoolify}
                onCheckedChange={(checked) => setResetCoolify(checked as boolean)}
              />
              <div className="flex-1">
                <label htmlFor="reset-coolify" className="font-medium cursor-pointer flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Coolify (Apps + Projets)
                </label>
                <p className="text-xs text-muted-foreground">
                  {t('adminMigration.resetCoolifyDesc', 'Supprime toutes les applications et projets sur tous les serveurs Coolify')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Checkbox 
                id="reset-database" 
                checked={resetDatabase}
                onCheckedChange={(checked) => setResetDatabase(checked as boolean)}
              />
              <div className="flex-1">
                <label htmlFor="reset-database" className="font-medium cursor-pointer flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  Base de données
                </label>
                <p className="text-xs text-muted-foreground">
                  {t('adminMigration.resetDatabaseDesc', 'Vide les tables: deployments, sync, projects, cache, estimates, health logs')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Checkbox 
                id="reset-github" 
                checked={resetGithub}
                onCheckedChange={(checked) => setResetGithub(checked as boolean)}
              />
              <div className="flex-1">
                <label htmlFor="reset-github" className="font-medium cursor-pointer flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  GitHub Repos
                </label>
                <p className="text-xs text-muted-foreground">
                  {t('adminMigration.resetGithubDesc', 'Supprime les repos contenant "-sovereign-" ou "inopay-" du compte configuré')}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Confirmation */}
          <div className="flex items-center space-x-3 p-3 rounded-lg border border-red-500/50 bg-red-500/10">
            <Checkbox 
              id="confirm-reset" 
              checked={confirmReset}
              onCheckedChange={(checked) => setConfirmReset(checked as boolean)}
            />
            <label htmlFor="confirm-reset" className="text-sm font-medium text-red-600 cursor-pointer">
              {t('adminMigration.confirmReset', 'Je comprends que cette action est irréversible')}
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => handleReset(true)}
              disabled={runningReset || (!resetCoolify && !resetDatabase && !resetGithub)}
              className="flex-1"
            >
              {runningReset ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              {t('adminMigration.simulation', 'Simulation (Dry Run)')}
            </Button>
            <Button 
              variant="destructive"
              onClick={() => handleReset(false)}
              disabled={runningReset || !confirmReset || (!resetCoolify && !resetDatabase && !resetGithub)}
              className="flex-1"
            >
              {runningReset ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t('adminMigration.executeReset', 'Exécuter le Reset')}
            </Button>
          </div>

          {/* Reset Result */}
          {resetResult && (
            <div className="p-4 rounded-lg border bg-background space-y-3">
              <div className="flex items-center gap-2">
                {resetResult.dry_run ? (
                  <Badge variant="secondary">Simulation</Badge>
                ) : (
                  <Badge variant="destructive">Exécuté</Badge>
                )}
                <span className="font-medium">Résultat du {resetResult.dry_run ? 'dry run' : 'reset'}</span>
              </div>
              
              <div className="grid gap-2 text-sm">
                {resetCoolify && (
                  <div className="flex justify-between">
                    <span>Coolify:</span>
                    <span>{resetResult.coolify.apps_deleted} apps, {resetResult.coolify.projects_deleted} projets</span>
                  </div>
                )}
                {resetDatabase && (
                  <div className="flex justify-between">
                    <span>Database:</span>
                    <span>
                      {Object.entries(resetResult.database)
                        .filter(([k, v]) => typeof v === 'number' && k !== 'errors')
                        .reduce((sum, [, v]) => sum + (v as number), 0)} records
                    </span>
                  </div>
                )}
                {resetGithub && (
                  <div className="flex justify-between">
                    <span>GitHub:</span>
                    <span>{resetResult.github.repos_deleted} repos</span>
                  </div>
                )}
              </div>

              {(resetResult.coolify.errors.length > 0 || (resetResult.database.errors as string[])?.length > 0 || resetResult.github.errors.length > 0) && (
                <div className="text-xs text-red-500">
                  {[...resetResult.coolify.errors, ...(resetResult.database.errors as string[] || []), ...resetResult.github.errors].slice(0, 3).map((err, i) => (
                    <div key={i}>• {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Adoption Progress */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('adminMigration.adoptionRate', 'Taux d\'Adoption Souveraineté')}
          </CardTitle>
          <CardDescription>
            {t('adminMigration.adoptionRateDesc', 'Pourcentage d\'utilisateurs ayant configuré leur propre infrastructure')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Progress value={adoptionRate} className="flex-1 h-3" />
            <span className="text-2xl font-bold">{adoptionRate}%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {stats?.usersWithServers || 0} {t('adminMigration.usersOnTotal', 'utilisateurs sur')} {stats?.totalUsers || 0} {t('adminMigration.haveVPS', 'ont un serveur VPS configuré')}
          </p>
        </CardContent>
      </Card>

      {/* Master SQL Script Download */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-amber-500" />
            🗃️ {t('adminMigration.masterScript', 'Master Script SQL de Migration')}
          </CardTitle>
          <CardDescription>
            {t('adminMigration.masterScriptDesc', 'Script complet incluant les 32 migrations fusionnées (ENUM, tables, RLS, triggers)')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={() => {
              const link = document.createElement('a');
              link.href = '/MASTER_MIGRATION_INOPAY.sql';
              link.download = 'MASTER_MIGRATION_INOPAY.sql';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success('Script Master SQL téléchargé');
            }}
            className="w-full"
            variant="default"
          >
            <Download className="h-4 w-4 mr-2" />
            📥 {t('adminMigration.downloadMasterScript', 'Télécharger MASTER_MIGRATION_INOPAY.sql')}
          </Button>
          
          <div className="p-3 rounded-lg bg-muted/50 border border-muted-foreground/20">
            <h4 className="font-medium text-sm mb-2">{t('adminMigration.instructions', 'Instructions d\'utilisation :')}</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>{t('adminMigration.step1', 'Téléchargez le fichier SQL ci-dessus')}</li>
              <li>{t('adminMigration.step2', 'Ouvrez le SQL Editor de votre Supabase privé')}</li>
              <li>{t('adminMigration.step3', 'Copiez-collez le contenu du fichier')}</li>
              <li>{t('adminMigration.step4', 'Exécutez le script pour créer toutes les tables et policies')}</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Platform Schema Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              {t('adminMigration.exportSchema', 'Export Schéma Plateforme')}
            </CardTitle>
            <CardDescription>
              {t('adminMigration.exportSchemaDesc', 'Exporte le schéma complet (23 tables, RLS, fonctions)')}
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
                  {t('adminMigration.exporting', 'Export en cours...')}
                </>
              ) : (
                <>
                  <FileCode className="h-4 w-4 mr-2" />
                  {t('adminMigration.exportSQL', 'Exporter le schéma SQL')}
                </>
              )}
            </Button>

            {schemaSQL && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('adminMigration.schemaExported', 'Schéma exporté avec succès')}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadSQL(schemaSQL, `inopay-schema-${new Date().toISOString().split('T')[0]}.sql`)}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t('adminMigration.download', 'Télécharger')}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(schemaSQL)}
                    className="flex-1"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {t('adminMigration.copy', 'Copier')}
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
              {t('adminMigration.platformSecrets', 'Secrets Plateforme')}
            </CardTitle>
            <CardDescription>
              {t('adminMigration.platformSecretsDesc', 'Secrets nécessaires pour la plateforme complète')}
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
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
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
            {t('adminMigration.adminResources', 'Ressources Admin')}
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
                <div className="text-xs text-muted-foreground">{t('adminMigration.dbManagement', 'Gestion BDD')}</div>
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
                <div className="text-xs text-muted-foreground">{t('adminMigration.payments', 'Paiements')}</div>
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
                <div className="font-medium text-sm">{t('adminMigration.migrationGuide', 'Guide Migration')}</div>
                <div className="text-xs text-muted-foreground">{t('adminMigration.documentation', 'Documentation')}</div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMigrationTools;
