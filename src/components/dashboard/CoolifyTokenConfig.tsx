import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CoolifyGuide } from './CoolifyGuide';
import { 
  Key, 
  Loader2, 
  CheckCircle2, 
  ExternalLink, 
  Copy,
  AlertCircle,
  Info
} from 'lucide-react';

interface CoolifyTokenConfigProps {
  serverId: string;
  serverIp: string;
  coolifyUrl: string | null;
  currentToken: string | null;
  onSuccess: () => void;
}

export function CoolifyTokenConfig({ 
  serverId, 
  serverIp, 
  coolifyUrl, 
  currentToken,
  onSuccess 
}: CoolifyTokenConfigProps) {
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const coolifyDashboardUrl = coolifyUrl || `http://${serverIp}:8000`;

  const handleValidateAndSave = async () => {
    if (!token.trim()) {
      toast({
        title: "Token requis",
        description: "Veuillez entrer votre token API Coolify.",
        variant: "destructive"
      });
      return;
    }

    setIsValidating(true);
    setIsValid(null);

    try {
      // Validate token via edge function
      const { data, error } = await supabase.functions.invoke('validate-coolify-token', {
        body: { 
          server_id: serverId,
          coolify_token: token.trim(),
          coolify_url: coolifyDashboardUrl
        }
      });

      if (error) throw error;

      if (data.valid) {
        setIsValid(true);
        toast({
          title: isEditing ? "Token mis à jour !" : "Token validé !",
          description: "Votre connexion à Coolify est configurée.",
        });
        if (isEditing) {
          handleEditSuccess();
        } else {
          onSuccess();
        }
      } else {
        setIsValid(false);
        toast({
          title: "Token invalide",
          description: data.error || "Impossible de se connecter à Coolify avec ce token.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      setIsValid(false);
      toast({
        title: "Erreur de validation",
        description: error.message || "Impossible de valider le token.",
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié !",
      description: "URL copiée dans le presse-papier.",
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setToken('');
    setIsValid(null);
  };

  const handleEditSuccess = () => {
    setIsEditing(false);
    setToken('');
    setIsValid(null);
    onSuccess();
  };

  if (currentToken && !isEditing) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Coolify configuré</p>
              <p className="text-sm text-muted-foreground">
                Votre serveur est prêt pour les déploiements
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Key className="w-4 h-4 mr-2" />
                Modifier le token
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(coolifyDashboardUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Ouvrir Coolify
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={isEditing ? "border-primary/30 bg-primary/5" : "border-warning/30 bg-warning/5"}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className={isEditing ? "w-5 h-5 text-primary" : "w-5 h-5 text-warning"} />
            <CardTitle className="text-lg">
              {isEditing ? "Modifier le token Coolify" : "Configurer Coolify"}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                Annuler
              </Button>
            )}
            <CoolifyGuide serverIp={serverIp} coolifyUrl={coolifyUrl || undefined} />
          </div>
        </div>
        <CardDescription>
          {isEditing 
            ? "Entrez votre nouveau token API Coolify avec les permissions de lecture et écriture"
            : "Connectez Inopay à Coolify pour activer les déploiements automatiques"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step-by-step guide */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <p className="font-medium">Comment obtenir votre token API Coolify :</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                <Button
                  variant="link"
                  className="p-0 h-auto text-primary"
                  onClick={() => window.open(coolifyDashboardUrl, '_blank')}
                >
                  Ouvrir Coolify <ExternalLink className="w-3 h-3 ml-1 inline" />
                </Button>
                {' '}et créez votre compte admin si c'est la première connexion
              </li>
              <li>Allez dans <Badge variant="outline" className="text-xs">Settings</Badge> → <Badge variant="outline" className="text-xs">API</Badge></li>
              <li>Cliquez sur <Badge variant="outline" className="text-xs">Create new token</Badge></li>
              <li>Copiez le token et collez-le ci-dessous</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Coolify URL display */}
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">URL Coolify:</span>
          <code className="text-sm font-mono flex-1">{coolifyDashboardUrl}</code>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => copyToClipboard(coolifyDashboardUrl)}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => window.open(coolifyDashboardUrl, '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>

        {/* Token input */}
        <div className="space-y-2">
          <Label htmlFor="coolify-token">Token API Coolify</Label>
          <div className="flex gap-2">
            <Input
              id="coolify-token"
              type="password"
              placeholder="Collez votre token API ici..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={isValid === false ? 'border-destructive' : isValid === true ? 'border-primary' : ''}
            />
            <Button 
              onClick={handleValidateAndSave}
              disabled={isValidating || !token.trim()}
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validation...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Valider
                </>
              )}
            </Button>
          </div>
          {isValid === false && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              Token invalide ou Coolify non accessible
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
