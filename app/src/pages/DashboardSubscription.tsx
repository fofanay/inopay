import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { InvestorDashboardLayout } from "@/components/investor/InvestorDashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CreditCard, Zap, Rocket, Star, Crown, Check, Loader2, CalendarDays, ArrowUpRight, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Plan { id: string; nom: string; prix_fcfa: number; features: string[]; }
interface Subscription { id: string; plan_id: string; status: string; start_date: string | null; end_date: string | null; }

const planIcons: Record<string, React.ElementType> = { STARTER: Zap, INVESTOR: Rocket, PRO: Star, ELITE: Crown };

const DashboardSubscription = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [paymentGateway, setPaymentGateway] = useState<"cinetpay" | "paystack">("cinetpay");
  const loc = i18n.language === "fr" ? "fr-FR" : "en-US";

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setUserId(session.user.id);
      setUserEmail(session.user.email || null);
      const { data: plansData } = await supabase.from("plans").select("id, nom, prix_fcfa, features").order("prix_fcfa", { ascending: true });
      if (plansData) setPlans(plansData as unknown as Plan[]);
      const { data: subData } = await supabase.from("subscriptions").select("id, plan_id, status, start_date, end_date").eq("user_id", session.user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1);
      if (subData && subData.length > 0) {
        const sub = subData[0] as unknown as Subscription;
        setCurrentSub(sub);
        if (plansData) { const found = (plansData as unknown as Plan[]).find(p => p.id === sub.plan_id); if (found) setCurrentPlan(found); }
      }
      setLoading(false);
    };
    load();
  }, [navigate]);

  const handleSubscribe = async (plan: Plan) => {
    if (!userId) { navigate("/login"); return; }
    if (plan.prix_fcfa === 0) {
      const { error } = await supabase.from("subscriptions").insert({ user_id: userId, plan_id: plan.id, status: "active", start_date: new Date().toISOString(), end_date: null });
      if (!error) {
        toast.success(t("dashboardSubscription.planActivated", { name: plan.nom }));
        setCurrentSub({ id: "", plan_id: plan.id, status: "active", start_date: new Date().toISOString(), end_date: null });
        setCurrentPlan(plan);
      } else { toast.error(t("dashboardSubscription.activationError")); }
      return;
    }
    setSubscribing(plan.id);
    try {
      if (paymentGateway === "paystack") {
        if (!userEmail) { toast.error(t("dashboardSubscription.genericError")); setSubscribing(null); return; }
        const { data, error } = await supabase.functions.invoke("paystack-init", {
          body: {
            amount: plan.prix_fcfa,
            email: userEmail,
            user_id: userId,
            currency: "XOF",
            callback_url: `${window.location.origin}/subscription/success`,
            metadata: { plan_id: plan.id, plan_name: plan.nom, payment_type: "subscription" },
          },
        });
        if (error) throw error;
        if (data?.payment_url) { window.location.href = data.payment_url; }
        else { toast.error(t("dashboardSubscription.paymentError")); }
      } else {
        const { data, error } = await supabase.functions.invoke("cinetpay-subscription", { body: { plan_id: plan.id, plan_name: plan.nom, amount: plan.prix_fcfa } });
        if (error) throw error;
        if (data?.payment_url) { window.location.href = data.payment_url; }
        else { toast.error(t("dashboardSubscription.paymentError")); }
      }
    } catch (err: any) { console.error("Payment error:", err); toast.error(err?.message || t("dashboardSubscription.genericError")); }
    setSubscribing(null);
  };

  const daysRemaining = currentSub?.end_date ? Math.max(0, Math.ceil((new Date(currentSub.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
  const progressPercent = daysRemaining !== null ? Math.min(100, ((30 - daysRemaining) / 30) * 100) : 0;

  if (loading) {
    return (
      <InvestorDashboardLayout title={t("dashboardSubscription.title")} badge="Abonnement" badgeIcon={<Crown className="h-3 w-3 text-primary" />}>
        <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </InvestorDashboardLayout>
    );
  }

  return (
    <InvestorDashboardLayout title={t("dashboardSubscription.title")} subtitle={t("dashboardSubscription.subtitle")} badge="Abonnement" badgeIcon={<Crown className="h-3 w-3 text-primary" />}>
      <div className="space-y-8 max-w-5xl animate-fade-in">
        <Card className={currentSub ? "border-primary/30" : "border-dashed border-muted-foreground/30"}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />{t("dashboardSubscription.currentSub")}</CardTitle>
            <CardDescription>{currentSub ? t("dashboardSubscription.currentSubDesc") : t("dashboardSubscription.noSubDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentSub && currentPlan ? (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                      {React.createElement(planIcons[currentPlan.nom] || Zap, { className: "h-7 w-7 text-primary" })}
                    </div>
                    <div>
                      <p className="text-xl font-bold text-foreground">{t("dashboardSubscription.plan")} {currentPlan.nom}</p>
                      <p className="text-sm text-muted-foreground">{currentPlan.prix_fcfa === 0 ? t("dashboardSubscription.free") : `${currentPlan.prix_fcfa.toLocaleString(loc)} ${t("dashboardSubscription.perMonth")}`}</p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 w-fit">{t("dashboardSubscription.active")}</Badge>
                </div>
                {currentSub.end_date && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border bg-card p-4 space-y-1">
                        <p className="text-xs text-muted-foreground">{t("dashboardSubscription.startDate")}</p>
                        <p className="font-semibold text-foreground flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{currentSub.start_date ? new Date(currentSub.start_date).toLocaleDateString(loc) : "—"}</p>
                      </div>
                      <div className="rounded-lg border bg-card p-4 space-y-1">
                        <p className="text-xs text-muted-foreground">{t("dashboardSubscription.expiration")}</p>
                        <p className="font-semibold text-foreground flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{new Date(currentSub.end_date).toLocaleDateString(loc)}</p>
                      </div>
                      <div className="rounded-lg border bg-card p-4 space-y-1">
                        <p className="text-xs text-muted-foreground">{t("dashboardSubscription.daysRemaining")}</p>
                        <p className={`font-semibold flex items-center gap-1.5 ${daysRemaining !== null && daysRemaining <= 5 ? "text-destructive" : "text-foreground"}`}>
                          <Zap className="h-3.5 w-3.5" />{daysRemaining !== null ? `${daysRemaining}` : "—"}
                        </p>
                      </div>
                    </div>
                    {daysRemaining !== null && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground"><span>{t("dashboardSubscription.cycleProgress")}</span><span>{Math.round(progressPercent)}%</span></div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-8 space-y-3">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted"><CreditCard className="h-8 w-8 text-muted-foreground" /></div>
                <p className="text-muted-foreground">{t("dashboardSubscription.choosePlan")}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-foreground">{t("dashboardSubscription.availablePlans")}</h2>
              <p className="text-sm text-muted-foreground">{t("dashboardSubscription.availablePlansDesc")}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setPaymentGateway("cinetpay")}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-all ${paymentGateway === "cinetpay" ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}
              >
                📱 CinetPay
              </button>
              <button
                type="button"
                onClick={() => setPaymentGateway("paystack")}
                className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-all ${paymentGateway === "paystack" ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:border-muted-foreground/40"}`}
              >
                💳 Paystack
              </button>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const Icon = planIcons[plan.nom] || Zap;
              const isCurrent = currentPlan?.id === plan.id;
              const isUpgrade = currentPlan ? plan.prix_fcfa > currentPlan.prix_fcfa : false;
              const isPopular = plan.nom === "PRO";
              return (
                <Card key={plan.id} className={`relative flex flex-col transition-all hover:shadow-lg ${isCurrent ? "border-primary border-2 shadow-md ring-2 ring-primary/10" : isPopular ? "border-primary/50 border-2" : "border-border"}`}>
                  {isCurrent && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">{t("dashboardSubscription.currentPlan")}</Badge>}
                  {!isCurrent && isPopular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground">{t("dashboardSubscription.popular")}</Badge>}
                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><Icon className="h-6 w-6 text-primary" /></div>
                    <CardTitle className="text-lg">{plan.nom}</CardTitle>
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-foreground">{plan.prix_fcfa === 0 ? t("dashboardSubscription.free") : plan.prix_fcfa.toLocaleString(loc)}</span>
                      {plan.prix_fcfa > 0 && <span className="text-xs text-muted-foreground ml-1">FCFA/{i18n.language === "fr" ? "mois" : "month"}</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1">
                    <ul className="space-y-2 mb-5 flex-1">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm"><Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" /><span className="text-muted-foreground text-xs">{f}</span></li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <Button variant="outline" size="sm" className="w-full" disabled><Check className="h-4 w-4 mr-1" /> {t("dashboardSubscription.current")}</Button>
                    ) : (
                      <Button size="sm" className="w-full" variant={isUpgrade || (!currentPlan && isPopular) ? "default" : "outline"} onClick={() => handleSubscribe(plan)} disabled={subscribing === plan.id}>
                        {subscribing === plan.id && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        {isUpgrade && <ArrowUpRight className="h-4 w-4 mr-1" />}
                        {plan.prix_fcfa === 0 ? t("dashboardSubscription.start") : isUpgrade ? t("dashboardSubscription.upgrade") : t("dashboardSubscription.subscribe")}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("dashboardSubscription.faqTitle")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><p className="font-medium text-sm text-foreground">{t("dashboardSubscription.faq1q")}</p><p className="text-sm text-muted-foreground">{t("dashboardSubscription.faq1a")}</p></div>
            <div><p className="font-medium text-sm text-foreground">{t("dashboardSubscription.faq2q")}</p><p className="text-sm text-muted-foreground">{t("dashboardSubscription.faq2a")}</p></div>
            <div><p className="font-medium text-sm text-foreground">{t("dashboardSubscription.faq3q")}</p><p className="text-sm text-muted-foreground">{t("dashboardSubscription.faq3a")}</p></div>
          </CardContent>
        </Card>
      </div>
    </InvestorDashboardLayout>
  );
};

export default DashboardSubscription;
