import { Link } from "react-router-dom";
import { Github, Twitter, Mail, Phone, MapPin, Clock, ArrowRight, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import inopayLogo from "@/assets/inopay-logo.png";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

const Footer = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isLoading) return;

    setIsLoading(true);
    try {
      // Insert email into newsletter_subscribers table
      const { error: insertError } = await supabase
        .from('newsletter_subscribers')
        .insert({ email, source: 'footer' });

      if (insertError) {
        if (insertError.code === '23505') {
          toast.info(t("footer.alreadySubscribed"));
        } else {
          throw insertError;
        }
      } else {
        // Send welcome email via edge function
        const { error: emailError } = await supabase.functions.invoke('send-newsletter-welcome', {
          body: { email }
        });

        if (emailError) {
          console.error('Error sending welcome email:', emailError);
          // Still show success since subscription worked
        }

        toast.success(t("footer.subscribeSuccess"));
      }
      setEmail("");
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      toast.error(t("footer.subscribeError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <footer className="bg-accent text-white">
      {/* Main Footer Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Column 1 - Brand & About */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-6">
              <img src={inopayLogo} alt="Inopay" className="h-12 w-auto brightness-0 invert" />
            </Link>
            <p className="text-white/70 text-sm leading-relaxed mb-6">
              {t("footer.tagline")}
            </p>
            {/* Social icons */}
            <div className="flex gap-3">
              <a 
                href="https://twitter.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 hover:bg-primary hover:text-white hover:border-primary transition-all"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a 
                href="https://github.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 hover:bg-primary hover:text-white hover:border-primary transition-all"
              >
                <Github className="h-4 w-4" />
              </a>
              <a 
                href="mailto:contact@getinopay.com"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 hover:bg-primary hover:text-white hover:border-primary transition-all"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Column 2 - Quick Links */}
          <div>
            <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              {t("footer.quickLinks")}
            </h4>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
                  {t("common.home")}
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
                  {t("common.dashboard")}
                </Link>
              </li>
              <li>
                <Link to="/economies" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
                  {t("common.savings")}
                </Link>
              </li>
              <li>
                <Link to="/tarifs" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
                  {t("common.pricing")}
                </Link>
              </li>
              <li>
                <Link to="/historique" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2 group">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/50 group-hover:bg-primary transition-colors" />
                  {t("common.history")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3 - Contact Info */}
          <div>
            <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              {t("footer.contact")}
            </h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-white font-medium">{t("footer.ourMission")}</p>
                  <p className="text-white/70 text-sm">{t("footer.liberateCode")}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-white font-medium">{t("footer.email")}</p>
                  <a href="mailto:contact@getinopay.com" className="text-white/70 text-sm hover:text-primary transition-colors">
                    contact@getinopay.com
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-white font-medium">{t("footer.support")}</p>
                  <p className="text-white/70 text-sm">{t("footer.supportAvailable")}</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Column 4 - Newsletter */}
          <div>
            <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              {t("footer.newsletter")}
            </h4>
            <p className="text-white/70 text-sm mb-4">
              {t("footer.newsletterDesc")}
            </p>
            <form onSubmit={handleNewsletterSubmit} className="space-y-3">
              <Input
                type="email"
                placeholder={t("footer.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-primary focus:ring-primary"
                required
              />
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-full font-semibold"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("footer.subscribing")}
                  </>
                ) : (
                  <>
                    {t("footer.subscribe")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
            <p className="text-white/50 text-xs mt-3">
              {t("footer.privacyNotice")}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-white/60 text-sm">
              {t("footer.copyright")}
            </p>
            <div className="flex items-center gap-6">
              <Link to="/legal/terms" className="text-white/60 text-sm hover:text-primary transition-colors">
                {t("footer.terms")}
              </Link>
              <Link to="/legal/privacy" className="text-white/60 text-sm hover:text-primary transition-colors">
                {t("footer.privacy")}
              </Link>
              <Link to="/legal/imprint" className="text-white/60 text-sm hover:text-primary transition-colors">
                {t("footer.legal")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;