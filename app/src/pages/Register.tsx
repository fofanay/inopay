import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { emailSchema, passwordSchema, clientRateLimit } from "@/lib/security";
import { Shield, Lock, CheckCircle2, Building2, TrendingUp } from "lucide-react";
import inopayLogo from "@/assets/inopay-logo.png";

const countryKeys = [
  "CI", "SN", "ML", "BF", "BJ", "TG", "NE", "GW",
  "CM", "GA", "CG", "TD", "CF", "GQ", "GH",
  "FR", "BE", "CH", "DE", "US", "CA", "GB", "OTHER",
];

const Register = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", country: "", phone: "", userType: "investor" as "investor" | "sgi", market: "BRVM" as "BRVM" | "BVMAC" | "GSE" });

  const step1Schema = z.object({
    firstName: z.string().trim().min(1, t("register.firstNameRequired")),
    lastName: z.string().trim().min(1, t("register.lastNameRequired")),
    email: emailSchema,
    password: passwordSchema,
  });
  const step2Schema = z.object({
    country: z.string().trim().nonempty(t("register.selectCountryError")),
    phone: z.string().trim().nonempty(t("register.phoneRequired")).max(20).regex(/^[+\d\s()-]+$/, t("register.phoneInvalid")),
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleStep1 = () => {
    const result = step1Schema.safeParse({ firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    const result = step2Schema.safeParse({ country: form.country, phone: form.phone });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }
    if (!clientRateLimit(`register_${form.email}`, 3, 300_000)) {
      toast({ title: t("register.tooManyAttempts"), description: t("register.wait5min"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      let signUpData: any = null; let lastError: any = null; let success = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await supabase.auth.signUp({ email: form.email, password: form.password, options: { emailRedirectTo: window.location.origin, data: { first_name: form.firstName, last_name: form.lastName, full_name: `${form.firstName} ${form.lastName}`.trim(), phone: form.phone, country: form.country } } });
        if (!result.error) { signUpData = result.data; success = true; break; }
        lastError = result.error;
        const isTransient = result.error.message?.includes("timeout") || result.error.message?.includes("504") || result.error.message?.includes("500") || result.error.status === 504 || result.error.status === 500;
        if (!isTransient) break;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
      if (!success) { toast({ title: t("register.error"), description: lastError?.message || t("register.genericError"), variant: "destructive" }); return; }

      const userId = signUpData.user?.id;

      // SGI registration: do NOT auto-promote on client side (privilege escalation risk)
      // SGI users should apply via /partners/apply and be approved by an admin
      if (form.userType === "sgi") {
        toast({ title: t("register.accountCreated"), description: t("register.sgiPendingApproval") });
        navigate("/partners/apply");
        return;
      }

      toast({ title: t("register.accountCreated"), description: t("register.welcome") });
      navigate("/dashboard");
    } catch { toast({ title: t("register.error"), description: t("register.genericError"), variant: "destructive" }); } finally { setLoading(false); }
  };

  return (
    <AppLayout hideFooter>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={inopayLogo} alt="INOPAY" className="mx-auto mb-4 h-10" />
            <CardTitle>{t("register.title")}</CardTitle>
            <CardDescription>{step === 1 ? t("register.step1") : t("register.step2")}</CardDescription>
            <div className="mt-4 flex gap-2">
              <div className="h-1 flex-1 rounded-full bg-primary" />
              <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {step === 1 ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t("register.accountType")}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => update("userType", "investor")}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all ${form.userType === "investor" ? "border-primary bg-primary/5 text-primary" : "border-muted bg-background text-muted-foreground hover:border-primary/40"}`}
                    >
                      <TrendingUp className="h-5 w-5" />
                      <span className="text-sm font-medium">{t("register.typeInvestor")}</span>
                      <span className="text-[10px] leading-tight text-center">{t("register.typeInvestorDesc")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => update("userType", "sgi")}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all ${form.userType === "sgi" ? "border-primary bg-primary/5 text-primary" : "border-muted bg-background text-muted-foreground hover:border-primary/40"}`}
                    >
                      <Building2 className="h-5 w-5" />
                      <span className="text-sm font-medium">{t("register.typeSgi")}</span>
                      <span className="text-[10px] leading-tight text-center">{t("register.typeSgiDesc")}</span>
                    </button>
                  </div>
                  {form.userType === "sgi" && (
                    <div className="mt-3">
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{t("register.selectMarket")}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { value: "BRVM" as const, label: "BRVM", flag: "🇨🇮", desc: t("register.marketBrvmDesc") },
                          { value: "BVMAC" as const, label: "BVMAC", flag: "🇨🇲", desc: t("register.marketBvmacDesc") },
                          { value: "GSE" as const, label: "GSE", flag: "🇬🇭", desc: t("register.marketGseDesc") },
                        ]).map((m) => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => update("market", m.value)}
                            className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all text-center ${form.market === m.value ? "border-primary bg-primary/5 text-primary" : "border-muted bg-background text-muted-foreground hover:border-primary/40"}`}
                          >
                            <span className="text-lg">{m.flag}</span>
                            <span className="text-xs font-semibold">{m.label}</span>
                            <span className="text-[9px] leading-tight">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label htmlFor="reg-firstName" className="text-sm font-medium text-foreground">{t("register.firstName")}</label>
                    <Input id="reg-firstName" placeholder={t("register.firstNamePlaceholder")} value={form.firstName} onChange={(e) => update("firstName", e.target.value)} autoComplete="given-name" />
                    {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="reg-lastName" className="text-sm font-medium text-foreground">{t("register.lastName")}</label>
                    <Input id="reg-lastName" placeholder={t("register.lastNamePlaceholder")} value={form.lastName} onChange={(e) => update("lastName", e.target.value)} autoComplete="family-name" />
                    {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="reg-email" className="text-sm font-medium text-foreground">{t("register.email")}</label>
                  <Input id="reg-email" type="email" placeholder={t("register.emailPlaceholder")} value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <label htmlFor="reg-password" className="text-sm font-medium text-foreground">{t("register.password")}</label>
                  <Input id="reg-password" type="password" placeholder={t("register.passwordPlaceholder")} value={form.password} onChange={(e) => update("password", e.target.value)} autoComplete="new-password" />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <Button className="w-full" size="lg" onClick={handleStep1}>{t("register.continue")}</Button>
              </>

            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t("register.country")}</label>
                  <select className="flex h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-sm ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-primary" value={form.country} onChange={(e) => update("country", e.target.value)}>
                    <option value="">{t("register.selectCountry")}</option>
                    {countryKeys.map((key) => <option key={key} value={t(`register.countries.${key}`)}>{t(`register.countries.${key}`)}</option>)}
                  </select>
                  {errors.country && <p className="text-xs text-destructive">{errors.country}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{t("register.phone")}</label>
                  <Input type="tel" placeholder={t("register.phonePlaceholder")} value={form.phone} onChange={(e) => update("phone", e.target.value)} autoComplete="tel" />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>{t("register.back")}</Button>
                  <Button className="flex-1" size="lg" onClick={handleSubmit} disabled={loading}>{loading ? t("register.loading") : t("register.submit")}</Button>
                </div>
              </>
            )}
            <p className="text-center text-sm text-muted-foreground">
              {t("register.alreadyRegistered")}{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">{t("register.loginLink")}</Link>
            </p>
            <div className="flex items-center justify-center gap-4 mt-4 text-[10px] text-muted-foreground/70">
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> {t("register.trustSecure")}</span>
              <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> {t("register.trustProtected")}</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {t("register.trustTrusted")}</span>
            </div>
            <p className="text-center text-[10px] text-muted-foreground/60 mt-2">{t("register.disclaimer")}</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Register;
