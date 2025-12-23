import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Sparkles, 
  CreditCard, 
  FolderOpen,
  Loader2,
  CheckCircle2,
  FileCode,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LargeProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectId?: string;
  totalFiles: number;
  maxFilesAllowed: number;
  files: Map<string, string>;
  onPartialClean: (selectedPaths: string[]) => void;
  onPaymentComplete: () => void;
}

interface Quote {
  id: string;
  excessFiles: number;
  baseTokenCost: number;
  supplementAmount: number;
  supplementFormatted: string;
}

export function LargeProjectModal({
  open,
  onOpenChange,
  projectName,
  projectId,
  totalFiles,
  maxFilesAllowed,
  files,
  onPartialClean,
  onPaymentComplete,
}: LargeProjectModalProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set(['src']));
  const [mode, setMode] = useState<'choice' | 'partial'>('choice');

  // Extract unique root folders from files
  const folders = Array.from(new Set(
    Array.from(files.keys())
      .map(path => path.split('/')[0])
      .filter(Boolean)
  )).sort();

  const selectedFilesCount = Array.from(files.keys()).filter(path => 
    Array.from(selectedFolders).some(folder => path.startsWith(folder + '/') || path === folder)
  ).length;

  const handleCalculateQuote = async () => {
    setIsCalculating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée');
        return;
      }

      const filesArray = Array.from(files.entries()).map(([path, content]) => ({ path, content }));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-liberation-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            projectName,
            projectId,
            totalFiles,
            maxFilesAllowed,
            filesData: filesArray,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur de calcul');
      }

      const data = await response.json();
      setQuote(data.quote);

      if (data.paymentUrl) {
        // Open Stripe checkout in new tab
        window.open(data.paymentUrl, '_blank');
        toast.info('Fenêtre de paiement ouverte', {
          description: 'Complétez le paiement pour débloquer la libération complète.',
        });
      }
    } catch (error) {
      console.error('Error calculating quote:', error);
      toast.error('Erreur de calcul', {
        description: error instanceof Error ? error.message : 'Erreur inconnue',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handlePartialClean = () => {
    const selectedPaths = Array.from(selectedFolders);
    onPartialClean(selectedPaths);
    onOpenChange(false);
  };

  const toggleFolder = (folder: string) => {
    setSelectedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) {
        next.delete(folder);
      } else {
        next.add(folder);
      }
      return next;
    });
  };

  const excessFiles = totalFiles - maxFilesAllowed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-gradient-to-br from-background to-muted/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            Projet de Grande Envergure Détecté
          </DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">{projectName}</span> contient{' '}
            <Badge variant="secondary" className="mx-1">{totalFiles} fichiers</Badge>
            (limite standard: {maxFilesAllowed})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {mode === 'choice' ? (
            <>
              {/* Volume Supplement Info */}
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <Zap className="h-4 w-4 text-amber-500" />
                <AlertDescription>
                  <span className="font-medium">+{excessFiles} fichiers</span> dépassent le quota inclus.
                  Un supplément de volume s'applique pour couvrir les coûts IA additionnels.
                </AlertDescription>
              </Alert>

              {/* Quote Display */}
              {quote && (
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Supplément calculé:</span>
                    <span className="text-2xl font-bold text-primary">{quote.supplementFormatted}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Basé sur {quote.excessFiles} fichiers excédentaires • Coût IA: ${(quote.baseTokenCost / 100).toFixed(2)} • Marge Inopay: 2.5x
                  </p>
                </div>
              )}

              {/* Option A: Partial Cleaning */}
              <div 
                className="p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-all"
                onClick={() => setMode('partial')}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold flex items-center gap-2">
                      Option A: Nettoyer Partiellement
                      <Badge variant="outline">Gratuit</Badge>
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sélectionnez uniquement les dossiers essentiels (ex: /src) pour rester dans la limite.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option B: Full Liberation */}
              <div 
                className="p-4 rounded-lg border border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 cursor-pointer transition-all hover:border-primary"
                onClick={handleCalculateQuote}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold flex items-center gap-2">
                      Option B: Libération Complète
                      {quote && <Badge className="bg-primary">{quote.supplementFormatted}</Badge>}
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Débloquez le nettoyage complet des {totalFiles} fichiers avec un supplément volume.
                    </p>
                  </div>
                  {isCalculating && <Loader2 className="h-5 w-5 animate-spin" />}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Partial Mode - Folder Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Sélectionnez les dossiers à nettoyer:</h4>
                  <Badge variant={selectedFilesCount <= maxFilesAllowed ? 'default' : 'destructive'}>
                    {selectedFilesCount} / {maxFilesAllowed} fichiers
                  </Badge>
                </div>

                <ScrollArea className="h-48 rounded-lg border p-3">
                  <div className="space-y-2">
                    {folders.map(folder => {
                      const folderFileCount = Array.from(files.keys()).filter(
                        path => path.startsWith(folder + '/') || path === folder
                      ).length;
                      
                      return (
                        <div 
                          key={folder}
                          className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50"
                        >
                          <Checkbox 
                            checked={selectedFolders.has(folder)}
                            onCheckedChange={() => toggleFolder(folder)}
                          />
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 font-mono text-sm">{folder}/</span>
                          <Badge variant="outline" className="text-xs">
                            {folderFileCount} fichiers
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {selectedFilesCount > maxFilesAllowed && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Sélection trop grande. Désélectionnez des dossiers pour rester sous {maxFilesAllowed} fichiers.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setMode('choice')} className="flex-1">
                  Retour
                </Button>
                <Button 
                  onClick={handlePartialClean}
                  disabled={selectedFilesCount > maxFilesAllowed || selectedFilesCount === 0}
                  className="flex-1"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Nettoyer {selectedFilesCount} fichiers
                </Button>
              </div>
            </>
          )}
        </div>

        {mode === 'choice' && (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Notre philosophie: "Oui, moyennant un coût juste" - Jamais de refus.
        </p>
      </DialogContent>
    </Dialog>
  );
}
