import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SelfLiberationPreFlight } from './SelfLiberationPreFlight';
import { SelfLiberationLauncher } from './SelfLiberationLauncher';
import { GitHubDestinationConfig } from './GitHubDestinationConfig';
import { SupabaseSHCredentials } from './SupabaseSHCredentials';
import { LiberationPackHub } from './LiberationPackHub';
import { 
  Rocket, 
  Settings, 
  CheckCircle2,
  Github,
  Database,
  Package,
  Zap
} from 'lucide-react';

interface SelfLiberationTabProps {
  onNavigate?: (tab: string) => void;
}

export function SelfLiberationTab({ onNavigate }: SelfLiberationTabProps) {
  const [activeTab, setActiveTab] = useState<'pack' | 'config' | 'auto'>('pack');
  const [isPreflightPassed, setIsPreflightPassed] = useState(false);

  const handlePreFlightPassed = () => {
    setIsPreflightPassed(true);
  };

  const handleConfigComplete = () => {
    // Refresh after config change
    setActiveTab('auto');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/20">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Libération</CardTitle>
              <CardDescription className="text-base">
                Libérez votre projet vers votre infrastructure souveraine
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pack" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Pack</span> Manuel
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="auto" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Auto-Libération
          </TabsTrigger>
        </TabsList>

        {/* Pack Manuel - Import ZIP/GitHub et génération de pack */}
        <TabsContent value="pack" className="mt-6">
          <LiberationPackHub />
        </TabsContent>

        {/* Configuration - GitHub destination et Supabase SH */}
        <TabsContent value="config" className="mt-6 space-y-6">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Settings className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-1">Configurez vos accès</h3>
                  <p className="text-sm text-muted-foreground">
                    Pour utiliser l'auto-libération, configurez votre compte GitHub destination 
                    et les credentials Supabase Self-Hosted de votre VPS.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* GitHub Destination Config */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">GitHub Destination</h3>
              </div>
              <GitHubDestinationConfig onConfigured={handleConfigComplete} />
            </div>

            {/* Supabase SH Config */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Supabase Self-Hosted</h3>
              </div>
              <SupabaseSHCredentials onConfigured={handleConfigComplete} />
            </div>
          </div>
          
          {/* CTA vers auto-libération */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Configuration terminée ?</p>
                    <p className="text-sm text-muted-foreground">
                      Passez à l'auto-libération pour déployer automatiquement
                    </p>
                  </div>
                </div>
                <Button onClick={() => setActiveTab('auto')}>
                  <Zap className="h-4 w-4 mr-2" />
                  Auto-Libération
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Auto-Libération - PreFlight + Launcher */}
        <TabsContent value="auto" className="mt-6 space-y-6">
          <SelfLiberationPreFlight 
            onAllPassed={handlePreFlightPassed}
            onNavigate={onNavigate}
          />
          
          {isPreflightPassed && (
            <SelfLiberationLauncher />
          )}
          
          {!isPreflightPassed && (
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center gap-4 text-center py-6">
                  <Settings className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <h3 className="font-semibold mb-1">Configuration requise</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      Complétez d'abord tous les prérequis ci-dessus pour activer l'auto-libération.
                      Cliquez sur "Configurer" à côté des éléments manquants.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setActiveTab('config')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Aller à la configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
