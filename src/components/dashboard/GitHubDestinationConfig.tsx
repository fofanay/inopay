import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Github, 
  CheckCircle2, 
  Loader2, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  Lock,
  Unlock
} from 'lucide-react';

interface GitHubDestinationConfigProps {
  onConfigured?: () => void;
}

export function GitHubDestinationConfig({ onConfigured }: GitHubDestinationConfigProps) {
  const [destinationToken, setDestinationToken] = useState('');
  const [destinationUsername, setDestinationUsername] = useState('');
  const [isPrivateRepo, setIsPrivateRepo] = useState(true);
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    username?: string;
    scopes?: string[];
  } | null>(null);

  useEffect(() => {
    loadExistingConfig();
  }, []);

  const loadExistingConfig = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsLoading(false);
        return;
      }

      const { data: settings } = await supabase
        .from('user_settings')
        .select('github_destination_token, github_destination_username, default_repo_private')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (settings) {
        if (settings.github_destination_token) {
          setDestinationToken(settings.github_destination_token);
          setIsConfigured(true);
        }
        if (settings.github_destination_username) {
          setDestinationUsername(settings.github_destination_username);
        }
        if (settings.default_repo_private !== null) {
          setIsPrivateRepo(settings.default_repo_private);
        }
      }
    } catch (error) {
      console.error('Error loading GitHub config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const validateToken = async (token: string) => {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        return { valid: false };
      }

      const userData = await response.json();
      const scopesHeader = response.headers.get('X-OAuth-Scopes') || '';
      const scopes = scopesHeader.split(',').map(s => s.trim()).filter(Boolean);
      
      return {
        valid: true,
        username: userData.login,
        scopes
      };
    } catch {
      return { valid: false };
    }
  };

  const cleanUsername = (input: string): string => {
    if (!input) return '';
    let cleaned = input.replace(/^https?:\/\/github\.com\//i, '');
    cleaned = cleaned.split('/')[0];
    return cleaned.trim();
  };

  const handleSave = async () => {
    if (!destinationToken.trim()) {
      toast.error('Token requis', { description: 'Veuillez entrer un token GitHub' });
      return;
    }

    if (!destinationUsername.trim()) {
      toast.error('Username requis', { description: 'Veuillez entrer le username destination' });
      return;
    }

    setIsSaving(true);

    try {
      // Validate token
      const validation = await validateToken(destinationToken.trim());
      setValidationResult(validation);

      if (!validation.valid) {
        toast.error('Token invalide', { description: 'Impossible de valider le token GitHub' });
        setIsSaving(false);
        return;
      }

      // Check required scopes
      const requiredScopes = ['repo'];
      const hasRepoScope = validation.scopes?.some(s => 
        s === 'repo' || s.startsWith('public_repo')
      );

      if (!hasRepoScope) {
        toast.error('Permissions insuffisantes', { 
          description: 'Le token doit avoir le scope "repo"' 
        });
        setIsSaving(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Session expirée');
        setIsSaving(false);
        return;
      }

      const cleanedUsername = cleanUsername(destinationUsername);

      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: session.user.id,
          github_destination_token: destinationToken.trim(),
          github_destination_username: cleanedUsername,
          default_repo_private: isPrivateRepo,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setDestinationUsername(cleanedUsername);
      setIsConfigured(true);
      toast.success('Configuration sauvegardée', {
        description: `Destination: ${cleanedUsername} (${isPrivateRepo ? 'privé' : 'public'})`
      });
      onConfigured?.();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Erreur de sauvegarde');
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

  return (
    <Card className={isConfigured ? "border-primary/20 bg-primary/5" : "border-warning/30 bg-warning/5"}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Github className={isConfigured ? "h-5 w-5 text-primary" : "h-5 w-5 text-warning"} />
          <CardTitle className="text-lg">GitHub Destination</CardTitle>
          {isConfigured && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Configuré
            </Badge>
          )}
        </div>
        <CardDescription>
          Configurez où le code nettoyé sera poussé
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Token input */}
        <div className="space-y-2">
          <Label htmlFor="dest-token">Token GitHub (avec scope "repo")</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="dest-token"
                type={showToken ? 'text' : 'password'}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={destinationToken}
                onChange={(e) => setDestinationToken(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Username input */}
        <div className="space-y-2">
          <Label htmlFor="dest-username">Username/Organisation destination</Label>
          <Input
            id="dest-username"
            placeholder="inovaqfofy"
            value={destinationUsername}
            onChange={(e) => setDestinationUsername(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Le repo sera créé sous github.com/{destinationUsername || 'username'}/[nom-projet]
          </p>
        </div>

        {/* Private repo toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            {isPrivateRepo ? (
              <Lock className="h-4 w-4 text-primary" />
            ) : (
              <Unlock className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {isPrivateRepo ? 'Repo privé' : 'Repo public'}
            </span>
          </div>
          <Switch
            checked={isPrivateRepo}
            onCheckedChange={setIsPrivateRepo}
          />
        </div>

        {validationResult && !validationResult.valid && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertTriangle className="h-4 w-4" />
            Token invalide ou expiré
          </div>
        )}

        {/* Save button */}
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !destinationToken.trim() || !destinationUsername.trim()}
          className="w-full"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validation...
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isConfigured ? 'Mettre à jour' : 'Configurer'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
