import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { 
  AlertTriangle, 
  CreditCard, 
  Server, 
  Wifi, 
  Key, 
  RefreshCw,
  ExternalLink,
  Github,
  Settings,
  ArrowRight,
  HelpCircle,
  Database,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DeploymentError {
  code: string;
  message: string;
  details?: string;
}

interface ErrorAction {
  label: string;
  icon: typeof AlertTriangle;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive";
}

interface ErrorConfig {
  title: string;
  description: string;
  icon: typeof AlertTriangle;
  iconColor: string;
  bgColor: string;
  actions: ErrorAction[];
  tips?: string[];
}

interface DeploymentErrorHandlerProps {
  error: DeploymentError;
  onRetry: () => void;
  onNavigate?: (path: string) => void;
  className?: string;
}

const getErrorConfig = (
  error: DeploymentError,
  onRetry: () => void,
  onNavigate?: (path: string) => void
): ErrorConfig => {
  const errorCode = error.code.toLowerCase();
  const errorMessage = error.message.toLowerCase();

  // Credit/Payment errors
  if (errorCode.includes("402") || errorMessage.includes("crédit") || errorMessage.includes("credit") || errorMessage.includes("payment")) {
    return {
      title: "Crédit de déploiement requis",
      description: "Vous avez besoin d'un crédit pour effectuer ce déploiement. Achetez un pack de crédits ou passez au plan Pro pour des déploiements illimités.",
      icon: CreditCard,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
      actions: [
        {
          label: "Acheter des crédits",
          icon: CreditCard,
          onClick: () => window.location.href = "/tarifs",
          variant: "default"
        },
        {
          label: "Voir les plans Pro",
          icon: ArrowRight,
          onClick: () => window.location.href = "/tarifs#pro",
          variant: "outline"
        }
      ],
      tips: [
        "Le plan Pro inclut des déploiements illimités",
        "Les crédits n'expirent jamais",
        "1 crédit = 1 déploiement complet"
      ]
    };
  }

  // Server connection errors
  if (errorMessage.includes("connection") || errorMessage.includes("connexion") || errorMessage.includes("timeout") || errorMessage.includes("econnrefused")) {
    return {
      title: "Impossible de se connecter au serveur",
      description: "La connexion au serveur a échoué. Vérifiez que votre serveur est allumé et que les ports nécessaires sont ouverts.",
      icon: Wifi,
      iconColor: "text-red-500",
      bgColor: "bg-red-500/10",
      actions: [
        {
          label: "Réessayer",
          icon: RefreshCw,
          onClick: onRetry,
          variant: "default"
        },
        {
          label: "Vérifier mes serveurs",
          icon: Server,
          onClick: () => onNavigate?.("servers"),
          variant: "outline"
        }
      ],
      tips: [
        "Vérifiez que le serveur est bien démarré",
        "Assurez-vous que le port 22 (SSH) et 8000 (Coolify) sont ouverts",
        "Vérifiez que l'adresse IP est correcte"
      ]
    };
  }

  // Authentication/Token errors
  if (errorMessage.includes("unauthorized") || errorMessage.includes("401") || errorMessage.includes("token") || errorMessage.includes("authentification")) {
    return {
      title: "Erreur d'authentification",
      description: "Votre session a expiré ou vos identifiants sont incorrects. Reconnectez-vous ou vérifiez vos tokens d'accès.",
      icon: Lock,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-500/10",
      actions: [
        {
          label: "Reconnecter GitHub",
          icon: Github,
          onClick: () => {
            const redirectUrl = `${window.location.origin}/dashboard`;
            supabase.auth.signInWithOAuth({
              provider: 'github',
              options: { redirectTo: redirectUrl }
            });
          },
          variant: "default"
        },
        {
          label: "Paramètres",
          icon: Settings,
          onClick: () => window.location.href = "/parametres",
          variant: "outline"
        }
      ],
      tips: [
        "Votre token GitHub a peut-être expiré",
        "Vérifiez les tokens Coolify dans les paramètres de votre serveur",
        "Reconnectez votre compte GitHub si nécessaire"
      ]
    };
  }

  // FTP/SFTP specific errors
  if (errorMessage.includes("ftp") || errorMessage.includes("sftp") || errorMessage.includes("530") || errorMessage.includes("login incorrect")) {
    return {
      title: "Identifiants FTP incorrects",
      description: "Les informations de connexion FTP sont invalides. Vérifiez votre nom d'utilisateur, mot de passe et l'adresse du serveur.",
      icon: Key,
      iconColor: "text-red-500",
      bgColor: "bg-red-500/10",
      actions: [
        {
          label: "Corriger les identifiants",
          icon: Key,
          onClick: onRetry,
          variant: "default"
        },
        {
          label: "Guide FTP",
          icon: HelpCircle,
          onClick: () => window.open("https://docs.getinopay.com/ftp-guide", "_blank"),
          variant: "outline"
        }
      ],
      tips: [
        "Vérifiez que le nom d'hôte FTP est correct (ex: ftp.example.com)",
        "Le port par défaut est 21 pour FTP, 22 pour SFTP",
        "Certains hébergeurs utilisent un préfixe comme 'user@domain.com' pour le login"
      ]
    };
  }

  // Database errors
  if (errorMessage.includes("database") || errorMessage.includes("postgresql") || errorMessage.includes("db_") || errorMessage.includes("migration")) {
    return {
      title: "Erreur de base de données",
      description: "La configuration ou la migration de la base de données a échoué. Vérifiez que PostgreSQL est correctement installé sur votre serveur.",
      icon: Database,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
      actions: [
        {
          label: "Réessayer",
          icon: RefreshCw,
          onClick: onRetry,
          variant: "default"
        },
        {
          label: "Configurer la base",
          icon: Database,
          onClick: () => onNavigate?.("servers"),
          variant: "outline"
        }
      ],
      tips: [
        "PostgreSQL doit être installé et démarré sur le serveur",
        "Vérifiez que le port 5432 est accessible",
        "Le script d'installation Inopay configure automatiquement PostgreSQL"
      ]
    };
  }

  // Server not ready
  if (errorMessage.includes("serveur") && (errorMessage.includes("prêt") || errorMessage.includes("ready") || errorMessage.includes("pending"))) {
    return {
      title: "Serveur pas encore prêt",
      description: "Votre serveur est encore en cours de configuration. Veuillez patienter quelques minutes ou vérifier l'état de l'installation.",
      icon: Server,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
      actions: [
        {
          label: "Vérifier le statut",
          icon: RefreshCw,
          onClick: () => onNavigate?.("servers"),
          variant: "default"
        },
        {
          label: "Voir le guide",
          icon: HelpCircle,
          onClick: () => window.open("https://docs.getinopay.com/server-setup", "_blank"),
          variant: "outline"
        }
      ],
      tips: [
        "L'installation du serveur prend généralement 5-10 minutes",
        "Vous recevrez une notification quand le serveur sera prêt",
        "Vérifiez que le script d'installation s'est terminé sans erreur"
      ]
    };
  }

  // GitHub errors
  if (errorMessage.includes("github") || errorMessage.includes("repository") || errorMessage.includes("repo")) {
    return {
      title: "Erreur GitHub",
      description: "Un problème est survenu avec votre dépôt GitHub. Vérifiez que le dépôt existe et que vous avez les permissions nécessaires.",
      icon: Github,
      iconColor: "text-slate-500",
      bgColor: "bg-slate-500/10",
      actions: [
        {
          label: "Reconnecter GitHub",
          icon: Github,
          onClick: () => {
            const redirectUrl = `${window.location.origin}/dashboard`;
            supabase.auth.signInWithOAuth({
              provider: 'github',
              options: { redirectTo: redirectUrl }
            });
          },
          variant: "default"
        },
        {
          label: "Réessayer",
          icon: RefreshCw,
          onClick: onRetry,
          variant: "outline"
        }
      ],
      tips: [
        "Vérifiez que le dépôt existe sur GitHub",
        "Assurez-vous d'avoir les droits en lecture sur le dépôt",
        "Pour les dépôts privés, vérifiez que l'accès est autorisé"
      ]
    };
  }

  // Generic/Unknown error
  return {
    title: "Erreur de déploiement",
    description: error.message || "Une erreur inattendue est survenue. Veuillez réessayer ou contacter le support si le problème persiste.",
    icon: AlertTriangle,
    iconColor: "text-destructive",
    bgColor: "bg-destructive/10",
    actions: [
      {
        label: "Réessayer",
        icon: RefreshCw,
        onClick: onRetry,
        variant: "default"
      },
      {
        label: "Contacter le support",
        icon: ExternalLink,
        onClick: () => window.open("mailto:support@getinopay.com?subject=Erreur de déploiement", "_blank"),
        variant: "outline"
      }
    ],
    tips: [
      "Vérifiez votre connexion internet",
      "Essayez de rafraîchir la page",
      "Si le problème persiste, contactez le support avec le message d'erreur"
    ]
  };
};

// Import supabase for GitHub reconnection
import { supabase } from "@/integrations/supabase/client";

export function DeploymentErrorHandler({ 
  error, 
  onRetry, 
  onNavigate,
  className 
}: DeploymentErrorHandlerProps) {
  const config = getErrorConfig(error, onRetry, onNavigate);
  const Icon = config.icon;

  return (
    <Card className={cn("border-destructive/30", className)}>
      <CardContent className="pt-6 space-y-4">
        {/* Error header */}
        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-xl shrink-0", config.bgColor)}>
            <Icon className={cn("h-6 w-6", config.iconColor)} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg text-foreground mb-1">
              {config.title}
            </h3>
            <p className="text-sm text-muted-foreground">
              {config.description}
            </p>
          </div>
        </div>

        {/* Technical details (collapsible) */}
        {error.details && (
          <Alert variant="destructive" className="bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Détails techniques</AlertTitle>
            <AlertDescription className="text-xs font-mono mt-1 break-all">
              {error.details}
            </AlertDescription>
          </Alert>
        )}

        {/* Tips */}
        {config.tips && config.tips.length > 0 && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              Actions suggérées
            </h4>
            <ul className="space-y-1.5">
              {config.tips.map((tip, index) => (
                <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          {config.actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <Button
                key={index}
                variant={action.variant || "default"}
                onClick={action.onClick}
                className="gap-2 flex-1"
              >
                <ActionIcon className="h-4 w-4" />
                {action.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to parse error from various sources
export function parseDeploymentError(error: unknown): DeploymentError {
  if (typeof error === "string") {
    return {
      code: "UNKNOWN",
      message: error
    };
  }

  if (error instanceof Error) {
    // Try to extract HTTP status code from message
    const statusMatch = error.message.match(/(\d{3})/);
    const code = statusMatch ? statusMatch[1] : "UNKNOWN";
    
    return {
      code,
      message: error.message,
      details: error.stack
    };
  }

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    return {
      code: String(err.code || err.status || "UNKNOWN"),
      message: String(err.message || err.error || "Erreur inconnue"),
      details: err.details ? String(err.details) : undefined
    };
  }

  return {
    code: "UNKNOWN",
    message: "Une erreur inconnue est survenue"
  };
}
