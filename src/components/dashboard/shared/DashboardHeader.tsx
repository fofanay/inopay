import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DashboardHeader({
  title,
  description,
  icon,
  actions,
  className,
}: DashboardHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50",
        className
      )}
    >
      <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">
                {title}
              </h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {description}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">
              {actions}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
