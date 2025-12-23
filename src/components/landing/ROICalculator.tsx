import { useState } from "react";
import { Calculator, DollarSign, Clock, TrendingDown, Sparkles, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

interface ROICalculatorProps {
  currency?: "CAD" | "USD" | "EUR";
}

const CURRENCY_CONFIG = {
  CAD: { symbol: "$", suffix: "CAD", portfolioPrice: 299, deployPrice: 99, herokuMonthly: 25, vercelMonthly: 20 },
  USD: { symbol: "$", suffix: "USD", portfolioPrice: 225, deployPrice: 75, herokuMonthly: 20, vercelMonthly: 20 },
  EUR: { symbol: "€", suffix: "EUR", portfolioPrice: 199, deployPrice: 69, herokuMonthly: 18, vercelMonthly: 18 },
};

export default function ROICalculator({ currency = "CAD" }: ROICalculatorProps) {
  const { t } = useTranslation();
  const [appCount, setAppCount] = useState(10);
  const [devHoursPerWeek, setDevHoursPerWeek] = useState(5);
  const [currentMonthlyCost, setCurrentMonthlyCost] = useState(50);

  const config = CURRENCY_CONFIG[currency];

  // Calculs ROI
  const yearlyHostingCostBefore = currentMonthlyCost * appCount * 12;
  const yearlyPortfolioCost = config.portfolioPrice * 12;
  const yearlyPayPerUseCost = config.deployPrice * appCount;

  // Économies hosting (Plan Portfolio vs PaaS actuel)
  const hostingSavings = Math.max(0, yearlyHostingCostBefore - yearlyPortfolioCost);
  
  // Économies temps (1h DevOps = ~75$ de valeur)
  const hourlyDevValue = currency === "EUR" ? 65 : currency === "USD" ? 75 : 85;
  const yearlyDevTimeCost = devHoursPerWeek * 52 * hourlyDevValue;
  const devTimeRecoveredPercent = 0.8; // On récupère 80% du temps DevOps
  const timeSavings = yearlyDevTimeCost * devTimeRecoveredPercent;
  
  // Heures récupérées par mois
  const hoursRecoveredPerMonth = Math.round(devHoursPerWeek * 4 * devTimeRecoveredPercent);

  const totalYearlySavings = hostingSavings + timeSavings;

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
            <Calculator className="h-3 w-3 mr-1" />
            {t("roiCalculator.badge")}
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            {t("roiCalculator.title")}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t("roiCalculator.subtitle")}
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-8">
          {/* Sliders */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {t("roiCalculator.yourSituation")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Nombre d'apps */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-foreground">
                    {t("roiCalculator.appCount")}
                  </label>
                  <Badge variant="secondary" className="text-lg font-bold px-3">
                    {appCount}
                  </Badge>
                </div>
                <Slider
                  value={[appCount]}
                  onValueChange={(value) => setAppCount(value[0])}
                  min={1}
                  max={50}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  {t("roiCalculator.appCountHelp")}
                </p>
              </div>

              {/* Heures DevOps */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-foreground">
                    {t("roiCalculator.devHours")}
                  </label>
                  <Badge variant="secondary" className="text-lg font-bold px-3">
                    {devHoursPerWeek}h
                  </Badge>
                </div>
                <Slider
                  value={[devHoursPerWeek]}
                  onValueChange={(value) => setDevHoursPerWeek(value[0])}
                  min={0}
                  max={20}
                  step={1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  {t("roiCalculator.devHoursHelp")}
                </p>
              </div>

              {/* Coût mensuel actuel */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-foreground">
                    {t("roiCalculator.monthlyCost")}
                  </label>
                  <Badge variant="secondary" className="text-lg font-bold px-3">
                    {config.symbol}{currentMonthlyCost}
                  </Badge>
                </div>
                <Slider
                  value={[currentMonthlyCost]}
                  onValueChange={(value) => setCurrentMonthlyCost(value[0])}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  {t("roiCalculator.monthlyCostHelp")}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Résultats */}
          <div className="space-y-6">
            {/* Total Savings Card */}
            <Card className="border-2 border-primary bg-primary/5">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    {t("roiCalculator.yearlySavings")}
                  </p>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <TrendingDown className="h-8 w-8 text-primary" />
                    <span className="text-5xl font-bold text-primary">
                      {config.symbol}{Math.round(totalYearlySavings).toLocaleString()}
                    </span>
                    <span className="text-lg text-muted-foreground">/{config.suffix}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("roiCalculator.monthlyEquivalent")}{config.symbol}{Math.round(totalYearlySavings / 12).toLocaleString()}{t("roiCalculator.perMonth")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <DollarSign className="h-8 w-8 text-success mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {config.symbol}{Math.round(hostingSavings).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("roiCalculator.hostingSavingsYear")}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">
                    {hoursRecoveredPerMonth}h
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("roiCalculator.recoveredMonth")}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Comparaison */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{t("roiCalculator.currentCost")}</span>
                    <span className="font-medium text-destructive line-through">
                      {config.symbol}{yearlyHostingCostBefore.toLocaleString()}/an
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{t("roiCalculator.withPortfolio")}</span>
                    <span className="font-medium text-success">
                      {config.symbol}{yearlyPortfolioCost.toLocaleString()}/an
                    </span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{t("roiCalculator.youKeep")}</span>
                      <Badge className="bg-success text-success-foreground">
                        {config.symbol}{hostingSavings.toLocaleString()}/an
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <Button asChild size="lg" className="w-full">
              <Link to="/tarifs">
                {t("roiCalculator.viewPlan")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}