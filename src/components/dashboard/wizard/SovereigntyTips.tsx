import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Shield, Database, Lock, Activity, RefreshCw, FileText,
  Server, Cloud, Key, Eye, CheckCircle2, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SovereigntyTip {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  category: "security" | "performance" | "maintenance" | "architecture";
  link?: string;
}

const tips: SovereigntyTip[] = [
  {
    id: "rls",
    icon: Shield,
    title: "Row Level Security (RLS)",
    description: "Le RLS de PostgreSQL protège vos données au niveau de la base. Chaque requête est filtrée automatiquement selon l'utilisateur connecté, empêchant tout accès non autorisé.",
    category: "security",
    link: "https://supabase.com/docs/guides/auth/row-level-security",
  },
  {
    id: "backups",
    icon: Database,
    title: "Sauvegardes Automatiques",
    description: "Configurez des sauvegardes régulières avec pg_dump ou via Coolify. Un VPS souverain vous appartient : sauvegardez-le comme vous le souhaitez.",
    category: "maintenance",
  },
  {
    id: "ssl",
    icon: Lock,
    title: "Certificats SSL Gratuits",
    description: "Coolify génère automatiquement des certificats SSL via Let's Encrypt. Votre application sera accessible en HTTPS sans configuration manuelle.",
    category: "security",
  },
  {
    id: "monitoring",
    icon: Activity,
    title: "Monitoring Open Source",
    description: "Uptime Kuma est un excellent outil open source pour surveiller la disponibilité de vos applications. Recevez des alertes instantanées en cas de problème.",
    category: "performance",
    link: "https://github.com/louislam/uptime-kuma",
  },
  {
    id: "updates",
    icon: RefreshCw,
    title: "Mises à Jour Régulières",
    description: "Pensez à mettre à jour vos dépendances npm tous les mois. Utilisez 'npm audit' pour détecter les vulnérabilités connues.",
    category: "maintenance",
  },
  {
    id: "logs",
    icon: FileText,
    title: "Gestion des Logs",
    description: "Coolify stocke les logs de votre application pendant 7 jours. Consultez-les régulièrement pour anticiper les problèmes.",
    category: "performance",
  },
  {
    id: "sovereignty",
    icon: Server,
    title: "Souveraineté Numérique",
    description: "Votre code tourne sur votre serveur. Aucune dépendance à un tiers, aucun lock-in. Vous êtes libre de migrer où vous voulez, quand vous voulez.",
    category: "architecture",
  },
  {
    id: "docker",
    icon: Cloud,
    title: "Conteneurisation Docker",
    description: "Votre application est conteneurisée avec Docker. Elle peut tourner sur n'importe quel serveur compatible, de Hetzner à OVH en passant par AWS.",
    category: "architecture",
  },
  {
    id: "secrets",
    icon: Key,
    title: "Gestion des Secrets",
    description: "Ne stockez jamais vos clés API dans le code. Utilisez des variables d'environnement sécurisées via Coolify ou un gestionnaire de secrets.",
    category: "security",
  },
  {
    id: "privacy",
    icon: Eye,
    title: "Données Privées",
    description: "Vos données utilisateurs restent sur votre infrastructure. Aucune télémétrie, aucun tracking, aucune collecte par des tiers.",
    category: "security",
  },
];

const categoryColors: Record<SovereigntyTip["category"], string> = {
  security: "from-success/20 to-success/5 border-success/30",
  performance: "from-primary/20 to-primary/5 border-primary/30",
  maintenance: "from-warning/20 to-warning/5 border-warning/30",
  architecture: "from-info/20 to-info/5 border-info/30",
};

const categoryLabels: Record<SovereigntyTip["category"], string> = {
  security: "Sécurité",
  performance: "Performance",
  maintenance: "Maintenance",
  architecture: "Architecture",
};

interface SovereigntyTipsProps {
  className?: string;
}

export function SovereigntyTips({ className }: SovereigntyTipsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

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
          <span className="text-sm font-medium">Conseils de Souveraineté</span>
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
                <h4 className="font-medium text-sm">{currentTip.title}</h4>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/50 text-muted-foreground">
                  {categoryLabels[currentTip.category]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {currentTip.description}
              </p>
              {currentTip.link && (
                <a
                  href={currentTip.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                >
                  En savoir plus
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
              <span className="hidden sm:inline">{tip.title.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
