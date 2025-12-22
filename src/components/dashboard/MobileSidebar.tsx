import { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

interface MobileSidebarProps {
  menuItems: MenuItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  logo: ReactNode;
  planBadge?: ReactNode;
  bottomActions?: ReactNode;
}

export function MobileSidebar({ 
  menuItems, 
  activeTab, 
  onTabChange, 
  logo,
  planBadge,
  bottomActions 
}: MobileSidebarProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden fixed top-4 left-4 z-50 bg-background/80 backdrop-blur-sm border shadow-sm"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0 bg-secondary">
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className="p-4 border-b border-secondary/50">
            <div className="flex items-center justify-between">
              {logo}
              <SheetClose asChild>
                <Button variant="ghost" size="icon" className="text-secondary-foreground/60">
                  <X className="h-5 w-5" />
                </Button>
              </SheetClose>
            </div>
            {planBadge && (
              <div className="text-center mt-3">
                {planBadge}
              </div>
            )}
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <nav className="p-3 space-y-1">
              {menuItems.map((item) => (
                <SheetClose key={item.id} asChild>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start gap-3 h-11 text-secondary-foreground/80 hover:text-secondary-foreground hover:bg-secondary-foreground/10 ${
                      activeTab === item.id 
                        ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" 
                        : ""
                    }`}
                    onClick={() => onTabChange(item.id)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-4 border-accent/50 text-accent shrink-0">
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                </SheetClose>
              ))}
            </nav>
          </ScrollArea>

          {/* Bottom Actions */}
          {bottomActions && (
            <div className="p-3 border-t border-secondary/50 space-y-1">
              {bottomActions}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
