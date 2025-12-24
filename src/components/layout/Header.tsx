import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { RoleIndicator } from "@/components/ui/role-indicator";
import { LogOut, User, Menu, X, Settings, Crown, Shield, Phone, Clock, MapPin, Mail, ArrowDownRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import inopayLogo from "@/assets/inopay-logo.png";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const Header = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, subscription, signOut, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const getPlanBadge = () => {
    if (subscription.planType === "pro") {
      return (
        <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
          <Crown className="h-3 w-3" />
          Pro
        </Badge>
      );
    }
    if (subscription.planType === "pack" && subscription.creditsRemaining) {
      return (
        <Badge className="bg-success/10 text-success border-success/20 gap-1">
          {subscription.creditsRemaining} crédit{subscription.creditsRemaining > 1 ? "s" : ""}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground border-border gap-1">
        {t("common.free")}
      </Badge>
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top Bar - Navy */}
      <div className="bg-inopay-navy text-white py-2 text-sm hidden md:block">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              contact@getinopay.com
            </span>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("common.support247")}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/a-propos" className="hover:text-white/80 transition-colors">{t("common.about")}</Link>
            <Link to="/tarifs" className="hover:text-white/80 transition-colors">{t("common.pricing")}</Link>
          </div>
        </div>
      </div>

      {/* Middle Bar - White with logo and info */}
      <div className="bg-card py-4 border-b border-border">
        <div className="container mx-auto px-4 flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img src={inopayLogo} alt="Inopay" className="h-12 w-auto" />
          </Link>
          
          {/* Center info */}
          <div className="hidden lg:flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("common.ourMission")}</p>
                <p className="text-sm font-medium text-foreground">{t("common.liberateCode")}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t("common.contact")}</p>
                <p className="text-sm font-medium text-foreground">contact@getinopay.com</p>
              </div>
            </div>
          </div>


          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation Bar - Gradient Inopay */}
      <nav className="gradient-inopay py-3 hidden md:block">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link 
              to="/" 
              className={`text-sm font-medium transition-colors ${
                isActive("/") ? "text-white" : "text-white/80 hover:text-white"
              }`}
            >
              {t("common.home")}
            </Link>
            <Link 
              to="/dashboard" 
              className={`text-sm font-medium transition-colors ${
                isActive("/dashboard") ? "text-white" : "text-white/80 hover:text-white"
              }`}
            >
              {t("common.dashboard")}
            </Link>
            <Link 
              to="/economies" 
              className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                isActive("/economies") ? "text-white" : "text-white/80 hover:text-white"
              }`}
            >
              {t("common.savings")}
              <Badge className="bg-white/20 text-white border-white/30 text-xs px-1.5 py-0">
                {t("common.new")}
              </Badge>
            </Link>
            <Link 
              to="/tarifs" 
              className={`text-sm font-medium transition-colors ${
                isActive("/tarifs") ? "text-white" : "text-white/80 hover:text-white"
              }`}
            >
              {t("common.pricing")}
            </Link>
            <Link 
              to="/historique" 
              className={`text-sm font-medium transition-colors ${
                isActive("/historique") ? "text-white" : "text-white/80 hover:text-white"
              }`}
            >
              {t("common.history")}
            </Link>
          </div>
          
          {/* Auth section */}
          <div className="flex items-center gap-4">
            <LanguageSwitcher variant="navbar" />
            {user ? (
              <>
                {/* Role Indicator */}
                {isAdmin ? (
                  <RoleIndicator role="admin" size="sm" />
                ) : (
                  <RoleIndicator role="client" size="sm" />
                )}
                {isAdmin && (
                  <Link to="/admin-dashboard">
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 gap-2">
                      <Shield className="h-4 w-4" />
                      {t("common.admin")}
                    </Button>
                  </Link>
                )}
                {getPlanBadge()}
                <div className="flex items-center gap-2 text-sm text-white/80">
                  <User className="h-4 w-4" />
                  <span className="max-w-[150px] truncate">{user.email}</span>
                </div>
                <Link to="/parametres">
                  <Button variant="ghost" size="sm" className="text-white hover:bg-white/10">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
                <Button 
                  size="sm" 
                  onClick={handleSignOut}
                  className="bg-white text-accent hover:bg-white/90 rounded-full px-4"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("common.logout")}
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button 
                  size="sm" 
                  className="bg-white text-accent hover:bg-white/90 rounded-full px-6 font-semibold"
                >
                  {t("common.start")}
                  <ArrowDownRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden py-4 border-t border-border bg-card">
          <div className="container mx-auto px-4">
            <nav className="flex flex-col gap-4">
              <Link 
                to="/" 
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive("/") ? "text-primary" : "text-muted-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("common.home")}
              </Link>
              <Link 
                to="/dashboard" 
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive("/dashboard") ? "text-primary" : "text-muted-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("common.dashboard")}
              </Link>
              <Link 
                to="/economies" 
                className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-2 ${
                  isActive("/economies") ? "text-primary" : "text-muted-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("common.savings")}
                <Badge className="bg-success/10 text-success border-success/20 text-xs px-1.5 py-0">
                  {t("common.new")}
                </Badge>
              </Link>
              <Link 
                to="/tarifs" 
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive("/tarifs") ? "text-primary" : "text-muted-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("common.pricing")}
              </Link>
              <Link 
                to="/historique" 
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  isActive("/historique") ? "text-primary" : "text-muted-foreground"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {t("common.history")}
              </Link>
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{t("common.settings")}</span>
                <LanguageSwitcher />
              </div>
              <div className="pt-2 border-t border-border">
                {user ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      {isAdmin ? (
                        <RoleIndicator role="admin" size="sm" />
                      ) : (
                        <RoleIndicator role="client" size="sm" />
                      )}
                      {getPlanBadge()}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span className="truncate">{user.email}</span>
                    </div>
                    {isAdmin && (
                      <Link to="/admin-dashboard" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" size="sm" className="w-full gap-2 border-destructive/50 text-destructive">
                          <Shield className="h-4 w-4" />
                          {t("common.adminDashboard")}
                        </Button>
                      </Link>
                    )}
                    <Link to="/parametres" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">
                        <Settings className="h-4 w-4 mr-2" />
                        {t("common.settings")}
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={handleSignOut}>
                      <LogOut className="h-4 w-4 mr-2" />
                      {t("common.logout")}
                    </Button>
                  </div>
                ) : (
                  <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full rounded-full gradient-inopay">
                      {t("common.loginSignup")}
                    </Button>
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
