import { HelpCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";

const PricingFAQ = () => {
  const { t } = useTranslation();

  const faqItems = [
    { key: "howItWorks" },
    { key: "oneTime" },
    { key: "packPro" },
    { key: "security" },
    { key: "support" },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <Badge className="mb-4 bg-secondary/50 text-secondary-foreground border-secondary/30">
          <HelpCircle className="h-3 w-3 mr-1" />
          {t('pricing.faq.badge')}
        </Badge>
        <h2 className="text-2xl md:text-3xl font-bold mb-2 text-foreground">
          {t('pricing.faq.title')}
        </h2>
        <p className="text-muted-foreground">
          {t('pricing.faq.subtitle')}
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {faqItems.map((item, index) => (
          <AccordionItem 
            key={item.key} 
            value={item.key}
            className="border border-border/50 rounded-lg px-4 bg-card/50 backdrop-blur data-[state=open]:border-primary/30"
          >
            <AccordionTrigger className="text-left py-4 hover:no-underline group">
              <div className="flex items-center gap-3">
                <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {index + 1}
                </span>
                <span className="font-medium group-hover:text-primary transition-colors">
                  {t(`pricing.faq.items.${item.key}.question`)}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pl-9 text-muted-foreground">
              {t(`pricing.faq.items.${item.key}.answer`)}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default PricingFAQ;
