import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Trash2, Loader2, Archive, Calendar, FileArchive, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ArchiveFile {
  id: string;
  name: string;
  created_at: string;
  size: number;
  path: string;
}

interface ProjectAnalysis {
  id: string;
  project_name: string;
  file_name: string;
  portability_score: number;
  status: string;
  created_at: string;
}

const History = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [archives, setArchives] = useState<ArchiveFile[]>([]);
  const [projects, setProjects] = useState<ProjectAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    setLoading(true);

    // Fetch archives from storage
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from('cleaned-archives')
      .list(user.id, {
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (storageError) {
      console.error('Error fetching archives:', storageError);
    } else {
      const archiveList: ArchiveFile[] = (storageFiles || [])
        .filter(file => file.name.endsWith('.zip'))
        .map(file => ({
          id: file.id || file.name,
          name: file.name,
          created_at: file.created_at || new Date().toISOString(),
          size: file.metadata?.size || 0,
          path: `${user.id}/${file.name}`
        }));
      setArchives(archiveList);
    }

    // Fetch project analyses
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects_analysis')
      .select('id, project_name, file_name, portability_score, status, created_at')
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
    } else {
      setProjects(projectsData || []);
    }

    setLoading(false);
  };

  const handleDownload = async (archive: ArchiveFile) => {
    setDownloading(archive.id);

    try {
      const { data, error } = await supabase.storage
        .from('cleaned-archives')
        .createSignedUrl(archive.path, 3600);

      if (error) {
        throw error;
      }

      // Open download in new tab
      window.open(data.signedUrl, '_blank');

      toast({
        title: "Téléchargement lancé",
        description: `L'archive ${archive.name} est en cours de téléchargement`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le lien de téléchargement",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (archive: ArchiveFile) => {
    setDeleting(archive.id);

    try {
      const { error } = await supabase.storage
        .from('cleaned-archives')
        .remove([archive.path]);

      if (error) {
        throw error;
      }

      setArchives(prev => prev.filter(a => a.id !== archive.id));

      toast({
        title: "Archive supprimée",
        description: `L'archive ${archive.name} a été supprimée`,
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'archive",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return 'N/A';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'cleaned':
        return <Badge className="bg-success/20 text-success border-success/30">Exporté</Badge>;
      case 'analyzed':
        return <Badge className="bg-primary/20 text-primary border-primary/30">Analysé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <Archive className="h-8 w-8 text-primary" />
                Historique des exports
              </h1>
              <p className="text-muted-foreground">
                Retrouvez et téléchargez vos projets nettoyés
              </p>
            </div>
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-8">
              {/* Archives disponibles */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileArchive className="h-5 w-5 text-primary" />
                    Archives téléchargeables
                  </CardTitle>
                  <CardDescription>
                    {archives.length} archive{archives.length > 1 ? 's' : ''} disponible{archives.length > 1 ? 's' : ''}
                    {archives.length > 0 && ' • Les archives expirent après 24h'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {archives.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileArchive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Aucune archive disponible</p>
                      <p className="text-sm mt-1">Les archives sont automatiquement supprimées après 24h</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nom du fichier</TableHead>
                          <TableHead>Date de création</TableHead>
                          <TableHead>Taille</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {archives.map((archive) => (
                          <TableRow key={archive.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <FileArchive className="h-4 w-4 text-muted-foreground" />
                                {archive.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {formatDate(archive.created_at)}
                              </div>
                            </TableCell>
                            <TableCell>{formatFileSize(archive.size)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleDownload(archive)}
                                  disabled={downloading === archive.id}
                                >
                                  {downloading === archive.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="h-4 w-4" />
                                  )}
                                  <span className="ml-1">Télécharger</span>
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-destructive hover:text-destructive"
                                      disabled={deleting === archive.id}
                                    >
                                      {deleting === archive.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Supprimer l'archive ?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Cette action est irréversible. L'archive "{archive.name}" sera définitivement supprimée.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDelete(archive)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Supprimer
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Historique des analyses */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Historique des analyses
                  </CardTitle>
                  <CardDescription>
                    {projects.length} projet{projects.length > 1 ? 's' : ''} analysé{projects.length > 1 ? 's' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {projects.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Aucun projet analysé</p>
                      <Button className="mt-4" onClick={() => navigate('/dashboard')}>
                        Analyser un projet
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Projet</TableHead>
                          <TableHead>Fichier source</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects.map((project) => (
                          <TableRow key={project.id}>
                            <TableCell className="font-medium">{project.project_name}</TableCell>
                            <TableCell className="text-muted-foreground">{project.file_name}</TableCell>
                            <TableCell>
                              <span className={`font-semibold ${getScoreColor(project.portability_score)}`}>
                                {project.portability_score}/100
                              </span>
                            </TableCell>
                            <TableCell>{getStatusBadge(project.status)}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(project.created_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default History;
