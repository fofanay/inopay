import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Download,
  FileArchive,
  Loader2,
  History,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Calendar,
  FileCode,
  Github,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import JSZip from 'jszip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LiberationRecord {
  id: string;
  project_name: string;
  created_at: string;
  status: string;
  portability_score_after: number | null;
  portability_score_before: number | null;
  files_uploaded: number | null;
  archive_path: string | null;
  archive_generated_at: string | null;
  deployed_url: string | null;
  cleaned_dependencies: string[] | null;
}

export function LiberationHistory() {
  const [liberations, setLiberations] = useState<LiberationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [pushingToGitHubId, setPushingToGitHubId] = useState<string | null>(null);
  const [gitHubProgress, setGitHubProgress] = useState(0);
  const [gitHubMessage, setGitHubMessage] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  useEffect(() => {
    loadLiberations();
  }, []);

  const handleDeleteOne = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('deployment_history')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setLiberations(prev => prev.filter(l => l.id !== id));
      toast.success('Libération supprimée');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase
        .from('deployment_history')
        .delete()
        .eq('user_id', session.user.id);
      
      if (error) throw error;
      
      setLiberations([]);
      toast.success('Historique vidé', {
        description: 'Vous pouvez relancer une nouvelle libération'
      });
    } catch (error) {
      console.error('Clear all error:', error);
      toast.error('Erreur lors de la suppression');
    } finally {
      setClearingAll(false);
    }
  };

  const loadLiberations = async () => {
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('deployment_history')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLiberations(data || []);
    } catch (error) {
      console.error('Error loading liberations:', error);
      toast.error('Erreur lors du chargement de l\'historique');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (liberation: LiberationRecord) => {
    if (!liberation.archive_path) {
      toast.error('Archive non disponible', {
        description: 'Le fichier ZIP n\'est plus disponible au téléchargement'
      });
      return;
    }

    setDownloadingId(liberation.id);
    try {
      const { data, error } = await supabase.storage
        .from('cleaned-archives')
        .download(liberation.archive_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${liberation.project_name}_liberated.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Téléchargement démarré');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Erreur de téléchargement', {
        description: 'Impossible de télécharger l\'archive'
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePushToGitHub = async (liberation: LiberationRecord) => {
    if (!liberation.archive_path) {
      toast.error('Archive non disponible');
      return;
    }

    setPushingToGitHubId(liberation.id);
    setGitHubProgress(0);
    setGitHubMessage('Chargement de la configuration...');

    try {
      // 1. Load GitHub config
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non connecté');

      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('github_destination_token, github_destination_username, default_repo_private')
        .eq('user_id', session.user.id)
        .single();

      if (settingsError || !settings?.github_destination_token) {
        toast.error('GitHub non configuré', {
          description: 'Configurez votre destination GitHub dans les paramètres.'
        });
        return;
      }

      setGitHubProgress(10);
      setGitHubMessage('Téléchargement de l\'archive...');

      // 2. Download the archive
      const { data: archiveData, error: downloadError } = await supabase.storage
        .from('cleaned-archives')
        .download(liberation.archive_path);

      if (downloadError) throw downloadError;

      setGitHubProgress(30);
      setGitHubMessage('Extraction des fichiers...');

      // 3. Extract and filter files
      const zip = await JSZip.loadAsync(archiveData);
      const files: Array<{ path: string; content: string }> = [];
      
      // Patterns to include (source files only)
      const includePatterns = [
        /^src\//,
        /^public\//,
        /^package\.json$/,
        /^tsconfig\.json$/,
        /^vite\.config\.ts$/,
        /^tailwind\.config\.ts$/,
        /^postcss\.config\./,
        /^\.env\.example$/,
        /^index\.html$/,
        /^README\.md$/,
        /^\.gitignore$/,
        /^components\.json$/,
        /^eslint\.config\./,
        // Handle frontend/ prefix in pack structure
        /^frontend\/src\//,
        /^frontend\/public\//,
        /^frontend\/package\.json$/,
        /^frontend\/tsconfig\.json$/,
        /^frontend\/vite\.config\.ts$/,
        /^frontend\/tailwind\.config\.ts$/,
        /^frontend\/postcss\.config\./,
        /^frontend\/index\.html$/,
        /^frontend\/components\.json$/,
      ];

      // Patterns to exclude
      const excludePatterns = [
        /node_modules\//,
        /\.git\//,
        /dist\//,
        /build\//,
        /_original\//,
        /DEPLOY_GUIDE/,
        /services\//,
        /scripts\//,
        /docs\//,
        /database\//,
        /backend\//,
        /docker-compose/,
        /Dockerfile/,
        /\.zip$/,
      ];

      for (const [relativePath, file] of Object.entries(zip.files)) {
        if (file.dir) continue;
        
        // Normalize path (remove leading folder if pack structure)
        let normalizedPath = relativePath;
        
        // Remove pack root folder if present (e.g., "project-liberated/frontend/src/...")
        const parts = relativePath.split('/');
        if (parts.length > 1 && parts[0].includes('-liberated')) {
          normalizedPath = parts.slice(1).join('/');
        }
        
        // Check exclusions
        if (excludePatterns.some(pattern => pattern.test(normalizedPath))) continue;
        
        // Check inclusions
        if (!includePatterns.some(pattern => pattern.test(normalizedPath))) continue;
        
        // Remove frontend/ prefix for final path
        let finalPath = normalizedPath;
        if (normalizedPath.startsWith('frontend/')) {
          finalPath = normalizedPath.replace(/^frontend\//, '');
        }
        
        const content = await file.async('string');
        files.push({ path: finalPath, content });
      }

      if (files.length === 0) {
        throw new Error('Aucun fichier source trouvé dans l\'archive');
      }

      setGitHubProgress(50);
      setGitHubMessage(`Envoi de ${files.length} fichiers vers GitHub...`);

      // 4. Push to GitHub
      const repoName = `${liberation.project_name.toLowerCase().replace(/\s+/g, '-')}-liberated`;
      
      const { data: result, error: pushError } = await supabase.functions.invoke('export-to-github', {
        body: {
          repoName,
          description: `${liberation.project_name} - Libéré par Inopay`,
          files,
          isPrivate: settings.default_repo_private ?? true,
          githubToken: settings.github_destination_token,
          username: settings.github_destination_username
        }
      });

      if (pushError) throw pushError;
      if (result?.error) throw new Error(result.error);

      setGitHubProgress(100);
      setGitHubMessage('Terminé !');

      toast.success('Poussé vers GitHub !', {
        description: `${files.length} fichiers envoyés`,
        action: {
          label: 'Voir',
          onClick: () => window.open(result.repoUrl, '_blank')
        }
      });

    } catch (error: any) {
      console.error('GitHub push error:', error);
      toast.error('Erreur GitHub', {
        description: error.message || 'Impossible de pousser vers GitHub'
      });
    } finally {
      setPushingToGitHubId(null);
      setGitHubProgress(0);
      setGitHubMessage('');
    }
  };

  const getSovereigntyBadge = (score: number | null) => {
    if (score === null) return null;
    
    if (score >= 90) {
      return (
        <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">
          <Shield className="h-3 w-3 mr-1" />
          {score}% Souverain
        </Badge>
      );
    } else if (score >= 70) {
      return (
        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
          <Shield className="h-3 w-3 mr-1" />
          {score}% Partiel
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-destructive/20 text-destructive border-destructive/30">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {score}% À améliorer
        </Badge>
      );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Succès
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Échec
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
        </Card>
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-28" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/20">
                <History className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Historique des libérations</CardTitle>
                <CardDescription className="text-base">
                  {liberations.length} libération{liberations.length > 1 ? 's' : ''} effectuée{liberations.length > 1 ? 's' : ''}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadLiberations}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Actualiser
              </Button>
              {liberations.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Tout supprimer
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer tout l'historique ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irréversible. Tous les enregistrements de libération seront supprimés.
                        Les archives téléchargées ne seront plus accessibles.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAll}
                        disabled={clearingAll}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {clearingAll ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Supprimer tout
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Empty state */}
      {liberations.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-12 pb-12 text-center">
            <FileArchive className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune libération</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Vous n'avez pas encore libéré de projet. 
              Commencez par importer un projet dans l'onglet Libération.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Liberation list */}
      <div className="space-y-4">
        {liberations.map((liberation) => (
          <Card key={liberation.id} className="hover:border-primary/30 transition-colors">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Icon & Project info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                    <FileCode className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{liberation.project_name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(liberation.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                    </div>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(liberation.status)}
                  {getSovereigntyBadge(liberation.portability_score_after)}
                  {liberation.files_uploaded && (
                    <Badge variant="outline">
                      <FileCode className="h-3 w-3 mr-1" />
                      {liberation.files_uploaded} fichiers
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {liberation.archive_path && (
                    <>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleDownload(liberation)}
                        disabled={downloadingId === liberation.id}
                      >
                        {downloadingId === liberation.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Télécharger
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePushToGitHub(liberation)}
                        disabled={pushingToGitHubId === liberation.id}
                      >
                        {pushingToGitHubId === liberation.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Github className="h-4 w-4 mr-2" />
                        )}
                        GitHub
                      </Button>
                    </>
                  )}
                  {liberation.deployed_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(liberation.deployed_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Voir
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOne(liberation.id)}
                    disabled={deletingId === liberation.id}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    {deletingId === liberation.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                {/* GitHub push progress */}
                {pushingToGitHubId === liberation.id && (
                  <div className="w-full mt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{gitHubMessage}</span>
                      <span className="font-medium">{gitHubProgress}%</span>
                    </div>
                    <Progress value={gitHubProgress} className="h-2" />
                  </div>
                )}
              </div>

              {/* Cleaned dependencies */}
              {liberation.cleaned_dependencies && liberation.cleaned_dependencies.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Dépendances nettoyées:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {liberation.cleaned_dependencies.slice(0, 10).map((dep, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {dep}
                      </Badge>
                    ))}
                    {liberation.cleaned_dependencies.length > 10 && (
                      <Badge variant="secondary" className="text-xs">
                        +{liberation.cleaned_dependencies.length - 10} autres
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Score improvement */}
              {liberation.portability_score_before !== null && liberation.portability_score_after !== null && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Score de souveraineté:</span>
                    <span className="text-destructive line-through">{liberation.portability_score_before}%</span>
                    <span className="text-primary">→</span>
                    <span className="text-emerald-600 font-semibold">{liberation.portability_score_after}%</span>
                    <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30 ml-2">
                      +{liberation.portability_score_after - liberation.portability_score_before}%
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
