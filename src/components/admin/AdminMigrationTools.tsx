import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertTriangle,
  Server,
  Key,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ALL_TABLES = [
  'admin_activity_logs',
  'banned_users',
  'deployment_history',
  'email_campaigns',
  'email_contacts',
  'email_list_contacts',
  'email_lists',
  'email_logs',
  'email_sends',
  'email_templates',
  'health_check_logs',
  'newsletter_subscribers',
  'projects_analysis',
  'security_audit_logs',
  'server_deployments',
  'subscriptions',
  'sync_configurations',
  'sync_history',
  'user_notifications',
  'user_purchases',
  'user_roles',
  'user_servers',
  'user_settings'
];

const REQUIRED_SECRETS = [
  { name: 'STRIPE_SECRET_KEY', description: 'Clé secrète Stripe pour les paiements' },
  { name: 'STRIPE_WEBHOOK_SECRET', description: 'Secret du webhook Stripe' },
  { name: 'RESEND_API_KEY', description: 'Clé API Resend pour les emails' },
  { name: 'ANTHROPIC_API_KEY', description: 'Clé API Claude/Anthropic' },
  { name: 'GITHUB_PERSONAL_ACCESS_TOKEN', description: 'Token GitHub pour les exports' },
];

export const AdminMigrationTools = () => {
  const [exportingSchema, setExportingSchema] = useState(false);
  const [exportingData, setExportingData] = useState(false);
  const [schemaSQL, setSchemaSQL] = useState<string | null>(null);
  const [dataSQL, setDataSQL] = useState<string | null>(null);
  const [selectedTables, setSelectedTables] = useState<string[]>(ALL_TABLES);
  const [exportStats, setExportStats] = useState<Record<string, number> | null>(null);

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

  const handleExportData = async () => {
    setExportingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-data', {
        body: { tables: selectedTables }
      });
      
      if (error) throw error;
      
      if (data?.sql) {
        setDataSQL(data.sql);
        setExportStats(data.stats);
        toast.success(`Données exportées: ${data.totalRows} lignes dans ${data.totalTables} tables`);
      } else {
        throw new Error('Aucune donnée retournée');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error("Erreur lors de l'export des données");
    } finally {
      setExportingData(false);
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

  const toggleTable = (table: string) => {
    setSelectedTables(prev => 
      prev.includes(table) 
        ? prev.filter(t => t !== table)
        : [...prev, table]
    );
  };

  const selectAllTables = () => setSelectedTables(ALL_TABLES);
  const deselectAllTables = () => setSelectedTables([]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Outils de Migration</h2>
          <p className="text-muted-foreground">
            Exportez votre base de données pour migrer vers votre propre instance Supabase
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Server className="h-3 w-3" />
          Migration Autonomie
        </Badge>
      </div>

      {/* Quick Guide */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Guide rapide
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="text-xs">1</Badge>
            <span>Exportez le schéma SQL et appliquez-le sur votre nouveau Supabase</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="text-xs">2</Badge>
            <span>Configurez les secrets dans votre nouvelle instance</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="text-xs">3</Badge>
            <span>Exportez les données et importez-les</span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="text-xs">4</Badge>
            <span>Déployez les Edge Functions avec le script fourni</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Schema Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Export du Schéma
            </CardTitle>
            <CardDescription>
              Exporte la structure des 23 tables, RLS policies, fonctions et triggers
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
                    Télécharger .sql
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
                <div className="p-3 bg-muted rounded-lg text-xs font-mono max-h-32 overflow-auto">
                  {schemaSQL.substring(0, 500)}...
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Secrets Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              Secrets à recréer
            </CardTitle>
            <CardDescription>
              Ces secrets doivent être configurés sur votre nouvelle instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {REQUIRED_SECRETS.map((secret) => (
                <div key={secret.name} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <code className="text-xs font-mono bg-background px-1.5 py-0.5 rounded">
                      {secret.name}
                    </code>
                    <p className="text-xs text-muted-foreground mt-1">{secret.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            Export des Données
          </CardTitle>
          <CardDescription>
            Sélectionnez les tables à exporter et générez les INSERT statements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Table Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Tables sélectionnées: {selectedTables.length}/{ALL_TABLES.length}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllTables}>
                  Tout sélectionner
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllTables}>
                  Tout désélectionner
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg">
              {ALL_TABLES.map((table) => (
                <label 
                  key={table} 
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded"
                >
                  <Checkbox 
                    checked={selectedTables.includes(table)}
                    onCheckedChange={() => toggleTable(table)}
                  />
                  <span className="truncate">{table}</span>
                </label>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleExportData} 
            disabled={exportingData || selectedTables.length === 0}
            className="w-full"
          >
            {exportingData ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Export en cours...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Exporter {selectedTables.length} tables
              </>
            )}
          </Button>

          {exportStats && dataSQL && (
            <div className="space-y-3">
              <Separator />
              
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Données exportées avec succès
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(exportStats).slice(0, 8).map(([table, count]) => (
                  <div key={table} className="p-2 bg-muted rounded-lg text-center">
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground truncate">{table}</div>
                  </div>
                ))}
              </div>

              {Object.keys(exportStats).length > 8 && (
                <div className="text-xs text-muted-foreground text-center">
                  + {Object.keys(exportStats).length - 8} autres tables
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => downloadSQL(dataSQL, `inopay-data-${new Date().toISOString().split('T')[0]}.sql`)}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger .sql
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => copyToClipboard(dataSQL)}
                  className="flex-1"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copier
                </Button>
              </div>

              <div className="p-3 bg-muted rounded-lg text-xs font-mono max-h-32 overflow-auto">
                {dataSQL.substring(0, 500)}...
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documentation Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Documentation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <a 
              href="https://supabase.com/docs" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <Database className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Supabase Docs</div>
                <div className="text-xs text-muted-foreground">Documentation officielle</div>
              </div>
            </a>
            <a 
              href="https://supabase.com/docs/guides/cli" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <FileCode className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-medium text-sm">Supabase CLI</div>
                <div className="text-xs text-muted-foreground">Déployer les fonctions</div>
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
                <div className="text-xs text-muted-foreground">Instructions complètes</div>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMigrationTools;
