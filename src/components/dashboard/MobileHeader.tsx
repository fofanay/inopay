import { ReactNode } from "react";
import { SovereigntyPulse } from "./SovereigntyPulse";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface MobileHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  showPulse?: boolean;
  showLanguageSwitcher?: boolean;
}

export function MobileHeader({ 
  title, 
  description, 
  actions, 
  showPulse = true,
  showLanguageSwitcher = true 
}: MobileHeaderProps) {
  return (
    <header className="bg-card border-b border-border px-4 py-4 md:px-8 md:py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 pl-12 md:pl-0">
          <h1 className="text-lg md:text-2xl font-bold text-foreground truncate">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {showLanguageSwitcher && <LanguageSwitcher />}
          {showPulse && <SovereigntyPulse />}
          {actions}
        </div>
      </div>
    </header>
  );
}