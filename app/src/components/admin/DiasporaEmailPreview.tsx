import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

const EMAIL_PREVIEW_HTML = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <tr>
            <td style="background-color:#0B1C39;padding:28px 40px;text-align:center;">
              <img src="https://getinopay.com/pwa-icon-192.png" alt="INOPAY" width="160" style="display:block;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 24px;">
              <h1 style="margin:0 0 20px;font-size:22px;color:#0B1C39;font-weight:700;line-height:1.3;">Bonjour Jean,</h1>
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">En tant que membre de <strong>Diversité Québec</strong>, partenaire officiel d'INOPAY, vous avez accès à une opportunité unique : <strong>investir sur les marchés financiers africains</strong> directement depuis le Canada.</p>
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">INOPAY est la première plateforme qui permet à la diaspora africaine d'investir simplement sur la <strong>BRVM</strong> (Bourse Régionale des Valeurs Mobilières), la <strong>BVMAC</strong> (Bourse des Valeurs Mobilières de l'Afrique Centrale) et le <strong>GSE</strong> (Ghana Stock Exchange).</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>Obligations souveraines</strong> avec des rendements de 5,5% à 7%</p></td></tr>
                <tr><td style="height:8px;"></td></tr>
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>Accès 100% en ligne</strong> — investissez depuis Montréal, Paris ou Abidjan</p></td></tr>
                <tr><td style="height:8px;"></td></tr>
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>SGI partenaires agréés</strong> par les régulateurs (CREPMF, COSUMAF, SEC Ghana)</p></td></tr>
              </table>
              <p style="margin:0 0 28px;font-size:15px;color:#333333;line-height:1.6;">Rejoignez les investisseurs de la diaspora qui font déjà fructifier leur épargne sur les marchés africains.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr><td style="border-radius:8px;background-color:#2E8B57;"><a href="https://getinopay.com/invest" target="_blank" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Découvrir les opportunités →</a></td></tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" /></td></tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.5;">Vous recevez cet email car vous êtes membre de <strong>Diversité Québec</strong>, partenaire officiel d'INOPAY.</p>
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.5;">Si vous ne souhaitez plus recevoir nos communications, répondez à cet email avec le mot "STOP".</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">© 2026 INOPAY — <a href="mailto:contact@getinopay.com" style="color:#2E8B57;text-decoration:none;">contact@getinopay.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const DiasporaEmailPreview: React.FC = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Eye className="h-4 w-4" />
          Aperçu email
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aperçu — Email de prospection Diaspora</DialogTitle>
        </DialogHeader>
        <div className="border rounded-lg overflow-hidden">
          <iframe
            srcDoc={EMAIL_PREVIEW_HTML}
            title="Email preview"
            className="w-full border-0"
            style={{ height: "700px" }}
            sandbox=""
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
