import { useState } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, CalendarCheck, ShoppingCart, TrendingUp } from "lucide-react";
import AdminPayments from "./AdminPayments";
import AdminSubscriptions from "./AdminSubscriptions";
import AdminPurchases from "./AdminPurchases";
import AdminUpsellStats from "./AdminUpsellStats";
import AdminKPIs from "./AdminKPIs";

export function AdminBusinessHub() {
  const [activeSubTab, setActiveSubTab] = useState("kpis");

  const tabs = [
    { id: "kpis", label: "KPIs", icon: TrendingUp },
    { id: "payments", label: "Paiements", icon: CreditCard },
    { id: "subscriptions", label: "Abonnements", icon: CalendarCheck },
    { id: "purchases", label: "Achats", icon: ShoppingCart },
    { id: "upsells", label: "Upsells", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl bg-muted/50">
          {tabs.map((tab) => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id}
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-6"
        >
          <TabsContent value="kpis" className="mt-0">
            <AdminKPIs />
          </TabsContent>
          <TabsContent value="payments" className="mt-0">
            <AdminPayments />
          </TabsContent>
          <TabsContent value="subscriptions" className="mt-0">
            <AdminSubscriptions />
          </TabsContent>
          <TabsContent value="purchases" className="mt-0">
            <AdminPurchases />
          </TabsContent>
          <TabsContent value="upsells" className="mt-0">
            <AdminUpsellStats />
          </TabsContent>
        </motion.div>
      </Tabs>
    </div>
  );
}
