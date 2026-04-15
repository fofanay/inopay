import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InvestorDashboardLayout } from "@/components/investor/InvestorDashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Landmark, Building2, Wifi, Zap, Heart, ArrowRight, TrendingUp, Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ThematicPack {
  id: string;
  icon: React.ElementType;
  titleKey: string;
  descKey: string;
  color: string;
  filters: { sectors?: string[]; types?: string[]; namePattern?: string; bondSearch?: string };
}

const THEMATIC_PACKS: ThematicPack[] = [
  {
    id: "passive-income",
    icon: TrendingUp,
    titleKey: "thematic.packs.passiveIncome.title",
    descKey: "thematic.packs.passiveIncome.desc",
    color: "from-emerald-500/20 to-emerald-600/5",
    filters: { types: ["bond"], sectors: ["Finances", "Services publics", "Utilities"] },
  },
  {
    id: "halal-sukuk",
    icon: Heart,
    titleKey: "thematic.packs.halal.title",
    descKey: "thematic.packs.halal.desc",
    color: "from-violet-500/20 to-violet-600/5",
    filters: { bondSearch: "sukuk" },
  },
  {
    id: "banks",
    icon: Building2,
    titleKey: "thematic.packs.banks.title",
    descKey: "thematic.packs.banks.desc",
    color: "from-blue-500/20 to-blue-600/5",
    filters: { sectors: ["Finances", "Finance", "Banking", "Banques"] },
  },
  {
    id: "telecoms",
    icon: Wifi,
    titleKey: "thematic.packs.telecoms.title",
    descKey: "thematic.packs.telecoms.desc",
    color: "from-orange-500/20 to-orange-600/5",
    filters: { sectors: ["Télécommunications", "Telecommunications", "Telecom"] },
  },
  {
    id: "infrastructure",
    icon: Zap,
    titleKey: "thematic.packs.infra.title",
    descKey: "thematic.packs.infra.desc",
    color: "from-amber-500/20 to-amber-600/5",
    filters: { sectors: ["Industrie", "Industry", "Energie", "Energy", "Infrastructure", "Transport"] },
  },
];

interface PackStats {
  instrumentCount: number;
  avgYield: number | null;
  markets: string[];
}

const ThematicPortfolios = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Record<string, PackStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      const { data: instruments } = await supabase.from("instruments").select("id, sector, instrument_type, market, name");
      const { data: bonds } = await supabase.from("bond_issuances").select("id, title, coupon_rate, listing_market");

      const newStats: Record<string, PackStats> = {};

      for (const pack of THEMATIC_PACKS) {
        let matchedInstruments: typeof instruments = [];
        let bondCount = 0;
        let bondYieldSum = 0;
        const marketsSet = new Set<string>();

        if (instruments) {
          matchedInstruments = instruments.filter((inst) => {
            if (pack.filters.types?.length && !pack.filters.types.includes(inst.instrument_type || "")) return false;
            if (pack.filters.sectors?.length && !pack.filters.sectors.some((s) => (inst.sector || "").toLowerCase().includes(s.toLowerCase()))) return false;
            return true;
          });
          matchedInstruments.forEach((i) => { if (i.market) marketsSet.add(i.market); });
        }

        if (bonds && pack.filters.bondSearch) {
          const matched = bonds.filter((b) => b.title.toLowerCase().includes(pack.filters.bondSearch!.toLowerCase()));
          bondCount = matched.length;
          matched.forEach((b) => { bondYieldSum += b.coupon_rate || 0; if (b.listing_market) marketsSet.add(b.listing_market); });
        }

        if (bonds && pack.id === "passive-income") {
          bondCount = bonds.length;
          bonds.forEach((b) => { bondYieldSum += b.coupon_rate || 0; if (b.listing_market) marketsSet.add(b.listing_market); });
        }

        const totalCount = (matchedInstruments?.length || 0) + bondCount;
        const avgYield = bondCount > 0 ? bondYieldSum / bondCount : null;

        newStats[pack.id] = { instrumentCount: totalCount, avgYield, markets: Array.from(marketsSet) };
      }

      setStats(newStats);
      setLoading(false);
    };

    loadStats();
  }, []);

  return (
    <InvestorDashboardLayout
      title={t("thematic.title")}
      subtitle={t("thematic.subtitle")}
      badge={t("thematic.badge")}
      badgeIcon={<Globe className="h-3 w-3 text-primary" />}
    >
      <div className="space-y-6 animate-fade-in">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {THEMATIC_PACKS.map((pack) => {
            const s = stats[pack.id];
            return (
              <Card key={pack.id} className={`group hover:shadow-lg transition-all duration-300 bg-gradient-to-br ${pack.color} border-border/40`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="rounded-xl bg-background/80 p-3">
                      <pack.icon className="h-6 w-6 text-primary" />
                    </div>
                    {s && s.instrumentCount > 0 && (
                      <Badge variant="secondary" className="text-xs">{s.instrumentCount} {t("thematic.instruments")}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-3">{t(pack.titleKey)}</CardTitle>
                  <CardDescription className="text-sm">{t(pack.descKey)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {loading ? (
                    <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  ) : s ? (
                    <>
                      {s.avgYield !== null && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{t("thematic.avgYield")}</span>
                          <span className="font-semibold text-primary">{s.avgYield.toFixed(2)}%</span>
                        </div>
                      )}
                      {s.markets.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {s.markets.map((m) => (
                            <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                          ))}
                        </div>
                      )}
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    className="w-full mt-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    variant="outline"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (pack.filters.types?.[0] === "bond") params.set("filter", "obligations");
                      else if (pack.filters.sectors?.length) params.set("sector", pack.filters.sectors[0]);
                      if (pack.filters.bondSearch) params.set("search", pack.filters.bondSearch);
                      navigate(`/markets?${params.toString()}`);
                    }}
                  >
                    {t("thematic.explore")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </InvestorDashboardLayout>
  );
};

export default ThematicPortfolios;
