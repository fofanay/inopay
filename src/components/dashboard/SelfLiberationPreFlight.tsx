import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw,
  Shield,
  Github,
  Server,
  Database,
  Cloud,
  CreditCard,
  AlertTriangle,
  ChevronRight,
  Rocket
} from 'lucide-react';

interface PreFlightCheck {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'checking' | 'success' | 'error' | 'warning';
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface SelfLiberationPreFlightProps {
  onAllPassed: () => void;
  onNavigate?: (tab: string) => void;
}

export function SelfLiberationPreFlight({ onAllPassed, onNavigate }: SelfLiberationPreFlightProps) {
  const [checks, setChecks] = useState<PreFlightCheck[]>([
    { id: 'auth', label: 'Authentification', icon: <Shield className="h-4 w-4" />, status: 'pending' },
    { id: 'subscription', label: 'Abonnement Pro', icon: <CreditCard className="h-4 w-4" />, status: 'pending' },
    { id: 'github-source', label: 'GitHub Source Token', icon: <Github className="h-4 w-4" />, status: 'pending' },
    { id: 'github-dest', label: 'GitHub Destination', icon: <Github className="h-4 w-4" />, status: 'pending' },
    { id: 'server', label: 'Serveur VPS', icon: <Server className="h-4 w-4" />, status: 'pending' },
    { id: 'coolify', label: 'Coolify Token', icon: <Cloud className="h-4 w-4" />, status: 'pending' },
    { id: 'supabase-sh', label: 'Supabase Self-Hosted', icon: <Database className="h-4 w-4" />, status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [allPassed, setAllPassed] = useState(false);

  useEffect(() => {
    runPreFlight();
  }, []);

  const updateCheck = (id: string, updates: Partial<PreFlightCheck>) => {
    setChecks(prev => prev.map(check => 
      check.id === id ? { ...check, ...updates } : check
    ));
  };

  const runPreFlight = async () => {
    setIsRunning(true);
    setAllPassed(false);

    // Reset all checks
    setChecks(prev => prev.map(c => ({ ...c, status: 'checking', message: undefined, action: undefined })));

    try {
      // 1. Check authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        updateCheck('auth', { 
          status: 'error', 
          message: 'Non connecté',
          action: { label: 'Se connecter', onClick: () => window.location.href = '/auth' }
        });
        setIsRunning(false);
        return;
      }
      updateCheck('auth', { status: 'success', message: session.user.email });

      // 2. Check subscription
      const { data: subData } = await supabase
        .from('subscriptions')
        .select('plan_type, status')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const isPro = subData?.plan_type === 'pro' && subData?.status === 'active';
      updateCheck('subscription', isPro 
        ? { status: 'success', message: 'Plan Pro actif' }
        : { 
            status: 'error', 
            message: 'Abonnement Pro requis',
            action: { label: 'Voir les offres', onClick: () => window.location.href = '/pricing' }
          }
      );

      // 3. Check GitHub source token
      const { data: settings } = await supabase
        .from('user_settings')
        .select('github_token, github_destination_token, github_destination_username')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (settings?.github_token) {
        const response = await fetch('https://api.github.com/user', {
          headers: { 'Authorization': `Bearer ${settings.github_token}` }
        });
        if (response.ok) {
          const userData = await response.json();
          updateCheck('github-source', { status: 'success', message: `@${userData.login}` });
        } else {
          updateCheck('github-source', { 
            status: 'error', 
            message: 'Token invalide ou expiré'
          });
        }
      } else {
        updateCheck('github-source', { 
          status: 'error', 
          message: 'Non configuré - Allez dans Paramètres'
        });
      }

      // 4. Check GitHub destination
      if (settings?.github_destination_token && settings?.github_destination_username) {
        const response = await fetch('https://api.github.com/user', {
          headers: { 'Authorization': `Bearer ${settings.github_destination_token}` }
        });
        if (response.ok) {
          updateCheck('github-dest', { 
            status: 'success', 
            message: `→ ${settings.github_destination_username}` 
          });
        } else {
          updateCheck('github-dest', { 
            status: 'error', 
            message: 'Token destination invalide'
          });
        }
      } else if (settings?.github_destination_username) {
        // Using source token for destination
        updateCheck('github-dest', { 
          status: 'warning', 
          message: `→ ${settings.github_destination_username} (via source token)` 
        });
      } else {
        updateCheck('github-dest', { 
          status: 'error', 
          message: 'Username destination non configuré'
        });
      }

      // 5. Check VPS server
      const { data: serverData } = await supabase
        .from('user_servers')
        .select('id, name, ip_address, status, coolify_token, coolify_url, jwt_secret, anon_key')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (serverData) {
        updateCheck('server', { 
          status: serverData.status === 'ready' ? 'success' : 'warning', 
          message: `${serverData.name} (${serverData.ip_address})` 
        });

        // 6. Check Coolify token
        if (serverData.coolify_token && serverData.coolify_url) {
          updateCheck('coolify', { status: 'success', message: serverData.coolify_url });
        } else if (serverData.coolify_url) {
          updateCheck('coolify', { 
            status: 'error', 
            message: 'Token Coolify non configuré'
          });
        } else {
          updateCheck('coolify', { 
            status: 'error', 
            message: 'Coolify non configuré'
          });
        }

        // 7. Check Supabase SH credentials
        if (serverData.jwt_secret && serverData.anon_key) {
          updateCheck('supabase-sh', { status: 'success', message: 'Credentials configurés' });
        } else {
          updateCheck('supabase-sh', { 
            status: 'warning', 
            message: 'Credentials Supabase SH non configurés (optionnel)'
          });
        }
      } else {
        updateCheck('server', { 
          status: 'error', 
          message: 'Aucun serveur configuré - Allez dans Ma Flotte'
        });
        updateCheck('coolify', { status: 'error', message: 'Serveur requis' });
        updateCheck('supabase-sh', { status: 'error', message: 'Serveur requis' });
      }

    } catch (error) {
      console.error('PreFlight error:', error);
      toast.error('Erreur lors de la vérification');
    } finally {
      setIsRunning(false);

      // Check if all passed
      setChecks(prev => {
        const critical = prev.filter(c => !['supabase-sh'].includes(c.id));
        const passed = critical.every(c => c.status === 'success' || c.status === 'warning');
        setAllPassed(passed);
        if (passed) {
          onAllPassed();
        }
        return prev;
      });
    }
  };

  const passedCount = checks.filter(c => c.status === 'success' || c.status === 'warning').length;
  const progress = (passedCount / checks.length) * 100;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Vérification Pré-Libération</CardTitle>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={runPreFlight}
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
        <CardDescription>
          Vérifiez que tous les prérequis sont configurés avant de lancer la libération
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progression</span>
            <span className="font-medium">{passedCount}/{checks.length}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Checks list */}
        <div className="space-y-2">
          {checks.map(check => (
            <div 
              key={check.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                check.status === 'success' 
                  ? 'bg-primary/5 border-primary/20' 
                  : check.status === 'error' 
                    ? 'bg-destructive/5 border-destructive/20'
                    : check.status === 'warning'
                      ? 'bg-warning/5 border-warning/20'
                      : 'bg-muted/50 border-muted'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`${
                  check.status === 'success' ? 'text-primary' :
                  check.status === 'error' ? 'text-destructive' :
                  check.status === 'warning' ? 'text-warning' :
                  'text-muted-foreground'
                }`}>
                  {check.status === 'checking' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : check.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : check.status === 'error' ? (
                    <XCircle className="h-4 w-4" />
                  ) : check.status === 'warning' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    check.icon
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{check.label}</p>
                  {check.message && (
                    <p className="text-xs text-muted-foreground">{check.message}</p>
                  )}
                </div>
              </div>
              {check.action && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={check.action.onClick}
                >
                  {check.action.label}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Status badge */}
        {!isRunning && (
          <div className="flex justify-center pt-2">
            {allPassed ? (
              <Badge className="bg-primary/20 text-primary border-primary/30 px-4 py-2">
                <Rocket className="h-4 w-4 mr-2" />
                Prêt pour la libération
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 px-4 py-2">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Configuration incomplète
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
