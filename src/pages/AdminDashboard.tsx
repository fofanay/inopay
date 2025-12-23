import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  FileText, 
  Loader2,
  BarChart3,
  LogOut,
  Home,
  FlaskConical,
  CreditCard,
  CalendarCheck,
  Mail,
  Bell,
  Settings,
  LineChart,
  Server,
  Activity,
  Shield,
  Wrench,
  TrendingUp,
  ShoppingCart,
  Smartphone,
  Webhook,
  HardDrive,
  Calculator,
  Network,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SheetClose } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RoleIndicator, RoleContextBanner } from "@/components/ui/role-indicator";
import AdminUsersList from "@/components/admin/AdminUsersList";
import AdminExportsList from "@/components/admin/AdminExportsList";
import AdminStats from "@/components/admin/AdminStats";
import AdminTesters from "@/components/admin/AdminTesters";
import AdminPayments from "@/components/admin/AdminPayments";
import AdminSubscriptions from "@/components/admin/AdminSubscriptions";
import AdminEmailCMS from "@/components/admin/AdminEmailCMS";
import AdminReminders from "@/components/admin/AdminReminders";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminServerFleet from "@/components/admin/AdminServerFleet";
import AdminActivityMonitor from "@/components/admin/AdminActivityMonitor";
import AdminSecurityAudit from "@/components/admin/AdminSecurityAudit";
import AdminKPIs from "@/components/admin/AdminKPIs";
import AdminSupportTools from "@/components/admin/AdminSupportTools";
import AdminPurchases from "@/components/admin/AdminPurchases";
import AdminStripeLogs from "@/components/admin/AdminStripeLogs";
import { AdminWidgetMonitoring } from "@/components/admin/AdminWidgetMonitoring";
import AdminMigrationTools from "@/components/admin/AdminMigrationTools";
import AdminCleaningMargins from "@/components/admin/AdminCleaningMargins";
import AdminNetworkDiagnostic from "@/components/admin/AdminNetworkDiagnostic";
import { MobileSidebar } from "@/components/dashboard/MobileSidebar";
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import inopayLogo from "@/assets/inopay-logo-admin.png";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate("/auth");
        return;
      }
      if (!isAdmin) {
        toast.error("Accès refusé - Administrateurs uniquement");
        navigate("/dashboard");
      }
    }
  }, [user, authLoading, isAdmin, navigate]);

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

  if (!isAdmin) {
    return null;
  }

  // Menu groupé par domaine
  const menuItems = [
    // 👥 Utilisateurs
    { id: "users", label: "Utilisateurs", icon: Users, section: "users" },
    { id: "testers", label: "Testeurs", icon: FlaskConical, section: "users" },
    { id: "subscriptions", label: "Abonnements", icon: CalendarCheck, section: "users" },
    // 💰 Business
    { id: "overview", label: "Vue d'ensemble", icon: BarChart3, section: "business" },
    { id: "kpis", label: "KPIs Business", icon: TrendingUp, section: "business" },
    { id: "payments", label: "Paiements", icon: CreditCard, section: "business" },
    { id: "purchases", label: "Achats Services", icon: ShoppingCart, section: "business" },
    { id: "margins", label: "Marges Nettoyage", icon: Calculator, section: "business" },
    { id: "stripe-logs", label: "Logs Stripe", icon: Webhook, section: "business" },
    // 🖥️ Infrastructure
    { id: "fleet", label: "Flotte Serveurs", icon: Server, section: "infra" },
    { id: "widgets", label: "Widgets & Sync", icon: Smartphone, section: "infra" },
    { id: "monitoring", label: "Monitoring", icon: Activity, section: "infra" },
    { id: "diagnostic", label: "Diagnostic Réseau", icon: Network, section: "infra" },
    // 📧 Marketing
    { id: "emails", label: "Emails (CMS)", icon: Mail, section: "marketing" },
    { id: "reminders", label: "Relances", icon: Bell, section: "marketing" },
    { id: "analytics", label: "Analytics", icon: LineChart, section: "marketing" },
    // 🔐 Sécurité & Support
    { id: "security", label: "Sécurité", icon: Shield, section: "security" },
    { id: "support", label: "Support Admin", icon: Wrench, section: "security" },
    { id: "exports", label: "Exports & Qualité", icon: FileText, section: "security" },
    { id: "migration", label: "Migration", icon: HardDrive, section: "security" },
    { id: "settings", label: "Paramètres", icon: Settings, section: "security" },
  ];

  const getPageTitle = () => {
    const item = menuItems.find(m => m.id === activeTab);
    return item?.label || "Dashboard";
  };

  const getPageDescription = () => {
    switch (activeTab) {
      case "overview": return "Statistiques globales de la plateforme Inopay";
      case "diagnostic": return "Vérifiez la connectivité Supabase, VPS, Coolify et GitHub";
      case "fleet": return "Vue temps réel de tous les serveurs et déploiements clients";
      case "widgets": return "Surveillance des widgets mobiles et synchronisations";
      case "monitoring": return "Journal d'activité et alertes en temps réel";
      case "stripe-logs": return "Historique des webhooks Stripe et erreurs de paiement";
      case "kpis": return "Revenus, taux de succès et métriques business";
      case "purchases": return "Tous les achats de services par utilisateur";
      case "security": return "Audit Zero-Knowledge et vérification des secrets";
      case "support": return "Outils d'intervention et notifications utilisateurs";
      case "users": return "Gérez les utilisateurs et leurs accès";
      case "payments": return "Revenus, paiements et remboursements Stripe";
      case "subscriptions": return "Abonnements actifs, coupons et MRR";
      case "analytics": return "Graphiques et métriques avancées";
      case "emails": return "Templates d'emails personnalisables";
      case "reminders": return "Campagnes d'emails automatiques";
      case "exports": return "Vérifiez la qualité des fichiers nettoyés par l'IA";
      case "migration": return "Exportez schéma et données pour migrer vers votre Supabase";
      case "testers": return "Gérez les comptes avec accès Pro gratuit à vie";
      case "settings": return "Configuration globale de l'application";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Admin Context Banner */}
      <RoleContextBanner role="admin" />
      
      <div className="flex flex-1">
      <MobileSidebar
        menuItems={menuItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        logo={<img src={inopayLogo} alt="Inopay" className="h-10 object-contain" />}
        planBadge={
          <Badge className="bg-primary/20 text-primary-foreground border-primary/30">
            Administration
          </Badge>
        }
        bottomActions={
          <>
            <SheetClose asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 h-11 text-secondary-foreground/80"
                onClick={() => navigate("/dashboard")}
              >
                <Home className="h-4 w-4" />
                Dashboard Standard
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

      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-72 bg-secondary flex-col">
        {/* Logo Header */}
        <div className="p-6 border-b border-secondary/50">
          <div className="flex items-center justify-center mb-3">
            <img src={inopayLogo} alt="Inopay" className="h-12 object-contain" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <RoleIndicator role="admin" size="md" />
            <span className="text-xs text-secondary-foreground/60">
              Gestion plateforme Inopay
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={`w-full justify-start gap-3 text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10 ${
                activeTab === item.id 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" 
                  : ""
              }`}
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-secondary/50 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10"
            onClick={() => navigate("/dashboard")}
          >
            <Home className="h-4 w-4" />
            Dashboard Standard
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <MobileHeader 
          title={getPageTitle()} 
          description={getPageDescription()} 
        />

        {/* Content Area */}
        <div className="p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === "overview" && <AdminStats />}
            {activeTab === "diagnostic" && <AdminNetworkDiagnostic />}
            {activeTab === "fleet" && <AdminServerFleet />}
            {activeTab === "widgets" && <AdminWidgetMonitoring />}
            {activeTab === "monitoring" && <AdminActivityMonitor />}
            {activeTab === "stripe-logs" && <AdminStripeLogs />}
            {activeTab === "kpis" && <AdminKPIs />}
            {activeTab === "purchases" && <AdminPurchases />}
            {activeTab === "margins" && <AdminCleaningMargins />}
            {activeTab === "security" && <AdminSecurityAudit />}
            {activeTab === "support" && <AdminSupportTools />}
            {activeTab === "users" && <AdminUsersList />}
            {activeTab === "payments" && <AdminPayments />}
            {activeTab === "subscriptions" && <AdminSubscriptions />}
            {activeTab === "analytics" && <AdminAnalytics />}
            {activeTab === "emails" && <AdminEmailCMS />}
            {activeTab === "reminders" && <AdminReminders />}
            {activeTab === "exports" && <AdminExportsList />}
            {activeTab === "migration" && <AdminMigrationTools />}
            {activeTab === "testers" && <AdminTesters />}
            {activeTab === "settings" && <AdminSettings />}
          </div>
        </div>
      </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
