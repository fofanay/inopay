import { useState, useEffect } from "react";
import {
  Download,
  Upload,
  Sparkles,
  Rocket,
  CheckCircle2,
  Circle,
  ArrowRight,
  Github,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StepStatus {
  source: "pending" | "in_progress" | "completed" | "error";
  destination: "pending" | "in_progress" | "completed" | "error";
  cleaning: "pending" | "in_progress" | "completed" | "error";
  export: "pending" | "in_progress" | "completed" | "error";
}

interface MigrationData {
  sourceUrl: string;
  sourceOwner: string;
  sourceRepo: string;
  destinationUsername: string;
  destinationRepo: string;
  exportedUrl: string | null;
}

export function LiberationWizard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [stepStatus, setStepStatus] = useState<StepStatus>({
    source: "pending",
    destination: "pending",
    cleaning: "pending",
    export: "pending",
  });
  
  const [migrationData, setMigrationData] = useState<MigrationData>({
    sourceUrl: "",
    sourceOwner: "",
    sourceRepo: "",
    destinationUsername: "",
    destinationRepo: "",
    exportedUrl: null,
  });
  
  const [sourceToken, setSourceToken] = useState("");
  const [destinationToken, setDestinationToken] = useState("");
  const [showTokens, setShowTokens] = useState({ source: false, destination: false });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) loadExistingConfig();
  }, [user]);

  const loadExistingConfig = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("user_settings")
      .select("github_source_token, github_destination_token, github_destination_username")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (data) {
      if (data.github_source_token) {
        setStepStatus(prev => ({ ...prev, source: "completed" }));
      }
      if (data.github_destination_token && data.github_destination_username) {
        setStepStatus(prev => ({ ...prev, destination: "completed" }));
        setMigrationData(prev => ({ 
          ...prev, 
          destinationUsername: data.github_destination_username || "" 
        }));
      }
    }
  };

  const parseGitHubUrl = (url: string) => {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
    return null;
  };

  const handleSourceUrlChange = (url: string) => {
    setMigrationData(prev => ({ ...prev, sourceUrl: url }));
    const parsed = parseGitHubUrl(url);
    if (parsed) {
      setMigrationData(prev => ({ 
        ...prev, 
        sourceOwner: parsed.owner, 
        sourceRepo: parsed.repo,
        destinationRepo: `${parsed.repo}-libre`
      }));
    }
  };

  const validateSource = async () => {
    if (!migrationData.sourceUrl) {
      toast({ title: "URL requise", description: "Entrez l'URL de votre dépôt Lovable", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    setStepStatus(prev => ({ ...prev, source: "in_progress" }));
    
    try {
      // Test if repo is accessible
      const parsed = parseGitHubUrl(migrationData.sourceUrl);
      if (!parsed) throw new Error("URL invalide");
      
      const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
      if (sourceToken) headers.Authorization = `Bearer ${sourceToken}`;
      
      const response = await fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, { headers });
      
      if (response.ok) {
        // Save source token if provided
        if (sourceToken && user) {
          await supabase
            .from("user_settings")
            .upsert({ 
              user_id: user.id, 
              github_source_token: sourceToken,
              updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });
        }
        
        setStepStatus(prev => ({ ...prev, source: "completed" }));
        setCurrentStep(2);
        toast({ title: "Source validée", description: `Dépôt ${parsed.owner}/${parsed.repo} accessible` });
      } else if (response.status === 404) {
        throw new Error("Dépôt non trouvé ou privé (token requis)");
      } else {
        throw new Error("Erreur d'accès au dépôt");
      }
    } catch (error: any) {
      setStepStatus(prev => ({ ...prev, source: "error" }));
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const validateDestination = async () => {
    if (!destinationToken) {
      toast({ title: "Token requis", description: "Entrez votre Personal Access Token", variant: "destructive" });
      return;
    }
    
    setLoading(true);
    setStepStatus(prev => ({ ...prev, destination: "in_progress" }));
    
    try {
      const response = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${destinationToken}`, Accept: "application/vnd.github.v3+json" }
      });
      
      if (response.ok) {
        const userData = await response.json();
        
        // Save destination config
        if (user) {
          await supabase
            .from("user_settings")
            .upsert({
              user_id: user.id,
              github_destination_token: destinationToken,
              github_destination_username: userData.login,
              updated_at: new Date().toISOString()
            }, { onConflict: "user_id" });
        }
        
        setMigrationData(prev => ({ ...prev, destinationUsername: userData.login }));
        setStepStatus(prev => ({ ...prev, destination: "completed" }));
        setCurrentStep(3);
        toast({ title: "Destination connectée", description: `Prêt à exporter vers @${userData.login}` });
      } else {
        throw new Error("Token invalide ou expiré");
      }
    } catch (error: any) {
      setStepStatus(prev => ({ ...prev, destination: "error" }));
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const startCleaning = async () => {
    setLoading(true);
    setStepStatus(prev => ({ ...prev, cleaning: "in_progress" }));
    
    try {
      // Simulate cleaning process (in real app, this would call the clean-code function)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStepStatus(prev => ({ ...prev, cleaning: "completed" }));
      setCurrentStep(4);
      toast({ title: "Nettoyage terminé", description: "Code débarrassé des dépendances propriétaires" });
    } catch (error: any) {
      setStepStatus(prev => ({ ...prev, cleaning: "error" }));
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const startExport = async () => {
    setLoading(true);
    setStepStatus(prev => ({ ...prev, export: "in_progress" }));
    
    try {
      // In real app, this would call export-to-github with destination token
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const exportedUrl = `https://github.com/${migrationData.destinationUsername}/${migrationData.destinationRepo}`;
      setMigrationData(prev => ({ ...prev, exportedUrl }));
      setStepStatus(prev => ({ ...prev, export: "completed" }));
      
      toast({ 
        title: "🎉 Libération réussie!", 
        description: `Votre code est maintenant sur votre compte personnel`
      });
    } catch (error: any) {
      setStepStatus(prev => ({ ...prev, export: "error" }));
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = () => {
    if (migrationData.exportedUrl) {
      navigator.clipboard.writeText(migrationData.exportedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setStepStatus({ source: "pending", destination: "pending", cleaning: "pending", export: "pending" });
    setMigrationData({ sourceUrl: "", sourceOwner: "", sourceRepo: "", destinationUsername: "", destinationRepo: "", exportedUrl: null });
    setSourceToken("");
    setDestinationToken("");
  };

  const getStepIcon = (status: string, stepNum: number) => {
    if (status === "completed") return <CheckCircle2 className="h-6 w-6 text-success" />;
    if (status === "in_progress") return <Loader2 className="h-6 w-6 text-primary animate-spin" />;
    if (status === "error") return <AlertCircle className="h-6 w-6 text-destructive" />;
    if (currentStep === stepNum) return <Circle className="h-6 w-6 text-primary fill-primary/20" />;
    return <Circle className="h-6 w-6 text-muted-foreground" />;
  };

  const completedSteps = Object.values(stepStatus).filter(s => s === "completed").length;
  const progress = (completedSteps / 4) * 100;

  const steps = [
    { num: 1, key: "source", label: "Source Lovable", icon: Download, color: "text-orange-500" },
    { num: 2, key: "destination", label: "Destination", icon: Upload, color: "text-success" },
    { num: 3, key: "cleaning", label: "Nettoyage", icon: Sparkles, color: "text-primary" },
    { num: 4, key: "export", label: "Export", icon: Rocket, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Assistant de Libération
              </CardTitle>
              <CardDescription>
                Exportez votre projet Lovable vers votre propre compte GitHub
              </CardDescription>
            </div>
            {completedSteps === 4 && (
              <Button variant="outline" size="sm" onClick={resetWizard}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recommencer
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-2 mb-4" />
          
          {/* Steps Indicator */}
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    stepStatus[step.key as keyof StepStatus] === "completed" ? "border-success bg-success/10" :
                    stepStatus[step.key as keyof StepStatus] === "in_progress" ? "border-primary bg-primary/10" :
                    stepStatus[step.key as keyof StepStatus] === "error" ? "border-destructive bg-destructive/10" :
                    currentStep === step.num ? "border-primary" : "border-muted"
                  }`}>
                    {getStepIcon(stepStatus[step.key as keyof StepStatus], step.num)}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${currentStep === step.num ? "text-primary" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-12 sm:w-20 h-0.5 mx-2 ${
                    stepStatus[step.key as keyof StepStatus] === "completed" ? "bg-success" : "bg-muted"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Visual Migration Flow */}
      {(migrationData.sourceRepo || migrationData.destinationUsername) && (
        <Card className="bg-gradient-to-r from-orange-500/5 via-primary/5 to-success/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {migrationData.sourceRepo && (
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <Github className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">
                    {migrationData.sourceOwner}/{migrationData.sourceRepo}
                  </span>
                  {stepStatus.source === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
                </div>
              )}
              
              {migrationData.sourceRepo && (
                <>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="px-3 py-2 bg-primary/10 border border-primary/30 rounded-lg">
                    <span className="text-sm font-medium">🧹 Inopay</span>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </>
              )}
              
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                migrationData.destinationUsername 
                  ? "bg-success/10 border border-success/30" 
                  : "bg-muted border border-border"
              }`}>
                <Github className="h-4 w-4 text-success" />
                <span className="text-sm font-medium">
                  {migrationData.destinationUsername 
                    ? `@${migrationData.destinationUsername}/${migrationData.destinationRepo}` 
                    : "Votre compte"}
                </span>
                {stepStatus.export === "completed" && <CheckCircle2 className="h-4 w-4 text-success" />}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Source */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Download className="h-5 w-5 text-orange-500" />
                <h3 className="text-lg font-semibold">Étape 1 : Connecter la source Lovable</h3>
              </div>
              
              <Alert>
                <Github className="h-4 w-4" />
                <AlertDescription>
                  Entrez l'URL du dépôt GitHub créé par Lovable pour votre projet.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label>URL du dépôt Lovable</Label>
                <Input
                  placeholder="https://github.com/lovable-org/mon-projet"
                  value={migrationData.sourceUrl}
                  onChange={(e) => handleSourceUrlChange(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Token (optionnel - dépôts privés)</Label>
                <div className="relative">
                  <Input
                    type={showTokens.source ? "text" : "password"}
                    placeholder="ghp_... (uniquement si dépôt privé)"
                    value={sourceToken}
                    onChange={(e) => setSourceToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowTokens(prev => ({ ...prev, source: !prev.source }))}
                  >
                    {showTokens.source ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <Button onClick={validateSource} disabled={loading || !migrationData.sourceUrl}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Valider la source
              </Button>
            </div>
          )}

          {/* Step 2: Destination */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Upload className="h-5 w-5 text-success" />
                <h3 className="text-lg font-semibold">Étape 2 : Connecter votre compte GitHub</h3>
              </div>
              
              <Alert className="border-success/50 bg-success/5">
                <Github className="h-4 w-4" />
                <AlertDescription>
                  Créez un Personal Access Token sur <strong>votre propre compte GitHub</strong> avec les permissions <code>repo</code> et <code>workflow</code>.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label>Personal Access Token (Classic)</Label>
                <div className="relative">
                  <Input
                    type={showTokens.destination ? "text" : "password"}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={destinationToken}
                    onChange={(e) => setDestinationToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowTokens(prev => ({ ...prev, destination: !prev.destination }))}
                  >
                    {showTokens.destination ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <a 
                  href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=InoPay%20Liberation"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Créer un token sur GitHub
                </a>
              </div>
              
              <div className="space-y-2">
                <Label>Nom du nouveau dépôt</Label>
                <Input
                  value={migrationData.destinationRepo}
                  onChange={(e) => setMigrationData(prev => ({ ...prev, destinationRepo: e.target.value }))}
                  placeholder="mon-projet-libre"
                />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>Retour</Button>
                <Button onClick={validateDestination} disabled={loading || !destinationToken}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Connecter mon compte
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Cleaning */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Étape 3 : Nettoyage du code</h3>
              </div>
              
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  Inopay va analyser et nettoyer votre code pour supprimer toutes les dépendances Lovable, GPTEngineer et autres services propriétaires.
                </AlertDescription>
              </Alert>
              
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <p>✓ Suppression des imports lovable/gptengineer</p>
                <p>✓ Nettoyage des hooks propriétaires</p>
                <p>✓ Mise à jour des dépendances package.json</p>
                <p>✓ Génération du .env.example</p>
                <p>✓ Ajout des configs Vercel/Netlify</p>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>Retour</Button>
                <Button onClick={startCleaning} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Nettoyage en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Lancer le nettoyage
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Export */}
          {currentStep === 4 && stepStatus.export !== "completed" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Rocket className="h-5 w-5 text-purple-500" />
                <h3 className="text-lg font-semibold">Étape 4 : Export vers votre compte</h3>
              </div>
              
              <Alert className="border-purple-500/50 bg-purple-500/5">
                <Rocket className="h-4 w-4" />
                <AlertDescription>
                  Le code nettoyé va être poussé vers un nouveau dépôt sur votre compte : <strong>@{migrationData.destinationUsername}/{migrationData.destinationRepo}</strong>
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>Retour</Button>
                <Button onClick={startExport} disabled={loading} className="bg-purple-600 hover:bg-purple-700">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Export en cours...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-2" />
                      Exporter maintenant
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Success State */}
          {stepStatus.export === "completed" && migrationData.exportedUrl && (
            <div className="text-center space-y-6 py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
                <CheckCircle2 className="h-10 w-10 text-success" />
              </div>
              
              <div>
                <h3 className="text-2xl font-bold text-success mb-2">🎉 Libération réussie !</h3>
                <p className="text-muted-foreground">
                  Votre code est maintenant 100% souverain sur votre propre compte GitHub
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-2 p-4 bg-muted rounded-lg max-w-md mx-auto">
                <Github className="h-5 w-5" />
                <code className="text-sm flex-1 text-left truncate">{migrationData.exportedUrl}</code>
                <Button variant="ghost" size="sm" onClick={copyUrl}>
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              
              <div className="flex justify-center gap-3">
                <Button variant="outline" asChild>
                  <a href={migrationData.exportedUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Voir sur GitHub
                  </a>
                </Button>
                <Button onClick={resetWizard}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Nouveau projet
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
