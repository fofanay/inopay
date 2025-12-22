import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CoolifyOrphansCleanupButtonProps {
  serverId: string;
  onCleanupComplete?: () => void;
}

export function CoolifyOrphansCleanupButton({ 
  serverId, 
  onCleanupComplete 
}: CoolifyOrphansCleanupButtonProps) {
  const [loading, setLoading] = useState(false);
  const [deleteFailedDeployments, setDeleteFailedDeployments] = useState(true);

  const handleCleanup = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Non authentifié");
      }

      const response = await supabase.functions.invoke("cleanup-coolify-orphans", {
        body: {
          server_id: serverId,
          delete_failed_deployments: deleteFailedDeployments
        }
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const result = response.data;
      
      if (result.summary.projects_deleted > 0 || result.summary.failed_deployment_records_deleted > 0) {
        toast.success(
          `Nettoyage terminé: ${result.summary.projects_deleted} projet(s) Coolify et ${result.summary.failed_deployment_records_deleted} enregistrement(s) supprimés`
        );
      } else {
        toast.info("Aucun projet orphelin trouvé");
      }

      onCleanupComplete?.();
    } catch (error) {
      console.error("Cleanup error:", error);
      toast.error(error instanceof Error ? error.message : "Erreur lors du nettoyage");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Nettoyer orphelins
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Nettoyer les projets orphelins</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Cette action va supprimer de Coolify tous les projets qui ne correspondent pas 
              à un déploiement actif dans votre historique.
            </p>
            <p className="text-destructive">
              ⚠️ Cette action est irréversible. Les projets supprimés ne pourront pas être récupérés.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="flex items-center space-x-2 py-4">
          <Checkbox 
            id="delete-failed" 
            checked={deleteFailedDeployments}
            onCheckedChange={(checked) => setDeleteFailedDeployments(checked === true)}
          />
          <Label htmlFor="delete-failed" className="text-sm">
            Supprimer aussi les enregistrements de déploiements échoués
          </Label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleCleanup}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirmer le nettoyage
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
