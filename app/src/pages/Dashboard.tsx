import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InvestorDashboardLayout } from "@/components/investor/InvestorDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, TrendingUp, BarChart3, Shield, Landmark, ArrowRight, Globe, GraduationCap, Crown, Newspaper, BookOpen } from "lucide-react";
import { KycStatusBadge, type KycStatusType } from "@/components/KycStatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { User } from "@supabase/supabase-js";
import { PortfolioChart } from "@/components/investor/PortfolioChart";
import { InvestorBadges } from "@/components/investor/InvestorBadges";
import { SandboxConversionCta } from "@/components/investor/SandboxConversionCta";
import { SocialInvesting } from "@/components/investor/SocialInvesting";
import { useTranslation } from "react-i18next";

interface SandboxPosition { id: string; quantity: number; average_price: number; instrument_id: string | null; }

const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<KycStatusType>("NON_COMMENCE");
  const [positions, setPositions] = useState<SandboxPosition[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [planEndDate, setPlanEndDate] = useState<string | null>(null);
  const [showKycPopup, setShowKycPopup] = useState(false);
  const [brvmNews, setBrvmNews] = useState<any[]>([]);
  const [sandboxTxCount, setSandboxTxCount] = useState(0);
  const [sandboxBalance, setSandboxBalance] = useState(10_000_000);

  const educationalCards = [
    { icon: Globe, title: t("dashboard.educCards.diaspora.title"), description: t("dashboard.educCards.diaspora.desc") },
    { icon: Landmark, title: t("dashboard.educCards.exchanges.title"), description: t("dashboard.educCards.exchanges.desc") },
    { icon: GraduationCap, title: t("dashboard.educCards.sandbox.title"), description: t("dashboard.educCards.sandbox.desc") },
    { icon: BookOpen, title: t("dashboard.educCards.brokers.title"), description: t("dashboard.educCards.brokers.desc") },
  ];

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (mounted) navigate("/login"); return; }

      // Role-based redirect using stored user role (returned by /auth/login and /auth/me)
      const role = (session.user as any).role;
      const userType = (session.user as any).user_type;
      if (role === "admin") { if (mounted) navigate("/admin", { replace: true }); return; }
      if (userType === "sgi_user") { if (mounted) navigate("/sgi/dashboard/clients", { replace: true }); return; }

      if (!mounted) return;
      setUser(session.user);
      setLoading(false);

      // Load data
      supabase.from("kycs").select("status").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(1).then(({ data }) => {
        if (!mounted) return;
        if (data && data.length > 0) { const s = (data[0].status as KycStatusType) || "NON_COMMENCE"; setKycStatus(s); if (s === "NON_COMMENCE" || s === "REFUSE") setTimeout(() => setShowKycPopup(true), 1500); }
        else setTimeout(() => setShowKycPopup(true), 1500);
      });

      supabase.from("sandbox_portfolios").select("id, quantity, average_price, instrument_id").eq("user_id", session.user.id).then(({ data }) => { if (data && mounted) setPositions(data); });
      supabase.from("sandbox_balances").select("balance").eq("user_id", session.user.id).order("created_at", { ascending: false }).limit(1).then(({ data }) => { if (data && data.length > 0 && mounted) setSandboxBalance(Number(data[0].balance)); });
      supabase.from("sandbox_transactions").select("id", { count: "exact", head: true }).eq("user_id", session.user.id).then(({ count }) => { if (mounted) setSandboxTxCount(count || 0); });
      supabase.from("subscriptions").select("plan_id, end_date, status").eq("user_id", session.user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).then(async ({ data: subData }) => {
        if (!mounted) return;
        if (subData && subData.length > 0) { setPlanEndDate(subData[0].end_date); const { data: planData } = await supabase.from("plans").select("nom").eq("id", subData[0].plan_id).single(); if (planData && mounted) setCurrentPlan((planData as any).nom); }
      });
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && mounted) { navigate("/login"); }
    });

    supabase.from("brvm_news").select("id, title, published_at").order("published_at", { ascending: false }).limit(3).then(({ data }) => { if (data && mounted) setBrvmNews(data as any[]); });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  if (loading) return <InvestorDashboardLayout title={t("dashboard.title")} badge="Dashboard" badgeIcon={<BarChart3 className="h-3 w-3 text-primary" />}><div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div></InvestorDashboardLayout>;

  const activePositions = positions.filter((p) => p.quantity && p.quantity > 0);

  return (
    <InvestorDashboardLayout title={t("dashboard.title")} subtitle={t("dashboard.welcome", { email: user?.email })} badge="Dashboard" badgeIcon={<BarChart3 className="h-3 w-3 text-primary" />}>
      <div className="space-y-6 animate-fade-in">
        {kycStatus !== "VALIDE" && (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {kycStatus === "NON_COMMENCE" ? t("dashboard.completeKyc") : kycStatus === "EN_ATTENTE" || kycStatus === "EN_REVISION" ? t("dashboard.kycInProgress") : t("dashboard.kycRefused")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.kycRequired")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <KycStatusBadge status={kycStatus} />
                {(kycStatus === "NON_COMMENCE" || kycStatus === "REFUSE") && <Button size="sm" onClick={() => navigate("/kyc")}>{t("dashboard.complete")}</Button>}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.myPlan")}</CardTitle><Crown className="h-4 w-4 text-primary" /></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{currentPlan || t("dashboard.none")}</p>
              {planEndDate ? <p className="mt-1 text-xs text-muted-foreground">{t("dashboard.expiresOn", { date: new Date(planEndDate).toLocaleDateString() })}</p> : <Button size="sm" variant="link" className="mt-1 p-0 h-auto text-xs" onClick={() => navigate("/dashboard/subscription")}>{t("dashboard.viewPlans")}</Button>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.sandboxBalance")}</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><p className="text-3xl font-bold text-foreground">{sandboxBalance.toLocaleString("fr-FR")} <span className="text-base font-medium text-muted-foreground">FCFA</span></p><p className="mt-1 text-xs text-muted-foreground">{t("dashboard.simulationOnly")}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.openPositions")}</CardTitle><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><p className="text-3xl font-bold text-foreground">{activePositions.length}</p><p className="mt-1 text-xs text-muted-foreground">{t("dashboard.sandboxPortfolio")}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("dashboard.kycStatus")}</CardTitle><Shield className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><KycStatusBadge status={kycStatus} /><p className="mt-2 text-xs text-muted-foreground">{kycStatus === "VALIDE" ? t("dashboard.readyToInvest") : t("dashboard.freeBrowsing")}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>{t("dashboard.sandboxInvestments")}</CardTitle><CardDescription>{t("dashboard.sandboxDesc")}</CardDescription></CardHeader>
          <CardContent>
            {activePositions.length > 0 ? (
              <Table>
                <TableHeader><TableRow><TableHead>{t("dashboard.instrument")}</TableHead><TableHead className="text-right">{t("dashboard.quantity")}</TableHead><TableHead className="text-right">{t("dashboard.avgPrice")}</TableHead><TableHead className="text-right">{t("dashboard.valueFcfa")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {activePositions.map((pos) => (
                    <TableRow key={pos.id}><TableCell className="font-medium">{pos.instrument_id ? pos.instrument_id.slice(0, 8) + "…" : "—"}</TableCell><TableCell className="text-right">{pos.quantity}</TableCell><TableCell className="text-right">{(pos.average_price || 0).toLocaleString("fr-FR")}</TableCell><TableCell className="text-right font-medium">{((pos.quantity || 0) * (pos.average_price || 0)).toLocaleString("fr-FR")}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center py-10 text-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">{t("dashboard.noSandboxInvestment")}</p>
                <Button size="sm" className="mt-4" onClick={() => navigate("/markets")}>{t("dashboard.exploreMarkets")} <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {brvmNews.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2"><Newspaper className="h-5 w-5 text-primary" /><CardTitle>{t("dashboard.marketNews")}</CardTitle></div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/markets/brvm/news")}>{t("dashboard.viewAll")} <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {brvmNews.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1">{item.title}</p>
                    {item.published_at && <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(item.published_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <SandboxConversionCta tradeCount={sandboxTxCount} kycStatus={kycStatus} />
        <SocialInvesting />
        <PortfolioChart sandbox />
        <InvestorBadges />

        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">{t("dashboard.guidesResources")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {educationalCards.map((card) => (
              <Card key={card.title} className="group cursor-default">
                <CardContent className="pt-6">
                  <card.icon className="h-8 w-8 text-primary mb-3 transition-transform group-hover:scale-110" />
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">{card.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{card.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Dialog open={showKycPopup} onOpenChange={setShowKycPopup}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Shield className="h-7 w-7 text-primary" /></div>
              <DialogTitle className="text-center">{t("dashboard.activateAccount")}</DialogTitle>
              <DialogDescription className="text-center">{t("dashboard.activateDesc")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2">
              <Button size="lg" onClick={() => { setShowKycPopup(false); navigate("/kyc"); }}>{t("dashboard.completeVerification")} <ArrowRight className="ml-2 h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setShowKycPopup(false)}>{t("dashboard.later")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </InvestorDashboardLayout>
  );
};

export default Dashboard;
