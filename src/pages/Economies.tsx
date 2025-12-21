import { useState } from "react";
import { Link } from "react-router-dom";
import { 
  DollarSign, 
  TrendingDown, 
  Server, 
  Cloud, 
  CheckCircle2, 
  ArrowRight,
  Calculator,
  Zap,
  Shield,
  Database,
  Search,
  MessageSquare,
  Mail,
  HardDrive,
  BarChart3,
  Lock,
  Rocket
} from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COSTLY_SERVICES, COST_CATEGORIES, CostlyServiceDefinition } from "@/lib/costOptimization";

const Economies = () => {
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [vpsMonthly, setVpsMonthly] = useState(10);
  const [projectsCount, setProjectsCount] = useState(1);

  const toggleService = (serviceId: string) => {
    const newSelected = new Set(selectedServices);
    if (newSelected.has(serviceId)) {
      newSelected.delete(serviceId);
    } else {
      newSelected.add(serviceId);
    }
    setSelectedServices(newSelected);
  };

  const selectedServicesList = COSTLY_SERVICES.filter(s => selectedServices.has(s.id));
  const totalCloudCost = selectedServicesList.reduce((sum, s) => sum + s.averageMonthlyCost, 0);
  const totalSelfHostedCost = vpsMonthly;
  const monthlySavings = Math.max(0, totalCloudCost - totalSelfHostedCost);
  const yearlySavings = monthlySavings * 12;
  const roiMonths = monthlySavings > 0 ? Math.ceil(99 / monthlySavings) : 0;

  const servicesByCategory = COSTLY_SERVICES.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, CostlyServiceDefinition[]>);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "ai": return <MessageSquare className="h-5 w-5" />;
      case "vectordb": return <Database className="h-5 w-5" />;
      case "auth": return <Lock className="h-5 w-5" />;
      case "search": return <Search className="h-5 w-5" />;
      case "realtime": return <Zap className="h-5 w-5" />;
      case "email": return <Mail className="h-5 w-5" />;
      case "storage": return <HardDrive className="h-5 w-5" />;
      case "analytics": return <BarChart3 className="h-5 w-5" />;
      case "database": return <Database className="h-5 w-5" />;
      default: return <Server className="h-5 w-5" />;
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-24 pb-16">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-6 bg-success/10 text-success border-success/20 gap-2">
              <TrendingDown className="h-4 w-4" />
              Conseiller en Économies
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
              Économisez jusqu'à{" "}
              <span className="text-success">500$/mois</span>
              {" "}sur vos factures API
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Remplacez vos services cloud payants par des alternatives Open Source 
              auto-hébergées sur votre propre VPS. Gardez le contrôle et éliminez les factures.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/dashboard">
                <Button size="lg" className="gap-2 rounded-xl shadow-lg">
                  <Rocket className="h-5 w-5" />
                  Analyser mon projet
                </Button>
              </Link>
              <a href="#calculator">
                <Button variant="outline" size="lg" className="gap-2 rounded-xl">
                  <Calculator className="h-5 w-5" />
                  Calculer mes économies
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Comparison Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground">
              Cloud vs Self-Hosted : La comparaison
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Voyez la différence entre payer des services cloud et auto-héberger les alternatives Open Source
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Cloud Services */}
            <Card className="border-destructive/20 bg-gradient-to-br from-destructive/5 to-card">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                  <Cloud className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle className="text-2xl text-destructive">Services Cloud</CardTitle>
                <CardDescription>Factures mensuelles récurrentes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-destructive/5">
                    <span>OpenAI (GPT-4)</span>
                    <span className="font-bold text-destructive">~50$/mois</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-destructive/5">
                    <span>Pinecone (Vector DB)</span>
                    <span className="font-bold text-destructive">~70$/mois</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-destructive/5">
                    <span>Clerk (Auth)</span>
                    <span className="font-bold text-destructive">~25$/mois</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-destructive/5">
                    <span>Algolia (Search)</span>
                    <span className="font-bold text-destructive">~35$/mois</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-destructive/5">
                    <span>Pusher (Realtime)</span>
                    <span className="font-bold text-destructive">~49$/mois</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-destructive/20">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-medium">Total mensuel</span>
                    <span className="font-bold text-destructive text-2xl">~229$/mois</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Soit <strong className="text-destructive">2 748$/an</strong> de factures API
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Self-Hosted */}
            <Card className="border-success/20 bg-gradient-to-br from-success/5 to-card">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
                  <Server className="h-8 w-8 text-success" />
                </div>
                <CardTitle className="text-2xl text-success">Self-Hosted</CardTitle>
                <CardDescription>Un seul VPS, toutes les alternatives</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-success/5">
                    <span>Ollama (LLM local)</span>
                    <span className="font-bold text-success">0$/mois</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-success/5">
                    <span>PGVector (PostgreSQL)</span>
                    <span className="font-bold text-success">0$/mois</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-success/5">
                    <span>Supabase Auth / PocketBase</span>
                    <span className="font-bold text-success">0$/mois</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-success/5">
                    <span>Meilisearch</span>
                    <span className="font-bold text-success">0$/mois</span>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg bg-success/5">
                    <span>Soketi (Pusher-compatible)</span>
                    <span className="font-bold text-success">0$/mois</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-success/20">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-medium">VPS (Hetzner/Contabo)</span>
                    <span className="font-bold text-success text-2xl">~10$/mois</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Soit <strong className="text-success">120$/an</strong> pour tout héberger
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Savings Summary */}
          <div className="mt-12 text-center">
            <Card className="max-w-xl mx-auto border-primary/20 bg-gradient-to-br from-primary/5 to-card">
              <CardContent className="p-8">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <DollarSign className="h-12 w-12 text-success" />
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground">Économie annuelle</p>
                    <p className="text-4xl font-bold text-success">2 628$/an</p>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  Avec un déploiement Inopay à <strong className="text-primary">99$</strong>, 
                  vous êtes rentable en <strong className="text-success">moins d'1 mois</strong> !
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Interactive Calculator */}
        <section id="calculator" className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 gap-2">
              <Calculator className="h-4 w-4" />
              Calculateur Interactif
            </Badge>
            <h2 className="text-3xl font-bold mb-4 text-foreground">
              Calculez vos économies personnalisées
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Sélectionnez les services que vous utilisez actuellement pour voir combien vous pourriez économiser
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Services Selection */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-primary" />
                    Services Cloud utilisés
                  </CardTitle>
                  <CardDescription>
                    Cliquez sur les services que vous payez actuellement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="ai" className="w-full">
                    <TabsList className="flex flex-wrap h-auto gap-2 bg-transparent p-0 mb-6">
                      {Object.entries(COST_CATEGORIES).map(([key, category]) => (
                        <TabsTrigger 
                          key={key} 
                          value={key}
                          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg gap-1"
                        >
                          {category.icon} {category.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>

                    {Object.entries(servicesByCategory).map(([category, services]) => (
                      <TabsContent key={category} value={category} className="space-y-3">
                        {services.map((service) => {
                          const isSelected = selectedServices.has(service.id);
                          return (
                            <button
                              key={service.id}
                              onClick={() => toggleService(service.id)}
                              className={`w-full p-4 rounded-xl border transition-all text-left ${
                                isSelected 
                                  ? "bg-primary/10 border-primary/30" 
                                  : "bg-card border-border hover:border-primary/20"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                    isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                                  }`}>
                                    {isSelected ? (
                                      <CheckCircle2 className="h-5 w-5" />
                                    ) : (
                                      getCategoryIcon(category)
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-foreground">{service.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                      → {service.alternative.name}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className={`font-bold ${isSelected ? "text-destructive line-through" : "text-foreground"}`}>
                                    {service.averageMonthlyCost}$/mois
                                  </p>
                                  {isSelected && (
                                    <p className="text-success font-medium">0$/mois</p>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </TabsContent>
                    ))}
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Calculator Results */}
            <div className="space-y-6">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-success" />
                    Vos économies
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* VPS Cost Slider */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm text-muted-foreground">Coût VPS mensuel</label>
                      <span className="font-bold text-foreground">{vpsMonthly}$/mois</span>
                    </div>
                    <Slider 
                      value={[vpsMonthly]} 
                      onValueChange={(v) => setVpsMonthly(v[0])}
                      min={5}
                      max={50}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Hetzner Cloud: 5-20$ • Contabo: 5-15$ • DigitalOcean: 10-40$
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="space-y-4 pt-4 border-t border-border">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Services sélectionnés</span>
                      <Badge variant="outline">{selectedServices.size}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Coût cloud actuel</span>
                      <span className="font-bold text-destructive">{totalCloudCost}$/mois</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Coût self-hosted</span>
                      <span className="font-bold text-success">{totalSelfHostedCost}$/mois</span>
                    </div>
                  </div>

                  {/* Big Savings */}
                  <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                    <p className="text-sm text-success mb-1">Économie mensuelle</p>
                    <p className="text-3xl font-bold text-success">{monthlySavings}$/mois</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Soit <strong className="text-success">{yearlySavings}$/an</strong>
                    </p>
                  </div>

                  {/* ROI */}
                  {monthlySavings > 0 && (
                    <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <p className="text-sm font-medium text-primary">Retour sur investissement</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Avec Inopay à 99$, rentabilisé en <strong className="text-primary">{roiMonths} mois</strong>
                      </p>
                    </div>
                  )}

                  <Link to="/dashboard" className="block">
                    <Button className="w-full gap-2 rounded-xl" size="lg">
                      <Rocket className="h-5 w-5" />
                      Analyser mon projet
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4 text-foreground">
              Pourquoi auto-héberger ?
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="text-center p-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                <DollarSign className="h-7 w-7 text-success" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">Coûts Prévisibles</h3>
              <p className="text-muted-foreground">
                Un VPS à prix fixe au lieu de factures variables qui explosent avec l'usage
              </p>
            </Card>

            <Card className="text-center p-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">Contrôle Total</h3>
              <p className="text-muted-foreground">
                Vos données restent chez vous. Pas de vendor lock-in, pas de dépendance
              </p>
            </Card>

            <Card className="text-center p-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
                <Zap className="h-7 w-7 text-accent" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-foreground">Performance</h3>
              <p className="text-muted-foreground">
                Latence réduite avec des services sur votre propre infrastructure
              </p>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16">
          <Card className="max-w-3xl mx-auto border-primary/20 bg-gradient-to-br from-primary/10 via-card to-success/10">
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-bold mb-4 text-foreground">
                Prêt à réduire vos factures API ?
              </h2>
              <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                Importez votre projet Lovable et laissez notre IA détecter automatiquement 
                les services coûteux et proposer des alternatives Open Source.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/dashboard">
                  <Button size="lg" className="gap-2 rounded-xl shadow-lg">
                    <Rocket className="h-5 w-5" />
                    Analyser mon projet gratuitement
                  </Button>
                </Link>
                <Link to="/tarifs">
                  <Button variant="outline" size="lg" className="gap-2 rounded-xl">
                    Voir les tarifs
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </Layout>
  );
};

export default Economies;
