import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface SgiGuardProps {
  children: React.ReactNode;
}

export const SgiGuard: React.FC<SgiGuardProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        // getUser() appelle /auth/me qui retourne role + user_type
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }

        const role = (user as any).role || (user as any).user_metadata?.role;
        const userType = (user as any).user_type || (user as any).user_metadata?.user_type;

        // Autoriser SGI users et admins
        if (userType === "sgi_user" || role === "admin") {
          setAuthorized(true);
        }
      } catch {
        setAuthorized(false);
      }
      setLoading(false);
    };
    check();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
