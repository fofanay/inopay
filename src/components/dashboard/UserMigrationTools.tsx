import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Rocket,
  Settings,
  Github,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// Tables that users can export (their own data only)
const USER_TABLES = [
  { name: 'projects_analysis', label: 'Projets analysés', description: 'Vos analyses de projets' },
  { name: 'deployment_history', label: 'Historique déploiements', description: 'Vos déploiements passés' },
  { name: 'server_deployments', label: 'Déploiements serveur', description: 'Vos apps déployées' },
  { name: 'sync_configurations', label: 'Configurations sync', description: 'Vos webhooks GitHub' },
  { name: 'sync_history', label: 'Historique sync', description: 'Logs de synchronisation' },
  { name: 'user_servers', label: 'Serveurs VPS', description: 'Vos serveurs configurés' },
  { name: 'user_settings', label: 'Paramètres', description: 'Vos préférences' },
  { name: 'user_notifications', label: 'Notifications', description: 'Vos notifications' },
];

const USER_SECRETS = [
  { name: 'GITHUB_TOKEN', description: 'Token GitHub Personnel pour les exports' },
  { name: 'COOLIFY_TOKEN', description: 'Token API Coolify pour les déploiements' },
  { name: 'SUPABASE_URL', description: 'URL de votre instance Supabase personnelle' },
  { name: 'SUPABASE_SERVICE_KEY', description: 'Clé Service Role de votre Supabase' },
];

interface MigrationStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'ready' | 'done';
  icon: React.ComponentType<{ className?: string }>;
}

export const UserMigrationTools = () => {
  const { user } = useAuth();
  const [exportingData, setExportingData] = useState(false);
  const [dataSQL, setDataSQL] = useState<string | null>(null);
  const [selectedTables, setSelectedTables] = useState<string[]>(USER_TABLES.map(t => t.name));
  const [exportStats, setExportStats] = useState<Record<string, number> | null>(null);
  const [hasServer, setHasServer] = useState(false);
  const [hasGitHub, setHasGitHub] = useState(false);
  const [checkingPrerequisites, setCheckingPrerequisites] = useState(true);

  // Check prerequisites
  useEffect(() => {
    const checkPrerequisites = async () => {
      if (!user) return;
      
      setCheckingPrerequisites(true);
      
      // Check for servers
      const { data: servers } = await supabase
        .from('user_servers')
        .select('id')
        .limit(1);
      
      setHasServer(!!servers && servers.length > 0);
      
      // Check for GitHub connection (via OAuth or settings)
      const githubIdentity = user.identities?.find(i => i.provider === 'github');
      const { data: settings } = await supabase
        .from('user_settings')
        .select('github_token')
        .eq('user_id', user.id)
        .single();
      
      setHasGitHub(!!githubIdentity || !!settings?.github_token);
      
      setCheckingPrerequisites(false);
    };
    
    checkPrerequisites();
  }, [user]);

  const getMigrationSteps = (): MigrationStep[] => [
    {
      id: 'server',
      label: 'Serveur VPS configuré',
      description: 'Un serveur avec Coolify installé',
      status: hasServer ? 'ready' : 'pending',
      icon: Server
    },
    {
      id: 'github',
      label: 'GitHub connecté',
      description: 'Token GitHub pour exporter le code',
      status: hasGitHub ? 'ready' : 'pending',
      icon: Github
    },
    {
      id: 'export',
      label: 'Exporter vos données',
      description: 'Téléchargez vos projets et configurations',
      status: dataSQL ? 'done' : 'pending',
      icon: Download
    },
    {
      id: 'deploy',
      label: 'Déployer sur VPS',
      description: 'Utilisez le Pipeline de Libération',
      status: 'pending',
      icon: Rocket
    }
  ];

  const handleExportData = async () => {
    if (!user) return;
    
    setExportingData(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data', {
        body: { 
          tables: selectedTables
        }
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

  const selectAllTables = () => setSelectedTables(USER_TABLES.map(t => t.name));
  const deselectAllTables = () => setSelectedTables([]);

  const steps = getMigrationSteps();
  const readySteps = steps.filter(s => s.status === 'ready' || s.status === 'done').length;
  const progressPercentage = (readySteps / steps.length) * 100;

  if (checkingPrerequisites) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span>Vérification de votre configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Outils de Migration</h2>
          <p className="text-muted-foreground">
            Exportez vos données pour migrer vers votre propre infrastructure
          </p>
        </div>
        <Badge variant="outline" className="gap-2">
          <Server className="h-3 w-3" />
          Autonomie Souveraine
        </Badge>
      </div>

      {/* Progress Overview */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Progression vers l'autonomie
          </CardTitle>
          <CardDescription>
            Complétez ces étapes pour migrer vos projets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Progress value={progressPercentage} className="flex-1" />
            <span className="text-sm font-medium">{readySteps}/{steps.length}</span>
          </div>
          
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div 
                  key={step.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    step.status === 'done' ? 'bg-success/10 border-success/30' :
                    step.status === 'ready' ? 'bg-primary/10 border-primary/30' :
                    'bg-muted/50 border-border'
                  }`}
                >
                  <div className={`p-2 rounded-full ${
                    step.status === 'done' ? 'bg-success/20' :
                    step.status === 'ready' ? 'bg-primary/20' :
                    'bg-muted'
                  }`}>
                    {step.status === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Icon className={`h-4 w-4 ${
                        step.status === 'ready' ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{step.label}</div>
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Prerequisites Alert */}
      {(!hasServer || !hasGitHub) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              {!hasServer && !hasGitHub && "Configurez un serveur VPS et connectez GitHub pour commencer."}
              {!hasServer && hasGitHub && "Ajoutez un serveur VPS dans l'onglet 'Mes Serveurs'."}
              {hasServer && !hasGitHub && "Connectez votre compte GitHub dans les paramètres."}
            </span>
            <Button variant="outline" size="sm" asChild>
              <a href={!hasServer ? "#servers" : "#settings"}>
                <Settings className="h-4 w-4 mr-2" />
                Configurer
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Secrets Reminder */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" />
              Secrets à configurer
            </CardTitle>
            <CardDescription>
              Ces tokens sont nécessaires sur votre nouvelle instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {USER_SECRETS.map((secret) => (
                <div key={secret.name} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <Key className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Actions rapides
            </CardTitle>
            <CardDescription>
              Raccourcis vers les fonctionnalités clés
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="#liberation">
                <FileCode className="h-4 w-4 mr-2" />
                Pipeline de Libération
                <Badge variant="secondary" className="ml-auto">Recommandé</Badge>
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="#servers">
                <Server className="h-4 w-4 mr-2" />
                Gérer mes serveurs
              </a>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <a href="#sync-mirror">
                <Github className="h-4 w-4 mr-2" />
                Configurer Sync Mirror
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-500" />
            Export de vos Données
          </CardTitle>
          <CardDescription>
            Exportez vos projets, configurations et historiques
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Table Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Tables sélectionnées: {selectedTables.length}/{USER_TABLES.length}
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 border rounded-lg">
              {USER_TABLES.map((table) => (
                <label 
                  key={table.name} 
                  className="flex items-center gap-3 text-sm cursor-pointer hover:bg-muted/50 p-2 rounded"
                >
                  <Checkbox 
                    checked={selectedTables.includes(table.name)}
                    onCheckedChange={() => toggleTable(table.name)}
                  />
                  <div>
                    <div className="font-medium">{table.label}</div>
                    <div className="text-xs text-muted-foreground">{table.description}</div>
                  </div>
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
                Exporter mes données ({selectedTables.length} tables)
              </>
            )}
          </Button>

          {exportStats && dataSQL && (
            <div className="space-y-3">
              <Separator />
              
              <div className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" />
                Données exportées avec succès
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(exportStats).map(([table, count]) => (
                  <div key={table} className="p-2 bg-muted rounded-lg text-center">
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {USER_TABLES.find(t => t.name === table)?.label || table}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => downloadSQL(dataSQL, `mes-donnees-${new Date().toISOString().split('T')[0]}.sql`)}
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
            Ressources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <a 
              href="https://coolify.io/docs" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <Server className="h-5 w-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Coolify Docs</div>
                <div className="text-xs text-muted-foreground">Déploiement VPS</div>
              </div>
            </a>
            <a 
              href="https://supabase.com/docs" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
            >
              <Database className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-medium text-sm">Supabase Docs</div>
                <div className="text-xs text-muted-foreground">Base de données</div>
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

export default UserMigrationTools;
