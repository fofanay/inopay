import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface OfflineState {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
}

export function useOfflineDetection() {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    wasOffline: false,
    lastOnlineAt: null
  });

  const handleOnline = useCallback(() => {
    setState(prev => ({
      isOnline: true,
      wasOffline: prev.wasOffline || !prev.isOnline,
      lastOnlineAt: new Date()
    }));
    
    toast.success("Connexion rétablie", {
      description: "Vous êtes de nouveau en ligne",
      duration: 3000
    });
  }, []);

  const handleOffline = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOnline: false,
      wasOffline: true
    }));
    
    toast.warning("Mode hors ligne", {
      description: "Certaines fonctionnalités peuvent être limitées",
      duration: 5000
    });
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return state;
}
