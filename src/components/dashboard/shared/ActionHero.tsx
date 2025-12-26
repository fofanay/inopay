import { ReactNode } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionHeroProps {
  title: string;
  description?: string;
  children?: ReactNode;
  ctaLabel?: string;
  ctaIcon?: ReactNode;
  onCtaClick?: () => void;
  variant?: "default" | "compact";
  className?: string;
}

export function ActionHero({
  title,
  description,
  children,
  ctaLabel,
  ctaIcon,
  onCtaClick,
  variant = "default",
  className,
}: ActionHeroProps) {
  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className={cn(
          "relative overflow-hidden border-0 shadow-lg",
          "bg-gradient-to-br from-primary/10 via-background to-accent/10",
          className
        )}>
          <div className="absolute inset-0 bg-grid-pattern opacity-5" />
          <CardContent className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 shrink-0">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{title}</h2>
                  {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
              </div>
              {ctaLabel && onCtaClick && (
                <Button 
                  onClick={onCtaClick}
                  className="gap-2 bg-primary hover:bg-primary/90 shrink-0"
                  size="lg"
                >
                  {ctaIcon}
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
            {children}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={cn(
        "relative overflow-hidden border-0 shadow-xl",
        "bg-gradient-to-br from-primary/15 via-background to-accent/15",
        className
      )}>
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <CardContent className="relative p-6 md:p-8">
          <div className="text-center max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Sparkles className="h-4 w-4" />
                Libérez votre code
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {title}
              </h1>
              {description && (
                <p className="text-muted-foreground mb-6">{description}</p>
              )}
            </motion.div>
            
            {children}
            
            {ctaLabel && onCtaClick && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="mt-6"
              >
                <Button 
                  onClick={onCtaClick}
                  size="lg"
                  className="gap-2 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25"
                >
                  {ctaIcon}
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
