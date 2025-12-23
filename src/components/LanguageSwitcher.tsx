import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const languages = [
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "en", name: "English", flag: "🇬🇧" },
];

interface LanguageSwitcherProps {
  variant?: "default" | "navbar";
}

const LanguageSwitcher = ({ variant = "default" }: LanguageSwitcherProps) => {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const currentLang = languages.find((l) => l.code === i18n.language) || languages[0];

  const handleLanguageChange = async (langCode: string) => {
    // Update i18next language
    i18n.changeLanguage(langCode);
    // Update document lang attribute for SEO
    document.documentElement.lang = langCode;
    
    // Save to user_settings if user is logged in
    if (user) {
      try {
        // Check if user has existing settings
        const { data: existingSettings } = await supabase
          .from("user_settings")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingSettings) {
          // Update existing settings
          await supabase
            .from("user_settings")
            .update({ language: langCode })
            .eq("id", existingSettings.id);
        } else {
          // Create new settings with language
          await supabase
            .from("user_settings")
            .insert([{ user_id: user.id, language: langCode }]);
        }
      } catch (error) {
        console.error("Error saving language preference:", error);
      }
    }
  };

  if (variant === "navbar") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:bg-white/10 transition-all text-white">
            <Globe className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[140px]">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`cursor-pointer ${
                i18n.language === lang.code ? "bg-primary/10 text-primary" : ""
              }`}
            >
              <span className="mr-2">{lang.flag}</span>
              {lang.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span>{currentLang.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={`cursor-pointer ${
              i18n.language === lang.code ? "bg-primary/10 text-primary" : ""
            }`}
          >
            <span className="mr-2">{lang.flag}</span>
            {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
