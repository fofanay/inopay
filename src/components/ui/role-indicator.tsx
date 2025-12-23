import { Badge } from "@/components/ui/badge";
import { Shield, User, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export type RoleType = "admin" | "client" | "tester";

interface RoleIndicatorProps {
  role: RoleType;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

const roleConfig: Record<RoleType, {
  label: string;
  icon: typeof Shield;
  bgClass: string;
  textClass: string;
  borderClass: string;
}> = {
  admin: {
    label: "MODE ADMIN",
    icon: Shield,
    bgClass: "bg-destructive/10",
    textClass: "text-destructive",
    borderClass: "border-destructive/30",
  },
  client: {
    label: "MON ESPACE",
    icon: User,
    bgClass: "bg-info/10",
    textClass: "text-info",
    borderClass: "border-info/30",
  },
  tester: {
    label: "TESTEUR",
    icon: FlaskConical,
    bgClass: "bg-warning/10",
    textClass: "text-warning",
    borderClass: "border-warning/30",
  },
};

export function RoleIndicator({ role, className, showIcon = true, size = "md" }: RoleIndicatorProps) {
  const config = roleConfig[role];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5 gap-1",
    md: "text-xs px-2 py-1 gap-1.5",
    lg: "text-sm px-3 py-1.5 gap-2",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  return (
    <Badge 
      className={cn(
        config.bgClass,
        config.textClass,
        config.borderClass,
        sizeClasses[size],
        "font-semibold tracking-wide animate-pulse",
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </Badge>
  );
}

export function RoleContextBanner({ role }: { role: RoleType }) {
  const config = roleConfig[role];
  const Icon = config.icon;

  if (role === "client") return null; // No banner for regular clients

  return (
    <div className={cn(
      "w-full py-1.5 px-4 flex items-center justify-center gap-2 text-xs font-medium",
      role === "admin" ? "bg-destructive/10 text-destructive border-b border-destructive/20" : "",
      role === "tester" ? "bg-warning/10 text-warning border-b border-warning/20" : ""
    )}>
      <Icon className="h-3.5 w-3.5" />
      <span>
        {role === "admin" && "Vous êtes connecté en tant qu'administrateur"}
        {role === "tester" && "Compte testeur - Accès Pro gratuit"}
      </span>
    </div>
  );
}
