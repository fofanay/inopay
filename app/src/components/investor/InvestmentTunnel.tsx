import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight, ArrowLeft, ShoppingCart, Building2, Shield, Receipt,
  CreditCard, CheckCircle2, Loader2, AlertTriangle,
} from "lucide-react";

const fmt = (n: number) => n.toLocaleString("fr-FR");
const fmtCurrency = (n: number, currency: string | null) => {
  if (currency === "GHS") return `GH₵ ${n.toLocaleString("en-GH", { minimumFractionDigits: 0 })}`;
  return `${fmt(n)} FCFA`;
};

// Commission INOPAY selon plan SGI : STARTER 0.25%, PRO 0.15%, ELITE 0.08%
const FEES = {
  courtage_total: 1.0,       // AMF-UMOA max brokerage rate
  inopay_percent: 0.25,      // INOPAY commission (plan STARTER default)
  brvm_percent: 0.10,        // Exchange fees
  tva_percent: 18,
};


interface Instrument {
  id: string; name: string; symbol: string | null; last_price: number | null; currency: string | null; market?: string | null;
}

interface SgiTenant {
  id: string; name: string; code: string;
}

interface BrokerPartner {
  id: string; name: string; country: string; currency: string | null;
}

interface InvestmentTunnelProps {
  open: boolean;
  onClose: () => void;
  type: "buy" | "sell";
  instruments: Instrument[];
  sgis: SgiTenant[];
  brokers?: BrokerPartner[];
  kycStatus: string;
  onComplete: () => void;
  /** If true, this is sandbox mode (simulated) */
  sandbox?: boolean;
}

export const InvestmentTunnel: React.FC<InvestmentTunnelProps> = ({
  open, onClose, type, instruments, sgis, brokers = [], kycStatus, onComplete, sandbox = false,
}) => {
  const { t } = useTranslation();
  const STEPS = [
    { label: t("sandbox.tradeSteps.instrument"), icon: ShoppingCart },
    { label: t("sandbox.tradeSteps.sgi"), icon: Building2 },
    { label: t("sandbox.tradeSteps.kyc"), icon: Shield },
    { label: t("sandbox.tradeSteps.fees"), icon: Receipt },
    { label: t("sandbox.tradeSteps.payment"), icon: CreditCard },
    { label: t("sandbox.tradeSteps.confirmation"), icon: CheckCircle2 },
  ];
  const [step, setStep] = useState(0);
  const [selectedInstrument, setSelectedInstrument] = useState("");
  const [selectedSgi, setSelectedSgi] = useState(sgis.length > 0 ? sgis[0].id : "");
  const [selectedBroker, setSelectedBroker] = useState(brokers.length > 0 ? brokers[0].id : "");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [kycChecking, setKycChecking] = useState(false);
  const [kycApproved, setKycApproved] = useState(kycStatus === "VALIDE");
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("mobile_money");
  const [paymentGateway, setPaymentGateway] = useState<"cinetpay" | "paystack">("cinetpay");
  // Track the order id saved at payment step to avoid duplicate inserts at confirmation step
  const [savedOrderId, setSavedOrderId] = useState<string | null>(null);

  const instrument = instruments.find((i) => i.id === selectedInstrument);
  const isGse = instrument?.market === "GSE";
  const sgi = sgis.find((s) => s.id === selectedSgi);
  const broker = brokers.find((b) => b.id === selectedBroker);
  const price = instrument?.last_price || 0;
  const qty = Number(quantity) || 0;
  const subtotal = qty * price;

  const courtageFee = Math.round(subtotal * FEES.courtage_total / 100);
  const inopayFee = Math.round(subtotal * FEES.inopay_percent / 100);
  const sgiFee = courtageFee - inopayFee;
  const brvmFee = Math.round(subtotal * FEES.brvm_percent / 100);
  const totalCommissions = courtageFee + brvmFee;
  const tva = Math.round(totalCommissions * FEES.tva_percent / 100);
  const totalFees = totalCommissions + tva;
  const grandTotal = subtotal + (type === "buy" ? totalFees : -totalFees);

  const canNext = () => {
    switch (step) {
      case 0: return selectedInstrument && qty > 0 && price > 0;
      case 1: return isGse ? !!selectedBroker : !!selectedSgi;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const handleNext = async () => {
    if (step === 2 && !kycApproved) {
      setKycChecking(true);
      if (sandbox || kycStatus === "VALIDE") {
        await new Promise((r) => setTimeout(r, 1500));
        setKycApproved(true);
        setKycChecking(false);
      } else {
        // Real mode: check actual KYC status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: kycs } = await supabase.from("kycs").select("status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1);
          if (kycs && kycs.length > 0 && kycs[0].status === "VALIDE") {
            setKycApproved(true);
          } else {
            toast({ title: "KYC requis", description: "Votre vérification KYC doit être validée pour investir.", variant: "destructive" });
          }
        }
        setKycChecking(false);
      }
      return;
    }
    if (step === 4 && !paymentDone) {
      setPaymentProcessing(true);
      if (sandbox) {
        await new Promise((r) => setTimeout(r, 2000));
        setPaymentDone(true);
        setPaymentProcessing(false);
      } else {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Non authentifié");
          
          if (paymentGateway === "paystack") {
            // Paystack flow — supports XOF and GHS
            const currency = instrument?.currency === "GHS" ? "GHS" : "XOF";
            const { data, error } = await supabase.functions.invoke("paystack-init", {
              body: {
                email: user.email,
                amount: grandTotal,
                currency,
                callback_url: `${window.location.origin}/dashboard/portfolio`,
                payment_type: "investment",
                broker_id: isGse ? selectedBroker : undefined,
                metadata: {
                  instrument_id: selectedInstrument,
                  broker_id: isGse ? selectedBroker : undefined,
                  sgi_id: !isGse ? selectedSgi : undefined,
                  quantity: qty,
                  user_id: user.id,
                },
              },
            });
            if (error) throw error;
            if (data?.payment_url) {
              await saveOrder("pending_payment", data.payment_ref || null);
              window.open(data.payment_url, "_blank");
              setPaymentDone(true);
            } else if (data?.error) {
              throw new Error(data.error);
            } else {
              await saveOrder("pending_payment", data?.payment_ref || null);
              setPaymentDone(true);
            }
          } else {
            // CinetPay flow — FCFA only
            const { data, error } = await supabase.functions.invoke("cinetpay-init", {
              body: {
                items: [{
                  instrumentId: selectedInstrument,
                  instrumentName: instrument?.name || "",
                  unitPrice: price,
                  quantity: qty,
                }],
                tenantId: selectedSgi,
                returnUrl: `${window.location.origin}/dashboard/portfolio`,
                notifyUrl: `${import.meta.env.VITE_API_URL || 'https://api.getinopay.com'}/functions/cinetpay-webhook`,
              },
            });
            if (error) throw error;
            if (data?.payment_url) {
              await saveOrder("pending_payment", data.payment_token || null);
              window.open(data.payment_url, "_blank");
              setPaymentDone(true);
            } else {
              await new Promise((r) => setTimeout(r, 2000));
              setPaymentDone(true);
            }
          }
        } catch (err: any) {
          console.error("Payment init error:", err);
          toast({ title: "Erreur paiement", description: err.message || "Impossible d'initialiser le paiement", variant: "destructive" });
        }
        setPaymentProcessing(false);
      }
      return;
    }
    if (step === 5) {
      setSubmitting(true);
      try {
        await saveOrder("executed");
        toast({ title: "Ordre exécuté", description: `${type === "buy" ? "Achat" : "Vente"} de ${qty} ${instrument?.symbol || ""} confirmé.` });
        onComplete();
        handleClose();
      } catch (err: any) {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setStep((s) => s + 1);
  };

  const saveOrder = async (status: string, paymentRef?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Non authentifié");

    // If we already inserted this order at the payment step, update it instead
    if (savedOrderId && status === "executed") {
      const { error } = await supabase.from("investment_orders").update({
        order_status: "executed",
        payment_status: "completed",
        executed_at: new Date().toISOString(),
      } as any).eq("id", savedOrderId);
      if (error) throw error;

      try {
        await supabase.from("sgi_orders").update({ status: "executed" } as any)
          .eq("instrument_id", selectedInstrument).eq("user_id", user.id).eq("status", "pending");
      } catch (_syncErr) {
        console.warn("sgi_orders update skipped:", _syncErr);
      }
      return;
    }

    const { data: inserted, error } = await supabase.from("investment_orders").insert({
      user_id: user.id,
      instrument_id: selectedInstrument,
      tenant_id: isGse ? null : (selectedSgi || null),
      broker_id: isGse ? (selectedBroker || null) : null,
      market: instrument?.market || "BRVM",
      order_type: type,
      quantity: qty,
      unit_price: price,
      subtotal,
      fees_inopay: inopayFee,
      fees_sgi: sgiFee,
      fees_brvm: brvmFee,
      fees_tva: tva,
      fees_total: totalFees,
      grand_total: grandTotal,
      kyc_validated: kycApproved,
      payment_method: paymentGateway,
      payment_ref: paymentRef || null,
      payment_status: paymentDone || status === "executed" ? "completed" : "pending",
      order_status: status,
      executed_at: status === "executed" ? new Date().toISOString() : null,
    } as any).select("id").single();

    if (error) throw error;
    if (inserted?.id) setSavedOrderId(inserted.id);

    // Also insert into sgi_orders for pipeline coherence (portfolio-agent, cinetpay-webhook)
    try {
      await supabase.from("sgi_orders").insert({
        user_id: user.id,
        instrument_id: selectedInstrument,
        tenant_id: isGse ? null : (selectedSgi || null),
        direction: type,
        quantity: qty,
        price,
        status: status === "executed" ? "executed" : "pending",
      } as any);
    } catch (_syncErr) {
      // Non-blocking: sgi_orders sync is best-effort
      console.warn("sgi_orders sync skipped:", _syncErr);
    }
  };

  const handleClose = () => {
    setStep(0);
    setSelectedInstrument("");
    setQuantity("");
    setKycChecking(false);
    setKycApproved(kycStatus === "VALIDE");
    setPaymentProcessing(false);
    setPaymentDone(false);
    setSavedOrderId(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sandbox ? "🎓 " : ""}{type === "buy" ? "Acheter" : "Vendre"} un instrument{sandbox ? " (Sandbox)" : ""}</DialogTitle>
          <DialogDescription>
            {sandbox ? "Simulation complète du processus INOPAY" : "Processus d'investissement réel via votre SGI"}
          </DialogDescription>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between">
            {STEPS.map((s, i) => (
              <div key={i} className={`flex flex-col items-center gap-1 ${i <= step ? "text-primary" : "text-muted-foreground"}`}>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary/20 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground"}`}>
                  {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className="text-[10px] font-medium hidden sm:block">{s.label}</span>
              </div>
            ))}
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
        </div>

        {/* Step 0: Instrument */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Instrument</label>
              <Select value={selectedInstrument} onValueChange={setSelectedInstrument}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un instrument" /></SelectTrigger>
                <SelectContent>
                  {instruments.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.symbol} — {i.name} ({fmtCurrency(i.last_price || 0, i.currency)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Quantité</label>
              <Input type="number" min={1} placeholder="Nombre de titres" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            {instrument && qty > 0 && (
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Prix unitaire</span><span className="font-medium">{fmtCurrency(price, instrument?.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Sous-total</span><span className="font-bold">{fmtCurrency(subtotal, instrument?.currency)}</span></div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: SGI / Broker */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{isGse ? "Select Broker (LDM)" : "Choix de la SGI"}</p>
                  <p className="text-xs text-muted-foreground">{isGse ? "Licensed Dealing Member on the GSE" : "Intermédiaire agréé pour l'exécution"}</p>
                </div>
              </div>
              <Separator />
              {isGse ? (
                <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                  <SelectTrigger><SelectValue placeholder="Select a broker" /></SelectTrigger>
                  <SelectContent>
                    {brokers.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} ({b.country})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : sgis.length === 0 ? (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">Aucune SGI disponible pour ce marché. Veuillez contacter le support INOPAY.</p>
                </div>
              ) : (
                <Select value={selectedSgi} onValueChange={setSelectedSgi}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une SGI" /></SelectTrigger>
                  <SelectContent>
                    {sgis.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                {sandbox ? "En mode sandbox, SGI-TEST est utilisée par défaut." : isGse ? "Your broker will execute the order on the Ghana Stock Exchange." : `Votre SGI exécutera l'ordre sur la ${instrument?.market === "BVMAC" ? "BVMAC" : "BRVM"}.`}
              </p>
            </div>
          </div>
        )}

        {/* Step 2: KYC */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${kycApproved ? "bg-primary/10" : "bg-muted"}`}>
                  {kycChecking ? <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" /> : kycApproved ? <CheckCircle2 className="h-6 w-6 text-primary" /> : <Shield className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-semibold text-foreground">Vérification KYC</p>
                  <p className="text-xs text-muted-foreground">{kycChecking ? "Vérification en cours…" : kycApproved ? "Identité vérifiée ✓" : "Validation requise avant investissement"}</p>
                </div>
              </div>
              {kycApproved && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-muted-foreground">Statut</p><p className="font-medium text-primary">Validé</p></div>
                    <div><p className="text-muted-foreground">Conformité</p><p className="font-medium">BCEAO / CREPMF</p></div>
                  </div>
                </>
              )}
              {!kycApproved && !kycChecking && !sandbox && kycStatus !== "VALIDE" && (
                <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">Votre KYC n'est pas encore validé. Complétez votre vérification dans la section KYC pour pouvoir investir.</p>
                </div>
              )}
            </div>
            {!kycApproved && !kycChecking && (
              <p className="text-xs text-muted-foreground text-center">
                {sandbox ? 'Cliquez "Vérifier KYC" pour simuler la vérification.' : 'Cliquez "Vérifier KYC" pour valider votre conformité.'}
              </p>
            )}
          </div>
        )}

        {/* Step 3: Fees */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-4 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">Détail des frais</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  ✓ Conforme AMF-UMOA
                </span>
              </div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground">Sous-total ({qty} × {fmtCurrency(price, instrument?.currency)})</span><span className="font-medium">{fmtCurrency(subtotal, instrument?.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Courtage AMF-UMOA ({FEES.courtage_total}%)</span><span className="font-medium">{fmtCurrency(courtageFee, instrument?.currency)}</span></div>
              <div className="pl-4 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">dont {isGse ? (broker?.name || "Broker") : (sgi?.name || "SGI")} ({((FEES.courtage_total - FEES.inopay_percent) / FEES.courtage_total * 100).toFixed(0)}%)</span><span>{fmtCurrency(sgiFee, instrument?.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">dont INOPAY ({(FEES.inopay_percent / FEES.courtage_total * 100).toFixed(0)}%)</span><span>{fmtCurrency(inopayFee, instrument?.currency)}</span></div>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">Frais {isGse ? "GSE/CSD" : "BRVM/DC-BR"} ({FEES.brvm_percent}%)</span><span>{fmtCurrency(brvmFee, instrument?.currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{isGse ? "NHIL/GETFund" : "TVA"} ({FEES.tva_percent}%)</span><span>{fmtCurrency(tva, instrument?.currency)}</span></div>
              <Separator />
              <div className="flex justify-between"><span className="text-muted-foreground font-medium">Total frais</span><span className="font-bold">{fmtCurrency(totalFees, instrument?.currency)}</span></div>
              <div className="flex justify-between text-base pt-1">
                <span className="font-semibold">{type === "buy" ? (isGse ? "Total to pay" : "Montant total à payer") : (isGse ? "Net amount" : "Montant net à recevoir")}</span>
                <span className="font-bold text-primary">{fmtCurrency(grandTotal, instrument?.currency)}</span>
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Tarification AMF-UMOA :</strong> Le courtage de {FEES.courtage_total}% est partagé entre la SGI et INOPAY (commission {FEES.inopay_percent}%). L'investisseur paie uniquement le taux réglementaire.</p>
            </div>
          </div>
        )}

        {/* Step 4: Payment */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Gateway selector */}
            {!paymentDone && !paymentProcessing && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Moyen de paiement</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentGateway("cinetpay")}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${paymentGateway === "cinetpay" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-muted-foreground/30"}`}
                  >
                    <span className="text-2xl">📱</span>
                    <span className="text-sm font-semibold text-foreground">CinetPay</span>
                    <span className="text-[10px] text-muted-foreground text-center">Mobile Money, Carte bancaire (FCFA)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentGateway("paystack")}
                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${paymentGateway === "paystack" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-muted-foreground/30"}`}
                  >
                    <span className="text-2xl">💳</span>
                    <span className="text-sm font-semibold text-foreground">Paystack</span>
                    <span className="text-[10px] text-muted-foreground text-center">Carte, Mobile Money, Bank Transfer</span>
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${paymentDone ? "bg-primary/10" : "bg-muted"}`}>
                  {paymentProcessing ? <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" /> : paymentDone ? <CheckCircle2 className="h-6 w-6 text-primary" /> : <CreditCard className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div>
                  <p className="font-semibold text-foreground">
                    {paymentDone ? "Paiement confirmé" : paymentProcessing ? "Traitement en cours…" : `Paiement ${paymentGateway === "paystack" ? "Paystack" : "CinetPay"}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {paymentDone
                      ? `Transaction ${sandbox ? "simulée" : "confirmée"} — ${fmtCurrency(grandTotal, instrument?.currency)}`
                      : sandbox
                        ? "Simulation du paiement"
                        : `Paiement sécurisé via ${paymentGateway === "paystack" ? "Paystack" : "CinetPay"}`}
                  </p>
                </div>
              </div>
              {!paymentDone && !paymentProcessing && (
                <>
                  <Separator />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Montant</span><span className="font-bold">{fmtCurrency(grandTotal, instrument?.currency)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Passerelle</span><span className="font-medium">{paymentGateway === "paystack" ? "Paystack" : "CinetPay"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Bénéficiaire</span><span className="font-medium">{isGse ? (broker?.name || "Broker") : (sgi?.name || "SGI")}</span></div>
                  </div>
                  {!sandbox && (
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-foreground">
                      {paymentGateway === "paystack"
                        ? "Vous serez redirigé vers Paystack pour finaliser le paiement par carte bancaire, Mobile Money ou virement."
                        : "Vous serez redirigé vers CinetPay pour finaliser le paiement par Mobile Money (Orange, MTN, Moov, Wave) ou carte bancaire."}
                    </div>
                  )}
                </>
              )}
              {paymentDone && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-muted-foreground">Référence</p><p className="font-mono text-xs font-medium">{sandbox ? "SBX" : "INO"}-{Date.now().toString(36).toUpperCase()}</p></div>
                    <div><p className="text-muted-foreground">Statut</p><div className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /><span className="font-medium text-primary">COMPLETED</span></div></div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 5: Final */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="text-center space-y-1">
                <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                <p className="text-lg font-bold text-foreground">Prêt à exécuter</p>
                <p className="text-sm text-muted-foreground">Récapitulatif de votre {type === "buy" ? "achat" : "vente"}{sandbox ? " (simulation)" : ""}</p>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Instrument</span><span className="font-medium">{instrument?.symbol} — {instrument?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Quantité</span><span className="font-medium">{qty} titres</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Prix unitaire</span><span className="font-medium">{fmtCurrency(price, instrument?.currency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Frais totaux</span><span className="font-medium">{fmtCurrency(totalFees, instrument?.currency)}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">SGI</span><span className="font-medium">{sgi?.name || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">KYC</span><span className="font-medium text-primary">✓ Validé</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paiement</span><span className="font-medium text-primary">✓ Confirmé</span></div>
                <Separator />
                <div className="flex justify-between text-base">
                   <span className="font-semibold">{type === "buy" ? "Total débité" : "Total crédité"}</span>
                   <span className="font-bold text-primary">{fmtCurrency(grandTotal, instrument?.currency)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={() => step === 0 ? handleClose() : setStep((s) => s - 1)}>
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            {step === 0 ? "Annuler" : "Retour"}
          </Button>
          <Button
            onClick={handleNext}
            disabled={!canNext() || submitting || kycChecking || paymentProcessing}
          >
            {(submitting || kycChecking || paymentProcessing) && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {step === 2 && !kycApproved ? "Vérifier KYC" : step === 4 && !paymentDone ? "Payer" : step === 5 ? "Confirmer l'ordre" : "Suivant"}
            {!submitting && !kycChecking && !paymentProcessing && step < 5 && <ArrowRight className="ml-1.5 h-3.5 w-3.5" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
