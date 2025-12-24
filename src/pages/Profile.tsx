import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { 
  User, 
  Save, 
  Loader2, 
  Camera, 
  MapPin, 
  Phone, 
  Building2, 
  CheckCircle2, 
  AlertTriangle,
  Shield,
  Upload,
  X,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import Layout from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  phone_verified: boolean;
  avatar_url: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_postal_code: string | null;
  billing_country: string;
  company_name: string | null;
  vat_number: string | null;
  profile_completed: boolean;
}

const COUNTRIES = [
  { code: "FR", name: "France" },
  { code: "CA", name: "Canada" },
  { code: "BE", name: "Belgique" },
  { code: "CH", name: "Suisse" },
  { code: "LU", name: "Luxembourg" },
  { code: "MC", name: "Monaco" },
  { code: "DE", name: "Allemagne" },
  { code: "ES", name: "Espagne" },
  { code: "IT", name: "Italie" },
  { code: "GB", name: "Royaume-Uni" },
  { code: "US", name: "États-Unis" },
];

const Profile = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [completionScore, setCompletionScore] = useState(0);
  
  // Phone verification states
  const [phoneToVerify, setPhoneToVerify] = useState("");
  const [showPhoneOTP, setShowPhoneOTP] = useState(false);
  const [phoneOTPCode, setPhoneOTPCode] = useState("");
  const [sendingPhoneOTP, setSendingPhoneOTP] = useState(false);
  const [verifyingPhoneOTP, setVerifyingPhoneOTP] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      calculateCompletionScore();
    }
  }, [profile]);

  const fetchProfile = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      // If profile doesn't exist, create one
      if (error.code === "PGRST116") {
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .insert({ id: user.id })
          .select()
          .single();
        
        if (!insertError && newProfile) {
          setProfile(newProfile as Profile);
        }
      }
    } else if (data) {
      setProfile(data as Profile);
    }
    setLoading(false);
  };

  const calculateCompletionScore = () => {
    if (!profile) return;

    let score = 0;
    const fields = [
      profile.first_name,
      profile.last_name,
      profile.phone,
      profile.avatar_url,
      profile.billing_address_line1,
      profile.billing_city,
      profile.billing_postal_code,
      profile.billing_country,
    ];

    fields.forEach((field) => {
      if (field && field.trim() !== "") score += 12.5;
    });

    setCompletionScore(Math.round(score));
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    setSaving(true);

    // Check if profile is complete
    const isComplete = !!(
      profile.first_name &&
      profile.last_name &&
      profile.billing_address_line1 &&
      profile.billing_city &&
      profile.billing_postal_code &&
      profile.billing_country
    );

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        billing_address_line1: profile.billing_address_line1,
        billing_address_line2: profile.billing_address_line2,
        billing_city: profile.billing_city,
        billing_postal_code: profile.billing_postal_code,
        billing_country: profile.billing_country,
        company_name: profile.company_name,
        vat_number: profile.vat_number,
        profile_completed: isComplete,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      console.error("Error saving profile:", error);
      toast({
        title: t("common.error"),
        description: t("profile.saveError"),
        variant: "destructive",
      });
    } else {
      setProfile({ ...profile, profile_completed: isComplete });
      toast({
        title: t("common.success"),
        description: t("profile.saved"),
      });
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: t("common.error"),
        description: t("profile.avatarTooLarge"),
        variant: "destructive",
      });
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({
        title: t("common.error"),
        description: t("profile.avatarInvalidType"),
        variant: "destructive",
      });
      return;
    }

    setUploadingAvatar(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete existing avatar if present
      if (profile?.avatar_url) {
        const existingPath = profile.avatar_url.split("/avatars/")[1];
        if (existingPath) {
          await supabase.storage.from("avatars").remove([existingPath]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update profile with avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile!, avatar_url: urlData.publicUrl });
      
      toast({
        title: t("common.success"),
        description: t("profile.avatarUpdated"),
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: t("common.error"),
        description: t("profile.avatarUploadError"),
        variant: "destructive",
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user || !profile?.avatar_url) return;

    try {
      const existingPath = profile.avatar_url.split("/avatars/")[1];
      if (existingPath) {
        await supabase.storage.from("avatars").remove([existingPath]);
      }

      await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      setProfile({ ...profile, avatar_url: null });

      toast({
        title: t("common.success"),
        description: t("profile.avatarRemoved"),
      });
    } catch (error) {
      console.error("Error removing avatar:", error);
    }
  };

  const updateField = (field: keyof Profile, value: string | null) => {
    if (profile) {
      setProfile({ ...profile, [field]: value });
    }
  };

  const handleSendPhoneOTP = async () => {
    if (!phoneToVerify.trim()) {
      toast({
        title: t("common.error"),
        description: t("profile.phoneRequired"),
        variant: "destructive",
      });
      return;
    }

    setSendingPhoneOTP(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("send-phone-otp", {
        body: { phone: phoneToVerify },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setShowPhoneOTP(true);
      toast({
        title: t("common.success"),
        description: t("profile.otpSent"),
      });
    } catch (error) {
      console.error("Error sending phone OTP:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("profile.otpSendError"),
        variant: "destructive",
      });
    } finally {
      setSendingPhoneOTP(false);
    }
  };

  const handleVerifyPhoneOTP = async () => {
    if (phoneOTPCode.length !== 6) {
      toast({
        title: t("common.error"),
        description: t("auth.otp.enterFullCode"),
        variant: "destructive",
      });
      return;
    }

    setVerifyingPhoneOTP(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke("verify-phone-otp", {
        body: { code: phoneOTPCode, phone: phoneToVerify },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update local state
      if (profile) {
        setProfile({ ...profile, phone: data.phone, phone_verified: true });
      }
      setShowPhoneOTP(false);
      setPhoneOTPCode("");
      setPhoneToVerify("");

      toast({
        title: t("common.success"),
        description: t("profile.phoneVerified"),
      });
    } catch (error) {
      console.error("Error verifying phone OTP:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("profile.otpVerifyError"),
        variant: "destructive",
      });
    } finally {
      setVerifyingPhoneOTP(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || "?";
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              {t("profile.title")}
            </h1>
            <p className="text-lg text-muted-foreground">
              {t("profile.subtitle")}
            </p>
          </div>

          {/* Completion Progress */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {t("profile.completion")}
                </span>
                <span className={`text-sm font-bold ${completionScore === 100 ? "text-emerald-500" : "text-amber-500"}`}>
                  {completionScore}%
                </span>
              </div>
              <Progress value={completionScore} className="h-2" />
              {completionScore < 100 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t("profile.completeForPayments")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Anti-fraud Alert */}
          <Alert className="mb-6 border-amber-500/30 bg-amber-500/5">
            <Shield className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-200">
              {t("profile.securityNotice")}
            </AlertDescription>
          </Alert>

          {/* Avatar Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                {t("profile.photo")}
              </CardTitle>
              <CardDescription>
                {t("profile.photoDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24 border-2 border-border">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-2xl bg-primary/10">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  {uploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {t("profile.uploadPhoto")}
                  </Button>
                  {profile?.avatar_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4 mr-2" />
                      {t("profile.removePhoto")}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("profile.photoRequirements")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {t("profile.personalInfo")}
              </CardTitle>
              <CardDescription>
                {t("profile.personalInfoDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t("profile.firstName")} *</Label>
                  <Input
                    id="first_name"
                    value={profile?.first_name || ""}
                    onChange={(e) => updateField("first_name", e.target.value)}
                    placeholder={t("profile.firstNamePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t("profile.lastName")} *</Label>
                  <Input
                    id="last_name"
                    value={profile?.last_name || ""}
                    onChange={(e) => updateField("last_name", e.target.value)}
                    placeholder={t("profile.lastNamePlaceholder")}
                  />
                </div>
              </div>
              {/* Phone Section with SMS Verification */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  {t("profile.phone")}
                  {profile?.phone_verified && (
                    <span className="flex items-center gap-1 text-emerald-500 text-xs">
                      <CheckCircle2 className="h-4 w-4" />
                      {t("profile.phoneVerifiedLabel")}
                    </span>
                  )}
                </Label>
                
                {profile?.phone_verified ? (
                  // Phone is verified - show read-only
                  <div className="flex items-center gap-2">
                    <Input
                      type="tel"
                      value={profile.phone || ""}
                      disabled
                      className="bg-muted/50"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhoneToVerify("");
                        setProfile({ ...profile, phone: null, phone_verified: false });
                      }}
                      className="text-muted-foreground"
                    >
                      {t("profile.changePhone")}
                    </Button>
                  </div>
                ) : showPhoneOTP ? (
                  // Show OTP verification
                  <div className="space-y-4 p-4 border border-border rounded-lg bg-muted/20">
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <span>{t("profile.otpSentTo")} <strong>{phoneToVerify}</strong></span>
                    </div>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={phoneOTPCode}
                        onChange={setPhoneOTPCode}
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
                    <div className="flex gap-2">
                      <Button
                        onClick={handleVerifyPhoneOTP}
                        disabled={verifyingPhoneOTP || phoneOTPCode.length !== 6}
                        className="flex-1"
                      >
                        {verifyingPhoneOTP ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("auth.otp.verifying")}
                          </>
                        ) : (
                          t("profile.verifyCode")
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowPhoneOTP(false);
                          setPhoneOTPCode("");
                        }}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleSendPhoneOTP}
                      disabled={sendingPhoneOTP}
                      className="w-full"
                    >
                      {t("auth.otp.resend")}
                    </Button>
                  </div>
                ) : (
                  // Show phone input with verify button
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      value={phoneToVerify}
                      onChange={(e) => setPhoneToVerify(e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendPhoneOTP}
                      disabled={sendingPhoneOTP || !phoneToVerify.trim()}
                      variant="secondary"
                    >
                      {sendingPhoneOTP ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        t("profile.verifyPhone")
                      )}
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("profile.phoneVerifyDesc")}
                </p>
              </div>
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <strong>{t("profile.email")}:</strong> {user?.email}
                <span className="ml-2 text-xs">{t("profile.emailNotEditable")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Billing Address */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t("profile.billingAddress")}
              </CardTitle>
              <CardDescription>
                {t("profile.billingAddressDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address_line1">{t("profile.addressLine1")} *</Label>
                <Input
                  id="address_line1"
                  value={profile?.billing_address_line1 || ""}
                  onChange={(e) => updateField("billing_address_line1", e.target.value)}
                  placeholder={t("profile.addressLine1Placeholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_line2">{t("profile.addressLine2")}</Label>
                <Input
                  id="address_line2"
                  value={profile?.billing_address_line2 || ""}
                  onChange={(e) => updateField("billing_address_line2", e.target.value)}
                  placeholder={t("profile.addressLine2Placeholder")}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">{t("profile.postalCode")} *</Label>
                  <Input
                    id="postal_code"
                    value={profile?.billing_postal_code || ""}
                    onChange={(e) => updateField("billing_postal_code", e.target.value)}
                    placeholder="75001"
                  />
                </div>
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <Label htmlFor="city">{t("profile.city")} *</Label>
                  <Input
                    id="city"
                    value={profile?.billing_city || ""}
                    onChange={(e) => updateField("billing_city", e.target.value)}
                    placeholder="Paris"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">{t("profile.country")} *</Label>
                <Select
                  value={profile?.billing_country || "FR"}
                  onValueChange={(value) => updateField("billing_country", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("profile.selectCountry")} />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Company Info (Optional) */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {t("profile.companyInfo")}
              </CardTitle>
              <CardDescription>
                {t("profile.companyInfoDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">{t("profile.companyName")}</Label>
                <Input
                  id="company_name"
                  value={profile?.company_name || ""}
                  onChange={(e) => updateField("company_name", e.target.value)}
                  placeholder={t("profile.companyNamePlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vat_number">{t("profile.vatNumber")}</Label>
                <Input
                  id="vat_number"
                  value={profile?.vat_number || ""}
                  onChange={(e) => updateField("vat_number", e.target.value)}
                  placeholder="FR12345678901"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end gap-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("common.saving")}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t("common.save")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;
