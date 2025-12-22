import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface DeploymentChange {
  id: string;
  project_name: string;
  status: string;
  deployed_url: string | null;
  error_message: string | null;
}

const STATUS_MESSAGES: Record<string, { title: string; variant: 'default' | 'destructive' }> = {
  pending: { title: 'Déploiement en attente', variant: 'default' },
  deploying: { title: 'Déploiement en cours...', variant: 'default' },
  building: { title: 'Construction en cours...', variant: 'default' },
  deployed: { title: 'Déploiement réussi !', variant: 'default' },
  failed: { title: 'Échec du déploiement', variant: 'destructive' },
  error: { title: 'Erreur de déploiement', variant: 'destructive' },
};

export function useDeploymentNotifications() {
  const { toast } = useToast();

  const handleDeploymentUpdate = useCallback((payload: { new: DeploymentChange; old: DeploymentChange }) => {
    const newData = payload.new;
    const oldData = payload.old;

    // Only notify if status actually changed
    if (newData.status === oldData.status) return;

    const statusInfo = STATUS_MESSAGES[newData.status] || { 
      title: `Statut: ${newData.status}`, 
      variant: 'default' as const 
    };

    let description = `Projet: ${newData.project_name}`;
    
    if (newData.status === 'deployed' && newData.deployed_url) {
      description = `${newData.project_name} est maintenant en ligne !`;
    } else if (newData.status === 'failed' && newData.error_message) {
      description = newData.error_message.substring(0, 100);
    }

    toast({
      title: statusInfo.title,
      description,
      variant: statusInfo.variant,
      duration: newData.status === 'deployed' ? 10000 : 5000,
    });

    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
      new Notification(statusInfo.title, {
        body: description,
        icon: '/favicon.ico',
      });
    }
  }, [toast]);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Subscribe to realtime updates
    const channel = supabase
      .channel('deployment-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'server_deployments',
        },
        (payload) => {
          console.log('Deployment status changed:', payload);
          handleDeploymentUpdate(payload as any);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleDeploymentUpdate]);
}
