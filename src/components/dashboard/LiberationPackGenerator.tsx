import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Package, 
  Download, 
  Server, 
  Database, 
  FileCode, 
  CheckCircle2, 
  Loader2, 
  FolderArchive,
  FileText,
  Settings,
  Rocket
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface LiberationPackGeneratorProps {
  projectName: string;
  cleanedFiles: Record<string, string>;
  edgeFunctions?: Array<{ name: string; content: string }>;
  sqlSchema?: string;
  onComplete?: (downloadUrl: string) => void;
}

export function LiberationPackGenerator({
  projectName,
  cleanedFiles,
  edgeFunctions = [],
  sqlSchema,
  onComplete
}: LiberationPackGeneratorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [includeBackend, setIncludeBackend] = useState(edgeFunctions.length > 0);
  const [includeDatabase, setIncludeDatabase] = useState(!!sqlSchema);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProgress(10);

    try {
      setProgress(30);
      
      const { data, error } = await supabase.functions.invoke('generate-liberation-pack', {
        body: {
          projectName,
          cleanedFiles,
          edgeFunctions: includeBackend ? edgeFunctions : [],
          sqlSchema: includeDatabase ? sqlSchema : null,
          includeBackend,
          includeDatabase
        }
      });

      setProgress(80);

      if (error) throw error;

      if (data?.downloadUrl) {
        setDownloadUrl(data.downloadUrl);
        setProgress(100);
        
        toast({
          title: "Pack généré avec succès !",
          description: `${data.summary?.frontendFiles || 0} fichiers frontend, ${data.summary?.backendRoutes || 0} routes backend`,
        });

        onComplete?.(data.downloadUrl);
      }
    } catch (error) {
      console.error('Error generating pack:', error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de générer le pack",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const frontendFilesCount = Object.keys(cleanedFiles).filter(p => !p.startsWith('supabase/')).length;
  const backendFilesCount = edgeFunctions.length;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Liberation Pack Autonome
              <Badge variant="secondary" className="ml-2">Nouveau</Badge>
            </CardTitle>
            <CardDescription>
              Téléchargez un package complet prêt à déployer sur n'importe quel VPS
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* What's included */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <FileCode className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Frontend</span>
              <Badge variant="outline">{frontendFilesCount} fichiers</Badge>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Code React nettoyé</li>
              <li>• Dockerfile optimisé</li>
              <li>• Configuration Nginx/Caddy</li>
            </ul>
          </div>
          
          <div className={`p-4 rounded-lg border ${includeBackend ? 'bg-card' : 'bg-muted/50 opacity-60'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-green-500" />
                <span className="font-medium">Backend API</span>
                {backendFilesCount > 0 && (
                  <Badge variant="outline">{backendFilesCount} routes</Badge>
                )}
              </div>
              <Switch 
                checked={includeBackend} 
                onCheckedChange={setIncludeBackend}
                disabled={edgeFunctions.length === 0}
              />
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Edge Functions → Express.js</li>
              <li>• Middleware d'authentification</li>
              <li>• Health checks intégrés</li>
            </ul>
          </div>
          
          <div className={`p-4 rounded-lg border ${includeDatabase ? 'bg-card' : 'bg-muted/50 opacity-60'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Base de données</span>
              </div>
              <Switch 
                checked={includeDatabase} 
                onCheckedChange={setIncludeDatabase}
                disabled={!sqlSchema}
              />
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Schéma SQL complet</li>
              <li>• Politiques RLS</li>
              <li>• Scripts de migration</li>
            </ul>
          </div>
          
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <Settings className="h-5 w-5 text-orange-500" />
              <span className="font-medium">Configuration</span>
            </div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• docker-compose.yml complet</li>
              <li>• .env.example pré-rempli</li>
              <li>• Script d'installation automatique</li>
            </ul>
          </div>
        </div>

        {/* Guide included */}
        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-medium">Guide interactif inclus</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Un fichier <code className="px-1.5 py-0.5 bg-muted rounded">DEPLOY_GUIDE.html</code> avec checklist interactive, 
            commandes copiables et dépannage intégré. Fonctionne hors-ligne !
          </p>
        </div>

        {/* Progress */}
        {isGenerating && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Génération en cours...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Download button */}
        {downloadUrl ? (
          <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <h4 className="font-semibold text-lg">Pack prêt !</h4>
              <p className="text-sm text-muted-foreground">
                Votre Liberation Pack est prêt à être téléchargé
              </p>
            </div>
            <Button onClick={handleDownload} size="lg" className="gap-2">
              <Download className="h-5 w-5" />
              Télécharger le pack
            </Button>
          </div>
        ) : (
          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            size="lg"
            className="w-full gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Génération en cours...
              </>
            ) : (
              <>
                <FolderArchive className="h-5 w-5" />
                Générer le Liberation Pack
              </>
            )}
          </Button>
        )}

        {/* Info */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm">
          <Rocket className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-muted-foreground">
              Le pack contient tout le nécessaire pour déployer votre application sur n'importe quel 
              serveur VPS (Hetzner, OVH, DigitalOcean, etc.) sans dépendance propriétaire.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
