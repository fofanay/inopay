import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SecretsCleanupButtonProps {
  deploymentId: string;
  serverId: string;
  secretsCleaned: boolean;
  deployedUrl?: string | null;
  onCleanupComplete?: () => void;
  compact?: boolean;
}

export function SecretsCleanupButton({
  deploymentId,
  serverId,
  secretsCleaned,
  deployedUrl,
  onCleanupComplete,
  compact = false
}: SecretsCleanupButtonProps) {
  const [cleaning, setCleaning] = useState(false);

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-secrets', {
        body: {
          server_id: serverId,
          deployment_id: deploymentId,
          verify_health: true,
          force: false
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Secrets nettoyés avec succès', {
          description: 'Votre déploiement est maintenant Zero-Knowledge'
        });
        onCleanupComplete?.();
      } else if (data.reason === 'health_check_failed' || data.reason === 'health_check_error') {
        toast.warning('Nettoyage reporté', {
          description: 'Le site ne répond pas correctement. Réessayez plus tard.'
        });
      } else if (data.already_cleaned) {
        toast.info('Secrets déjà nettoyés', {
          description: 'Ce déploiement est déjà Zero-Knowledge'
        });
      }
    } catch (error: any) {
      console.error('Cleanup error:', error);
      toast.error('Erreur lors du nettoyage', {
        description: error.message
      });
    } finally {
      setCleaning(false);
    }
  };

  if (secretsCleaned) {
    return (
      <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1">
        <ShieldCheck className="h-3 w-3" />
        {!compact && 'Zero-Knowledge'}
      </Badge>
    );
  }

  return (
    <Button
      variant="outline"
      size={compact ? "sm" : "default"}
      onClick={handleCleanup}
      disabled={cleaning}
      className="gap-2 text-warning border-warning/30 hover:bg-warning/10"
    >
      {cleaning ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {!compact && 'Nettoyage...'}
        </>
      ) : (
        <>
          <Trash2 className="h-4 w-4" />
          {!compact && 'Nettoyer les secrets'}
        </>
      )}
    </Button>
  );
}
