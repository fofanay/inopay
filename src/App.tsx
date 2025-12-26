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
// Services page merged into Pricing - redirect handled via NotFound
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";
import Imprint from "./pages/legal/Imprint";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
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
            <Route path="/services" element={<Pricing />} />
            <Route path="/legal/terms" element={<Terms />} />
            <Route path="/legal/privacy" element={<Privacy />} />
            <Route path="/legal/imprint" element={<Imprint />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
