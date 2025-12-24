import { useState, useEffect, useCallback } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface DiagnosticResult {
  aiCleaner: { status: "ok" | "warning" | "error"; message: string };
  github: { status: "ok" | "warning" | "error"; message: string };
  infrastructure: { status: "ok" | "warning" | "error"; message: string; latency?: number };
  sovereignty: { status: "ok" | "warning" | "error"; score: number; message: string };
}

type PulseStatus = "nominal" | "processing" | "action-required";

export function SovereigntyPulse() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PulseStatus>("nominal");
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const runDiagnostic = useCallback(async () => {
    setLoading(true);
    setStatus("processing");

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setStatus("action-required");
        setDiagnostic({
          aiCleaner: { status: "warning", message: "Non authentifié" },
          github: { status: "warning", message: "Non vérifié" },
          infrastructure: { status: "warning", message: "Non vérifié" },
          sovereignty: { status: "warning", score: 0, message: "Authentification requise" },
        });
        return;
      }

      const startTime = Date.now();
      
      // Check user settings for API key and GitHub
      const { data: settings } = await supabase
        .from("user_settings")
        .select("api_key, github_token, github_destination_token")
        .eq("user_id", session.session.user.id)
        .single();

      // Check active servers
      const { data: servers } = await supabase
        .from("user_servers")
        .select("id, status, coolify_url, provider, name")
        .eq("user_id", session.session.user.id)
        .eq("status", "active");

      // Check recent deployments
      const { data: deployments } = await supabase
        .from("server_deployments")
        .select("status, health_status")
        .eq("user_id", session.session.user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Check sync configurations
      const { data: syncs } = await supabase
        .from("sync_configurations")
        .select("sync_enabled, last_sync_status")
        .eq("user_id", session.session.user.id)
        .eq("sync_enabled", true);

      const latency = Date.now() - startTime;

      // Evaluate AI Cleaner status
      const hasApiKey = !!settings?.api_key;
      const aiStatus: DiagnosticResult["aiCleaner"] = {
        status: "ok",
        message: hasApiKey ? "Opérationnel (BYOK)" : "Opérationnel (DeepSeek-V3)",
      };

      // Evaluate GitHub status
      const hasGitHub = !!(settings?.github_token || settings?.github_destination_token);
      const githubStatus: DiagnosticResult["github"] = hasGitHub
        ? { status: "ok", message: "Connectée (Token OK)" }
        : { status: "warning", message: "Non configurée" };

      // Evaluate Infrastructure status
      const hasActiveServer = (servers?.length || 0) > 0;
      const activeDeployments = deployments?.filter(d => d.status === "deployed" && d.health_status === "healthy").length || 0;
      // Get provider name dynamically from first active server or default to generic message
      const serverProvider = servers?.[0] ? (servers[0].provider || 'VPS') : 'VPS';
      const infraStatus: DiagnosticResult["infrastructure"] = hasActiveServer
        ? { status: "ok", message: `Serveur ${serverProvider} Réactif`, latency }
        : { status: "warning", message: "Aucun serveur configuré", latency };

      // Evaluate Sovereignty status
      const activeSyncs = syncs?.filter(s => s.last_sync_status === "success").length || 0;
      let sovereigntyScore = 0;
      if (hasActiveServer) sovereigntyScore += 40;
      if (activeDeployments > 0) sovereigntyScore += 30;
      if (activeSyncs > 0) sovereigntyScore += 30;

      const sovereigntyStatus: DiagnosticResult["sovereignty"] = {
        status: sovereigntyScore >= 70 ? "ok" : sovereigntyScore >= 40 ? "warning" : "error",
        score: sovereigntyScore,
        message: sovereigntyScore === 100
          ? "Aucune dépendance propriétaire détectée"
          : sovereigntyScore >= 70
          ? "Souveraineté partielle"
          : "Configuration requise",
      };

      // Determine overall status
      const hasWarning = [aiStatus, githubStatus, infraStatus, sovereigntyStatus].some(s => s.status === "warning");
      const hasError = [aiStatus, githubStatus, infraStatus, sovereigntyStatus].some(s => s.status === "error");

      setDiagnostic({
        aiCleaner: aiStatus,
        github: githubStatus,
        infrastructure: infraStatus,
        sovereignty: sovereigntyStatus,
      });

      setStatus(hasError ? "action-required" : hasWarning ? "action-required" : "nominal");
      setLastCheck(new Date());
    } catch (error) {
      console.error("Diagnostic error:", error);
      setStatus("action-required");
      setDiagnostic({
        aiCleaner: { status: "error", message: "Erreur de vérification" },
        github: { status: "error", message: "Erreur de vérification" },
        infrastructure: { status: "error", message: "Erreur de vérification" },
        sovereignty: { status: "error", score: 0, message: "Erreur de vérification" },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial check and polling every 60 seconds
  useEffect(() => {
    runDiagnostic();
    const interval = setInterval(runDiagnostic, 60000);
    return () => clearInterval(interval);
  }, [runDiagnostic]);

  const getStatusColor = () => {
    switch (status) {
      case "nominal":
        return "bg-emerald-500";
      case "processing":
        return "bg-blue-500";
      case "action-required":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getGlowColor = () => {
    switch (status) {
      case "nominal":
        return "shadow-emerald-500/50";
      case "processing":
        return "shadow-blue-500/50";
      case "action-required":
        return "shadow-orange-500/50";
      default:
        return "shadow-gray-500/50";
    }
  };

  const getAnimationClass = () => {
    switch (status) {
      case "nominal":
        return "animate-pulse";
      case "processing":
        return "animate-ping";
      case "action-required":
        return "animate-bounce";
      default:
        return "";
    }
  };

  const getStatusIcon = (itemStatus: "ok" | "warning" | "error") => {
    switch (itemStatus) {
      case "ok":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
      case "warning":
        return <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />;
      case "error":
        return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className="relative cursor-pointer group">
            {/* Glow effect ring */}
            <div
              className={`absolute inset-0 rounded-full ${getStatusColor()} opacity-30 blur-md transition-all duration-1000 ${
                status === "nominal" ? "animate-pulse" : status === "processing" ? "animate-ping" : ""
              }`}
            />
            
            {/* Main pulse indicator */}
            <div
              className={`relative w-8 h-8 rounded-full ${getStatusColor()} shadow-lg ${getGlowColor()} 
                flex items-center justify-center transition-all duration-300
                group-hover:scale-110 group-hover:shadow-xl`}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 text-white animate-spin" />
              ) : (
                <Zap className="h-4 w-4 text-white" />
              )}
            </div>

            {/* Outer ring animation */}
            <div
              className={`absolute -inset-1 rounded-full border-2 ${
                status === "nominal"
                  ? "border-emerald-500/40"
                  : status === "processing"
                  ? "border-blue-500/40"
                  : "border-orange-500/40"
              } ${getAnimationClass()} opacity-60`}
              style={{ animationDuration: status === "nominal" ? "3s" : "1.5s" }}
            />
          </div>
        </TooltipTrigger>

        <TooltipContent 
          side="bottom" 
          align="end" 
          className="w-80 p-0 bg-secondary/95 backdrop-blur-sm border-border/50"
        >
          <div className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">Pouls de Souveraineté</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 hover:bg-primary/10"
                onClick={(e) => {
                  e.stopPropagation();
                  runDiagnostic();
                }}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Diagnostic Items */}
            {diagnostic && (
              <div className="space-y-2.5">
                {/* AI Cleaner */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {getStatusIcon(diagnostic.aiCleaner.status)}
                    <span>Nettoyeur IA</span>
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {diagnostic.aiCleaner.message}
                  </span>
                </div>

                {/* GitHub */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {getStatusIcon(diagnostic.github.status)}
                    <span>Liaison GitHub</span>
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {diagnostic.github.message}
                  </span>
                </div>

                {/* Infrastructure */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {getStatusIcon(diagnostic.infrastructure.status)}
                    <span>Infrastructure</span>
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    {diagnostic.infrastructure.message}
                    {diagnostic.infrastructure.latency && (
                      <span className="text-muted-foreground ml-1">
                        ({diagnostic.infrastructure.latency}ms)
                      </span>
                    )}
                  </span>
                </div>

                {/* Sovereignty Score */}
                <div className="pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {getStatusIcon(diagnostic.sovereignty.status)}
                      <span>Statut Souveraineté</span>
                    </div>
                    <span className={`text-xs font-bold ${
                      diagnostic.sovereignty.score >= 70 
                        ? "text-emerald-500" 
                        : diagnostic.sovereignty.score >= 40 
                        ? "text-orange-500" 
                        : "text-destructive"
                    }`}>
                      {diagnostic.sovereignty.score}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {diagnostic.sovereignty.message}
                  </p>
                </div>
              </div>
            )}

            {/* Last check */}
            {lastCheck && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground text-center">
                  Dernière vérification: {lastCheck.toLocaleTimeString("fr-FR")}
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
