import { Home, FolderOpen, History, Flame, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardTab = "overview" | "liberation" | "projects" | "deployments" | "services";

interface MobileBottomNavProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

const NAV_ITEMS: { tab: DashboardTab; label: string; icon: typeof Home }[] = [
  { tab: "overview", label: "Accueil", icon: Home },
  { tab: "liberation", label: "Libérer", icon: Flame },
  { tab: "projects", label: "Projets", icon: FolderOpen },
  { tab: "deployments", label: "Historique", icon: History },
  { tab: "services", label: "Services", icon: Crown },
];

export function MobileBottomNav({ currentTab, onTabChange }: MobileBottomNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t border-border z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
          const isActive = currentTab === tab;
          
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-lg transition-all min-w-[60px]",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={cn(
                "h-5 w-5 transition-transform",
                isActive && "scale-110"
              )} />
              <span className={cn(
                "text-[10px] font-medium truncate",
                isActive && "text-primary"
              )}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
