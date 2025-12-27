import { useState, useEffect } from "react";
import { 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Copy, 
  Check, 
  ExternalLink,
  ChevronRight,
  RefreshCw,
  Download,
  FileText
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useWizard } from "@/contexts/WizardContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type MigrationStep = 'connection' | 'schema' | 'verification' | 'import' | 'complete';

interface TableStatus {
  name: string;
  exists: boolean;
  rowCount?: number;
}

interface ImportProgress {
  table: string;
  totalRows: number;
  inserted: number;
  success: boolean;
  error?: string;
}

export function DatabaseMigrationAssistant() {
  const { state, dispatch } = useWizard();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<MigrationStep>('connection');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionValid, setConnectionValid] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [sqlEditorUrl, setSqlEditorUrl] = useState('');
  
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [missingTables, setMissingTables] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress[]>([]);
  const [importComplete, setImportComplete] = useState(false);
  
  const [copied, setCopied] = useState(false);
  const [migrationSql, setMigrationSql] = useState('');

  // Expected tables from the project
  const expectedTables = [
    'profiles', 'user_roles', 'user_settings', 'user_servers', 'subscriptions',
    'projects_analysis', 'cleaning_cache', 'cleaning_estimates', 'server_deployments',
    'deployment_history', 'sync_configurations', 'sync_history', 'user_purchases',
    'user_notifications', 'security_audit_logs', 'health_check_logs', 'admin_activity_logs',
    'admin_config', 'banned_users', 'email_templates', 'email_lists', 'email_contacts',
    'email_list_contacts', 'email_campaigns', 'email_logs', 'email_sends',
    'newsletter_subscribers', 'otp_verifications', 'pending_liberation_payments',
    'liberation_upsell_views'
  ];

  // Load migration SQL on mount
  useEffect(() => {
    fetch('/MASTER_MIGRATION_INOPAY.sql')
      .then(res => res.text())
      .then(sql => setMigrationSql(sql))
      .catch(() => console.log('Migration SQL file not found'));
  }, []);

  const testConnection = async () => {
    if (!state.destination.destSupabaseUrl || !state.destination.destSupabaseKey) {
      toast({ 
        title: "Champs requis", 
        description: "Entrez l'URL et la Service Role Key", 
        variant: "destructive" 
      });
      return;
    }

    setIsTestingConnection(true);
    setConnectionError('');

    try {
      const { data, error } = await supabase.functions.invoke('validate-supabase-destination', {
        body: {
          destUrl: state.destination.destSupabaseUrl,
          destServiceKey: state.destination.destSupabaseKey,
          expectedTables
        }
      });

      if (error) throw error;

      if (data.success && data.connectionValid) {
        setConnectionValid(true);
        setProjectRef(data.projectRef || '');
        setSqlEditorUrl(data.sqlEditorUrl || '');
        setTables(data.tables || []);
        setMissingTables(data.missingTables || []);
        
        toast({ 
          title: "Connexion réussie !", 
          description: `Projet ${data.projectRef} connecté` 
        });
        
        // Auto-advance if schema already exists
        if (data.isSchemaReady) {
          setCurrentStep('import');
        } else {
          setCurrentStep('schema');
        }
      } else {
        setConnectionError(data.error || "Connexion échouée");
        toast({ 
          title: "Erreur de connexion", 
          description: data.error, 
          variant: "destructive" 
        });
      }
    } catch (err: any) {
      console.error("[DatabaseMigrationAssistant] Connection test error:", err);
      setConnectionError(err.message || "Erreur inconnue");
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const verifySchema = async () => {
    setIsVerifying(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('validate-supabase-destination', {
        body: {
          destUrl: state.destination.destSupabaseUrl,
          destServiceKey: state.destination.destSupabaseKey,
          expectedTables
        }
      });

      if (error) throw error;

      setTables(data.tables || []);
      setMissingTables(data.missingTables || []);

      if (data.isSchemaReady) {
        toast({ title: "Schéma vérifié !", description: "Toutes les tables existent" });
        setCurrentStep('import');
      } else {
        toast({ 
          title: "Tables manquantes", 
          description: `${data.missingTables.length} tables non trouvées`,
          variant: "destructive"
        });
      }
    } catch (err: any) {
      toast({ title: "Erreur de vérification", description: err.message, variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const startImport = async () => {
    setIsImporting(true);
    setImportProgress([]);

    try {
      // First, export data from source (current Supabase)
      const tablesToExport = expectedTables.filter(t => !['otp_verifications', 'banned_users'].includes(t));
      
      const tablesData: { name: string; data: any[] }[] = [];
      
      for (const tableName of tablesToExport) {
        try {
          const { data, error } = await supabase
            .from(tableName as any)
            .select('*');
          
          if (!error && data) {
            tablesData.push({ name: tableName, data });
            setImportProgress(prev => [...prev, {
              table: tableName,
              totalRows: data.length,
              inserted: 0,
              success: true
            }]);
          }
        } catch {
          // Table might not exist or not accessible
        }
      }

      // Import to destination
      const { data: importResult, error: importError } = await supabase.functions.invoke('import-data-to-supabase', {
        body: {
          destUrl: state.destination.destSupabaseUrl,
          destServiceKey: state.destination.destSupabaseKey,
          tables: tablesData
        }
      });

      if (importError) throw importError;

      setImportProgress(importResult.tables || []);
      setImportComplete(true);
      
      dispatch({ type: "UPDATE_DESTINATION", payload: { isSupabaseMigrated: true } });
      
      toast({ 
        title: "Import terminé !", 
        description: `${importResult.summary.totalInserted} lignes importées` 
      });
      
      setCurrentStep('complete');
    } catch (err: any) {
      console.error("[DatabaseMigrationAssistant] Import error:", err);
      toast({ title: "Erreur d'import", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copié !", description: "Script SQL copié dans le presse-papier" });
  };

  const downloadSql = () => {
    const blob = new Blob([migrationSql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'MASTER_MIGRATION_INOPAY.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const steps: { key: MigrationStep; label: string; number: number }[] = [
    { key: 'connection', label: 'Connexion', number: 1 },
    { key: 'schema', label: 'Schéma', number: 2 },
    { key: 'verification', label: 'Vérification', number: 3 },
    { key: 'import', label: 'Import', number: 4 },
    { key: 'complete', label: 'Terminé', number: 5 }
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Assistant de migration Supabase
        </CardTitle>
        <CardDescription>
          Migrez vos données vers votre propre instance Supabase
        </CardDescription>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between mt-4">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${idx < currentStepIndex ? 'bg-success text-success-foreground' : ''}
                ${idx === currentStepIndex ? 'bg-primary text-primary-foreground' : ''}
                ${idx > currentStepIndex ? 'bg-muted text-muted-foreground' : ''}
              `}>
                {idx < currentStepIndex ? <Check className="h-4 w-4" /> : step.number}
              </div>
              {idx < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Step 1: Connection */}
        {currentStep === 'connection' && (
          <div className="space-y-4">
            <Alert>
              <Database className="h-4 w-4" />
              <AlertTitle>Connectez-vous à votre Supabase</AlertTitle>
              <AlertDescription>
                Entrez les informations de votre projet Supabase de destination.
                Vous trouverez ces informations dans Settings → API de votre dashboard Supabase.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL du projet Supabase</Label>
                <Input
                  placeholder="https://xxxxx.supabase.co"
                  value={state.destination.destSupabaseUrl}
                  onChange={(e) => dispatch({ 
                    type: "UPDATE_DESTINATION", 
                    payload: { destSupabaseUrl: e.target.value } 
                  })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Service Role Key (secret)</Label>
                <Input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={state.destination.destSupabaseKey}
                  onChange={(e) => dispatch({ 
                    type: "UPDATE_DESTINATION", 
                    payload: { destSupabaseKey: e.target.value } 
                  })}
                />
                <p className="text-xs text-muted-foreground">
                  ⚠️ Gardez cette clé secrète. Elle donne un accès complet à votre base de données.
                </p>
              </div>
              
              {connectionError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{connectionError}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={testConnection} 
                disabled={isTestingConnection}
                className="w-full"
              >
                {isTestingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Tester la connexion
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Schema */}
        {currentStep === 'schema' && (
          <div className="space-y-4">
            <Alert className="border-warning/50 bg-warning/5">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertTitle>Action manuelle requise</AlertTitle>
              <AlertDescription>
                <p className="mb-2">
                  Cette étape nécessite d'exécuter le script SQL dans votre dashboard Supabase.
                  C'est la seule façon de créer les tables avec leurs politiques de sécurité.
                </p>
              </AlertDescription>
            </Alert>

            {missingTables.length > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Tables à créer ({missingTables.length}):</p>
                <div className="flex flex-wrap gap-1">
                  {missingTables.slice(0, 10).map(table => (
                    <Badge key={table} variant="outline" className="text-xs">
                      {table}
                    </Badge>
                  ))}
                  {missingTables.length > 10 && (
                    <Badge variant="secondary" className="text-xs">
                      +{missingTables.length - 10} autres
                    </Badge>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex gap-2">
                <Button 
                  onClick={() => copyToClipboard(migrationSql)} 
                  variant="outline"
                  className="flex-1"
                  disabled={!migrationSql}
                >
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? "Copié !" : "Copier le SQL"}
                </Button>
                <Button 
                  onClick={downloadSql} 
                  variant="outline"
                  disabled={!migrationSql}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Télécharger
                </Button>
              </div>
              
              {sqlEditorUrl && (
                <Button 
                  onClick={() => window.open(sqlEditorUrl, '_blank')} 
                  variant="secondary"
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ouvrir l'éditeur SQL Supabase
                </Button>
              )}
              
              <Separator />
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => setCurrentStep('connection')} 
                  variant="ghost"
                >
                  Retour
                </Button>
                <Button 
                  onClick={verifySchema} 
                  disabled={isVerifying}
                  className="flex-1"
                >
                  {isVerifying ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  J'ai exécuté le SQL, vérifier
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Verification (auto-redirects) */}
        {currentStep === 'verification' && (
          <div className="space-y-4 text-center py-8">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium">Vérification du schéma...</p>
          </div>
        )}

        {/* Step 4: Import */}
        {currentStep === 'import' && (
          <div className="space-y-4">
            <Alert className="border-success/50 bg-success/5">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertTitle>Schéma prêt !</AlertTitle>
              <AlertDescription>
                Toutes les tables existent dans votre Supabase. 
                Vous pouvez maintenant importer les données.
              </AlertDescription>
            </Alert>

            {isImporting ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Import en cours...</span>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
                
                <ScrollArea className="h-48 border rounded-lg p-3">
                  {importProgress.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 text-sm">
                      <span className="font-mono">{item.table}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{item.totalRows} lignes</span>
                        {item.success ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : item.error ? (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">
                    Cette action va copier toutes les données de la source vers votre Supabase.
                  </p>
                  <ul className="text-sm space-y-1">
                    <li>• Les données existantes ne seront pas écrasées (upsert)</li>
                    <li>• Les utilisateurs devront recréer leurs comptes</li>
                    <li>• Les fichiers Storage ne sont pas migrés</li>
                  </ul>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => setCurrentStep('schema')} 
                    variant="ghost"
                  >
                    Retour
                  </Button>
                  <Button 
                    onClick={startImport} 
                    className="flex-1"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Lancer l'import des données
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Complete */}
        {currentStep === 'complete' && (
          <div className="space-y-4 text-center py-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold">Migration terminée !</h3>
              <p className="text-muted-foreground mt-1">
                Vos données ont été migrées vers votre Supabase.
              </p>
            </div>

            <Alert>
              <FileText className="h-4 w-4" />
              <AlertTitle>Prochaines étapes</AlertTitle>
              <AlertDescription className="text-left">
                <ol className="list-decimal list-inside space-y-1 mt-2">
                  <li>Configurez les secrets de vos Edge Functions</li>
                  <li>Testez l'authentification sur votre nouvelle instance</li>
                  <li>Mettez à jour les variables d'environnement de votre app</li>
                </ol>
              </AlertDescription>
            </Alert>

            <Button onClick={() => setCurrentStep('connection')} variant="outline">
              Faire une nouvelle migration
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
