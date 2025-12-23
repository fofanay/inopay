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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [token, setToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const coolifyDashboardUrl = coolifyUrl || `http://${serverIp}:8000`;

  const handleValidateAndSave = async () => {
    if (!token.trim()) {
      toast({
        title: t('coolifyConfig.tokenRequired'),
        description: t('coolifyConfig.tokenRequiredDesc'),
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
          title: isEditing ? t('coolifyConfig.tokenUpdated') : t('coolifyConfig.tokenValidated'),
          description: t('coolifyConfig.connectionConfigured'),
        });
        if (isEditing) {
          handleEditSuccess();
        } else {
          onSuccess();
        }
      } else {
        setIsValid(false);
        toast({
          title: t('coolifyConfig.tokenInvalid'),
          description: data.error || t('coolifyConfig.tokenInvalidDesc'),
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      setIsValid(false);
      toast({
        title: t('coolifyConfig.validationError'),
        description: error.message || t('coolifyConfig.validationErrorDesc'),
        variant: "destructive"
      });
    } finally {
      setIsValidating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: t('coolifyConfig.copied'),
      description: t('coolifyConfig.copiedDesc'),
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
              <p className="font-medium">{t('coolifyConfig.configured')}</p>
              <p className="text-sm text-muted-foreground">
                {t('coolifyConfig.configuredDesc')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Key className="w-4 h-4 mr-2" />
                {t('coolifyConfig.modifyToken')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(coolifyDashboardUrl, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('coolifyConfig.openCoolify')}
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
              {isEditing ? t('coolifyConfig.titleEdit') : t('coolifyConfig.title')}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                {t('coolifyConfig.cancel')}
              </Button>
            )}
            <CoolifyGuide serverIp={serverIp} coolifyUrl={coolifyUrl || undefined} />
          </div>
        </div>
        <CardDescription>
          {isEditing 
            ? t('coolifyConfig.descriptionEdit')
            : t('coolifyConfig.description')
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step-by-step guide */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <p className="font-medium">{t('coolifyConfig.howToGet')}</p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>
                <Button
                  variant="link"
                  className="p-0 h-auto text-primary"
                  onClick={() => window.open(coolifyDashboardUrl, '_blank')}
                >
                  {t('coolifyConfig.openCoolify')} <ExternalLink className="w-3 h-3 ml-1 inline" />
                </Button>
                {' '}{t('coolifyConfig.step1')}
              </li>
              <li>{t('coolifyConfig.step2')} <Badge variant="outline" className="text-xs">Settings</Badge> → <Badge variant="outline" className="text-xs">API</Badge></li>
              <li>{t('coolifyConfig.step3')} <Badge variant="outline" className="text-xs">Create new token</Badge></li>
              <li>{t('coolifyConfig.step4')}</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Coolify URL display */}
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">{t('coolifyConfig.coolifyUrl')}</span>
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
          <Label htmlFor="coolify-token">{t('coolifyConfig.tokenLabel')}</Label>
          <div className="flex gap-2">
            <Input
              id="coolify-token"
              type="password"
              placeholder={t('coolifyConfig.tokenPlaceholder')}
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
                  {t('coolifyConfig.validating')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t('coolifyConfig.validate')}
                </>
              )}
            </Button>
          </div>
          {isValid === false && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {t('coolifyConfig.tokenInvalidOrUnreachable')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}