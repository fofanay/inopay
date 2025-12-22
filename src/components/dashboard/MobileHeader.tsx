import { ReactNode } from "react";

interface MobileHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function MobileHeader({ title, description, actions }: MobileHeaderProps) {
  return (
    <header className="bg-card border-b border-border px-4 py-4 md:px-8 md:py-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 pl-12 md:pl-0">
          <h1 className="text-lg md:text-2xl font-bold text-foreground truncate">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
          )}
        </div>
        {actions && (
          <div className="shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
