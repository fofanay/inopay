import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { 
  Loader2,
  Settings, 
  Package, 
  Rocket, 
  LogOut,
  Home,
  Server,
  Flame,
  LayoutDashboard,
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SheetClose } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { RoleIndicator } from "@/components/ui/role-indicator";
import { SovereignLiberationWizard } from "@/components/dashboard/SovereignLiberationWizard";
import { MyPersonalFleet } from "@/components/dashboard/MyPersonalFleet";
import { SovereigntyAuditReport } from "@/components/dashboard/SovereigntyAuditReport";
import { MobileSidebar } from "@/components/dashboard/MobileSidebar";
import { DashboardShell, DashboardHeader, ModernSidebar, ActionHero, QuickStatsBar } from "@/components/dashboard/shared";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardProjects } from "@/components/dashboard/DashboardProjects";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";
import { useDeploymentNotifications } from "@/hooks/useDeploymentNotifications";
import { supabase } from "@/integrations/supabase/client";
import inopayLogo from "@/assets/inopay-logo-admin.png";
import FofyChat from "@/components/FofyChat";

type DashboardTab = "overview" | "liberation" | "fleet" | "audit";

const DASHBOARD_TABS: DashboardTab[] = ["overview", "liberation", "fleet", "audit"];

const Dashboard = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  useDeploymentNotifications();
  const { user, loading: authLoading, subscription, isAdmin, signOut } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [stats, setStats] = useState({
    projects: 0,
    score: 0,
    deployments: 0,
    savings: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const swipeHandlers = useSwipeNavigation(
    DASHBOARD_TABS,
    activeTab,
    (tab) => setActiveTab(tab as DashboardTab),
    { threshold: 80, allowedTime: 400 }
  );

  // Redirect if not authenticated or if admin
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
    if (!authLoading && user && isAdmin) {
      navigate("/admin-dashboard");
    }
  }, [user, authLoading, isAdmin, navigate]);

  // Fetch user stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      
      try {
        // Projects
        const { data: projects } = await supabase
          .from("projects_analysis")
          .select("portability_score")
          .eq("user_id", user.id);
        
        // Deployments
        const { data: deployments } = await supabase
          .from("deployment_history")
          .select("id, cost_analysis")
          .eq("user_id", user.id);

        const { data: serverDeployments } = await supabase
          .from("server_deployments")
          .select("id, status")
          .eq("user_id", user.id)
          .eq("status", "deployed");

        // Calculate stats
        const scores = projects?.map(p => p.portability_score).filter(s => s !== null) || [];
        const avgScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => a + (b || 0), 0) / scores.length)
          : 0;

        let totalSavings = 0;
        deployments?.forEach(d => {
          if (d.cost_analysis && typeof d.cost_analysis === 'object') {
            const costData = d.cost_analysis as { monthlySavings?: number };
            if (costData.monthlySavings) {
              totalSavings += costData.monthlySavings;
            }
          }
        });

        setStats({
          projects: projects?.length || 0,
          score: avgScore,
          deployments: (deployments?.length || 0) + (serverDeployments?.length || 0),
          savings: totalSavings,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const menuItems = [
    { id: "overview", label: t("dashboard.overview"), icon: LayoutDashboard, section: "main" },
    { id: "liberation", label: t("dashboard.liberation"), icon: Flame, section: "main", badge: "🚀" },
    { id: "fleet", label: "Ma Flotte", icon: Server, section: "main" },
    { id: "audit", label: "Audit Souveraineté", icon: ShieldCheck, section: "main" },
  ];

  const sections = [
    { id: "main", label: "Navigation" },
  ];

  const getPageInfo = () => {
    switch (activeTab) {
      case "overview":
        return { 
          title: t("dashboard.overview"), 
          description: "Votre tableau de bord personnel",
          icon: <LayoutDashboard className="h-5 w-5 text-primary" />
        };
      case "liberation":
        return { 
          title: t("dashboard.liberation"), 
          description: "Libérez votre code des plateformes propriétaires",
          icon: <Flame className="h-5 w-5 text-primary" />
        };
      case "fleet":
        return { 
          title: "Ma Flotte", 
          description: "Serveurs, déploiements et synchronisations",
          icon: <Server className="h-5 w-5 text-primary" />
        };
      case "audit":
        return { 
          title: "Audit Souveraineté", 
          description: "Vérifiez que votre projet est 100% souverain",
          icon: <ShieldCheck className="h-5 w-5 text-primary" />
        };
      default:
        return { title: t("dashboard.title"), description: "", icon: null };
    }
  };

  const pageInfo = getPageInfo();

  const sidebar = (
    <>
      {/* Mobile Sidebar */}
      <MobileSidebar
        menuItems={menuItems}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as DashboardTab)}
        logo={<img src={inopayLogo} alt="Inopay" className="h-10 object-contain" />}
        planBadge={
          <Badge className={`${
            subscription.subscribed 
              ? "bg-primary/20 text-primary-foreground border-primary/30" 
              : "bg-muted/20 text-secondary-foreground/70 border-muted/30"
          }`}>
            {subscription.subscribed ? (subscription.planType === "pro" ? "Pro" : "Pack Liberté") : "Gratuit"}
          </Badge>
        }
        bottomActions={
          <>
            <SheetClose asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11 text-muted-foreground"
                onClick={() => navigate("/settings")}
              >
                <Settings className="h-4 w-4" />
                Paramètres
              </Button>
            </SheetClose>
            <SheetClose asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11 text-muted-foreground"
                onClick={() => navigate("/")}
              >
                <Home className="h-4 w-4" />
                Accueil
              </Button>
            </SheetClose>
            <SheetClose asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11 text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Déconnexion
              </Button>
            </SheetClose>
          </>
        }
      />

      {/* Desktop Sidebar */}
      <ModernSidebar
        logo={<img src={inopayLogo} alt="Inopay" className="h-12 object-contain" />}
        planBadge={
          <div className="flex flex-col items-center gap-2">
            <RoleIndicator role="client" size="md" />
            <Badge className={`${
              subscription.subscribed 
                ? "bg-primary/20 text-primary-foreground border-primary/30" 
                : "bg-muted/20 text-muted-foreground border-muted/30"
            }`}>
              {subscription.subscribed ? (subscription.planType === "pro" ? "Pro" : "Pack Liberté") : "Gratuit"}
            </Badge>
          </div>
        }
        menuItems={menuItems}
        sections={sections}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as DashboardTab)}
        bottomActions={
          <>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-white/80 hover:text-white hover:bg-slate-800"
              onClick={() => navigate("/settings")}
            >
              <Settings className="h-4 w-4" />
              Paramètres
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-white/80 hover:text-white hover:bg-slate-800"
              onClick={() => navigate("/")}
            >
              <Home className="h-4 w-4" />
              Accueil
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </>
        }
      />
    </>
  );

  const header = (
    <DashboardHeader
      title={pageInfo.title}
      description={pageInfo.description}
      icon={pageInfo.icon}
    />
  );

  return (
    <DashboardShell sidebar={sidebar} header={header}>
      <div 
        className="max-w-6xl mx-auto space-y-6"
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchEnd={swipeHandlers.onTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Hero CTA */}
                <ActionHero
                  variant="compact"
                  title="Libérez votre prochain projet"
                  description="Analysez, nettoyez et déployez en quelques clics"
                  ctaLabel="Nouvelle libération"
                  ctaIcon={<Rocket className="h-4 w-4" />}
                  onCtaClick={() => setActiveTab("liberation")}
                />

                {/* Quick Stats */}
                {!loadingStats && (
                  <QuickStatsBar stats={stats} variant="user" />
                )}

                {/* Dashboard Content */}
                <DashboardHero onNavigate={(tab) => setActiveTab(tab as DashboardTab)} />
                
                {/* Recent Projects */}
                <DashboardProjects onNavigate={(tab) => setActiveTab(tab as DashboardTab)} />
              </div>
            )}

            {activeTab === "liberation" && (
              <SovereignLiberationWizard />
            )}

            {activeTab === "fleet" && (
              <MyPersonalFleet />
            )}

            {activeTab === "audit" && (
              <SovereigntyAuditReport />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Fofy Chat Assistant */}
      <FofyChat />
    </DashboardShell>
  );
};

export default Dashboard;
