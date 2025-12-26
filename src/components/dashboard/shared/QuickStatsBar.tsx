import { GradientStatCard } from "./GradientStatCard";
import { FileText, Target, Rocket, Clock, Server, Zap, DollarSign } from "lucide-react";

interface QuickStatsBarProps {
  stats: {
    projects?: number;
    score?: number;
    deployments?: number;
    savings?: number;
    servers?: number;
    syncs?: number;
    timeSaved?: number;
  };
  variant?: "user" | "admin";
}

export function QuickStatsBar({ stats, variant = "user" }: QuickStatsBarProps) {
  if (variant === "admin") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <GradientStatCard
          title="Utilisateurs"
          value={stats.projects || 0}
          icon={FileText}
          gradient="primary"
          delay={0}
        />
        <GradientStatCard
          title="Revenus MRR"
          value={`${stats.savings || 0}€`}
          icon={DollarSign}
          gradient="success"
          delay={0.1}
        />
        <GradientStatCard
          title="Déploiements"
          value={stats.deployments || 0}
          icon={Rocket}
          gradient="accent"
          delay={0.2}
        />
        <GradientStatCard
          title="Taux conversion"
          value={`${stats.score || 0}%`}
          icon={Target}
          gradient="violet"
          delay={0.3}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <GradientStatCard
        title="Projets"
        value={stats.projects || 0}
        icon={FileText}
        gradient="primary"
        delay={0}
      />
      <GradientStatCard
        title="Score moyen"
        value={`${stats.score || 0}%`}
        icon={Target}
        gradient="success"
        delay={0.1}
      />
      <GradientStatCard
        title="Déploiements"
        value={stats.deployments || 0}
        icon={Rocket}
        gradient="accent"
        delay={0.2}
      />
      <GradientStatCard
        title="Économies"
        value={`${stats.savings || 0}$/mois`}
        icon={DollarSign}
        gradient="emerald"
        delay={0.3}
      />
    </div>
  );
}
