import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronRight } from "lucide-react";

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  section?: string;
}

interface MenuSection {
  id: string;
  label: string;
  icon?: LucideIcon;
}

interface ModernSidebarProps {
  logo: ReactNode;
  planBadge?: ReactNode;
  menuItems: MenuItem[];
  sections?: MenuSection[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  bottomActions?: ReactNode;
  className?: string;
}

export function ModernSidebar({
  logo,
  planBadge,
  menuItems,
  sections,
  activeTab,
  onTabChange,
  bottomActions,
  className,
}: ModernSidebarProps) {
  // Group menu items by section
  const groupedItems = sections
    ? sections.map(section => ({
        ...section,
        items: menuItems.filter(item => item.section === section.id),
      }))
    : [{ id: "default", label: "", items: menuItems }];

  return (
    <aside className={cn(
      "hidden md:flex w-72 bg-slate-900 flex-col border-r border-slate-700",
      className
    )}>
      {/* Header with Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-center mb-4">
          {logo}
        </div>
        {planBadge && (
          <div className="flex justify-center">
            {planBadge}
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="p-4 space-y-6">
          {groupedItems.map((group, groupIndex) => (
            <div key={group.id}>
              {group.label && (
                <div className="flex items-center gap-2 px-3 mb-2">
                  {group.icon && <group.icon className="h-3.5 w-3.5 text-slate-400" />}
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {group.label}
                  </span>
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item, index) => {
                  const isActive = activeTab === item.id;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (groupIndex * 0.1) + (index * 0.05) }}
                    >
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 h-11 font-medium transition-all duration-200",
                          isActive
                            ? "bg-primary text-white hover:bg-primary/90 hover:text-white shadow-md shadow-primary/30"
                            : "text-white/80 hover:text-white hover:bg-slate-800"
                        )}
                        onClick={() => onTabChange(item.id)}
                      >
                        <item.icon className={cn(
                          "h-4 w-4 shrink-0",
                          isActive && "drop-shadow-sm"
                        )} />
                        <span className="truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <Badge 
                            variant="secondary"
                            className={cn(
                              "ml-auto text-[10px] px-1.5 py-0",
                              isActive ? "bg-white/20 text-white" : "bg-slate-700 text-white"
                            )}
                          >
                            {item.badge}
                          </Badge>
                        )}
                        {isActive && (
                          <ChevronRight className="h-4 w-4 ml-auto shrink-0" />
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Bottom Actions */}
      {bottomActions && (
        <div className="p-4 border-t border-slate-700 space-y-1">
          {bottomActions}
        </div>
      )}
    </aside>
  );
}
