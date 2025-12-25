import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { validateCoolifyUrl, CoolifyUrlValidation } from '@/lib/coolifyUrlValidator';
import { cn } from '@/lib/utils';

interface ServerSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: {
    id: string;
    name: string;
    ip_address: string;
    coolify_url: string | null;
    coolify_token: string | null;
  };
  onSuccess: () => void;
}

export function ServerSettingsDialog({
  open,
  onOpenChange,
  server,
  onSuccess,
}: ServerSettingsDialogProps) {
  const [name, setName] = useState(server.name);
  const [coolifyUrl, setCoolifyUrl] = useState(server.coolify_url || '');
  const [isSaving, setIsSaving] = useState(false);
  const [urlValidation, setUrlValidation] = useState<CoolifyUrlValidation | null>(null);
  const { toast } = useToast();

  const isUrlChanged = coolifyUrl !== (server.coolify_url || '');
  const hasToken = !!server.coolify_token;

  // Validate URL on change
  useEffect(() => {
    const validation = validateCoolifyUrl(coolifyUrl);
    setUrlValidation(validation);
  }, [coolifyUrl]);

  const handleApplySuggestion = () => {
    if (urlValidation?.suggestedUrl) {
      setCoolifyUrl(urlValidation.suggestedUrl);
    }
  };

  const handleSave = async () => {
    // Validate URL format
    if (urlValidation && !urlValidation.isValid) {
      toast({
        title: "URL invalide",
        description: urlValidation.error || "Veuillez corriger l'URL Coolify",
        variant: "destructive",
      });
      return;
    }

    // Validate name
    if (!name.trim()) {
      toast({
        title: "Nom requis",
        description: "Le nom du serveur ne peut pas être vide",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Normalize URL - remove trailing slash
      const normalizedUrl = coolifyUrl.trim().replace(/\/$/, '');

      const { error } = await supabase
        .from('user_servers')
        .update({
          name: name.trim(),
          coolify_url: normalizedUrl || null,
        })
        .eq('id', server.id);

      if (error) throw error;

      toast({
        title: "Paramètres mis à jour",
        description: "Les informations du serveur ont été sauvegardées.",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Update error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les paramètres.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paramètres du serveur</DialogTitle>
          <DialogDescription>
            Modifiez les informations de votre serveur VPS
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="server-name">Nom du serveur</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mon serveur VPS"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ip-address">Adresse IP</Label>
            <Input
              id="ip-address"
              value={server.ip_address}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              L'adresse IP ne peut pas être modifiée
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coolify-url">URL Coolify</Label>
            <Input
              id="coolify-url"
              value={coolifyUrl}
              onChange={(e) => setCoolifyUrl(e.target.value)}
              placeholder="http://209.46.125.157:8000"
              className={cn(
                urlValidation?.error && "border-destructive focus-visible:ring-destructive"
              )}
            />
            <p className="text-xs text-muted-foreground">
              Format: http://IP:8000 ou https://coolify.example.com
            </p>
            
            {/* Validation error */}
            {urlValidation?.error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div className="text-sm flex-1">
                  <p className="font-medium text-destructive">{urlValidation.error}</p>
                  {urlValidation.suggestedUrl && (
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-primary"
                      onClick={handleApplySuggestion}
                    >
                      Utiliser : {urlValidation.suggestedUrl}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Validation warning */}
            {urlValidation?.warning && !urlValidation?.error && (
              <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
                <Info className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div className="text-sm flex-1">
                  <p className="text-muted-foreground">{urlValidation.warning}</p>
                  {urlValidation.suggestedUrl && (
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-primary"
                      onClick={handleApplySuggestion}
                    >
                      Utiliser le port standard : {urlValidation.suggestedUrl}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {isUrlChanged && hasToken && !urlValidation?.error && (
            <div className="flex items-start gap-2 p-3 bg-warning/10 border border-warning/30 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-warning">Attention</p>
                <p className="text-muted-foreground">
                  Un token API est déjà configuré. Si vous changez l'URL, assurez-vous que le token reste valide pour cette nouvelle adresse.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || (urlValidation ? !urlValidation.isValid : false)}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
