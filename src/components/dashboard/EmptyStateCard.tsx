import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  children?: ReactNode;
  variant?: "default" | "primary" | "success" | "warning";
  estimatedSavings?: number;
}

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  children,
  variant = "default",
  estimatedSavings,
}: EmptyStateCardProps) {
  const iconColors = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  };

  const buttonVariants = {
    default: "bg-primary hover:bg-primary/90",
    primary: "bg-primary hover:bg-primary/90",
    success: "bg-success hover:bg-success/90 text-success-foreground",
    warning: "bg-warning hover:bg-warning/90 text-warning-foreground",
  };

  return (
    <Card className="border-dashed border-2 border-border bg-gradient-to-br from-muted/30 to-transparent">
      <CardContent className="py-12 px-6">
        <div className="flex flex-col items-center text-center max-w-md mx-auto">
          <div className={cn(
            "p-4 rounded-2xl mb-4",
            iconColors[variant]
          )}>
            <Icon className="h-8 w-8" />
          </div>
          
          <h3 className="text-lg font-semibold mb-2 text-foreground">
            {title}
          </h3>
          
          <p className="text-muted-foreground mb-6">
            {description}
          </p>

          {estimatedSavings !== undefined && estimatedSavings > 0 && (
            <div className="mb-6 p-4 rounded-xl bg-success/10 border border-success/20">
              <p className="text-sm text-success">
                💰 Économie potentielle estimée : <strong>{estimatedSavings}$/mois</strong>
              </p>
              <p className="text-xs text-success/70 mt-1">
                Basé sur les moyennes de nos utilisateurs
              </p>
            </div>
          )}

          {children}

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            {actionLabel && onAction && (
              <Button 
                onClick={onAction}
                className={cn("gap-2", buttonVariants[variant])}
              >
                {actionLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            
            {secondaryActionLabel && onSecondaryAction && (
              <Button 
                variant="outline" 
                onClick={onSecondaryAction}
              >
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
