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
  FlaskConical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AdminUsersList from "@/components/admin/AdminUsersList";
import AdminExportsList from "@/components/admin/AdminExportsList";
import AdminStats from "@/components/admin/AdminStats";
import AdminTesters from "@/components/admin/AdminTesters";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  // Redirect non-admins
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

        <nav className="flex-1 p-4 space-y-2">
          <Button
            variant={activeTab === "overview" ? "secondary" : "ghost"}
            className="w-full justify-start gap-2"
            onClick={() => setActiveTab("overview")}
          >
            <BarChart3 className="h-4 w-4" />
            Vue d'ensemble
          </Button>
          <Button
            variant={activeTab === "users" ? "secondary" : "ghost"}
            className="w-full justify-start gap-2"
            onClick={() => setActiveTab("users")}
          >
            <Users className="h-4 w-4" />
            Utilisateurs
          </Button>
          <Button
            variant={activeTab === "exports" ? "secondary" : "ghost"}
            className="w-full justify-start gap-2"
            onClick={() => setActiveTab("exports")}
          >
            <FileText className="h-4 w-4" />
            Exports & Qualité
          </Button>
          <Button
            variant={activeTab === "testers" ? "secondary" : "ghost"}
            className="w-full justify-start gap-2"
            onClick={() => setActiveTab("testers")}
          >
            <FlaskConical className="h-4 w-4" />
            Testeurs
          </Button>
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
            <h1 className="text-3xl font-bold text-foreground">
              {activeTab === "overview" && "Vue d'ensemble"}
              {activeTab === "users" && "Gestion des Utilisateurs"}
              {activeTab === "exports" && "Supervision des Exports"}
              {activeTab === "testers" && "Comptes Testeurs"}
            </h1>
            <p className="text-muted-foreground mt-1">
              {activeTab === "overview" && "Statistiques globales de la plateforme Inopay"}
              {activeTab === "users" && "Gérez les utilisateurs et leurs accès"}
              {activeTab === "exports" && "Vérifiez la qualité des fichiers nettoyés par l'IA"}
              {activeTab === "testers" && "Gérez les comptes avec accès Pro gratuit à vie"}
            </p>
          </div>

          {activeTab === "overview" && <AdminStats />}
          {activeTab === "users" && <AdminUsersList />}
          {activeTab === "exports" && <AdminExportsList />}
          {activeTab === "testers" && <AdminTesters />}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
