import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionInfo {
  subscribed: boolean;
  planType: "free" | "pack" | "pro";
  creditsRemaining?: number;
  subscriptionEnd?: string;
}

type UserRole = "admin" | "moderator" | "user" | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  subscription: SubscriptionInfo;
  role: UserRole;
  isAdmin: boolean;
  checkSubscription: () => Promise<void>;
  checkRole: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo>({
    subscribed: false,
    planType: "free",
  });
  const [role, setRole] = useState<UserRole>(null);

  const checkRole = async () => {
    if (!user) {
      setRole(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking role:", error);
        setRole(null);
        return;
      }

      setRole(data?.role as UserRole || null);
    } catch (error) {
      console.error("Error checking role:", error);
      setRole(null);
    }
  };

  const checkSubscription = async (accessToken?: string) => {
    const tokenToUse = accessToken || session?.access_token;
    if (!tokenToUse) {
      console.log("[AUTH] checkSubscription: No token available");
      return;
    }

    console.log("[AUTH] checkSubscription: Calling with token");

    try {
      const response = await supabase.functions.invoke("check-subscription", {
        headers: {
          Authorization: `Bearer ${tokenToUse}`,
        },
      });

      if (response.data && !response.error) {
        setSubscription({
          subscribed: response.data.subscribed,
          planType: response.data.plan_type || "free",
          creditsRemaining: response.data.credits_remaining,
          subscriptionEnd: response.data.subscription_end,
        });
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Check subscription and role after auth state change
        if (session?.access_token) {
          setTimeout(() => {
            checkSubscription(session.access_token);
          }, 0);
        } else {
          setSubscription({ subscribed: false, planType: "free" });
          setRole(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.access_token) {
        setTimeout(() => {
          checkSubscription(session.access_token);
        }, 0);
      }
    });

    return () => authSubscription.unsubscribe();
  }, []);

  // Check role when user changes
  useEffect(() => {
    if (user) {
      checkRole();
    } else {
      setRole(null);
    }
  }, [user]);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSubscription({ subscribed: false, planType: "free" });
    setRole(null);
  };

  const isAdmin = role === "admin";

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      subscription,
      role,
      isAdmin,
      checkSubscription,
      checkRole,
      signUp, 
      signIn, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
