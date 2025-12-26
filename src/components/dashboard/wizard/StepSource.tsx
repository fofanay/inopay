import { useState, useEffect } from "react";
import { Github, CheckCircle2, Loader2, Eye, EyeOff, ExternalLink, HelpCircle, AlertCircle, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useWizard, Platform } from "@/contexts/WizardContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  storeSensitive, 
  getSensitive, 
  enableIncognitoMode, 
  disableIncognitoMode,
  isIncognitoModeActive 
} from "@/lib/incognito-mode";

// Platform logos
import lovableLogo from "@/assets/platforms/lovable-logo.png";
import boltLogo from "@/assets/platforms/bolt-logo.png";
import v0Logo from "@/assets/platforms/v0-logo.jpg";
import cursorLogo from "@/assets/platforms/cursor-logo.jpg";

const platforms: { id: Platform; name: string; logo: string; color: string }[] = [
  { id: "lovable", name: "Lovable", logo: lovableLogo, color: "bg-pink-500/10 border-pink-500/30 hover:border-pink-500" },
  { id: "bolt", name: "Bolt.new", logo: boltLogo, color: "bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500" },
  { id: "v0", name: "v0.dev", logo: v0Logo, color: "bg-slate-500/10 border-slate-500/30 hover:border-slate-500" },
  { id: "cursor", name: "Cursor", logo: cursorLogo, color: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500" },
];

function GitHubGuideModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <HelpCircle className="h-4 w-4" />
          Où trouver mon token ?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            Créer un Personal Access Token GitHub
          </DialogTitle>
          <DialogDescription>
            Suivez ces étapes pour générer un token avec les permissions requises
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
            <div>
              <p className="font-medium">Accédez aux paramètres GitHub</p>
              <code className="text-xs bg-muted px-2 py-1 rounded mt-1 block">
                Settings → Developer settings → Personal access tokens → Tokens (classic)
              </code>
            </div>
          </div>
          
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
            <div>
              <p className="font-medium">Cochez les scopes requis</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">repo</Badge>
                <Badge variant="outline" className="bg-success/10 text-success border-success/30">admin:repo_hook</Badge>
                <Badge variant="outline" className="bg-muted text-muted-foreground">workflow (optionnel)</Badge>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex justify-center">
            <Button asChild className="gap-2">
              <a 
                href="https://github.com/settings/tokens/new?scopes=repo,admin:repo_hook,workflow&description=Inopay%20Liberation" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4" />
                Créer mon token maintenant
              </a>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StepSource() {
  const { state, dispatch, nextStep } = useWizard();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [showToken, setShowToken] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [incognitoMode, setIncognitoMode] = useState(isIncognitoModeActive());

  // Gestion du mode incognito
  useEffect(() => {
    // Activer le mode incognito par défaut pour la sécurité
    enableIncognitoMode();
    setIncognitoMode(true);
    
    // Restaurer le token depuis sessionStorage si disponible
    const savedToken = getSensitive('githubToken');
    if (savedToken && !state.source.token) {
      dispatch({ type: "UPDATE_SOURCE", payload: { token: savedToken } });
    }
    
    return () => {
      // Le mode incognito reste actif jusqu'à fermeture de l'onglet
    };
  }, []);

  // Sauvegarder le token dans sessionStorage (jamais en backend sauf VPS)
  const handleTokenChange = (token: string) => {
    dispatch({ type: "UPDATE_SOURCE", payload: { token } });
    if (incognitoMode) {
      storeSensitive('githubToken', token);
    }
  };

  const toggleIncognitoMode = (enabled: boolean) => {
    if (enabled) {
      enableIncognitoMode();
    } else {
      disableIncognitoMode();
    }
    setIncognitoMode(enabled);
  };

  const parseGitHubUrl = (url: string) => {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
    return null;
  };

  const handleUrlChange = (url: string) => {
    const parsed = parseGitHubUrl(url);
    dispatch({
      type: "UPDATE_SOURCE",
      payload: {
        repoUrl: url,
        owner: parsed?.owner || "",
        repo: parsed?.repo || "",
      },
    });
    
    // Also set destination repo name
    if (parsed) {
      dispatch({
        type: "UPDATE_DESTINATION",
        payload: {
          destinationRepo: `${parsed.repo}-libre`,
        },
      });
    }
  };

  const validateSource = async () => {
    if (!state.source.repoUrl) {
      toast({ title: "URL requise", description: "Entrez l'URL de votre dépôt GitHub", variant: "destructive" });
      return;
    }
    
    setIsValidating(true);
    dispatch({ type: "SET_STEP_STATUS", payload: { step: "source", status: "in_progress" } });
    
    try {
      const parsed = parseGitHubUrl(state.source.repoUrl);
      if (!parsed) throw new Error("URL GitHub invalide");
      
      console.log("[StepSource] Fetching repo:", state.source.repoUrl);
      
      const { data, error } = await supabase.functions.invoke("fetch-github-repo", {
        body: { 
          repoUrl: state.source.repoUrl,
          token: state.source.token || undefined
        }
      });
      
      if (error) throw new Error(error.message);
      if (!data?.files || data.files.length === 0) throw new Error("Aucun fichier trouvé dans le dépôt");
      
      console.log(`[StepSource] Fetched ${data.files.length} files`);
      
      // INOPAY SOVEREIGN: NE JAMAIS sauvegarder le token GitHub en base de données
      // Les tokens restent exclusivement en mémoire volatile (sessionStorage)
      // Cette ligne a été supprimée intentionnellement pour la sécurité souveraine
      
      dispatch({
        type: "UPDATE_SOURCE",
        payload: { isValidated: true },
      });
      
      dispatch({
        type: "UPDATE_CLEANING",
        payload: { 
          fetchedFiles: data.files,
          filesAnalyzed: data.files.length,
        },
      });
      
      dispatch({ type: "SET_STEP_STATUS", payload: { step: "source", status: "completed" } });
      
      toast({ 
        title: "Source validée !", 
        description: `${data.files.length} fichiers récupérés depuis ${parsed.owner}/${parsed.repo}` 
      });
      
      nextStep();
    } catch (error: any) {
      console.error("[StepSource] Error:", error);
      dispatch({ type: "SET_STEP_STATUS", payload: { step: "source", status: "error" } });
      toast({ title: "Erreur de connexion", description: error.message, variant: "destructive" });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="h-5 w-5" />
          D'où vient votre projet ?
        </CardTitle>
        <CardDescription>
          Connectez-vous à votre dépôt GitHub pour commencer la libération
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform selector */}
        <div className="space-y-3">
          <Label>Plateforme d'origine</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                onClick={() => dispatch({ type: "UPDATE_SOURCE", payload: { platform: platform.id } })}
                className={`
                  flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                  ${platform.color}
                  ${state.source.platform === platform.id 
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                    : "opacity-70 hover:opacity-100"
                  }
                `}
              >
                <img src={platform.logo} alt={platform.name} className="w-10 h-10 rounded-lg object-cover" />
                <span className="text-sm font-medium">{platform.name}</span>
              </button>
            ))}
          </div>
        </div>
        
        {/* GitHub URL */}
        <div className="space-y-2">
          <Label htmlFor="repo-url">URL de votre dépôt GitHub</Label>
          <div className="relative">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="repo-url"
              placeholder="https://github.com/user/mon-projet"
              value={state.source.repoUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="pl-10"
            />
          </div>
          {state.source.owner && state.source.repo && (
            <p className="text-sm text-muted-foreground">
              Détecté : <span className="font-medium text-foreground">{state.source.owner}/{state.source.repo}</span>
            </p>
          )}
        </div>
        
        {/* Incognito Mode Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-success" />
            <div>
              <p className="text-sm font-medium">Mode Incognito</p>
              <p className="text-xs text-muted-foreground">Tokens stockés en session uniquement</p>
            </div>
          </div>
          <Switch checked={incognitoMode} onCheckedChange={toggleIncognitoMode} />
        </div>

        {/* Token input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="github-token">Token GitHub (optionnel pour les dépôts publics)</Label>
            <GitHubGuideModal />
          </div>
          <div className="relative">
            <Input
              id="github-token"
              type={showToken ? "text" : "password"}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={state.source.token}
              onChange={(e) => handleTokenChange(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {incognitoMode && (
            <p className="text-xs text-success flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Token protégé - effacé à la fermeture de l'onglet
            </p>
          )}
        </div>
        
        {state.source.isValidated && (
          <Alert className="border-success/50 bg-success/5">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              Dépôt validé ! {state.cleaning.filesAnalyzed} fichiers prêts pour l'analyse.
            </AlertDescription>
          </Alert>
        )}
        
        {/* Validate button */}
        <Button 
          onClick={validateSource} 
          disabled={!state.source.repoUrl || isValidating}
          className="w-full gap-2"
          size="lg"
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Vérification en cours...
            </>
          ) : state.source.isValidated ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Continuer
            </>
          ) : (
            <>
              <Github className="h-4 w-4" />
              Vérifier la connexion
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
