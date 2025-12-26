import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, Database, Lock, Activity, RefreshCw, FileText,
  Server, Cloud, Key, Eye, CheckCircle2, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface SovereigntyTip {
  id: string;
  icon: React.ElementType;
  titleKey: string;
  descriptionKey: string;
  category: "security" | "performance" | "maintenance" | "architecture";
  link?: string;
}

const tips: SovereigntyTip[] = [
  {
    id: "rls",
    icon: Shield,
    titleKey: "wizard.tips.rls.title",
    descriptionKey: "wizard.tips.rls.description",
    category: "security",
    link: "https://supabase.com/docs/guides/auth/row-level-security",
  },
  {
    id: "backups",
    icon: Database,
    titleKey: "wizard.tips.backups.title",
    descriptionKey: "wizard.tips.backups.description",
    category: "maintenance",
  },
  {
    id: "ssl",
    icon: Lock,
    titleKey: "wizard.tips.ssl.title",
    descriptionKey: "wizard.tips.ssl.description",
    category: "security",
  },
  {
    id: "monitoring",
    icon: Activity,
    titleKey: "wizard.tips.monitoring.title",
    descriptionKey: "wizard.tips.monitoring.description",
    category: "performance",
    link: "https://github.com/louislam/uptime-kuma",
  },
  {
    id: "updates",
    icon: RefreshCw,
    titleKey: "wizard.tips.updates.title",
    descriptionKey: "wizard.tips.updates.description",
    category: "maintenance",
  },
  {
    id: "logs",
    icon: FileText,
    titleKey: "wizard.tips.logs.title",
    descriptionKey: "wizard.tips.logs.description",
    category: "performance",
  },
  {
    id: "sovereignty",
    icon: Server,
    titleKey: "wizard.tips.sovereignty.title",
    descriptionKey: "wizard.tips.sovereignty.description",
    category: "architecture",
  },
  {
    id: "docker",
    icon: Cloud,
    titleKey: "wizard.tips.docker.title",
    descriptionKey: "wizard.tips.docker.description",
    category: "architecture",
  },
  {
    id: "secrets",
    icon: Key,
    titleKey: "wizard.tips.secrets.title",
    descriptionKey: "wizard.tips.secrets.description",
    category: "security",
  },
  {
    id: "privacy",
    icon: Eye,
    titleKey: "wizard.tips.privacy.title",
    descriptionKey: "wizard.tips.privacy.description",
    category: "security",
  },
];

const categoryColors: Record<SovereigntyTip["category"], string> = {
  security: "from-success/20 to-success/5 border-success/30",
  performance: "from-primary/20 to-primary/5 border-primary/30",
  maintenance: "from-warning/20 to-warning/5 border-warning/30",
  architecture: "from-info/20 to-info/5 border-info/30",
};

interface SovereigntyTipsProps {
  className?: string;
}

export function SovereigntyTips({ className }: SovereigntyTipsProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);

  const categoryLabels: Record<SovereigntyTip["category"], string> = {
    security: t("wizard.tips.categories.security"),
    performance: t("wizard.tips.categories.performance"),
    maintenance: t("wizard.tips.categories.maintenance"),
    architecture: t("wizard.tips.categories.architecture"),
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tips.length);
    }, 6000); // Change toutes les 6 secondes

    return () => clearInterval(interval);
  }, []);

  const currentTip = tips[currentIndex];
  const Icon = currentTip.icon;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-sm font-medium">{t("wizard.tips.title")}</span>
        </div>
        <div className="flex gap-1">
          {tips.map((_, idx) => (
            <button
              key={idx}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                idx === currentIndex 
                  ? "w-4 bg-primary" 
                  : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              onClick={() => setCurrentIndex(idx)}
            />
          ))}
        </div>
      </div>

      {/* Tip Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentTip.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "rounded-xl border bg-gradient-to-br p-4",
            categoryColors[currentTip.category]
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/80 backdrop-blur">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">{t(currentTip.titleKey)}</h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/50 text-muted-foreground">
                  {categoryLabels[currentTip.category]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t(currentTip.descriptionKey)}
              </p>
              {currentTip.link && (
                <a
                  href={currentTip.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                >
                  {t("wizard.tips.learnMore")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation rapide */}
      <div className="flex flex-wrap gap-1.5">
        {tips.map((tip, idx) => {
          const TipIcon = tip.icon;
          return (
            <button
              key={tip.id}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all",
                idx === currentIndex
                  ? "bg-primary/10 text-primary"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              <TipIcon className="h-3 w-3" />
              <span className="hidden sm:inline">{t(tip.titleKey).split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
