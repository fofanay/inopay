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
  Eye,
  Layers,
  Rocket,
  GitBranch,
  FolderUp,
  X,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SheetClose } from "@/components/ui/sheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
import AdminOperationsCenter from "@/components/admin/AdminOperationsCenter";
import { AdminExcessPayments } from "@/components/admin/AdminExcessPayments";
import { MobileSidebar } from "@/components/dashboard/MobileSidebar";
import { MobileHeader } from "@/components/dashboard/MobileHeader";
import { MyPersonalFleet } from "@/components/dashboard/MyPersonalFleet";
import { DeploymentChoice } from "@/components/dashboard/DeploymentChoice";
import { SyncMirror } from "@/components/dashboard/SyncMirror";
import { AnalyzedProjects } from "@/components/dashboard/AnalyzedProjects";
import { CoolifyDeploymentAssistant } from "@/components/dashboard/CoolifyDeploymentAssistant";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import inopayLogo from "@/assets/inopay-logo-admin.png";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("operations");
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);

  // Handler pour la navigation depuis MyPersonalFleet
  const handleFleetNavigate = (tab: string) => {
    // Mapper les tabs de MyPersonalFleet vers les tabs AdminDashboard
    const tabMapping: Record<string, string> = {
      "deploy-choice": "deploy-choice",
      "sync-mirror": "sync-mirror",
      "batch-import": "import",
      "import": "import",
    };
    const targetTab = tabMapping[tab] || tab;
    if (menuItems.some(m => m.id === targetTab)) {
      setActiveTab(targetTab);
    } else {
      toast.info(`Navigation vers: ${tab}`);
    }
  };

  // Handler pour la sélection d'un projet
  const handleSelectProject = (project: any) => {
    setSelectedProject(project);
    setShowProjectDetails(true);
  };

  // Helper pour obtenir la couleur du score
  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-muted-foreground";
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  // Helper pour obtenir le statut du projet
  const getStatusBadge = (status: string, score: number | null) => {
    if (status === "analyzed" && (score ?? 0) >= 70) {
      return <Badge className="bg-success/20 text-success border-success/30">Prêt à déployer</Badge>;
    }
    if (status === "analyzed") {
      return <Badge className="bg-warning/20 text-warning border-warning/30">Analysé</Badge>;
    }
    return <Badge variant="secondary">En attente</Badge>;
  };

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
    { id: "operations", label: "Centre Opérations", icon: Eye, section: "business" },
    { id: "overview", label: "Vue d'ensemble", icon: BarChart3, section: "business" },
    { id: "kpis", label: "KPIs Business", icon: TrendingUp, section: "business" },
    { id: "payments", label: "Paiements", icon: CreditCard, section: "business" },
    { id: "purchases", label: "Achats Services", icon: ShoppingCart, section: "business" },
    { id: "excess-payments", label: "Suppléments Volume", icon: TrendingUp, section: "business" },
    { id: "margins", label: "Marges Nettoyage", icon: Calculator, section: "business" },
    { id: "stripe-logs", label: "Logs Stripe", icon: Webhook, section: "business" },
    // 🖥️ Infrastructure
    { id: "my-fleet", label: "Ma Flotte Perso", icon: Layers, section: "infra" },
    { id: "deploy-assistant", label: "Deploy Assistant", icon: Rocket, section: "infra" },
    { id: "deploy-choice", label: "Choix Déploiement", icon: Rocket, section: "infra" },
    { id: "sync-mirror", label: "Sync & Mirror", icon: GitBranch, section: "infra" },
    { id: "import", label: "Import Projets", icon: FolderUp, section: "infra" },
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
      case "operations": return "Surveillance en temps réel du processus de libération";
      case "overview": return "Statistiques globales de la plateforme Inopay";
      case "diagnostic": return "Vérifiez la connectivité Supabase, VPS, Coolify et GitHub";
      case "my-fleet": return "Gérez vos propres serveurs Coolify pour les déploiements";
      case "deploy-assistant": return "Configurez et déployez automatiquement sur Coolify";
      case "deploy-choice": return "Choisissez votre méthode de déploiement préférée";
      case "sync-mirror": return "Synchronisez vos déploiements avec GitHub";
      case "import": return "Importez et analysez de nouveaux projets";
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
            {activeTab === "operations" && <AdminOperationsCenter />}
            {activeTab === "overview" && <AdminStats />}
            {activeTab === "diagnostic" && <AdminNetworkDiagnostic />}
            {activeTab === "my-fleet" && (
              <MyPersonalFleet 
                onSelectProject={handleSelectProject}
                onNavigate={handleFleetNavigate}
              />
            )}
            {activeTab === "deploy-assistant" && (
              <CoolifyDeploymentAssistant 
                onComplete={(id) => toast.success(`Déploiement créé: ${id}`)} 
              />
            )}
            {activeTab === "deploy-choice" && (
              <DeploymentChoice 
                onSelect={(option) => toast.success(`Option sélectionnée: ${option}`)} 
              />
            )}
            {activeTab === "sync-mirror" && <SyncMirror />}
            {activeTab === "import" && <AnalyzedProjects />}
            {activeTab === "fleet" && <AdminServerFleet />}
            {activeTab === "widgets" && <AdminWidgetMonitoring />}
            {activeTab === "monitoring" && <AdminActivityMonitor />}
            {activeTab === "stripe-logs" && <AdminStripeLogs />}
            {activeTab === "kpis" && <AdminKPIs />}
            {activeTab === "purchases" && <AdminPurchases />}
            {activeTab === "excess-payments" && <AdminExcessPayments />}
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

      {/* Project Details Sheet */}
      <Sheet open={showProjectDetails} onOpenChange={setShowProjectDetails}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Détails du Projet
            </SheetTitle>
            <SheetDescription>
              Informations détaillées et actions disponibles
            </SheetDescription>
          </SheetHeader>

          {selectedProject && (
            <div className="mt-6 space-y-6">
              {/* Project Header */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-foreground">{selectedProject.project_name}</h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedProject.status, selectedProject.portability_score)}
                  <span className="text-xs text-muted-foreground">
                    Créé {formatDistanceToNow(new Date(selectedProject.created_at), { addSuffix: true, locale: fr })}
                  </span>
                </div>
              </div>

              {/* Score Card */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Score de Portabilité</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className={`text-4xl font-bold ${getScoreColor(selectedProject.portability_score)}`}>
                      {selectedProject.portability_score ?? "N/A"}
                    </div>
                    <div className="flex-1">
                      <Progress 
                        value={selectedProject.portability_score ?? 0} 
                        className="h-3"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {(selectedProject.portability_score ?? 0) >= 70 
                          ? "Prêt pour le déploiement" 
                          : "Optimisation recommandée"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Issues Detected */}
              {selectedProject.detected_issues && Array.isArray(selectedProject.detected_issues) && selectedProject.detected_issues.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      Problèmes Détectés ({selectedProject.detected_issues.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedProject.detected_issues.slice(0, 5).map((issue: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 bg-muted/50 rounded-md">
                          {typeof issue === "string" ? issue : JSON.stringify(issue)}
                        </div>
                      ))}
                      {selectedProject.detected_issues.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          + {selectedProject.detected_issues.length - 5} autres problèmes
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {selectedProject.recommendations && Array.isArray(selectedProject.recommendations) && selectedProject.recommendations.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      Recommandations ({selectedProject.recommendations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedProject.recommendations.slice(0, 5).map((rec: any, idx: number) => (
                        <div key={idx} className="text-sm p-2 bg-success/5 rounded-md border-l-2 border-success">
                          {typeof rec === "string" ? rec : JSON.stringify(rec)}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="space-y-3 pt-4 border-t">
                <Button 
                  className="w-full" 
                  onClick={() => {
                    setShowProjectDetails(false);
                    setActiveTab("deploy-choice");
                  }}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  Déployer ce projet
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setShowProjectDetails(false);
                    setActiveTab("sync-mirror");
                  }}
                >
                  <GitBranch className="h-4 w-4 mr-2" />
                  Configurer la synchronisation
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setShowProjectDetails(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminDashboard;
