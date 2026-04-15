import React, { useEffect, useState, useCallback, Component, ErrorInfo } from "react";

class MarketsErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("[Markets Error]", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-muted-foreground text-sm">Une erreur est survenue lors du chargement des marchés.</p>
          <button className="text-sm text-primary underline" onClick={() => this.setState({ error: null })}>Réessayer</button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Helmet } from "react-helmet-async";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InvestorDashboardLayout } from "@/components/investor/InvestorDashboardLayout";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingUp, TrendingDown, Minus, ArrowRight, RefreshCw, Wifi, WifiOff, ShoppingCart, UserPlus, Globe } from "lucide-react";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

interface Instrument {
  id: string; name: string; symbol: string | null; isin: string | null;
  instrument_type: string | null; market: string | null; currency: string | null;
  last_price: number | null; description: string | null; change_percent: number | null;
  volume: number | null; last_synced_at: string | null;
}
interface PricePoint { price: number; recorded_at: string; source?: string; }

const AUTO_REFRESH_INTERVAL = 60_000;
const TRADABLE_MARKETS = ["BRVM", "BVMAC", "GSE"];

function formatPrice(price: number, currency: string | null): string {
  if (currency === "GHS") return `GH₵ ${price.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return price.toLocaleString("fr-FR");
}

function getSourceBadge(source: string, market: string | null, t: any) {
  // Sources ending in _sim are simulated; any other non-empty source is live data
  const isLive = !!source && !source.endsWith("_sim");
  const label = market || t("markets.estimatedLabel");
  return { label, live: isLive };
}

const MarketsContent = ({ isLoggedIn }: { isLoggedIn: boolean }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addItem, items } = useCart();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [sparklines, setSparklines] = useState<Record<string, PricePoint[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [filter, setFilter] = useState(searchParams.get("filter") || "all");
  const [sectorFilter, setSectorFilter] = useState(searchParams.get("sector") || "");
  const [marketFilter, setMarketFilter] = useState("all");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [sourceMap, setSourceMap] = useState<Record<string, string>>({});
  const [liveCount, setLiveCount] = useState(0);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
    const { data } = await supabase.from("instruments").select("*").order("name");
    if (data) {
      setInstruments(data as Instrument[]);
      const ids = data.map((i: any) => i.id);
      if (ids.length > 0) {
        // Fetch price history in smaller batches to avoid statement timeout
        const BATCH_SIZE = 20;
        const allHistory: any[] = [];
        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
          const batchIds = ids.slice(i, i + BATCH_SIZE);
          const { data: history } = await supabase
            .from("price_history")
            .select("instrument_id, price, recorded_at, source")
            .in("instrument_id", batchIds)
            .order("recorded_at", { ascending: false })
            .limit(batchIds.length * 20);
          if (history) allHistory.push(...history);
        }
        if (allHistory.length > 0) {
          const grouped: Record<string, PricePoint[]> = {};
          const sources: Record<string, string> = {};
          for (const h of allHistory) {
            if (!grouped[h.instrument_id]) grouped[h.instrument_id] = [];
            if (grouped[h.instrument_id].length < 20) grouped[h.instrument_id].push({ price: h.price, recorded_at: h.recorded_at, source: h.source });
            if (!sources[h.instrument_id]) sources[h.instrument_id] = h.source || "brvm_sim";
          }
          for (const key of Object.keys(grouped)) grouped[key].reverse();
          setSparklines(grouped);
          setSourceMap(sources);
          setLiveCount(Object.values(sources).filter(s => !!s && !s.endsWith("_sim")).length);
        }
      }
    }
    setLastRefresh(new Date());
    } catch (e) { console.error("[Markets] fetchData error:", e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); const interval = setInterval(() => fetchData(true), AUTO_REFRESH_INTERVAL); return () => clearInterval(interval); }, [fetchData]);

  const filtered = instruments.filter((i) => {
    const matchSearch = (i.name || "").toLowerCase().includes(search.toLowerCase()) || (i.symbol || "").toLowerCase().includes(search.toLowerCase());
    const matchType = filter === "all" || (filter === "actions" && i.instrument_type === "Action") || (filter === "obligations" && i.instrument_type === "Obligation");
    const matchMarket = marketFilter === "all" || i.market === marketFilter;
    const matchSector = !sectorFilter || (i as any).sector?.toLowerCase().includes(sectorFilter.toLowerCase());
    return matchSearch && matchType && matchMarket && matchSector;
  });

  const lastSync = instruments.find((i) => i.last_synced_at)?.last_synced_at;
  const markets = [...new Set(instruments.map(i => i.market).filter(Boolean))].sort();
  const hasLiveData = liveCount > 0;
  const marketCounts = instruments.reduce((acc, i) => { const m = i.market || "Autre"; acc[m] = (acc[m] || 0) + 1; return acc; }, {} as Record<string, number>);
  const isTradable = (market: string | null) => TRADABLE_MARKETS.includes(market || "");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {hasLiveData ? <Wifi className="h-3.5 w-3.5 text-primary" /> : <WifiOff className="h-3.5 w-3.5" />}
          {hasLiveData ? t("markets.realtime", { count: liveCount }) : t("markets.estimated")}
          {lastSync && <span className="text-xs opacity-70">— Sync : {new Date(lastSync).toLocaleString()}</span>}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Globe className="h-3 w-3" />
            {Object.entries(marketCounts).map(([m, c]) => (<Badge key={m} variant="outline" className="text-[10px] px-1.5 py-0">{m}: {c}</Badge>))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setLoading(true); fetchData(); }}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t("markets.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Tabs value={marketFilter} onValueChange={setMarketFilter}>
            <TabsList>
              <TabsTrigger value="all">{t("markets.allMarkets")}</TabsTrigger>
              {markets.map(m => <TabsTrigger key={m} value={m!}>{m}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              <TabsTrigger value="all">{t("markets.all")}</TabsTrigger>
              <TabsTrigger value="actions">{t("markets.stocks")}</TabsTrigger>
              <TabsTrigger value="obligations">{t("markets.bondsFilter")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
        <span>{t("markets.instruments", { count: filtered.length })}</span>
        <span>•</span>
        <span>{filtered.filter(i => (Number(i.change_percent) || 0) > 0).length} {t("markets.rising")}</span>
        <span>•</span>
        <span>{filtered.filter(i => (Number(i.change_percent) || 0) < 0).length} {t("markets.falling")}</span>
        <span>•</span>
        <span className={hasLiveData ? "text-primary" : "text-amber-500"}>
          {liveCount} {t("markets.live")} · {instruments.length - liveCount} {t("markets.estimatedShort")}
        </span>
      </div>

      {!isLoggedIn && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-foreground">{t("markets.createAccountCta")}</p>
            <Button onClick={() => navigate("/register")} size="sm"><UserPlus className="mr-1.5 h-4 w-4" />{t("markets.createAccountBtn")}</Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20"><p className="text-muted-foreground">{t("markets.noInstrument")}</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((instrument) => {
            const changePct = Number(instrument.change_percent) || 0;
            const direction = changePct > 0 ? "up" : changePct < 0 ? "down" : "flat";
            const spark = sparklines[instrument.id] || [];
            const source = sourceMap[instrument.id] || "";
            const badge = getSourceBadge(source, instrument.market, t);
            const tradable = isTradable(instrument.market);

            return (
              <Card key={instrument.id} className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/20 group" onClick={() => navigate(`/instrument/${instrument.id}`)}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold rounded bg-muted px-2 py-0.5 text-muted-foreground">{instrument.symbol}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{instrument.market}</Badge>
                        {badge.live ? (<Badge className="text-[10px] px-1.5 py-0 bg-primary/90 text-primary-foreground border-0">{badge.label}</Badge>) : (<Badge variant="secondary" className="text-[10px] px-1.5 py-0 opacity-60">{badge.label}</Badge>)}
                        {!tradable && (<Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/50 text-amber-600">{t("markets.consultationOnly")}</Badge>)}
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-foreground truncate">{instrument.name}</h3>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xl font-bold text-foreground">{formatPrice(Number(instrument.last_price) || 0, instrument.currency)}</p>
                      <p className="text-xs text-muted-foreground">{instrument.currency}{instrument.volume ? ` · Vol: ${Number(instrument.volume).toLocaleString("fr-FR")}` : ""}</p>
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-medium ${direction === "up" ? "text-primary" : direction === "down" ? "text-destructive" : "text-muted-foreground"}`}>
                      {direction === "up" ? <TrendingUp className="h-4 w-4" /> : direction === "down" ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                      {changePct > 0 ? "+" : ""}{changePct.toFixed(2)}%
                    </div>
                  </div>
                  <div className="mt-3 flex items-end gap-px h-8">
                    {(spark.length > 0 ? spark : Array.from({ length: 20 }, () => ({ price: Number(instrument.last_price) || 5000 }))).map((p, i) => {
                      const prices = spark.length > 0 ? spark.map((s) => Number(s.price)) : [Number(instrument.last_price) || 5000];
                      const min = Math.min(...prices); const max = Math.max(...prices); const range = max - min || 1;
                      const height = ((Number(p.price) - min) / range) * 100;
                      return (<div key={i} className={`flex-1 rounded-t-sm ${direction === "up" ? "bg-primary/60" : direction === "down" ? "bg-destructive/50" : "bg-muted-foreground/30"}`} style={{ height: `${Math.max(height, 5)}%` }} />);
                    })}
                  </div>
                  {isLoggedIn && tradable ? (
                    <Button variant="outline" size="sm" className="w-full mt-3" onClick={(e) => {
                      e.stopPropagation();
                      const inCart = items.some(it => it.instrumentId === instrument.id);
                      if (inCart) { toast({ title: t("markets.alreadyInCart", { symbol: instrument.symbol }) }); return; }
                      addItem({ instrumentId: instrument.id, instrumentName: instrument.name, symbol: instrument.symbol || "", unitPrice: instrument.last_price || 0, currency: instrument.currency || "XOF" }, 1);
                      toast({ title: t("markets.addedToCart", { symbol: instrument.symbol }) });
                    }}>
                      <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />{t("markets.addToCart")}
                    </Button>
                  ) : isLoggedIn && !tradable ? (
                    <div className="mt-3 text-center text-xs text-muted-foreground py-1.5 bg-muted/50 rounded-md">{t("markets.gseTradingSoon")}</div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full mt-3" onClick={(e) => { e.stopPropagation(); navigate("/register"); }}>
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />{t("markets.investBtn")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const Markets = () => {
  const { t } = useTranslation();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setIsLoggedIn(!!session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setIsLoggedIn(!!session));
    return () => subscription.unsubscribe();
  }, []);

  if (isLoggedIn === null) return <div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;

  if (isLoggedIn) return <InvestorDashboardLayout title={t("markets.title")} subtitle={t("markets.subtitle")}><MarketsContent isLoggedIn /></InvestorDashboardLayout>;

  return (
    <AppLayout>
      <Helmet>
        <title>Marchés Financiers Africains – BRVM, BVMAC, GSE | INOPAY</title>
        <meta name="description" content="Suivez les cours en temps réel des actions et obligations sur les marchés africains : BRVM, BVMAC et GSE Ghana. Données actualisées en continu." />
        <link rel="canonical" href="https://getinopay.com/markets" />
      </Helmet>
      <PageHero badge={t("markets.title")} badgeIcon={<TrendingUp className="h-3.5 w-3.5 text-primary" />} title={t("markets.title")} subtitle={t("markets.subtitle")} />
      <div className="container mx-auto px-4 py-10">
        <MarketsContent isLoggedIn={false} />
      </div>
    </AppLayout>
  );
};

const MarketsWithBoundary = () => (
  <MarketsErrorBoundary>
    <Markets />
  </MarketsErrorBoundary>
);

export default MarketsWithBoundary;
