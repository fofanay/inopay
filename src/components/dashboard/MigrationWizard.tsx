import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Upload, 
  GitBranch, 
  Database, 
  Server, 
  Shield, 
  Download, 
  Rocket,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode,
  Settings,
  ChevronRight,
  Package,
  FolderArchive
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MigrationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

interface DetectedAsset {
  type: 'edge-function' | 'table' | 'rls-policy' | 'storage-bucket' | 'migration';
  name: string;
  details?: string;
}

interface MigrationOptions {
  convertEdgeFunctions: boolean;
  migrateDatabase: boolean;
  generateDockerCompose: boolean;
  extractRlsPolicies: boolean;
  includeSupabaseFolder: boolean;
}

export function MigrationWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});
  const [detectedAssets, setDetectedAssets] = useState<DetectedAsset[]>([]);
  const [options, setOptions] = useState<MigrationOptions>({
    convertEdgeFunctions: true,
    migrateDatabase: true,
    generateDockerCompose: true,
    extractRlsPolicies: true,
    includeSupabaseFolder: true,
  });
  const [conversionResult, setConversionResult] = useState<{
    routes?: { name: string; content: string }[];
    middlewares?: { name: string; content: string }[];
    dockerCompose?: string;
    downloadUrl?: string;
  } | null>(null);

  const steps: MigrationStep[] = [
    {
      id: 'upload',
      title: 'Import du projet',
      description: 'Uploadez votre ZIP ou connectez GitHub',
      status: currentStep > 0 ? 'completed' : currentStep === 0 ? 'in-progress' : 'pending',
    },
    {
      id: 'analyze',
      title: 'Analyse',
      description: 'Détection des Edge Functions, tables et RLS',
      status: currentStep > 1 ? 'completed' : currentStep === 1 ? 'in-progress' : 'pending',
    },
    {
      id: 'configure',
      title: 'Configuration',
      description: 'Options de migration',
      status: currentStep > 2 ? 'completed' : currentStep === 2 ? 'in-progress' : 'pending',
    },
    {
      id: 'convert',
      title: 'Conversion',
      description: 'Génération du backend Express',
      status: currentStep > 3 ? 'completed' : currentStep === 3 ? 'in-progress' : 'pending',
    },
    {
      id: 'export',
      title: 'Export',
      description: 'Téléchargement ou déploiement',
      status: currentStep === 4 ? 'in-progress' : 'pending',
    },
  ];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    
    try {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(file);
      const files: Record<string, string> = {};

      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (!zipEntry.dir && !path.startsWith('__MACOSX')) {
          const content = await zipEntry.async('string');
          files[path] = content;
        }
      }

      setUploadedFiles(files);
      analyzeProject(files);
      setCurrentStep(1);
    } catch (error) {
      console.error('Error reading ZIP:', error);
      toast.error('Erreur lors de la lecture du fichier ZIP');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeProject = (files: Record<string, string>) => {
    const assets: DetectedAsset[] = [];

    // Detect Edge Functions
    for (const path of Object.keys(files)) {
      const match = path.match(/supabase\/functions\/([^/]+)\/index\.ts$/);
      if (match) {
        assets.push({
          type: 'edge-function',
          name: match[1],
          details: `${files[path].length} caractères`,
        });
      }
    }

    // Detect migrations (tables and RLS)
    for (const [path, content] of Object.entries(files)) {
      if (path.includes('migrations') && path.endsWith('.sql')) {
        // Detect CREATE TABLE
        const tableMatches = content.matchAll(/CREATE\s+TABLE\s+(?:public\.)?(\w+)/gi);
        for (const match of tableMatches) {
          assets.push({
            type: 'table',
            name: match[1],
            details: 'Table SQL',
          });
        }

        // Detect CREATE POLICY
        const policyMatches = content.matchAll(/CREATE\s+POLICY\s+["']([^"']+)["']\s+ON\s+(?:public\.)?(\w+)/gi);
        for (const match of policyMatches) {
          assets.push({
            type: 'rls-policy',
            name: `${match[2]}: ${match[1]}`,
            details: 'Row Level Security',
          });
        }
      }
    }

    // Detect config.toml
    if (files['supabase/config.toml']) {
      const configMatches = files['supabase/config.toml'].matchAll(/\[functions\.([^\]]+)\]/g);
      for (const match of configMatches) {
        if (!assets.find(a => a.type === 'edge-function' && a.name === match[1])) {
          assets.push({
            type: 'edge-function',
            name: match[1],
            details: 'Référencé dans config.toml',
          });
        }
      }
    }

    setDetectedAssets(assets);
    toast.success(`Analyse terminée : ${assets.length} éléments détectés`);
  };

  const handleConversion = async () => {
    setIsConverting(true);
    setCurrentStep(3);

    try {
      // Extract edge functions
      const edgeFunctions: { name: string; content: string }[] = [];
      for (const [path, content] of Object.entries(uploadedFiles)) {
        const match = path.match(/supabase\/functions\/([^/]+)\/index\.ts$/);
        if (match) {
          edgeFunctions.push({ name: match[1], content });
        }
      }

      // Convert Edge Functions to Express
      if (options.convertEdgeFunctions && edgeFunctions.length > 0) {
        const { data: routesData, error: routesError } = await supabase.functions.invoke(
          'convert-edge-to-backend',
          { body: { edgeFunctions } }
        );

        if (routesError) throw routesError;

        setConversionResult(prev => ({
          ...prev,
          routes: routesData.routes,
          dockerCompose: routesData.dockerCompose,
        }));
      }

      // Extract RLS policies
      if (options.extractRlsPolicies) {
        const migrationFiles: Record<string, string> = {};
        for (const [path, content] of Object.entries(uploadedFiles)) {
          if (path.includes('migrations') && path.endsWith('.sql')) {
            migrationFiles[path] = content;
          }
        }

        const { data: policiesData, error: policiesError } = await supabase.functions.invoke(
          'extract-rls-policies',
          { body: { migrationFiles } }
        );

        if (policiesError) {
          console.error('RLS extraction error:', policiesError);
        } else {
          setConversionResult(prev => ({
            ...prev,
            middlewares: policiesData.middlewares,
          }));
        }
      }

      toast.success('Conversion terminée avec succès !');
      setCurrentStep(4);
    } catch (error) {
      console.error('Conversion error:', error);
      toast.error('Erreur lors de la conversion');
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = async () => {
    if (!conversionResult) return;

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      // Add backend folder
      const backend = zip.folder('backend');
      const src = backend?.folder('src');
      const routes = src?.folder('routes');
      const middleware = src?.folder('middleware');

      // Add routes
      if (conversionResult.routes) {
        for (const route of conversionResult.routes) {
          routes?.file(`${route.name}.ts`, route.content);
        }
      }

      // Add middlewares
      if (conversionResult.middlewares) {
        for (const mw of conversionResult.middlewares) {
          middleware?.file(`${mw.name}.ts`, mw.content);
        }
      }

      // Add frontend (cleaned files)
      const frontend = zip.folder('frontend');
      for (const [path, content] of Object.entries(uploadedFiles)) {
        if (!path.startsWith('supabase/')) {
          frontend?.file(path, content);
        }
      }

      // Add supabase folder if option enabled
      if (options.includeSupabaseFolder) {
        const supabaseFolder = zip.folder('supabase');
        for (const [path, content] of Object.entries(uploadedFiles)) {
          if (path.startsWith('supabase/')) {
            supabaseFolder?.file(path.replace('supabase/', ''), content);
          }
        }
      }

      // Add docker-compose
      if (conversionResult.dockerCompose) {
        zip.file('docker-compose.yml', conversionResult.dockerCompose);
      }

      // Add README
      zip.file('README.md', generateReadme());

      // Generate and download
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `projet-souverain-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Archive souveraine téléchargée !');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const generateReadme = () => {
    return `# 🔓 Projet Souverain

Ce projet a été converti par Inopay pour être 100% autonome et déployable sur n'importe quel serveur.

## 📁 Structure

\`\`\`
├── frontend/           # Application React
├── backend/            # API Express (converti depuis Edge Functions)
│   ├── src/
│   │   ├── routes/     # Routes API
│   │   └── middleware/ # Middlewares de sécurité (depuis RLS)
├── supabase/           # Configuration Supabase originale
│   ├── functions/      # Edge Functions originales
│   └── migrations/     # Migrations SQL
├── docker-compose.yml  # Stack complète
└── README.md
\`\`\`

## 🚀 Déploiement

### Option 1 : Docker Compose (recommandé)

\`\`\`bash
docker-compose up -d
\`\`\`

### Option 2 : Déploiement manuel

\`\`\`bash
# Backend
cd backend
npm install
npm run build
npm start

# Frontend
cd frontend
npm install
npm run build
# Servir dist/ avec nginx
\`\`\`

## 📊 Éléments convertis

- ${detectedAssets.filter(a => a.type === 'edge-function').length} Edge Functions → Routes Express
- ${detectedAssets.filter(a => a.type === 'rls-policy').length} RLS Policies → Middlewares
- ${detectedAssets.filter(a => a.type === 'table').length} Tables SQL

---

**Généré par Inopay** - Libérez votre code !
`;
  };

  const edgeFunctionCount = detectedAssets.filter(a => a.type === 'edge-function').length;
  const tableCount = detectedAssets.filter(a => a.type === 'table').length;
  const policyCount = detectedAssets.filter(a => a.type === 'rls-policy').length;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Migration Wizard</CardTitle>
            <CardDescription>
              Convertissez votre projet Supabase en stack autonome
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${step.status === 'completed' ? 'bg-green-500 text-white' :
                    step.status === 'in-progress' ? 'bg-primary text-primary-foreground' :
                    'bg-muted text-muted-foreground'}
                `}>
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : step.status === 'in-progress' ? (
                    <span className="text-sm font-bold">{index + 1}</span>
                  ) : (
                    <span className="text-sm">{index + 1}</span>
                  )}
                </div>
                <span className="text-xs mt-1 text-center max-w-[80px]">
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground mx-2" />
              )}
            </div>
          ))}
        </div>

        {/* Step 0: Upload */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Card className="border-dashed hover:border-primary transition-colors">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    {isAnalyzing ? (
                      <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    ) : (
                      <Upload className="h-12 w-12 text-muted-foreground" />
                    )}
                    <h3 className="mt-4 font-medium">Upload ZIP</h3>
                    <p className="text-sm text-muted-foreground">
                      Glissez ou cliquez pour uploader
                    </p>
                  </CardContent>
                </Card>
              </label>

              <Card className="border-dashed opacity-50">
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <GitBranch className="h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-4 font-medium">Connecter GitHub</h3>
                  <p className="text-sm text-muted-foreground">
                    Bientôt disponible
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 1: Analysis Results */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <FileCode className="h-5 w-5 text-blue-500" />
                    <span className="text-2xl font-bold">{edgeFunctionCount}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Edge Functions</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold">{tableCount}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Tables</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-orange-500" />
                    <span className="text-2xl font-bold">{policyCount}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">RLS Policies</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Éléments détectés</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {detectedAssets.map((asset, i) => (
                      <div key={i} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          {asset.type === 'edge-function' && <FileCode className="h-4 w-4 text-blue-500" />}
                          {asset.type === 'table' && <Database className="h-4 w-4 text-green-500" />}
                          {asset.type === 'rls-policy' && <Shield className="h-4 w-4 text-orange-500" />}
                          <span className="text-sm">{asset.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {asset.type}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Button onClick={() => setCurrentStep(2)} className="w-full">
              Continuer vers la configuration
            </Button>
          </div>
        )}

        {/* Step 2: Configuration */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Options de migration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">Convertir Edge Functions → Express</p>
                      <p className="text-xs text-muted-foreground">{edgeFunctionCount} fonctions détectées</p>
                    </div>
                  </div>
                  <Checkbox 
                    checked={options.convertEdgeFunctions}
                    onCheckedChange={(c) => setOptions({ ...options, convertEdgeFunctions: !!c })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">Extraire RLS → Middlewares</p>
                      <p className="text-xs text-muted-foreground">{policyCount} policies détectées</p>
                    </div>
                  </div>
                  <Checkbox 
                    checked={options.extractRlsPolicies}
                    onCheckedChange={(c) => setOptions({ ...options, extractRlsPolicies: !!c })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">Générer docker-compose.yml</p>
                      <p className="text-xs text-muted-foreground">Stack complète avec PostgreSQL</p>
                    </div>
                  </div>
                  <Checkbox 
                    checked={options.generateDockerCompose}
                    onCheckedChange={(c) => setOptions({ ...options, generateDockerCompose: !!c })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderArchive className="h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">Inclure dossier supabase/</p>
                      <p className="text-xs text-muted-foreground">Migrations et fonctions originales</p>
                    </div>
                  </div>
                  <Checkbox 
                    checked={options.includeSupabaseFolder}
                    onCheckedChange={(c) => setOptions({ ...options, includeSupabaseFolder: !!c })}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Retour
              </Button>
              <Button onClick={handleConversion} className="flex-1" disabled={isConverting}>
                {isConverting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Conversion en cours...
                  </>
                ) : (
                  'Lancer la conversion'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Converting */}
        {currentStep === 3 && isConverting && (
          <div className="flex flex-col items-center py-12">
            <Loader2 className="h-16 w-16 text-primary animate-spin" />
            <h3 className="mt-4 text-lg font-medium">Conversion en cours...</h3>
            <p className="text-muted-foreground">Génération du backend Express</p>
            <Progress value={65} className="w-64 mt-4" />
          </div>
        )}

        {/* Step 4: Export */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200">
                  Conversion terminée !
                </span>
              </div>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {conversionResult?.routes?.length || 0} routes Express générées, 
                {' '}{conversionResult?.middlewares?.length || 0} middlewares créés
              </p>
            </div>

            <Tabs defaultValue="preview">
              <TabsList className="w-full">
                <TabsTrigger value="preview" className="flex-1">Aperçu</TabsTrigger>
                <TabsTrigger value="routes" className="flex-1">Routes</TabsTrigger>
                <TabsTrigger value="middlewares" className="flex-1">Middlewares</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="mt-4">
                <Card>
                  <CardContent className="pt-4">
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-[300px]">
                      {conversionResult?.dockerCompose || 'Docker Compose sera généré...'}
                    </pre>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="routes" className="mt-4">
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {conversionResult?.routes?.map((route, i) => (
                      <Card key={i}>
                        <CardContent className="py-2">
                          <div className="flex items-center gap-2">
                            <FileCode className="h-4 w-4 text-blue-500" />
                            <span className="font-mono text-sm">{route.name}.ts</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="middlewares" className="mt-4">
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {conversionResult?.middlewares?.map((mw, i) => (
                      <Card key={i}>
                        <CardContent className="py-2">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-orange-500" />
                            <span className="font-mono text-sm">{mw.name}.ts</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button onClick={handleDownload} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Télécharger Archive Souveraine
              </Button>
              <Button variant="outline" className="w-full" disabled>
                <Rocket className="mr-2 h-4 w-4" />
                Déployer sur VPS (bientôt)
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
