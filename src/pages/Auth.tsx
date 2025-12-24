import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Lock, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import inopayLogo from "@/assets/inopay-logo.png";
import OTPVerification from "@/components/auth/OTPVerification";

type AuthStep = "credentials" | "otp";

const Auth = () => {
  const { t, i18n } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("credentials");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingPassword, setPendingPassword] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn } = useAuth();

  const authSchema = z.object({
    email: z.string().email(t("auth.invalidEmail")),
    password: z.string().min(6, t("auth.passwordMinLength")),
  });

  type AuthFormValues = z.infer<typeof authSchema>;

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: AuthFormValues) => {
    setLoading(true);
    
    try {
      if (isLogin) {
        // Login flow - unchanged
        const { error } = await signIn(data.email, data.password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: t("auth.loginError"),
              description: t("auth.invalidCredentials"),
              variant: "destructive",
            });
          } else {
            toast({
              title: t("common.error"),
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: t("auth.loginSuccess"),
            description: t("auth.welcomeBack"),
          });
          navigate("/dashboard");
        }
      } else {
        // Signup flow - send OTP
        const { data: otpData, error } = await supabase.functions.invoke("send-otp", {
          body: { 
            email: data.email, 
            password: data.password,
            language: i18n.language 
          },
        });

        if (error) {
          toast({
            title: t("common.error"),
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        if (otpData?.error) {
          toast({
            title: t("common.error"),
            description: otpData.error,
            variant: "destructive",
          });
          return;
        }

        // Store credentials and move to OTP step
        setPendingEmail(data.email);
        setPendingPassword(data.password);
        setAuthStep("otp");
        
        toast({
          title: t("auth.otp.sent"),
          description: t("auth.otp.checkEmail"),
        });
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("auth.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSuccess = () => {
    toast({
      title: t("auth.signupSuccess"),
      description: t("auth.welcomeNew"),
    });
    navigate("/dashboard");
  };

  const handleBackToCredentials = () => {
    setAuthStep("credentials");
    setPendingEmail("");
    setPendingPassword("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg px-4">
      {/* Background Effects */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md">
        {/* Back Link */}
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t("auth.backToHome")}
        </Link>

        {authStep === "otp" ? (
          <>
            {/* Logo above OTP card */}
            <div className="flex justify-center mb-6">
              <img src={inopayLogo} alt="Inopay" className="h-12 object-contain" />
            </div>
            <OTPVerification
              email={pendingEmail}
              password={pendingPassword}
              onSuccess={handleOTPSuccess}
              onBack={handleBackToCredentials}
            />
          </>
        ) : (
          <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
            <CardHeader className="text-center space-y-4">
              {/* Logo */}
              <div className="flex justify-center">
                <img src={inopayLogo} alt="Inopay" className="h-12 object-contain" />
              </div>
              <div>
                <CardTitle className="text-2xl">
                  {isLogin ? t("auth.login") : t("auth.signup")}
                </CardTitle>
                <CardDescription className="mt-2">
                  {isLogin ? t("auth.loginDesc") : t("auth.signupDesc")}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("auth.email")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              placeholder={t("auth.emailPlaceholder")} 
                              className="pl-10" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("auth.password")}</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              type="password" 
                              placeholder={t("auth.passwordPlaceholder")} 
                              className="pl-10" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full glow-sm" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isLogin ? t("auth.submit") : t("auth.submitSignup")}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Auth;
