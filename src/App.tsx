import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { PWAInstallPrompt, OfflineIndicator, ServiceWorkerUpdater } from "@/components/pwa";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import About from "./pages/About";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import History from "./pages/History";
import Pricing from "./pages/Pricing";
import Economies from "./pages/Economies";
import PaymentSuccess from "./pages/PaymentSuccess";
import LiberationReport from "./pages/LiberationReport";
import Widget from "./pages/Widget";
import { AgencyDashboard } from "./components/dashboard/AgencyDashboard";
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";
import Imprint from "./pages/legal/Imprint";
import NotFound from "./pages/NotFound";

// Liberator Dashboard Pages
import { LiberatorLayout } from "./components/liberator/LiberatorLayout";
import HomeDashboard from "./pages/liberator/HomeDashboard";
import UploadProject from "./pages/liberator/UploadProject";
import AuditResults from "./pages/liberator/AuditResults";
import CleanerProgress from "./pages/liberator/CleanerProgress";
import RebuildView from "./pages/liberator/RebuildView";
import DownloadPackage from "./pages/liberator/DownloadPackage";
import LiberationHistory from "./pages/liberator/LiberationHistory";
import AISettings from "./pages/liberator/AISettings";
import SelfHostInopay from "./pages/liberator/SelfHostInopay";

const queryClient = new QueryClient();

const App = () => (
  <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <OfflineIndicator />
          <PWAInstallPrompt />
          <ServiceWorkerUpdater />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin-dashboard" element={<AdminDashboard />} />
            <Route path="/a-propos" element={<About />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/parametres" element={<Settings />} />
            <Route path="/profil" element={<Profile />} />
            <Route path="/historique" element={<History />} />
            <Route path="/tarifs" element={<Pricing />} />
            <Route path="/economies" element={<Economies />} />
            <Route path="/payment-success" element={<PaymentSuccess />} />
            <Route path="/rapport-liberation/:deploymentId" element={<LiberationReport />} />
            <Route path="/widget" element={<Widget />} />
            <Route path="/agence" element={<AgencyDashboard />} />
            <Route path="/liberate" element={<Dashboard />} />
            <Route path="/services" element={<Pricing />} />
            <Route path="/legal/terms" element={<Terms />} />
            <Route path="/legal/privacy" element={<Privacy />} />
            <Route path="/legal/imprint" element={<Imprint />} />
            
            {/* Liberator Dashboard Routes */}
            <Route path="/liberator" element={<LiberatorLayout><HomeDashboard /></LiberatorLayout>} />
            <Route path="/liberator/upload" element={<LiberatorLayout><UploadProject /></LiberatorLayout>} />
            <Route path="/liberator/audit" element={<LiberatorLayout><AuditResults /></LiberatorLayout>} />
            <Route path="/liberator/cleaner" element={<LiberatorLayout><CleanerProgress /></LiberatorLayout>} />
            <Route path="/liberator/rebuild" element={<LiberatorLayout><RebuildView /></LiberatorLayout>} />
            <Route path="/liberator/download" element={<LiberatorLayout><DownloadPackage /></LiberatorLayout>} />
            <Route path="/liberator/history" element={<LiberatorLayout><LiberationHistory /></LiberatorLayout>} />
            <Route path="/liberator/ai-settings" element={<LiberatorLayout><AISettings /></LiberatorLayout>} />
            <Route path="/liberator/self-host" element={<LiberatorLayout><SelfHostInopay /></LiberatorLayout>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </Suspense>
);

export default App;
