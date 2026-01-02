import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Upload,
  FileSearch,
  Sparkles,
  Box,
  Download,
  History,
  Settings,
  Server,
  Moon,
  Sun,
  Menu,
  X,
  Shield,
  Zap,
  ChevronLeft,
  ChevronRight,
  Activity,
  BookOpen,
  Rocket,
  Code2,
} from "lucide-react";
import inopayLogo from "@/assets/inopay-logo.png";

interface LiberatorLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { id: "home", label: "Dashboard", icon: Home, path: "/liberator" },
  { id: "upload", label: "Libérer un projet", icon: Upload, path: "/liberator/upload" },
  { id: "audit", label: "Résultats d'audit", icon: FileSearch, path: "/liberator/audit" },
  { id: "cleaner", label: "Nettoyage", icon: Sparkles, path: "/liberator/cleaner" },
  { id: "rebuild", label: "Reconstruction", icon: Box, path: "/liberator/rebuild" },
  { id: "download", label: "Télécharger", icon: Download, path: "/liberator/download" },
  { id: "history", label: "Historique", icon: History, path: "/liberator/history" },
];

const settingsItems = [
  { id: "monitoring", label: "Monitoring", icon: Activity, path: "/liberator/monitoring" },
  { id: "ai", label: "IA Settings", icon: Settings, path: "/liberator/ai-settings" },
  { id: "selfhost", label: "Self-Host", icon: Server, path: "/liberator/self-host" },
];

const docsItems = [
  { id: "docs-official", label: "Documentation", icon: BookOpen, path: "/docs/official" },
  { id: "docs-quickstart", label: "Quickstart", icon: Rocket, path: "/docs/quickstart" },
  { id: "docs-api", label: "API Reference", icon: Code2, path: "/docs/api" },
];

export function LiberatorLayout({ children }: LiberatorLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const isActive = (path: string) => {
    if (path === "/liberator") {
      return location.pathname === "/liberator";
    }
    return location.pathname.startsWith(path);
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-6 border-b border-border",
        collapsed && "justify-center px-2"
      )}>
        <div className="relative">
          <img src={inopayLogo} alt="Inopay" className="h-8 w-8" />
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full border-2 border-card" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-bold text-lg text-foreground">Inopay</span>
            <span className="text-xs text-muted-foreground -mt-1">Liberator</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 mb-2">
          {!collapsed && (
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Libération
            </span>
          )}
        </div>
        <ul className="space-y-1 px-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 h-10 font-medium transition-all",
                  isActive(item.path) 
                    ? "bg-primary/10 text-primary hover:bg-primary/15" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  collapsed && "justify-center px-2"
                )}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
              >
                <item.icon className={cn("h-4 w-4", isActive(item.path) && "text-primary")} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.id === "upload" && (
                  <Badge variant="secondary" className="ml-auto text-xs bg-primary/10 text-primary">
                    New
                  </Badge>
                )}
              </Button>
            </li>
          ))}
        </ul>

        <div className="px-3 mt-6 mb-2">
          {!collapsed && (
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Configuration
            </span>
          )}
        </div>
        <ul className="space-y-1 px-2">
          {settingsItems.map((item) => (
            <li key={item.id}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 h-10 font-medium transition-all",
                  isActive(item.path) 
                    ? "bg-primary/10 text-primary hover:bg-primary/15" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  collapsed && "justify-center px-2"
                )}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
              >
                <item.icon className={cn("h-4 w-4", isActive(item.path) && "text-primary")} />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            </li>
          ))}
        </ul>

        <div className="px-3 mt-6 mb-2">
          {!collapsed && (
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Documentation
            </span>
          )}
        </div>
        <ul className="space-y-1 px-2">
          {docsItems.map((item) => (
            <li key={item.id}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 h-10 font-medium transition-all",
                  isActive(item.path) 
                    ? "bg-primary/10 text-primary hover:bg-primary/15" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  collapsed && "justify-center px-2"
                )}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
              >
                <item.icon className={cn("h-4 w-4", isActive(item.path) && "text-primary")} />
                {!collapsed && <span>{item.label}</span>}
              </Button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-border p-3">
        {!collapsed && (
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">100% Souverain</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Vos données restent sur votre serveur
            </p>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="h-9 w-9"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-9 w-9 hidden md:flex"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 260 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden md:flex flex-col bg-card border-r border-border fixed h-full z-30"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border z-50 md:hidden flex flex-col"
            >
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col min-h-screen transition-all duration-200",
        collapsed ? "md:ml-[72px]" : "md:ml-[260px]"
      )}>
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center justify-between h-14 px-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div className="hidden sm:flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">
                  Libérez vos projets du vendor lock-in
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden sm:flex gap-1 items-center">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                v2.0.0
              </Badge>
              
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={() => navigate("/liberator/upload")}
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">Nouveau projet</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-4 md:p-6 lg:p-8"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
