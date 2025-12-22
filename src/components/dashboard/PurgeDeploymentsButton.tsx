import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PurgeDeploymentsButtonProps {
  serverId: string;
  onPurgeComplete?: () => void;
}

export function PurgeDeploymentsButton({ serverId, onPurgeComplete }: PurgeDeploymentsButtonProps) {
  const [isPurging, setIsPurging] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handlePurge = async () => {
    setIsPurging(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Vous devez être connecté");
        return;
      }

      const { data, error } = await supabase.functions.invoke('purge-server-deployments', {
        body: { server_id: serverId }
      });

      if (error) throw error;

      toast.success(`${data.deleted} déploiements supprimés`, {
        description: data.coolify_deleted > 0 
          ? `${data.coolify_deleted} applications Coolify supprimées`
          : undefined
      });

      setIsOpen(false);
      onPurgeComplete?.();
    } catch (error) {
      console.error("Purge error:", error);
      toast.error("Erreur lors de la purge");
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-1">
          <Trash2 className="h-4 w-4" />
          Purger tout
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Purger tous les déploiements ?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>Cette action va :</p>
            <ul className="list-disc list-inside text-sm">
              <li>Supprimer <strong>tous</strong> les déploiements de ce serveur</li>
              <li>Supprimer les applications correspondantes dans Coolify</li>
              <li>Supprimer tous les projets orphelins dans Coolify</li>
            </ul>
            <p className="text-destructive font-medium mt-2">
              Cette action est irréversible !
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPurging}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={handlePurge}
            disabled={isPurging}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPurging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Purge en cours...
              </>
            ) : (
              "Purger tout"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
