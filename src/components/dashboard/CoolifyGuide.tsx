import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, Loader2, ExternalLink } from 'lucide-react';
import html2pdf from 'html2pdf.js';

interface CoolifyGuideProps {
  serverIp: string;
  coolifyUrl?: string;
}

export function CoolifyGuide({ serverIp, coolifyUrl }: CoolifyGuideProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const dashboardUrl = coolifyUrl || `http://${serverIp}:8000`;

  const generatePDF = async () => {
    setIsGenerating(true);

    const content = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 40px;">
          <h1 style="color: #6366f1; font-size: 28px; margin-bottom: 10px;">Guide de Configuration Coolify</h1>
          <p style="color: #6b7280; font-size: 14px;">Récupérer votre Token API pour Inopay</p>
        </div>

        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h3 style="color: #374151; margin: 0 0 10px 0;">Informations de votre serveur</h3>
          <p style="margin: 5px 0;"><strong>Adresse IP:</strong> ${serverIp}</p>
          <p style="margin: 5px 0;"><strong>URL Coolify:</strong> ${dashboardUrl}</p>
        </div>

        <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Étape 1 : Accéder à Coolify</h2>
        <ol style="line-height: 1.8; color: #4b5563;">
          <li>Ouvrez votre navigateur web</li>
          <li>Accédez à l'URL : <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${dashboardUrl}</code></li>
          <li>Si c'est votre première connexion, créez votre compte administrateur</li>
          <li>Connectez-vous avec vos identifiants</li>
        </ol>

        <div style="page-break-inside: avoid;">
          <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-top: 30px;">Étape 2 : Créer un Token API</h2>
          <ol style="line-height: 1.8; color: #4b5563;">
            <li>Dans le menu de gauche, cliquez sur <strong>"Settings"</strong> (Paramètres)</li>
            <li>Allez dans la section <strong>"API"</strong></li>
            <li>Cliquez sur le bouton <strong>"Create new token"</strong></li>
            <li>Donnez un nom descriptif au token (ex: "Inopay Integration")</li>
            <li>Sélectionnez les permissions nécessaires :
              <ul style="margin-top: 10px;">
                <li>✅ <strong>Read</strong> - Pour consulter les projets</li>
                <li>✅ <strong>Write</strong> - Pour créer et déployer</li>
              </ul>
            </li>
            <li>Cliquez sur <strong>"Create"</strong></li>
          </ol>
        </div>

        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <strong style="color: #92400e;">⚠️ Important :</strong>
          <p style="color: #92400e; margin: 5px 0 0 0;">
            Le token ne sera affiché qu'une seule fois. Copiez-le immédiatement et conservez-le en lieu sûr !
          </p>
        </div>

        <h2 style="color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-top: 30px;">Étape 3 : Configurer dans Inopay</h2>
        <ol style="line-height: 1.8; color: #4b5563;">
          <li>Retournez dans le tableau de bord Inopay</li>
          <li>Allez dans la section <strong>"Mes Serveurs VPS"</strong></li>
          <li>Trouvez votre serveur et cliquez sur <strong>"Configurer Coolify"</strong></li>
          <li>Collez le token API dans le champ prévu</li>
          <li>Cliquez sur <strong>"Valider"</strong></li>
        </ol>

        <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <strong style="color: #065f46;">✅ C'est terminé !</strong>
          <p style="color: #065f46; margin: 5px 0 0 0;">
            Votre serveur est maintenant configuré. Vous pouvez déployer vos projets directement depuis Inopay.
          </p>
        </div>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #9ca3af; font-size: 12px;">
            Guide généré par Inopay • ${new Date().toLocaleDateString('fr-FR')}
          </p>
          <p style="color: #9ca3af; font-size: 12px;">
            Support : contact@inopay.app
          </p>
        </div>
      </div>
    `;

    const element = document.createElement('div');
    element.innerHTML = content;
    document.body.appendChild(element);

    try {
      await html2pdf()
        .set({
          margin: 10,
          filename: `guide-coolify-${serverIp.replace(/\./g, '-')}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(element)
        .save();

      toast({
        title: 'PDF téléchargé',
        description: 'Le guide a été enregistré dans vos téléchargements.',
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de générer le PDF.',
        variant: 'destructive',
      });
    } finally {
      document.body.removeChild(element);
      setIsGenerating(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="w-4 h-4 mr-2" />
          Guide PDF
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Guide de configuration Coolify</DialogTitle>
          <DialogDescription>
            Téléchargez un guide PDF détaillé pour récupérer votre token API Coolify
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Ce guide contient :</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Instructions pas à pas illustrées</li>
              <li>• Informations de votre serveur pré-remplies</li>
              <li>• Conseils de sécurité importants</li>
              <li>• Étapes de configuration dans Inopay</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => window.open(dashboardUrl, '_blank')}
              variant="outline"
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ouvrir Coolify
            </Button>
            <Button
              onClick={generatePDF}
              disabled={isGenerating}
              className="flex-1"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
