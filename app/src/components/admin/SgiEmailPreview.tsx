import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye } from "lucide-react";

const SGI_EMAIL_FR = `
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
              <h1 style="margin:0 0 20px;font-size:22px;color:#0B1C39;font-weight:700;line-height:1.3;">Bonjour,</h1>
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">INOPAY a développé une <strong>infrastructure digitale</strong> qui achemine automatiquement des investisseurs qualifiés de la diaspora vers les SGI partenaires — <strong>sans coût d'acquisition</strong> pour votre institution.</p>
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">Notre plateforme connecte un réseau global d'investisseurs actifs directement à votre institution, en prenant en charge :</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>Vérification KYC</strong> — identité et justificatif de domicile</p></td></tr>
                <tr><td style="height:8px;"></td></tr>
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>Éducation & onboarding</strong> des investisseurs</p></td></tr>
                <tr><td style="height:8px;"></td></tr>
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>Routage automatique</strong> des ordres</p></td></tr>
                <tr><td style="height:8px;"></td></tr>
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>Paiement sécurisé</strong> multi-devises</p></td></tr>
              </table>
              <p style="margin:0 0 28px;font-size:15px;color:#333333;line-height:1.6;">Nous intégrons actuellement des SGI partenaires pour servir de courtiers d'exécution à notre base croissante d'investisseurs en Afrique de l'Ouest et Centrale.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr><td style="border-radius:8px;background-color:#2E8B57;"><a href="https://getinopay.com/partners/sgi" target="_blank" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Devenir partenaire →</a></td></tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" /></td></tr>
          <tr>
            <td style="padding:0 40px 32px;">
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

const SGI_EMAIL_EN = `
<!DOCTYPE html>
<html lang="en">
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
              <h1 style="margin:0 0 20px;font-size:22px;color:#0B1C39;font-weight:700;line-height:1.3;">Dear Sir/Madam,</h1>
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">INOPAY has built a <strong>digital infrastructure</strong> that automatically channels qualified diaspora investors to licensed capital market intermediaries — at <strong>zero acquisition cost</strong> to you.</p>
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">Our platform connects a global network of active investors directly to your institution, handling:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>KYC verification</strong> — identity & address proof</p></td></tr>
                <tr><td style="height:8px;"></td></tr>
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>Investor education</strong> & onboarding</p></td></tr>
                <tr><td style="height:8px;"></td></tr>
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>Automated order routing</strong></p></td></tr>
                <tr><td style="height:8px;"></td></tr>
                <tr><td style="padding:12px 16px;background-color:#f0fdf4;border-left:4px solid #2E8B57;border-radius:0 8px 8px 0;"><p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.5;">✅ <strong>Secure multi-currency</strong> payment processing</p></td></tr>
              </table>
              <p style="margin:0 0 28px;font-size:15px;color:#333333;line-height:1.6;">We are currently onboarding Licensed Dealing Members to serve as execution partners for our growing investor base across Africa.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr><td style="border-radius:8px;background-color:#2E8B57;"><a href="https://getinopay.com/partners/sgi" target="_blank" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Become a Partner →</a></td></tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" /></td></tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;line-height:1.5;">If you wish to unsubscribe, reply to this email with "STOP".</p>
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

export const SgiEmailPreview: React.FC = () => {
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
          <DialogTitle>Aperçu — Email de prospection SGI</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="fr">
          <TabsList>
            <TabsTrigger value="fr">🇫🇷 Français</TabsTrigger>
            <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
          </TabsList>
          <TabsContent value="fr">
            <div className="border rounded-lg overflow-hidden">
              <iframe srcDoc={SGI_EMAIL_FR} title="Email preview FR" className="w-full border-0" style={{ height: "700px" }} sandbox="" />
            </div>
          </TabsContent>
          <TabsContent value="en">
            <div className="border rounded-lg overflow-hidden">
              <iframe srcDoc={SGI_EMAIL_EN} title="Email preview EN" className="w-full border-0" style={{ height: "700px" }} sandbox="" />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
