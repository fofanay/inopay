import { Check, X, Zap, Key, Sparkles, Shield, FileCode, Infinity, Lock, Rocket, Building2, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

interface ComparisonFeature {
  key: string;
  icon: React.ElementType;
  confort: boolean | string;
  souverain: boolean | string;
}

const PackComparison = () => {
  const { t } = useTranslation();

  const features: ComparisonFeature[] = [
    { key: "aiCleaning", icon: Sparkles, confort: true, souverain: true },
    { key: "fileLimit", icon: FileCode, confort: "500", souverain: "unlimited" },
    { key: "ownApiKey", icon: Key, confort: false, souverain: true },
    { key: "tokenCost", icon: Zap, confort: "included", souverain: "byok" },
    { key: "zeroDoor", icon: Shield, confort: true, souverain: true },
    { key: "advancedAudit", icon: Lock, confort: false, souverain: true },
    { key: "encryption", icon: Lock, confort: true, souverain: true },
    { key: "deployment", icon: Rocket, confort: true, souverain: true },
    { key: "volumeDiscount", icon: Infinity, confort: false, souverain: true },
  ];

  const renderValue = (value: boolean | string) => {
    if (value === true) {
      return <Check className="h-5 w-5 text-success" />;
    }
    if (value === false) {
      return <X className="h-5 w-5 text-muted-foreground/50" />;
    }
    if (value === "unlimited") {
      return <span className="text-sm font-medium text-amber-400">{t('pricing.comparison.unlimited')}</span>;
    }
    if (value === "included") {
      return <span className="text-sm font-medium text-emerald-400">{t('pricing.comparison.included')}</span>;
    }
    if (value === "byok") {
      return <span className="text-sm font-medium text-amber-400">{t('pricing.comparison.yourTokens')}</span>;
    }
    return <span className="text-sm font-medium">{value} {t('pricing.calculator.files')}</span>;
  };

  return (
    <Card className="border-primary/20 bg-card/50 backdrop-blur">
      <CardHeader className="text-center pb-6">
        <Badge className="mx-auto mb-3 bg-primary/10 text-primary border-primary/20">
          {t('pricing.comparison.badge')}
        </Badge>
        <CardTitle className="text-2xl">{t('pricing.comparison.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-4 px-3 text-sm font-medium text-muted-foreground">
                  {t('pricing.comparison.feature')}
                </th>
                <th className="text-center py-4 px-3 min-w-[140px]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">{t('pricing.confort.name')}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>49$/mo</span>
                      </div>
                    </div>
                  </div>
                </th>
                <th className="text-center py-4 px-3 min-w-[140px]">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Key className="h-4 w-4 text-amber-500" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">{t('pricing.souverain.name')}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span>29$/mo</span>
                      </div>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((feature, index) => (
                <tr 
                  key={feature.key} 
                  className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${
                    index % 2 === 0 ? 'bg-muted/10' : ''
                  }`}
                >
                  <td className="py-4 px-3">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <feature.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{t(`pricing.comparison.features.${feature.key}.name`)}</p>
                        <p className="text-xs text-muted-foreground">{t(`pricing.comparison.features.${feature.key}.desc`)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-center">
                    {renderValue(feature.confort)}
                  </td>
                  <td className="py-4 px-3 text-center">
                    {renderValue(feature.souverain)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PackComparison;
