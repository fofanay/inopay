import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SelfLiberationPreFlight } from './SelfLiberationPreFlight';
import { SelfLiberationLauncher } from './SelfLiberationLauncher';
import { GitHubDestinationConfig } from './GitHubDestinationConfig';
import { SupabaseSHCredentials } from './SupabaseSHCredentials';
import { 
  Rocket, 
  Settings, 
  CheckCircle2,
  Github,
  Database
} from 'lucide-react';

interface SelfLiberationTabProps {
  onNavigate?: (tab: string) => void;
}

export function SelfLiberationTab({ onNavigate }: SelfLiberationTabProps) {
  const [activeTab, setActiveTab] = useState<'preflight' | 'config' | 'launch'>('preflight');
  const [isPreflightPassed, setIsPreflightPassed] = useState(false);

  const handlePreFlightPassed = () => {
    setIsPreflightPassed(true);
  };

  const handleConfigComplete = () => {
    // Refresh preflight after config change
    setActiveTab('preflight');
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
              <CardTitle className="text-2xl">Auto-Libération</CardTitle>
              <CardDescription className="text-base">
                Libérez automatiquement Inopay vers votre infrastructure souveraine
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="preflight" className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Vérification
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger 
            value="launch" 
            className="flex items-center gap-2"
            disabled={!isPreflightPassed}
          >
            <Rocket className="h-4 w-4" />
            Lancement
          </TabsTrigger>
        </TabsList>

        <TabsContent value="preflight" className="mt-6">
          <SelfLiberationPreFlight 
            onAllPassed={handlePreFlightPassed}
            onNavigate={onNavigate}
          />
        </TabsContent>

        <TabsContent value="config" className="mt-6 space-y-6">
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
        </TabsContent>

        <TabsContent value="launch" className="mt-6">
          <SelfLiberationLauncher />
        </TabsContent>
      </Tabs>
    </div>
  );
}
