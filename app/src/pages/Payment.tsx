import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InvestorDashboardLayout } from "@/components/investor/InvestorDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, ShieldCheck, Loader2, CheckCircle2, XCircle, ArrowLeft, Building2,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const Payment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, totalCost, clearCart, selectedTenantId, selectedTenantName } = useCart();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [selectedGateway, setSelectedGateway] = useState<"cinetpay" | "paystack">("cinetpay");

  const returnStatus = searchParams.get("status");

  // Detect currency
  const isGHS = useMemo(() => items.some((i) => i.currency === "GHS"), [items]);
  const currencyLabel = isGHS ? "GH₵" : "FCFA";
  const currencyCode = isGHS ? "GHS" : "XOF";

  // For GSE, selectedTenantId maps to broker_partners.id (LDM broker)
  const brokerId = isGHS ? selectedTenantId : null;

  useEffect(() => {
    if (returnStatus === "return") {
      setStatus("success");
      clearCart();
    }
  }, [returnStatus, clearCart]);

  const providerName = selectedGateway === "paystack" ? "Paystack" : "CinetPay";

  const handlePay = async () => {
    if (!selectedTenantId) {
      toast({ title: isGHS ? "Aucun broker sélectionné" : "Aucune SGI sélectionnée", description: "Retournez au panier pour choisir votre intermédiaire.", variant: "destructive" });
      return;
    }
    if (items.length === 0) {
      toast({ title: "Panier vide", variant: "destructive" });
      return;
    }

    setLoading(true);
    setStatus("processing");

    try {
      const returnUrl = `${window.location.origin}/payment?status=return`;

      if (selectedGateway === "paystack") {
        // ── Paystack flow ──
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || "investor@inopay.app";

        const { data, error } = await supabase.functions.invoke("paystack-init", {
          body: {
            email,
            amount: totalCost,
            currency: currencyCode,
            callback_url: returnUrl,
            broker_id: brokerId,
            payment_type: "investment",
            metadata: {
              items: items.map((i) => ({
                instrumentId: i.instrumentId,
                instrumentName: i.instrumentName,
                quantity: i.quantity,
              })),
              market: isGHS ? "GSE" : "BRVM",
            },
          },
        });

        if (error) throw new Error("Erreur lors de l'initialisation Paystack");
        if (!data?.success) throw new Error(data?.error || "Paystack init failed");
        if (!data?.payment_url) throw new Error("Aucune URL de paiement reçue");
        window.location.href = data.payment_url;
      } else {
        // ── CinetPay flow (FCFA) ──
            const notifyUrl = `${import.meta.env.VITE_API_URL || 'https://api.getinopay.com'}/functions/cinetpay-webhook`;

        const { data, error } = await supabase.functions.invoke("cinetpay-init", {
          body: {
            items: items.map((i) => ({
              instrumentId: i.instrumentId,
              instrumentName: i.instrumentName,
              unitPrice: i.unitPrice,
              quantity: i.quantity,
            })),
            tenantId: selectedTenantId,
            returnUrl,
            notifyUrl,
          },
        });

        if (error || !data?.payment_url) {
          throw new Error(data?.error || "Erreur lors de l'initialisation du paiement");
        }

        window.location.href = data.payment_url;
      }
    } catch (err: any) {
      setStatus("error");
      toast({
        title: "Erreur de paiement",
        description: err.message || "Impossible d'initialiser le paiement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (status === "success") {
    return (
      <InvestorDashboardLayout title="Paiement" subtitle="Confirmation" badge="Paiement" badgeIcon={<CreditCard className="h-3 w-3 text-primary" />}>
        <div className="max-w-lg mx-auto py-12 text-center animate-fade-in">
          <CheckCircle2 className="mx-auto h-16 w-16 text-primary mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Paiement envoyé</h1>
          <p className="text-muted-foreground mb-6">
            Votre ordre d'investissement a été transmis{isGHS ? " à votre broker (LDM) via Paystack" : " à votre SGI via CinetPay"}.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate("/orders")}>Suivre mes ordres</Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>Tableau de bord</Button>
          </div>
        </div>
      </InvestorDashboardLayout>
    );
  }

  if (items.length === 0 && !returnStatus) {
    return (
      <InvestorDashboardLayout title="Paiement" badge="Paiement" badgeIcon={<CreditCard className="h-3 w-3 text-primary" />}>
        <div className="max-w-lg mx-auto py-12 text-center animate-fade-in">
          <CreditCard className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Aucun article à payer</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Ajoutez des instruments à votre panier avant de procéder au paiement.
          </p>
          <Button variant="outline" onClick={() => navigate("/invest")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Retour au panier
          </Button>
        </div>
      </InvestorDashboardLayout>
    );
  }

  return (
    <InvestorDashboardLayout title="Paiement" subtitle={`Finalisez votre investissement via ${providerName}`} badge="Paiement" badgeIcon={<CreditCard className="h-3 w-3 text-primary" />}>
      <div className="max-w-2xl space-y-6 animate-fade-in">
        {/* Gateway selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Moyen de paiement</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelectedGateway("cinetpay")}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${selectedGateway === "cinetpay" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-muted-foreground/30"}`}
            >
              <span className="text-2xl">📱</span>
              <span className="text-sm font-semibold text-foreground">CinetPay</span>
              <span className="text-[10px] text-muted-foreground text-center">Mobile Money, Carte bancaire (FCFA)</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedGateway("paystack")}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${selectedGateway === "paystack" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-muted-foreground/30"}`}
            >
              <span className="text-2xl">💳</span>
              <span className="text-sm font-semibold text-foreground">Paystack</span>
              <span className="text-[10px] text-muted-foreground text-center">Carte, Mobile Money, Bank Transfer</span>
            </button>
          </div>
        </div>

        {/* Provider badge */}
        <div className="flex items-center gap-2">
          <Badge variant={selectedGateway === "paystack" ? "secondary" : "default"} className="text-xs">
            {selectedGateway === "paystack" ? "💳 Paystack" : "📱 CinetPay"} — {currencyLabel}
          </Badge>
        </div>

        {/* SGI selected (only for CinetPay) */}
        {selectedTenantName && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Building2 className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isGHS ? "Broker (LDM)" : "SGI"} sélectionné(e) : <span className="text-primary">{selectedTenantName}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {isGHS
                    ? "Le broker est le marchand de référence (Merchant of Record). Les fonds d'investissement sont reçus directement sur son compte Paystack."
                    : "Le paiement sera envoyé directement à cette SGI"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Récapitulatif de commande</CardTitle>
            <CardDescription>
              Le paiement sera traité via {providerName}. {selectedGateway === "paystack" && isGHS && brokerId
                ? "Les fonds sont versés au broker agréé (LDM). INOPAY ne reçoit pas les fonds."
                : `Le montant est envoyé à votre ${isGHS ? "broker" : "SGI"} via ${providerName}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instrument</TableHead>
                  <TableHead className="text-right">Prix unit.</TableHead>
                  <TableHead className="text-center">Qté</TableHead>
                  <TableHead className="text-right">Sous-total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.instrumentId}>
                    <TableCell>
                      <span className="font-medium">{item.symbol}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{item.instrumentName}</span>
                    </TableCell>
                    <TableCell className="text-right">{item.unitPrice.toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right font-medium">{(item.unitPrice * item.quantity).toLocaleString("fr-FR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 flex items-center justify-between border-t pt-4">
              <span className="text-sm font-medium text-muted-foreground">Total à payer</span>
              <span className="text-2xl font-bold text-foreground">
                {totalCost.toLocaleString("fr-FR")} <span className="text-sm font-medium text-muted-foreground">{currencyLabel}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Security notice */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Paiement sécurisé via {providerName}</p>
              <p className="text-muted-foreground mt-1">
                {isGHS
                  ? "Vous serez redirigé vers la page de paiement Paystack de votre broker agréé (LDM). INOPAY ne reçoit pas les fonds d'investissement — ils sont versés directement au courtier."
                  : "INOPAY ne stocke aucun fonds. Le montant est envoyé directement à votre SGI. Vous serez redirigé vers CinetPay pour finaliser le paiement en toute sécurité."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Error state */}
        {status === "error" && (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="flex items-start gap-3 py-4">
              <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Échec du paiement</p>
                <p className="text-muted-foreground mt-1">Le paiement n'a pas pu être initialisé. Veuillez réessayer.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={handlePay} disabled={loading || !selectedTenantId}>
            {loading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Redirection vers {providerName}…</>
            ) : (
              <><CreditCard className="mr-2 h-4 w-4" />Payer {totalCost.toLocaleString("fr-FR")} {currencyLabel} via {providerName}</>
            )}
          </Button>
          <Button variant="ghost" onClick={() => navigate("/invest")} disabled={loading}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Modifier le panier
          </Button>
        </div>

        {!selectedTenantId && (
          <p className="text-center text-sm text-destructive">
            {isGHS
              ? "Aucun broker (LDM) sélectionné. Retournez au panier et choisissez votre broker."
              : "Aucune SGI sélectionnée. Retournez au panier et choisissez votre SGI."}
          </p>
        )}
      </div>
    </InvestorDashboardLayout>
  );
};

export default Payment;
