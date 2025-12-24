import { useState } from "react";
import { useTranslation } from "react-i18next";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Loader2, Sparkles, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CodeCleanerProps {
  fileName: string;
  originalCode: string;
  isOpen: boolean;
  onClose: () => void;
}

const CodeCleaner = ({ fileName, originalCode, isOpen, onClose }: CodeCleanerProps) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [cleaning, setCleaning] = useState(false);
  const [cleanedCode, setCleanedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleClean = async () => {
    setCleaning(true);
    setCleanedCode(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Non connecté",
          description: "Veuillez vous connecter pour utiliser cette fonctionnalité",
          variant: "destructive",
        });
        setCleaning(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clean-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code: originalCode, fileName }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors du nettoyage");
      }

      setCleanedCode(data.cleanedCode);
      toast({
        title: "Code nettoyé",
        description: "Le code a été nettoyé avec succès",
      });
    } catch (error) {
      console.error("Clean error:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors du nettoyage du code",
        variant: "destructive",
      });
    } finally {
      setCleaning(false);
    }
  };

  const handleCopy = async () => {
    if (!cleanedCode) return;
    await navigator.clipboard.writeText(cleanedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copié",
      description: "Le code nettoyé a été copié dans le presse-papiers",
    });
  };

  const handleDownload = () => {
    if (!cleanedCode) return;
    const blob = new Blob([cleanedCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.replace(/\.(tsx?|jsx?)$/, ".cleaned$&");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setCleanedCode(null);
    setCleaning(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Nettoyage IA - {fileName}
          </DialogTitle>
          <DialogDescription>
            L'IA va réécrire ce code pour supprimer les dépendances propriétaires
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {!cleanedCode ? (
            <Card className="flex-1 flex flex-col items-center justify-center">
              <CardContent className="text-center py-12">
                {cleaning ? (
                  <>
                    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nettoyage en cours...</h3>
                    <p className="text-muted-foreground">
                      L'IA analyse et réécrit votre code
                    </p>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Prêt à nettoyer</h3>
                    <p className="text-muted-foreground mb-6">
                      Cliquez pour générer une version autonome du code
                    </p>
                    <Button onClick={handleClean} size="lg" className="glow-sm">
                      <Sparkles className="mr-2 h-5 w-5" />
                      Générer le code autonome
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  <span className="text-sm font-medium px-3 py-1 rounded-full bg-destructive/20 text-destructive">
                    Original
                  </span>
                  <span className="text-sm font-medium px-3 py-1 rounded-full bg-success/20 text-success">
                    Nettoyé
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    {copied ? "Copié" : "Copier"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-1" />
                    Télécharger
                  </Button>
                  <Button size="sm" onClick={handleClean} disabled={cleaning}>
                    {cleaning ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-1" />
                    )}
                    Régénérer
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto rounded-lg border">
                <ReactDiffViewer
                  oldValue={originalCode}
                  newValue={cleanedCode}
                  splitView={true}
                  compareMethod={DiffMethod.WORDS}
                  leftTitle={t("codeCleaner.originalCode")}
                  rightTitle={t("codeCleaner.cleanedCode")}
                  styles={{
                    variables: {
                      dark: {
                        diffViewerBackground: "hsl(var(--background))",
                        diffViewerColor: "hsl(var(--foreground))",
                        addedBackground: "hsl(142 76% 36% / 0.2)",
                        addedColor: "hsl(var(--foreground))",
                        removedBackground: "hsl(0 84% 60% / 0.2)",
                        removedColor: "hsl(var(--foreground))",
                        wordAddedBackground: "hsl(142 76% 36% / 0.4)",
                        wordRemovedBackground: "hsl(0 84% 60% / 0.4)",
                        gutterBackground: "hsl(var(--muted))",
                        gutterColor: "hsl(var(--muted-foreground))",
                        codeFoldBackground: "hsl(var(--muted))",
                        codeFoldGutterBackground: "hsl(var(--muted))",
                        codeFoldContentColor: "hsl(var(--muted-foreground))",
                        emptyLineBackground: "hsl(var(--muted))",
                      },
                    },
                    contentText: {
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontSize: "13px",
                    },
                  }}
                  useDarkTheme={true}
                />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CodeCleaner;
