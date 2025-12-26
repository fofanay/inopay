import { useState, useEffect } from "react";
import {
  TrendingUp,
  Eye,
  MousePointer,
  CreditCard,
  Loader2,
  RefreshCw,
  Package,
  Rocket,
  Activity,
  Server,
  Calendar,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface UpsellView {
  id: string;
  user_id: string;
  project_name: string;
  files_count: number;
  offers_shown: string[];
  offer_clicked: string | null;
  converted: boolean;
  purchase_id: string | null;
  created_at: string;
  converted_at: string | null;
}

interface DailyStats {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
}

const OFFER_LABELS: Record<string, { label: string; icon: typeof Rocket; color: string }> = {
  redeploy: { label: "Déploiement", icon: Rocket, color: "#10b981" },
  monitoring: { label: "Monitoring", icon: Activity, color: "#3b82f6" },
  server: { label: "Serveur VPS", icon: Server, color: "#f59e0b" },
  pack: { label: "Pack Complet", icon: Package, color: "#8b5cf6" },
};

export default function AdminUpsellStats() {
  const [loading, setLoading] = useState(true);
  const [views, setViews] = useState<UpsellView[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [filterOffer, setFilterOffer] = useState<string>("all");
  const [filterConverted, setFilterConverted] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all upsell views (admin has access via RLS policy)
      const { data, error } = await supabase
        .from("liberation_upsell_views")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;

      const viewsData = (data || []) as UpsellView[];
      setViews(viewsData);

      // Calculate daily stats for last 7 days
      const last7Days: DailyStats[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, "yyyy-MM-dd");
        const dayViews = viewsData.filter(v => format(new Date(v.created_at), "yyyy-MM-dd") === dateStr);
        
        last7Days.push({
          date: format(date, "dd/MM"),
          impressions: dayViews.length,
          clicks: dayViews.filter(v => v.offer_clicked).length,
          conversions: dayViews.filter(v => v.converted).length,
        });
      }
      setDailyStats(last7Days);
    } catch (error) {
      console.error("Error fetching upsell data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate KPIs
  const totalImpressions = views.length;
  const totalClicks = views.filter(v => v.offer_clicked).length;
  const totalConversions = views.filter(v => v.converted).length;
  const clickRate = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0";
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0";

  // Top clicked offers
  const offerClicks = views.reduce((acc, v) => {
    if (v.offer_clicked) {
      acc[v.offer_clicked] = (acc[v.offer_clicked] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topOffers = Object.entries(offerClicks)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // Filter views
  const filteredViews = views.filter(v => {
    if (filterOffer !== "all" && v.offer_clicked !== filterOffer) return false;
    if (filterConverted === "converted" && !v.converted) return false;
    if (filterConverted === "not_converted" && v.converted) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalImpressions}</p>
                <p className="text-xs text-muted-foreground">Impressions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <MousePointer className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalClicks}</p>
                <p className="text-xs text-muted-foreground">Clics ({clickRate}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalConversions}</p>
                <p className="text-xs text-muted-foreground">Conversions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Taux conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 flex items-center justify-center h-full">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              7 Derniers Jours
            </CardTitle>
            <CardDescription>Impressions, clics et conversions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))' 
                    }}
                  />
                  <Bar dataKey="impressions" name="Impressions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="clicks" name="Clics" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversions" name="Conversions" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Offers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Offres les Plus Cliquées
            </CardTitle>
            <CardDescription>Répartition des clics par offre</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topOffers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucun clic enregistré</p>
              ) : (
                topOffers.map(([offer, count]) => {
                  const offerInfo = OFFER_LABELS[offer] || { label: offer, icon: Package, color: "#6b7280" };
                  const Icon = offerInfo.icon;
                  const percentage = totalClicks > 0 ? ((count / totalClicks) * 100).toFixed(0) : 0;

                  return (
                    <div key={offer} className="flex items-center gap-4">
                      <div 
                        className="h-10 w-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${offerInfo.color}20` }}
                      >
                        <Icon className="h-5 w-5" style={{ color: offerInfo.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{offerInfo.label}</span>
                          <span className="text-sm text-muted-foreground">{count} clics ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full"
                            style={{ width: `${percentage}%`, backgroundColor: offerInfo.color }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Détail des Impressions</CardTitle>
              <CardDescription>Liste des affichages d'offres post-libération</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterOffer} onValueChange={setFilterOffer}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Offre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes offres</SelectItem>
                  <SelectItem value="redeploy">Déploiement</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="server">Serveur</SelectItem>
                  <SelectItem value="pack">Pack</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterConverted} onValueChange={setFilterConverted}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="converted">Convertis</SelectItem>
                  <SelectItem value="not_converted">Non convertis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Projet</TableHead>
                <TableHead>Fichiers</TableHead>
                <TableHead>Offre cliquée</TableHead>
                <TableHead>Converti</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredViews.slice(0, 50).map((view) => (
                <TableRow key={view.id}>
                  <TableCell className="font-medium">{view.project_name}</TableCell>
                  <TableCell>{view.files_count}</TableCell>
                  <TableCell>
                    {view.offer_clicked ? (
                      <Badge variant="outline">
                        {OFFER_LABELS[view.offer_clicked]?.label || view.offer_clicked}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={view.converted ? "default" : "secondary"}>
                      {view.converted ? "Oui" : "Non"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(view.created_at), { addSuffix: true, locale: fr })}
                  </TableCell>
                </TableRow>
              ))}
              {filteredViews.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucune donnée disponible
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {filteredViews.length > 50 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Affichage des 50 premiers résultats sur {filteredViews.length}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}