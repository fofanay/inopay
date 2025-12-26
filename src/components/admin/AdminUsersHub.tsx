import { useState } from "react";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, FlaskConical } from "lucide-react";
import AdminUsersList from "./AdminUsersList";
import AdminTesters from "./AdminTesters";

export function AdminUsersHub() {
  const [activeSubTab, setActiveSubTab] = useState("users");

  const tabs = [
    { id: "users", label: "Utilisateurs", icon: Users },
    { id: "testers", label: "Testeurs", icon: FlaskConical },
  ];

  return (
    <div className="space-y-6">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid grid-cols-2 w-full max-w-md bg-muted/50">
          {tabs.map((tab) => (
            <TabsTrigger 
              key={tab.id} 
              value={tab.id}
              className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
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
          <TabsContent value="users" className="mt-0">
            <AdminUsersList />
          </TabsContent>
          <TabsContent value="testers" className="mt-0">
            <AdminTesters />
          </TabsContent>
        </motion.div>
      </Tabs>
    </div>
  );
}
