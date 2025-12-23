import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Rocket, 
  Sparkles, 
  CreditCard, 
  FolderOpen,
  Loader2,
  CheckCircle2,
  FileCode,
  Zap,
  Shield,
  Server,
  ArrowLeft,
  Check,
  Star
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

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

// Utility to round up to professional pricing
const formatProfessionalPrice = (cents: number): string => {
  const dollars = cents / 100;
  // Round up to .49 or .99 for professional appearance
  const baseAmount = Math.ceil(dollars);
  if (baseAmount <= 10) {
    return `${baseAmount - 0.01}`;
  } else if (baseAmount <= 25) {
    return `${Math.ceil(dollars / 5) * 5 - 0.01}`;
  } else {
    return `${Math.ceil(dollars / 10) * 10 - 0.01}`;
  }
};

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
  const [mode, setMode] = useState<'choice' | 'partial' | 'processing'>('choice');
  const [processingStep, setProcessingStep] = useState(0);

  // Extract unique root folders from files
  const folders = Array.from(new Set(
    Array.from(files.keys())
      .map(path => path.split('/')[0])
      .filter(Boolean)
  )).sort();

  const selectedFilesCount = Array.from(files.keys()).filter(path => 
    Array.from(selectedFolders).some(folder => path.startsWith(folder + '/') || path === folder)
  ).length;

  // Calculate quote on modal open
  useEffect(() => {
    if (open && !quote) {
      calculateQuoteOnly();
    }
  }, [open]);

  const calculateQuoteOnly = async () => {
    setIsCalculating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const excessFiles = totalFiles - maxFilesAllowed;
      // Average token cost per file (estimated at ~500 tokens per file, $0.003/1K tokens)
      const avgCostPerFile = 0.15; // cents
      const baseCost = excessFiles * avgCostPerFile;
      const marginMultiplier = 2.5;
      const supplement = Math.ceil(baseCost * marginMultiplier);
      
      // Round up to professional pricing
      const professionalPrice = formatProfessionalPrice(supplement);
      
      setQuote({
        id: crypto.randomUUID(),
        excessFiles,
        baseTokenCost: Math.round(baseCost),
        supplementAmount: parseFloat(professionalPrice) * 100,
        supplementFormatted: `$${professionalPrice}`,
      });
    } catch (error) {
      console.error('Error calculating quote:', error);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleFullLiberation = async () => {
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
        toast.success('Fenêtre de paiement ouverte', {
          description: 'Complétez le paiement pour débloquer la libération complète.',
        });
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Erreur de paiement', {
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

  // Simulated post-payment processing animation
  const processingSteps = [
    'Paiement confirmé',
    'Allocation des ressources de nettoyage étendue',
    'Initialisation du moteur IA haute capacité',
    'Lancement du pipeline de libération',
  ];

  useEffect(() => {
    if (mode === 'processing') {
      const interval = setInterval(() => {
        setProcessingStep(prev => {
          if (prev >= processingSteps.length - 1) {
            clearInterval(interval);
            setTimeout(() => {
              onPaymentComplete();
              onOpenChange(false);
            }, 1000);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [mode]);

  const excessFiles = totalFiles - maxFilesAllowed;

  const valuePropositions = [
    { icon: FileCode, text: 'Nettoyage profond de chaque ligne de code' },
    { icon: Shield, text: 'Garantie zéro dépendance propriétaire sur l\'ensemble du volume' },
    { icon: Server, text: 'Optimisation de l\'infrastructure VPS pour les larges dépôts' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white overflow-hidden">
        <AnimatePresence mode="wait">
          {mode === 'processing' ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="py-12 flex flex-col items-center justify-center space-y-8"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="relative"
              >
                <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
                <div className="relative p-6 bg-gradient-to-br from-primary to-primary/70 rounded-full">
                  <Rocket className="h-12 w-12 text-white" />
                </div>
              </motion.div>

              <div className="space-y-4 w-full max-w-sm">
                {processingSteps.map((step, index) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ 
                      opacity: index <= processingStep ? 1 : 0.3,
                      x: 0 
                    }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className={`p-1 rounded-full transition-colors ${
                      index <= processingStep ? 'bg-green-500' : 'bg-slate-600'
                    }`}>
                      {index < processingStep ? (
                        <Check className="h-4 w-4 text-white" />
                      ) : index === processingStep ? (
                        <Loader2 className="h-4 w-4 text-white animate-spin" />
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                    </div>
                    <span className={`text-sm ${
                      index <= processingStep ? 'text-white' : 'text-slate-500'
                    }`}>
                      {step}...
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : mode === 'partial' ? (
            <motion.div
              key="partial"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <DialogHeader>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setMode('choice')}
                  className="absolute left-4 top-4 text-slate-400 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Retour
                </Button>
                <DialogTitle className="text-xl pt-8 text-white">
                  Sélection manuelle des dossiers
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Fichiers sélectionnés:</span>
                  <Badge 
                    variant={selectedFilesCount <= maxFilesAllowed ? 'default' : 'destructive'}
                    className={selectedFilesCount <= maxFilesAllowed ? 'bg-green-500/20 text-green-400 border-green-500/30' : ''}
                  >
                    {selectedFilesCount} / {maxFilesAllowed}
                  </Badge>
                </div>

                <ScrollArea className="h-56 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <div className="space-y-1">
                    {folders.map(folder => {
                      const folderFileCount = Array.from(files.keys()).filter(
                        path => path.startsWith(folder + '/') || path === folder
                      ).length;
                      
                      return (
                        <div 
                          key={folder}
                          className="flex items-center space-x-3 p-2 rounded hover:bg-slate-700/50 cursor-pointer transition-colors"
                          onClick={() => toggleFolder(folder)}
                        >
                          <Checkbox 
                            checked={selectedFolders.has(folder)}
                            onCheckedChange={() => toggleFolder(folder)}
                            className="border-slate-500 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                          />
                          <FolderOpen className="h-4 w-4 text-amber-400" />
                          <span className="flex-1 font-mono text-sm text-slate-200">{folder}/</span>
                          <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                            {folderFileCount}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {selectedFilesCount > maxFilesAllowed && (
                  <Alert variant="destructive" className="bg-red-500/10 border-red-500/30">
                    <AlertDescription className="text-red-400">
                      Désélectionnez des dossiers pour rester sous {maxFilesAllowed} fichiers.
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  onClick={handlePartialClean}
                  disabled={selectedFilesCount > maxFilesAllowed || selectedFilesCount === 0}
                  className="w-full bg-slate-700 hover:bg-slate-600"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Nettoyer {selectedFilesCount} fichiers sélectionnés
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="choice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {/* Header */}
              <DialogHeader className="text-center space-y-3">
                <div className="mx-auto p-3 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl w-fit">
                  <Rocket className="h-10 w-10 text-amber-400" />
                </div>
                <DialogTitle className="text-2xl font-bold text-white">
                  🚀 Votre projet voit grand !
                </DialogTitle>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Nous avons détecté <span className="text-white font-semibold">{totalFiles} fichiers</span> et 
                  une structure complexe. Pour garantir un nettoyage 100% souverain et minutieux par notre 
                  moteur d'IA, une puissance de calcul supplémentaire est requise.
                </p>
              </DialogHeader>

              {/* Value Propositions */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 space-y-3">
                {valuePropositions.map((prop, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="p-1.5 bg-green-500/20 rounded-lg">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                    <span className="text-sm text-slate-300">{prop.text}</span>
                  </div>
                ))}
              </div>

              {/* Options */}
              <div className="space-y-3">
                {/* Option A - Primary: Full Liberation */}
                <button
                  onClick={handleFullLiberation}
                  disabled={isCalculating}
                  className="relative w-full group"
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-amber-500 to-primary rounded-xl opacity-60 group-hover:opacity-100 blur transition-opacity" />
                  <div className="relative flex items-center justify-between p-4 bg-slate-900 rounded-xl border border-primary/30">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/20 rounded-lg">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">Libérer le projet complet</span>
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Recommandé
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Nettoyage intégral des {totalFiles} fichiers
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCalculating ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <>
                          <span className="text-2xl font-bold text-primary">
                            {quote?.supplementFormatted || '...'}
                          </span>
                          <CreditCard className="h-5 w-5 text-slate-400" />
                        </>
                      )}
                    </div>
                  </div>
                </button>

                {/* Option B - Secondary: Partial Cleaning */}
                <button
                  onClick={() => setMode('partial')}
                  className="w-full text-left p-4 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/30 hover:bg-slate-800/50 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-700/50 rounded-lg group-hover:bg-slate-700">
                      <FolderOpen className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <span className="font-medium text-slate-300 group-hover:text-white transition-colors">
                        Sélectionner manuellement les dossiers à nettoyer
                      </span>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Restez dans la limite de {maxFilesAllowed} fichiers
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Footer */}
              <p className="text-xs text-slate-500 text-center">
                Notre philosophie : « Oui, moyennant un coût juste » — Jamais de refus.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
