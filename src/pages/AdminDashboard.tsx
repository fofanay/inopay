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
  LineChart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
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

  const menuItems = [
    { id: "overview", label: "Vue d'ensemble", icon: BarChart3 },
    { id: "users", label: "Utilisateurs", icon: Users },
    { id: "payments", label: "Paiements", icon: CreditCard },
    { id: "subscriptions", label: "Abonnements", icon: CalendarCheck },
    { id: "analytics", label: "Analytics", icon: LineChart },
    { id: "emails", label: "Emails (CMS)", icon: Mail },
    { id: "reminders", label: "Relances", icon: Bell },
    { id: "exports", label: "Exports & Qualité", icon: FileText },
    { id: "testers", label: "Testeurs", icon: FlaskConical },
    { id: "settings", label: "Paramètres", icon: Settings },
  ];

  const getPageTitle = () => {
    const item = menuItems.find(m => m.id === activeTab);
    return item?.label || "Dashboard";
  };

  const getPageDescription = () => {
    switch (activeTab) {
      case "overview": return "Statistiques globales de la plateforme Inopay";
      case "users": return "Gérez les utilisateurs et leurs accès";
      case "payments": return "Revenus, paiements et remboursements Stripe";
      case "subscriptions": return "Abonnements actifs, coupons et MRR";
      case "analytics": return "Graphiques et métriques avancées";
      case "emails": return "Templates d'emails personnalisables";
      case "reminders": return "Campagnes d'emails automatiques";
      case "exports": return "Vérifiez la qualité des fichiers nettoyés par l'IA";
      case "testers": return "Gérez les comptes avec accès Pro gratuit à vie";
      case "settings": return "Configuration globale de l'application";
      default: return "";
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-72 bg-secondary flex flex-col">
        {/* Logo Header */}
        <div className="p-6 border-b border-secondary/50">
          <div className="flex items-center justify-center mb-3">
            <img src={inopayLogo} alt="Inopay" className="h-12 object-contain" />
          </div>
          <div className="text-center">
            <Badge className="bg-primary/20 text-primary-foreground border-primary/30 hover:bg-primary/30">
              Administration
            </Badge>
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
        {/* Top Header */}
        <header className="bg-card border-b border-border px-8 py-6">
          <h1 className="text-2xl font-bold text-foreground">{getPageTitle()}</h1>
          <p className="text-muted-foreground mt-1">{getPageDescription()}</p>
        </header>

        {/* Content Area */}
        <div className="p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === "overview" && <AdminStats />}
            {activeTab === "users" && <AdminUsersList />}
            {activeTab === "payments" && <AdminPayments />}
            {activeTab === "subscriptions" && <AdminSubscriptions />}
            {activeTab === "analytics" && <AdminAnalytics />}
            {activeTab === "emails" && <AdminEmailCMS />}
            {activeTab === "reminders" && <AdminReminders />}
            {activeTab === "exports" && <AdminExportsList />}
            {activeTab === "testers" && <AdminTesters />}
            {activeTab === "settings" && <AdminSettings />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
