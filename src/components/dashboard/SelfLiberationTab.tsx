import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LiberationPackHub } from './LiberationPackHub';
import { Rocket } from 'lucide-react';

interface SelfLiberationTabProps {
  onNavigate?: (tab: string) => void;
}

export function SelfLiberationTab({ onNavigate }: SelfLiberationTabProps) {
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

      {/* Un seul composant unifié - plus de wizard séparé */}
      <LiberationPackHub />
    </div>
  );
}
