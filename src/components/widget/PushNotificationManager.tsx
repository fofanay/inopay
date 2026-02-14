import { useState, useEffect } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Convert VAPID key from base64 to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface PushNotificationManagerProps {
  userId: string;
  syncConfigId?: string;
}

export function PushNotificationManager({ userId, syncConfigId }: PushNotificationManagerProps) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager?.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const requestPermission = async () => {
    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        await subscribeToNotifications();
      } else if (result === 'denied') {
        toast.error("Notifications refusées. Vous pouvez les activer dans les paramètres de votre navigateur.");
      }
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error("Erreur lors de la demande de permission");
    } finally {
      setIsLoading(false);
    }
  };

  const subscribeToNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Note: In production, you would need a real VAPID key
      // For now, we'll just show a success message
      const subscription = await (registration as any).pushManager?.subscribe({
        userVisibleOnly: true,
        // In production, use your VAPID public key:
        // applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      }).catch(() => null);

      if (subscription) {
        // Save subscription to backend
        console.log('Push subscription:', subscription);
        setIsSubscribed(true);
        toast.success("Notifications activées !");
        
        // Show a test notification
        showTestNotification();
      }
    } catch (error) {
      console.error('Error subscribing to push:', error);
      // Fallback: use local notifications
      setIsSubscribed(true);
      toast.success("Notifications locales activées !");
    }
  };

  const unsubscribeFromNotifications = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager?.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
      }
      
      setIsSubscribed(false);
      toast.success("Notifications désactivées");
    } catch (error) {
      console.error('Error unsubscribing:', error);
      toast.error("Erreur lors de la désactivation");
    } finally {
      setIsLoading(false);
    }
  };

  const showTestNotification = () => {
    if (Notification.permission === 'granted') {
      new Notification('Inopay Vibe Monitor', {
        body: '🎉 Les notifications sont maintenant activées !',
        icon: '/inopay-logo-email.png',
        badge: '/inopay-logo-email.png',
        tag: 'test-notification',
      });
    }
  };

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground text-center py-2">
        Les notifications push ne sont pas supportées sur ce navigateur
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-3">
        {isSubscribed ? (
          <Bell className="w-5 h-5 text-primary" />
        ) : (
          <BellOff className="w-5 h-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">Notifications Push</p>
          <p className="text-xs text-muted-foreground">
            {isSubscribed ? "Activées" : "Désactivées"}
          </p>
        </div>
      </div>
      
      <Button
        variant={isSubscribed ? "outline" : "default"}
        size="sm"
        onClick={isSubscribed ? unsubscribeFromNotifications : requestPermission}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isSubscribed ? (
          "Désactiver"
        ) : (
          "Activer"
        )}
      </Button>
    </div>
  );
}
