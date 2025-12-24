import { useState, useEffect } from "react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, RefreshCw, CheckCircle, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

interface OTPVerificationProps {
  email: string;
  password: string;
  onSuccess: () => void;
  onBack: () => void;
}

const OTPVerification = ({ email, password, onSuccess, onBack }: OTPVerificationProps) => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const [otpValue, setOtpValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleResendOTP = async () => {
    if (!canResend) return;
    
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { email, password, language: i18n.language },
      });

      if (error) throw error;

      toast({
        title: t("auth.otp.resent"),
        description: t("auth.otp.checkEmail"),
      });
      
      setCountdown(60);
      setCanResend(false);
      setOtpValue("");
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("auth.otp.resendError"),
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpValue.length !== 6) {
      toast({
        title: t("common.error"),
        description: t("auth.otp.enterFullCode"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { email, otpCode: otpValue, language: i18n.language },
      });

      if (error) throw error;

      if (data?.error) {
        toast({
          title: t("common.error"),
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      // User created successfully - sign in with temp password then update
      if (data?.success && data?.tempPassword) {
        // Sign in with temp password
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: data.tempPassword,
        });

        if (signInError) {
          console.error("Sign in error:", signInError);
          throw signInError;
        }

        // Update password to the one user originally chose
        const { error: updateError } = await supabase.auth.updateUser({
          password: password,
        });

        if (updateError) {
          console.error("Password update error:", updateError);
          // Still consider it a success since account is created
        }

        toast({
          title: t("auth.otp.verified"),
          description: t("auth.otp.accountCreated"),
        });

        onSuccess();
      }
    } catch (error: any) {
      console.error("Verify OTP error:", error);
      toast({
        title: t("common.error"),
        description: error.message || t("auth.otp.verifyError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (otpValue.length === 6 && !loading) {
      handleVerifyOTP();
    }
  }, [otpValue]);

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <div>
          <CardTitle className="text-2xl">{t("auth.otp.title")}</CardTitle>
          <CardDescription className="mt-2">
            {t("auth.otp.description")}
            <br />
            <span className="font-medium text-foreground">{email}</span>
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otpValue}
            onChange={setOtpValue}
            disabled={loading}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button 
          className="w-full glow-sm" 
          onClick={handleVerifyOTP}
          disabled={loading || otpValue.length !== 6}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.otp.verifying")}
            </>
          ) : (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              {t("auth.otp.verify")}
            </>
          )}
        </Button>

        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("auth.otp.noCode")}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResendOTP}
            disabled={!canResend || resending}
            className="gap-2"
          >
            {resending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {canResend 
              ? t("auth.otp.resend")
              : `${t("auth.otp.resendIn")} ${countdown}s`
            }
          </Button>
        </div>

        <Button
          variant="link"
          className="w-full gap-2"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          {t("auth.otp.changeEmail")}
        </Button>
      </CardContent>
    </Card>
  );
};

export default OTPVerification;
