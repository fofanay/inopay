import { useState } from "react";
import { 
  Wand2, 
  Loader2, 
  CheckCircle2, 
  Download, 
  ArrowRight,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CostlyServiceDetection, generateDockerComposeAlternatives, generateEnvTemplate } from "@/lib/costOptimization";

interface AutoMigrationButtonProps {
  services: CostlyServiceDetection[];
  extractedFiles: Map<string, string>;
  projectName: string;
  onMigrationComplete?: (migratedFiles: Map<string, string>) => void;
  disabled?: boolean;
}

interface MigrationStatus {
  total: number;
  completed: number;
  currentFile: string;
  migratedFiles: Map<string, string>;
}

const AutoMigrationButton = ({
  services,
  extractedFiles,
  projectName,
  onMigrationComplete,
  disabled
}: AutoMigrationButtonProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSavings = services.reduce((sum, s) => sum + s.estimatedMonthlyCost, 0);

  // Find files that need migration based on detected services
  const getFilesToMigrate = () => {
    const filesToMigrate: string[] = [];
    
    services.forEach(detection => {
      detection.detectedIn.forEach(loc => {
        if (extractedFiles.has(loc.file) && !filesToMigrate.includes(loc.file)) {
          filesToMigrate.push(loc.file);
        }
      });
    });

    return filesToMigrate;
  };

  const handleStartMigration = async () => {
    setIsMigrating(true);
    setError(null);

    const filesToMigrate = getFilesToMigrate();
    const migratedFiles = new Map<string, string>();

    setMigrationStatus({
      total: filesToMigrate.length,
      completed: 0,
      currentFile: "",
      migratedFiles
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("Non authentifié");
      }

      for (let i = 0; i < filesToMigrate.length; i++) {
        const filePath = filesToMigrate[i];
        const content = extractedFiles.get(filePath);

        if (!content) continue;

        setMigrationStatus(prev => prev ? {
          ...prev,
          currentFile: filePath,
          completed: i
        } : null);

        // Call clean-code edge function with cost optimization
        const { data, error: funcError } = await supabase.functions.invoke("clean-code", {
          body: { 
            code: content, 
            fileName: filePath,
            optimizeCosts: true // Flag for cost optimization
          },
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`
          }
        });

        if (funcError) {
          console.error(`Error migrating ${filePath}:`, funcError);
          // Continue with other files
          migratedFiles.set(filePath, content);
        } else if (data?.cleanedCode) {
          migratedFiles.set(filePath, data.cleanedCode);
        } else {
          migratedFiles.set(filePath, content);
        }

        setMigrationStatus(prev => prev ? {
          ...prev,
          completed: i + 1,
          migratedFiles: new Map(migratedFiles)
        } : null);
      }

      // Add docker-compose and env template
      setMigrationStatus(prev => prev ? {
        ...prev,
        currentFile: "Génération des fichiers de configuration..."
      } : null);

      // Generate docker-compose
      const dockerCompose = generateDockerComposeAlternatives(services);
      migratedFiles.set("docker-compose.alternatives.yml", dockerCompose);

      // Generate .env template
      const envTemplate = generateEnvTemplate(services);
      migratedFiles.set(".env.alternatives.example", envTemplate);

      setMigrationStatus(prev => prev ? {
        ...prev,
        completed: prev.total,
        migratedFiles: new Map(migratedFiles)
      } : null);

      toast({
        title: "Migration terminée !",
        description: `${migratedFiles.size} fichiers migrés vers Open Source`,
      });

      onMigrationComplete?.(migratedFiles);

    } catch (err) {
      console.error("Migration error:", err);
      setError(err instanceof Error ? err.message : "Erreur lors de la migration");
      toast({
        title: "Erreur de migration",
        description: err instanceof Error ? err.message : "Une erreur est survenue",
        variant: "destructive"
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const handleDownloadMigrated = () => {
    if (!migrationStatus?.migratedFiles) return;

    // Create a simple text file with all migrated content
    let content = `# Fichiers migrés par Inopay\n# Projet: ${projectName}\n# Économies estimées: ${totalSavings}$/mois\n\n`;

    migrationStatus.migratedFiles.forEach((fileContent, filePath) => {
      content += `\n${"=".repeat(60)}\n`;
      content += `# ${filePath}\n`;
      content += `${"=".repeat(60)}\n\n`;
      content += fileContent;
      content += "\n";
    });

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName}-migrated-opensource.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progress = migrationStatus 
    ? (migrationStatus.completed / migrationStatus.total) * 100 
    : 0;

  const filesToMigrate = getFilesToMigrate();

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        disabled={disabled || services.length === 0}
        className="gap-2"
        size="lg"
      >
        <Wand2 className="h-5 w-5" />
        Auto-Migration Open Source
        <ArrowRight className="h-4 w-4" />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Auto-Migration vers Open Source
            </DialogTitle>
            <DialogDescription>
              Notre IA va réécrire automatiquement votre code pour utiliser des alternatives 
              Open Source auto-hébergées au lieu des services cloud payants.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Services Summary */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Services à migrer</span>
                <Badge className="bg-success/10 text-success border-success/20">
                  -{totalSavings}$/mois
                </Badge>
              </div>
              <div className="space-y-2">
                {services.map(s => (
                  <div key={s.service.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {s.service.name} → {s.service.alternative.name}
                    </span>
                    <span className="text-success">-{s.estimatedMonthlyCost}$</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Files to migrate */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border">
              <p className="text-sm font-medium mb-2">Fichiers à traiter</p>
              <p className="text-sm text-muted-foreground">
                {filesToMigrate.length} fichier(s) seront analysés et migrés
              </p>
            </div>

            {/* Migration Progress */}
            {isMigrating && migrationStatus && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-medium">
                    {migrationStatus.completed}/{migrationStatus.total}
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground truncate">
                  {migrationStatus.currentFile}
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-destructive">Erreur</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
            )}

            {/* Success */}
            {migrationStatus && migrationStatus.completed === migrationStatus.total && !isMigrating && (
              <div className="p-4 rounded-xl bg-success/10 border border-success/20 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-success">Migration terminée !</p>
                  <p className="text-sm text-muted-foreground">
                    {migrationStatus.migratedFiles.size} fichiers ont été migrés vers Open Source.
                    Économie estimée: {totalSavings}$/mois
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {!migrationStatus || migrationStatus.completed < migrationStatus.total ? (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsOpen(false)}
                    disabled={isMigrating}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={handleStartMigration}
                    disabled={isMigrating || filesToMigrate.length === 0}
                    className="flex-1 gap-2"
                  >
                    {isMigrating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Migration en cours...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Démarrer la migration
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsOpen(false)}
                    className="flex-1"
                  >
                    Fermer
                  </Button>
                  <Button 
                    onClick={handleDownloadMigrated}
                    className="flex-1 gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Télécharger
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AutoMigrationButton;
