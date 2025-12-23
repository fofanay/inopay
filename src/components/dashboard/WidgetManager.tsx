import { useState } from "react";
import { Smartphone, QrCode, RefreshCw, Copy, Check, ExternalLink, Shield, Ban, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";

interface WidgetManagerProps {
  syncConfigId: string;
  currentToken: string | null;
  tokenUsedAt?: string | null;
  tokenLastIp?: string | null;
  tokenRevoked?: boolean;
  onTokenUpdate: (newToken: string) => void;
}

export function WidgetManager({ 
  syncConfigId, 
  currentToken, 
  tokenUsedAt,
  tokenLastIp,
  tokenRevoked = false,
  onTokenUpdate 
}: WidgetManagerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  const widgetUrl = currentToken && !tokenRevoked
    ? `${window.location.origin}/widget?token=${currentToken}`
    : null;

  const generateToken = async () => {
    setIsGenerating(true);
    try {
      // Generate a secure random token
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const newToken = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      
      const { error } = await supabase
        .from('sync_configurations')
        .update({ 
          widget_token: newToken,
          widget_token_created_at: new Date().toISOString(),
          widget_token_revoked: false,
          widget_token_used_at: null,
          widget_token_last_ip: null,
        })
        .eq('id', syncConfigId);

      if (error) throw error;

      onTokenUpdate(newToken);
      toast.success("Nouveau token widget généré !");
    } catch (error) {
      console.error('Token generation error:', error);
      toast.error("Erreur lors de la génération du token");
    } finally {
      setIsGenerating(false);
    }
  };

  const revokeToken = async () => {
    setIsRevoking(true);
    try {
      const { error } = await supabase
        .from('sync_configurations')
        .update({ 
          widget_token_revoked: true,
        })
        .eq('id', syncConfigId);

      if (error) throw error;

      toast.success("Token révoqué ! L'accès au widget est désactivé.");
      // Force refresh by updating with empty token effect
      onTokenUpdate('');
    } catch (error) {
      console.error('Token revocation error:', error);
      toast.error("Erreur lors de la révocation du token");
    } finally {
      setIsRevoking(false);
    }
  };

  const copyToClipboard = async () => {
    if (!widgetUrl) return;
    
    try {
      await navigator.clipboard.writeText(widgetUrl);
      setCopied(true);
      toast.success("Lien copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Erreur lors de la copie");
    }
  };

  const openWidget = () => {
    if (widgetUrl) {
      window.open(widgetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Widget Mobile</CardTitle>
            <CardDescription>
              Installez le widget sur votre téléphone pour surveiller votre infrastructure
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentToken && !tokenRevoked ? (
          <>
            {/* Token usage info */}
            {tokenUsedAt && (
              <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Dernier accès: {new Date(tokenUsedAt).toLocaleString('fr-FR')}</span>
                {tokenLastIp && <span className="text-muted-foreground/60">({tokenLastIp})</span>}
              </div>
            )}

            {/* QR Code */}
            <div className="flex justify-center p-4 bg-white rounded-xl">
              <QRCodeSVG 
                value={widgetUrl!} 
                size={180}
                level="H"
                includeMargin
                className="rounded-lg"
              />
            </div>
            
            <p className="text-center text-sm text-muted-foreground">
              Scannez ce QR code avec votre téléphone pour accéder au widget
            </p>

            {/* URL Copy */}
            <div className="flex gap-2">
              <div className="flex-1 p-3 bg-muted/50 rounded-lg text-sm font-mono truncate">
                {widgetUrl}
              </div>
              <Button 
                variant="outline" 
                size="icon"
                onClick={copyToClipboard}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={openWidget}
                className="gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Ouvrir
              </Button>
              <Button 
                variant="outline" 
                onClick={generateToken}
                disabled={isGenerating}
                className="gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
                Régénérer
              </Button>
            </div>

            {/* Revoke button */}
            <Button 
              variant="destructive" 
              onClick={revokeToken}
              disabled={isRevoking}
              className="w-full gap-2"
            >
              <Ban className={cn("w-4 h-4", isRevoking && "animate-pulse")} />
              Révoquer l'accès au widget
            </Button>

            {/* Security note */}
            <div className="flex items-start gap-2 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
              <Shield className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-xs text-orange-200">
                Ce token donne accès à votre widget de monitoring. Vous pouvez le révoquer à tout moment pour désactiver immédiatement l'accès.
              </p>
            </div>

            {/* PWA Instructions */}
            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <QrCode className="w-4 h-4" />
                Installation sur l'écran d'accueil
              </h4>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Scannez le QR code avec votre téléphone</li>
                <li>Sur iOS : appuyez sur "Partager" puis "Sur l'écran d'accueil"</li>
                <li>Sur Android : appuyez sur le menu ⋮ puis "Ajouter à l'écran d'accueil"</li>
              </ol>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Smartphone className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Générez un token pour accéder au widget mobile
            </p>
            <Button 
              onClick={generateToken} 
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              Générer le Widget Token
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
