import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface GradientStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  gradient?: "primary" | "success" | "accent" | "violet" | "amber" | "emerald";
  className?: string;
  delay?: number;
}

const gradientConfig = {
  primary: {
    border: "border-primary/20",
    bg: "bg-primary/5",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    valueColor: "text-primary",
  },
  success: {
    border: "border-success/20",
    bg: "bg-success/5",
    iconBg: "bg-success/10",
    iconColor: "text-success",
    valueColor: "text-success",
  },
  accent: {
    border: "border-accent/20",
    bg: "bg-accent/5",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
    valueColor: "text-accent",
  },
  violet: {
    border: "border-violet-500/20",
    bg: "bg-violet-500/5",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-500",
    valueColor: "text-violet-500",
  },
  amber: {
    border: "border-amber-500/20",
    bg: "bg-amber-500/5",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    valueColor: "text-amber-500",
  },
  emerald: {
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
    valueColor: "text-emerald-500",
  },
};

export function GradientStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  gradient = "primary",
  className,
  delay = 0,
}: GradientStatCardProps) {
  const config = gradientConfig[gradient];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card 
        className={cn(
          "relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
          config.border,
          config.bg,
          className
        )}
      >
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", config.iconBg)}>
              <Icon className={cn("h-5 w-5", config.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-2xl md:text-3xl font-bold tracking-tight", config.valueColor)}>
                {value}
              </p>
              <p className="text-xs text-muted-foreground truncate">{title}</p>
              {subtitle && (
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
