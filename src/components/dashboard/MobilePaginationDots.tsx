import { cn } from "@/lib/utils";

interface MobilePaginationDotsProps<T extends string> {
  tabs: T[];
  currentTab: T;
  onTabChange: (tab: T) => void;
  labels?: Record<T, string>;
}

export function MobilePaginationDots<T extends string>({ 
  tabs, 
  currentTab, 
  onTabChange,
  labels
}: MobilePaginationDotsProps<T>) {
  const currentIndex = tabs.indexOf(currentTab);

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-40 safe-area-bottom">
      <div className="px-4 py-3">
        {/* Current tab label */}
        <div className="text-center mb-2">
          <span className="text-xs font-medium text-foreground">
            {labels?.[currentTab] || currentTab}
          </span>
          <span className="text-xs text-muted-foreground ml-1">
            ({currentIndex + 1}/{tabs.length})
          </span>
        </div>
        
        {/* Dots indicator */}
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-1">
          {tabs.map((tab, index) => {
            const isActive = tab === currentTab;
            const isNear = Math.abs(index - currentIndex) <= 2;
            
            // Show all dots on small lists, or only nearby dots on long lists
            if (tabs.length > 8 && !isNear && !isActive) {
              // Show tiny dots for far items
              if (index === 0 || index === tabs.length - 1) {
                return (
                  <button
                    key={tab}
                    onClick={() => onTabChange(tab)}
                    className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 transition-all shrink-0"
                    aria-label={labels?.[tab] || tab}
                  />
                );
              }
              // Skip middle far dots but show ellipsis indicator
              if (index === currentIndex - 3 || index === currentIndex + 3) {
                return (
                  <span key={tab} className="text-muted-foreground text-xs px-0.5">•</span>
                );
              }
              return null;
            }
            
            return (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={cn(
                  "rounded-full transition-all shrink-0",
                  isActive 
                    ? "w-6 h-2 bg-primary" 
                    : "w-2 h-2 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                )}
                aria-label={labels?.[tab] || tab}
                aria-current={isActive ? "page" : undefined}
              />
            );
          })}
        </div>
        
        {/* Swipe hint */}
        <p className="text-[10px] text-muted-foreground text-center mt-1">
          Glissez pour naviguer
        </p>
      </div>
    </div>
  );
}
