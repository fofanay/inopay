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
import { clientRateLimit, emailSchema } from "@/lib/security";
import { AlertTriangle } from "lucide-react";
import inopayLogo from "@/assets/inopay-logo.png";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ email: "", password: "" });
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, t("login.passwordRequired")),
  });

  const redirectParam = new URLSearchParams(window.location.search).get("redirect");

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const resilientQuery = async (queryFn: () => PromiseLike<{ data: any; error: any }>): Promise<any> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await queryFn();
      if (!error) return data;
      const msg = error?.message || "";
      const isTransient = msg.includes("schema cache") || msg.includes("timeout") || error?.code === "PGRST002" || error?.status === 503 || error?.status === 504;
      if (!isTransient || attempt === 2) return null;
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    }
    return null;
  };

  const handleLogin = async () => {
    if (isLocked) {
      const remaining = Math.ceil(((lockedUntil || 0) - Date.now()) / 1000);
      toast({ title: t("login.locked"), description: t("login.lockedDesc", { seconds: remaining }), variant: "destructive" });
      return;
    }

    const result = loginSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((e) => { if (e.path[0]) fieldErrors[e.path[0] as string] = e.message; });
      setErrors(fieldErrors);
      return;
    }

    if (!clientRateLimit(`login_${form.email}`, 10, 60_000)) {
      toast({ title: t("login.tooManyAttempts"), description: t("login.waitOneMin"), variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let lastError: any = null;
      let success = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (!signInError) { success = true; break; }
        lastError = signInError;
        const isTransient = signInError.message?.includes("timeout") || signInError.message?.includes("504") || signInError.message?.includes("500") || signInError.status === 504 || signInError.status === 500;
        if (!isTransient) break;
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }

      const error = success ? null : lastError;

      if (error) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCKOUT_MS);
          setFailedAttempts(0);
          toast({ title: t("login.lockedTemp"), description: t("login.lockedTempDesc"), variant: "destructive" });
        } else {
          toast({ title: t("login.error"), description: `${error.message} (${t("login.attemptsLeft", { remaining: MAX_ATTEMPTS - newAttempts })})`, variant: "destructive" });
        }
        return;
      }

      setFailedAttempts(0);
      setLockedUntil(null);

      if (redirectParam && redirectParam !== "/login" && redirectParam !== "/register") { navigate(redirectParam); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if ((user as any).role === "admin") { navigate("/admin"); return; }
        if ((user as any).user_type === "sgi_user") { navigate("/sgi/dashboard/clients"); return; }
      }
      navigate("/dashboard");
    } catch {
      toast({ title: t("login.success"), description: t("login.redirecting") });
      navigate(redirectParam || "/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout hideFooter>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={inopayLogo} alt="INOPAY" className="mx-auto mb-4 h-10" />
            <CardTitle>{t("login.title")}</CardTitle>
            <CardDescription>{t("login.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
            {isLocked && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{t("login.lockedTempDesc")}</p>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-medium text-foreground">{t("login.email")}</label>
              <Input id="login-email" type="email" placeholder={t("login.emailPlaceholder")} value={form.email} onChange={(e) => update("email", e.target.value)} autoComplete="email" disabled={isLocked} />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-medium text-foreground">{t("login.password")}</label>
              <Input id="login-password" type="password" placeholder={t("login.passwordPlaceholder")} value={form.password} onChange={(e) => update("password", e.target.value)} autoComplete="current-password" disabled={isLocked} />
              {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              <div className="flex justify-end">
                <button type="button" className="text-xs text-primary hover:underline" onClick={async () => {
                  if (!form.email) { toast({ title: t("login.enterEmailFirst"), variant: "destructive" }); return; }
                  if (!clientRateLimit(`reset_${form.email}`, 3, 300_000)) {
                    toast({ title: t("login.tooManyAttempts"), description: t("login.waitOneMin"), variant: "destructive" });
                    return;
                  }
                  const { error } = await supabase.auth.resetPasswordForEmail(form.email, { redirectTo: `${window.location.origin}/reset-password` });
                  if (error) toast({ title: t("login.error"), description: error.message, variant: "destructive" });
                  else toast({ title: t("login.resetSent"), description: t("login.resetSentDesc") });
                }}>{t("login.forgotPassword")}</button>
              </div>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading || isLocked}>
              {loading ? t("login.loading") : t("login.submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("login.noAccount")}{" "}
              <Link to="/register" className="font-medium text-primary hover:underline">{t("login.createAccount")}</Link>
            </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Login;
