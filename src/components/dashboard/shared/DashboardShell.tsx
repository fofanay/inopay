import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DashboardShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardShell({ sidebar, header, children, className }: DashboardShellProps) {
  return (
    <div className={cn("min-h-screen bg-background flex flex-col", className)}>
      <div className="flex flex-1">
        {sidebar}
        <main className="flex-1 overflow-auto flex flex-col">
          {header}
          <motion.div 
            className="flex-1 p-4 md:p-6 lg:p-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
