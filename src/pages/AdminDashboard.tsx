import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  FileText, 
  Shield, 
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
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg text-foreground">Admin Inopay</span>
          </div>
          <Badge className="mt-2 bg-destructive/10 text-destructive border-destructive/20">
            Mode Administrateur
          </Badge>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setActiveTab(item.id)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => navigate("/dashboard")}
          >
            <Home className="h-4 w-4" />
            Dashboard Standard
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-destructive hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">{getPageTitle()}</h1>
            <p className="text-muted-foreground mt-1">{getPageDescription()}</p>
          </div>

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
      </main>
    </div>
  );
};

export default AdminDashboard;
