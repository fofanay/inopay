import React, { useState } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink,
  Globe,
  Shield,
  Clock,
  FileCode,
  Smartphone,
  AlertTriangle,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Check {
  name: string;
  passed: boolean;
  message: string;
}

interface ValidationResult {
  success: boolean;
  status?: number;
  statusText?: string;
  loadTime?: number;
  isHttps?: boolean;
  hasValidHtml?: boolean;
  title?: string;
  error?: string;
  checks: Check[];
  summary?: {
    passed: number;
    total: number;
    percentage: number;
  };
}

interface DeploymentValidatorProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUrl?: string;
  projectName?: string;
}

const getCheckIcon = (checkName: string) => {
  switch (checkName) {
    case 'Connexion sécurisée (HTTPS)':
      return Shield;
    case 'Code de statut HTTP':
    case 'Accessibilité':
      return Globe;
    case 'Temps de réponse':
      return Clock;
    case 'Structure HTML':
    case 'Titre de la page':
      return FileCode;
    case 'Compatibilité mobile':
      return Smartphone;
    case 'Application SPA détectée':
      return Sparkles;
    default:
      return Globe;
  }
};

const DeploymentValidator = ({ 
  isOpen, 
  onClose, 
  defaultUrl = '',
  projectName
}: DeploymentValidatorProps) => {
  const { toast } = useToast();
  const [url, setUrl] = useState(defaultUrl);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);

  const handleCheck = async () => {
    if (!url.trim()) {
      toast({
        title: "URL requise",
        description: "Veuillez entrer l'URL de votre site déployé",
        variant: "destructive",
      });
      return;
    }

    // Ensure URL has protocol
    let urlToCheck = url.trim();
    if (!urlToCheck.startsWith('http://') && !urlToCheck.startsWith('https://')) {
      urlToCheck = 'https://' + urlToCheck;
      setUrl(urlToCheck);
    }

    setChecking(true);
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-deployment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
          },
          body: JSON.stringify({ url: urlToCheck }),
        }
      );

      const data = await response.json();
      setResult(data);

      if (data.success) {
        toast({
          title: "Déploiement validé !",
          description: "Votre site est en ligne et fonctionnel",
        });
      } else if (data.error) {
        toast({
          title: "Vérification échouée",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Validation error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de vérifier le déploiement",
        variant: "destructive",
      });
      setResult({
        success: false,
        error: "Erreur de connexion au service de vérification",
        checks: []
      });
    } finally {
      setChecking(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setUrl(defaultUrl);
    onClose();
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-500';
    if (percentage >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Vérification du déploiement
          </DialogTitle>
          <DialogDescription>
            Testez si votre site est correctement déployé et accessible
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* URL Input */}
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://mon-site.vercel.app"
              disabled={checking}
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            />
            <Button onClick={handleCheck} disabled={checking || !url.trim()}>
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : result ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                'Vérifier'
              )}
            </Button>
          </div>

          {/* Loading state */}
          {checking && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Analyse en cours...
                  </p>
                  <Progress value={50} className="w-full mt-4 animate-pulse" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {result && !checking && (
            <div className="space-y-4">
              {/* Summary Card */}
              <Card className={result.success 
                ? 'border-green-500/50 bg-green-500/5' 
                : 'border-red-500/50 bg-red-500/5'
              }>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <div className="p-2 rounded-full bg-green-500/20">
                          <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-full bg-red-500/20">
                          <XCircle className="h-8 w-8 text-red-500" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-lg">
                          {result.success ? 'Déploiement réussi !' : 'Problèmes détectés'}
                        </h3>
                        {result.title && (
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {result.title}
                          </p>
                        )}
                      </div>
                    </div>

                    {result.summary && (
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getScoreColor(result.summary.percentage)}`}>
                          {result.summary.percentage}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {result.summary.passed}/{result.summary.total} tests
                        </p>
                      </div>
                    )}
                  </div>

                  {result.summary && (
                    <div className="mt-4">
                      <Progress 
                        value={result.summary.percentage} 
                        className={`h-2 ${getScoreBg(result.summary.percentage)}`}
                      />
                    </div>
                  )}

                  {result.loadTime && (
                    <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {result.loadTime}ms
                      </span>
                      {result.status && (
                        <Badge variant={result.status < 400 ? "default" : "destructive"}>
                          HTTP {result.status}
                        </Badge>
                      )}
                      {result.isHttps && (
                        <Badge variant="outline" className="gap-1">
                          <Shield className="h-3 w-3" />
                          HTTPS
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detailed Checks */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Détails des vérifications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.checks.map((check, index) => {
                    const Icon = getCheckIcon(check.name);
                    return (
                      <div 
                        key={index}
                        className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
                          check.passed 
                            ? 'bg-green-500/5 hover:bg-green-500/10' 
                            : 'bg-red-500/5 hover:bg-red-500/10'
                        }`}
                      >
                        <div className={`mt-0.5 ${check.passed ? 'text-green-500' : 'text-red-500'}`}>
                          {check.passed ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">{check.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {check.message}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Error message */}
              {result.error && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                      <p className="text-sm text-destructive">{result.error}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => window.open(url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ouvrir le site
                </Button>
                <Button 
                  className="flex-1"
                  onClick={handleCheck}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Revérifier
                </Button>
              </div>
            </div>
          )}

          {/* Initial state - tips */}
          {!result && !checking && (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm mb-2">
                    Entrez l'URL de votre site déployé pour vérifier :
                  </p>
                  <ul className="text-xs space-y-1 text-left max-w-xs mx-auto">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Accessibilité du site
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Connexion HTTPS sécurisée
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Temps de chargement
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Structure HTML valide
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      Optimisation mobile
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeploymentValidator;