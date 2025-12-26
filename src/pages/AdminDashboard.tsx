import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  FileText, 
  Loader2,
  BarChart3,
  LogOut,
  Home,
  FlaskConical,
  CreditCard,
  Settings,
  TrendingUp,
  ShoppingCart,
  Briefcase,
  Wrench,
  LayoutDashboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RoleIndicator } from "@/components/ui/role-indicator";
import AdminUsersList from "@/components/admin/AdminUsersList";
import AdminExportsList from "@/components/admin/AdminExportsList";
import AdminStats from "@/components/admin/AdminStats";
import AdminTesters from "@/components/admin/AdminTesters";
import AdminPayments from "@/components/admin/AdminPayments";
import AdminSubscriptions from "@/components/admin/AdminSubscriptions";
import AdminSettings from "@/components/admin/AdminSettings";
import AdminKPIs from "@/components/admin/AdminKPIs";
import AdminPurchases from "@/components/admin/AdminPurchases";
import AdminUpsellStats from "@/components/admin/AdminUpsellStats";
import { AdminBusinessHub } from "@/components/admin/AdminBusinessHub";
import { AdminUsersHub } from "@/components/admin/AdminUsersHub";
import { MobileSidebar } from "@/components/dashboard/MobileSidebar";
import { DashboardShell, DashboardHeader, ModernSidebar } from "@/components/dashboard/shared";
import inopayLogo from "@/assets/inopay-logo-admin.png";

type AdminTab = "overview" | "business" | "users" | "tools";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

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
    { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard, section: "main" },
    { id: "business", label: "Business", icon: Briefcase, section: "main" },
    { id: "users", label: "Utilisateurs", icon: Users, section: "main" },
    { id: "tools", label: "Outils", icon: Wrench, section: "main" },
  ];

  const sections = [
    { id: "main", label: "Navigation" },
  ];

  const getPageInfo = () => {
    switch (activeTab) {
      case "overview":
        return { 
          title: "Vue d'ensemble", 
          description: "Statistiques globales de la plateforme Inopay",
          icon: <BarChart3 className="h-5 w-5 text-primary" />
        };
      case "business":
        return { 
          title: "Business", 
          description: "Paiements, abonnements, achats et conversions",
          icon: <Briefcase className="h-5 w-5 text-primary" />
        };
      case "users":
        return { 
          title: "Utilisateurs", 
          description: "Gestion des utilisateurs et testeurs",
          icon: <Users className="h-5 w-5 text-primary" />
        };
      case "tools":
        return { 
          title: "Outils", 
          description: "Exports, qualité et paramètres",
          icon: <Wrench className="h-5 w-5 text-primary" />
        };
      default:
        return { title: "Dashboard", description: "", icon: null };
    }
  };

  const pageInfo = getPageInfo();

  const sidebar = (
    <>
      {/* Mobile Sidebar */}
      <MobileSidebar
        menuItems={menuItems}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as AdminTab)}
        logo={<img src={inopayLogo} alt="Inopay" className="h-10 object-contain" />}
        planBadge={
          <Badge className="bg-primary/20 text-primary-foreground border-primary/30">
            Administration
          </Badge>
        }
        bottomActions={
          <>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11 text-muted-foreground"
              onClick={() => navigate("/dashboard")}
            >
              <Home className="h-4 w-4" />
              Dashboard Standard
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11 text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Button>
          </>
        }
      />

      {/* Desktop Sidebar */}
      <ModernSidebar
        logo={<img src={inopayLogo} alt="Inopay" className="h-12 object-contain" />}
        planBadge={<RoleIndicator role="admin" size="md" />}
        menuItems={menuItems}
        sections={sections}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as AdminTab)}
        bottomActions={
          <>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-white/80 hover:text-white hover:bg-slate-800"
              onClick={() => navigate("/dashboard")}
            >
              <Home className="h-4 w-4" />
              Dashboard Standard
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
      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview" && <AdminStats />}
            {activeTab === "business" && <AdminBusinessHub />}
            {activeTab === "users" && <AdminUsersHub />}
            {activeTab === "tools" && (
              <div className="space-y-6">
                <AdminExportsList />
                <AdminSettings />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardShell>
  );
};

export default AdminDashboard;
