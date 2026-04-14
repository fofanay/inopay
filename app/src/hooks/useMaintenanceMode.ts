import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMaintenanceMode() {
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      // Check maintenance status (public read)
      const { data: maint } = await supabase
        .from("system_maintenance")
        .select("maintenance_active")
        .limit(1)
        .maybeSingle();

      const active = maint?.maintenance_active === true;
      setIsMaintenanceActive(active);

      if (active) {
        // Check if current user is admin using stored role (set by /auth/login and /auth/me)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const role = (user as any).role || (user as any).user_metadata?.role;
          setIsAdmin(role === "admin");
        }
      }

      setLoading(false);
    };

    check();
  }, []);

  return { isMaintenanceActive, isAdmin, loading };
}
