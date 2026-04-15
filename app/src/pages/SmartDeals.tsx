import React, { useEffect, useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InvestorDashboardLayout } from "@/components/investor/InvestorDashboardLayout";
import { SmartDealCard, SmartDeal } from "@/components/investor/SmartDealCard";
import { InvestmentTunnel } from "@/components/investor/InvestmentTunnel";
import { scoreDeal } from "@/lib/dealScoring";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Zap, Layers, ArrowRight } from "lucide-react";
import { differenceInDays } from "date-fns";

const SmartDeals = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState<any[]>([]);
  const [bonds, setBonds] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterMarket, setFilterMarket] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterRisk, setFilterRisk] = useState("all");
  const [tunnelOpen, setTunnelOpen] = useState(false);
  const [selectedDealInstrument, setSelectedDealInstrument] = useState<any>(null);
  const [sgis, setSgis] = useState<any[]>([]);
  const [kycStatus, setKycStatus] = useState("EN_ATTENTE");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      const [instRes, bondRes, tenantRes] = await Promise.all([
        supabase.from("instruments").select("*").limit(200),
        supabase.from("bond_issuances").select("*").in("status", ["open", "upcoming"]).limit(100),
        supabase.rpc("get_tenants_safe"),
      ]);

      setInstruments(instRes.data ?? []);
      setBonds(bondRes.data ?? []);
      setSgis((tenantRes.data ?? []).map((t: any) => ({ id: t.id, name: t.name, code: t.code })));

      if (user) {
        const [profileRes, recRes, kycRes] = await Promise.all([
          supabase.from("profiles").select("country").eq("user_id", user.id).single(),
          supabase.from("investment_recommendations").select("*").eq("user_id", user.id).limit(50),
          supabase.from("kycs").select("status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1),
        ]);
        setUserCountry(profileRes.data?.country ?? null);
        setRecommendations(recRes.data ?? []);
        if (kycRes.data?.[0]) setKycStatus(kycRes.data[0].status);
      }
      setLoading(false);
    };
    load();
  }, []);

  const deals: SmartDeal[] = useMemo(() => {
    const recMap = new Map(recommendations.map((r: any) => [r.instrument_id, r.score]));

    const stockDeals: SmartDeal[] = instruments.map((inst) => {
      const score = scoreDeal({
        type: "stock",
        market: inst.market || "BRVM",
        changePercent: inst.change_percent,
        userCountry,
        recommendationScore: recMap.get(inst.id) ?? null,
        orderCount: Math.floor(Math.random() * 12), // placeholder
      });
      return {
        id: inst.id,
        name: inst.name,
        type: "stock",
        market: inst.market || "BRVM",
        symbol: inst.symbol,
        price: inst.last_price,
        changePercent: inst.change_percent,
        currency: inst.currency,
        sector: inst.sector,
        score,
      };
    });

    const bondDeals: SmartDeal[] = bonds.map((b) => {
      const daysRemaining = b.close_date ? differenceInDays(new Date(b.close_date), new Date()) : null;
      const score = scoreDeal({
        type: "bond",
        market: b.listing_market || "BRVM",
        couponRate: b.coupon_rate,
        minSubscription: b.min_subscription,
        daysRemaining: daysRemaining ?? undefined,
        userCountry,
        orderCount: Math.floor(Math.random() * 8),
      });
      return {
        id: b.id,
        name: b.title,
        type: "bond",
        market: b.listing_market || "BRVM",
        couponRate: b.coupon_rate,
        currency: b.currency,
        minSubscription: b.min_subscription,
        daysRemaining: daysRemaining !== null && daysRemaining > 0 ? daysRemaining : null,
        issuer: b.issuer,
        score,
      };
    });

    return [...stockDeals, ...bondDeals];
  }, [instruments, bonds, recommendations, userCountry]);

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (filterMarket !== "all" && d.market !== filterMarket) return false;
      if (filterType !== "all" && d.type !== filterType) return false;
      if (filterRisk !== "all" && d.score.riskLevel !== filterRisk) return false;
      return true;
    });
  }, [deals, filterMarket, filterType, filterRisk]);

  const recommended = useMemo(() => [...filtered].filter((d) => d.score.isRecommended).sort((a, b) => b.score.total - a.score.total).slice(0, 8), [filtered]);
  const trending = useMemo(() => [...filtered].filter((d) => d.score.isPopular).sort((a, b) => b.score.total - a.score.total).slice(0, 8), [filtered]);
  const newBonds = useMemo(() => filtered.filter((d) => d.type === "bond" && (d.daysRemaining ?? 0) > 0).sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999)).slice(0, 8), [filtered]);
  const allSorted = useMemo(() => [...filtered].sort((a, b) => b.score.total - a.score.total), [filtered]);

  const handleInvest = (deal: SmartDeal) => {
    if (deal.type === "bond") {
      navigate(`/bonds/${deal.id}`);
    } else {
      const inst = instruments.find((i) => i.id === deal.id);
      if (inst) {
        setSelectedDealInstrument(inst);
        setTunnelOpen(true);
      }
    }
  };

  const tunnelInstruments = selectedDealInstrument
    ? [{ id: selectedDealInstrument.id, name: selectedDealInstrument.name, symbol: selectedDealInstrument.symbol, last_price: selectedDealInstrument.last_price, currency: selectedDealInstrument.currency, market: selectedDealInstrument.market }]
    : [];

  const renderGrid = (items: SmartDeal[]) => (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((deal) => (
        <SmartDealCard key={deal.id} deal={deal} onInvest={handleInvest} />
      ))}
    </div>
  );

  return (
    <InvestorDashboardLayout title={t("smartDeals.title")} subtitle={t("smartDeals.subtitle")} badge="Smart Deal Engine™" badgeIcon={<Zap className="h-3.5 w-3.5 text-primary" />}>
      <Helmet>
        <title>{t("smartDeals.pageTitle")} | INOPAY</title>
      </Helmet>

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs gap-1">
                <Zap className="h-3 w-3" /> Smart Deal Engine™
              </Badge>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t("smartDeals.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("smartDeals.subtitle")}</p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/dashboard/thematic-portfolios">
              <Layers className="h-4 w-4 mr-2" /> {t("smartDeals.viewPacks")}
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={filterMarket} onValueChange={setFilterMarket}>
            <SelectTrigger className="w-36"><SelectValue placeholder={t("smartDeals.filterMarket")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("smartDeals.allMarkets")}</SelectItem>
              <SelectItem value="BRVM">🇨🇮 BRVM</SelectItem>
              <SelectItem value="BVMAC">🇨🇲 BVMAC</SelectItem>
              <SelectItem value="GSE">🇬🇭 GSE</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-36"><SelectValue placeholder={t("smartDeals.filterType")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("smartDeals.allTypes")}</SelectItem>
              <SelectItem value="stock">{t("smartDeals.stocks")}</SelectItem>
              <SelectItem value="bond">{t("smartDeals.bonds")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterRisk} onValueChange={setFilterRisk}>
            <SelectTrigger className="w-36"><SelectValue placeholder={t("smartDeals.filterRisk")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("smartDeals.allRisks")}</SelectItem>
              <SelectItem value="low">{t("smartDeals.risk.low")}</SelectItem>
              <SelectItem value="medium">{t("smartDeals.risk.medium")}</SelectItem>
              <SelectItem value="high">{t("smartDeals.risk.high")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="recommended" className="space-y-6">
            <TabsList>
              <TabsTrigger value="recommended">{t("smartDeals.forYou")} ({recommended.length})</TabsTrigger>
              <TabsTrigger value="trending">{t("smartDeals.trending")} ({trending.length})</TabsTrigger>
              <TabsTrigger value="bonds">{t("smartDeals.newBonds")} ({newBonds.length})</TabsTrigger>
              <TabsTrigger value="all">{t("smartDeals.allDeals")} ({allSorted.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="recommended">
              {recommended.length > 0 ? renderGrid(recommended) : <p className="text-muted-foreground text-sm py-8 text-center">{t("smartDeals.noDeals")}</p>}
            </TabsContent>
            <TabsContent value="trending">
              {trending.length > 0 ? renderGrid(trending) : <p className="text-muted-foreground text-sm py-8 text-center">{t("smartDeals.noDeals")}</p>}
            </TabsContent>
            <TabsContent value="bonds">
              {newBonds.length > 0 ? renderGrid(newBonds) : <p className="text-muted-foreground text-sm py-8 text-center">{t("smartDeals.noDeals")}</p>}
            </TabsContent>
            <TabsContent value="all">
              {allSorted.length > 0 ? renderGrid(allSorted) : <p className="text-muted-foreground text-sm py-8 text-center">{t("smartDeals.noDeals")}</p>}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Investment Tunnel */}
      <InvestmentTunnel
        open={tunnelOpen}
        onClose={() => { setTunnelOpen(false); setSelectedDealInstrument(null); }}
        type="buy"
        instruments={tunnelInstruments}
        sgis={sgis}
        kycStatus={kycStatus}
        onComplete={() => { setTunnelOpen(false); setSelectedDealInstrument(null); }}
      />
    </InvestorDashboardLayout>
  );
};

export default SmartDeals;
