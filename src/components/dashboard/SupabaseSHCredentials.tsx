import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Database, 
  CheckCircle2, 
  Loader2, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  Key,
  Info,
  Server
} from 'lucide-react';

interface SupabaseSHCredentialsProps {
  serverId?: string;
  onConfigured?: () => void;
}

export function SupabaseSHCredentials({ serverId, onConfigured }: SupabaseSHCredentialsProps) {
  const [jwtSecret, setJwtSecret] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [serviceRoleKey, setServiceRoleKey] = useState('');
  const [dbUrl, setDbUrl] = useState('');
  
  const [showJwtSecret, setShowJwtSecret] = useState(false);
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [showServiceRoleKey, setShowServiceRoleKey] = useState(false);
  const [showDbUrl, setShowDbUrl] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [currentServerId, setCurrentServerId] = useState<string | null>(serverId || null);

  useEffect(() => {
    loadExistingConfig();
  }, [serverId]);

  const loadExistingConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      // Get server config
      let query = supabase
        .from('user_servers')
        .select('id, jwt_secret, anon_key, service_role_key, db_url')
        .eq('user_id', session.user.id);

      if (serverId) {
        query = query.eq('id', serverId);
      }

      const { data: serverData } = await query.maybeSingle();

      if (serverData) {
        setCurrentServerId(serverData.id);
        if (serverData.jwt_secret) setJwtSecret(serverData.jwt_secret);
        if (serverData.anon_key) setAnonKey(serverData.anon_key);
        if (serverData.service_role_key) setServiceRoleKey(serverData.service_role_key);
        if (serverData.db_url) setDbUrl(serverData.db_url);
        
        // Check if configured (at least jwt_secret and anon_key)
        if (serverData.jwt_secret && serverData.anon_key) {
          setIsConfigured(true);
        }
      }
    } catch (error) {
      console.error('Error loading Supabase SH config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentServerId) {
      toast.error('Serveur non trouvé', { 
        description: 'Veuillez d\'abord configurer un serveur dans "Ma Flotte"' 
      });
      return;
    }

    if (!jwtSecret.trim() || !anonKey.trim()) {
      toast.error('Champs requis manquants', { 
        description: 'JWT Secret et Anon Key sont obligatoires' 
      });
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('user_servers')
        .update({
          jwt_secret: jwtSecret.trim(),
          anon_key: anonKey.trim(),
          service_role_key: serviceRoleKey.trim() || null,
          db_url: dbUrl.trim() || null,
          db_status: 'configured',
          updated_at: new Date().toISOString()
        })
        .eq('id', currentServerId);

      if (error) throw error;

      setIsConfigured(true);
      toast.success('Credentials Supabase SH sauvegardés', {
        description: 'Les clés sont maintenant configurées pour votre serveur'
      });
      onConfigured?.();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Erreur de sauvegarde', {
        description: error instanceof Error ? error.message : 'Erreur inconnue'
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!currentServerId) {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-warning" />
            <div>
              <p className="font-medium">Serveur non configuré</p>
              <p className="text-sm text-muted-foreground">
                Configurez d'abord un serveur dans "Ma Flotte" avant d'ajouter les credentials Supabase
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isConfigured ? "border-primary/20 bg-primary/5" : "border-warning/30 bg-warning/5"}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className={isConfigured ? "h-5 w-5 text-primary" : "h-5 w-5 text-warning"} />
          <CardTitle className="text-lg">Supabase Self-Hosted</CardTitle>
          {isConfigured && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Configuré
            </Badge>
          )}
        </div>
        <CardDescription>
          Credentials de votre instance Supabase Self-Hosted
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-1">Où trouver ces clés ?</p>
            <p className="text-sm">
              Connectez-vous en SSH à votre VPS et consultez le fichier <code className="bg-muted px-1 rounded">.env</code> 
              {" "}dans le dossier de votre installation Supabase (généralement <code className="bg-muted px-1 rounded">/opt/supabase</code>).
            </p>
          </AlertDescription>
        </Alert>

        {/* JWT Secret */}
        <div className="space-y-2">
          <Label htmlFor="jwt-secret" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            JWT Secret <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="jwt-secret"
              type={showJwtSecret ? 'text' : 'password'}
              placeholder="super-secret-jwt-token-with-at-least-32-characters"
              value={jwtSecret}
              onChange={(e) => setJwtSecret(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowJwtSecret(!showJwtSecret)}
            >
              {showJwtSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Anon Key */}
        <div className="space-y-2">
          <Label htmlFor="anon-key" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Anon Key <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="anon-key"
              type={showAnonKey ? 'text' : 'password'}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowAnonKey(!showAnonKey)}
            >
              {showAnonKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Service Role Key */}
        <div className="space-y-2">
          <Label htmlFor="service-role-key" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Service Role Key (optionnel)
          </Label>
          <div className="relative">
            <Input
              id="service-role-key"
              type={showServiceRoleKey ? 'text' : 'password'}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={serviceRoleKey}
              onChange={(e) => setServiceRoleKey(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowServiceRoleKey(!showServiceRoleKey)}
            >
              {showServiceRoleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Database URL */}
        <div className="space-y-2">
          <Label htmlFor="db-url" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Database URL (optionnel)
          </Label>
          <div className="relative">
            <Input
              id="db-url"
              type={showDbUrl ? 'text' : 'password'}
              placeholder="postgresql://postgres:password@localhost:5432/postgres"
              value={dbUrl}
              onChange={(e) => setDbUrl(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowDbUrl(!showDbUrl)}
            >
              {showDbUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Save button */}
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !jwtSecret.trim() || !anonKey.trim()}
          className="w-full"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sauvegarde...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isConfigured ? 'Mettre à jour' : 'Sauvegarder'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
