import { useState, useEffect, useCallback, useRef, createContext, useContext, ReactNode } from "react";
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
  checkSubscription: (accessToken?: string) => Promise<void>;
  checkRole: () => Promise<void>;
  refreshSession: () => Promise<Session | null>;
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

// Check if token is about to expire (within 5 minutes)
const isTokenExpiringSoon = (session: Session | null): boolean => {
  if (!session?.expires_at) return false;
  const expiresAt = session.expires_at * 1000; // Convert to milliseconds
  const fiveMinutes = 5 * 60 * 1000;
  return Date.now() > expiresAt - fiveMinutes;
};

// Check if token is expired
const isTokenExpired = (session: Session | null): boolean => {
  if (!session?.expires_at) return true;
  return Date.now() > session.expires_at * 1000;
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
  const refreshingRef = useRef(false);
  const lastRefreshRef = useRef<number>(0);

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

  const clearAuthState = useCallback(async () => {
    setSession(null);
    setUser(null);
    setSubscription({ subscribed: false, planType: "free" });
    setRole(null);

    try {
      // "local" clears client storage even if the server-side session is already gone
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Ignore: session may already be invalidated server-side
    }
  }, []);

  // Refresh session and get new tokens
  const refreshSession = useCallback(async (): Promise<Session | null> => {
    // Prevent concurrent refresh attempts
    if (refreshingRef.current) {
      console.log("[AUTH] Refresh already in progress, skipping");
      return session;
    }

    // Prevent too frequent refreshes (minimum 10 seconds between refreshes)
    const now = Date.now();
    if (now - lastRefreshRef.current < 10000) {
      console.log("[AUTH] Refresh attempted too soon, skipping");
      return session;
    }

    refreshingRef.current = true;
    lastRefreshRef.current = now;

    try {
      console.log("[AUTH] Refreshing session...");
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error("[AUTH] Session refresh failed:", error);
        refreshingRef.current = false;
        
        // If refresh token/session is invalid, sign out locally (clears storage)
        if (
          error.message?.includes("refresh_token") ||
          error.message?.includes("Invalid") ||
          error.message?.includes("not found") ||
          error.message?.includes("session_not_found") ||
          error.message?.includes("Session from session_id claim")
        ) {
          console.log("[AUTH] Invalid refresh token/session, signing out user locally");
          await clearAuthState();
        }
        return null;
      }

      if (data.session) {
        console.log("[AUTH] Session refreshed successfully");
        setSession(data.session);
        setUser(data.session.user);
        refreshingRef.current = false;
        return data.session;
      }

      refreshingRef.current = false;
      return null;
    } catch (error) {
      console.error("[AUTH] Session refresh error:", error);
      refreshingRef.current = false;
      return null;
    }
  }, [session, clearAuthState]);

  const checkSubscription = useCallback(async (accessToken?: string) => {
    let tokenToUse = accessToken || session?.access_token;
    
    // Don't check if session is expired
    if (session && isTokenExpired(session)) {
      console.log("[AUTH] Token expired, skipping subscription check");
      return;
    }
    
    // If token is expiring soon, refresh first
    if (session && isTokenExpiringSoon(session)) {
      console.log("[AUTH] Token expiring soon, refreshing before subscription check");
      const newSession = await refreshSession();
      if (newSession) {
        tokenToUse = newSession.access_token;
      } else {
        console.log("[AUTH] Refresh failed, skipping subscription check");
        return;
      }
    }

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

      // Handle 401 errors by refreshing token and retrying
      if (response.error?.message?.includes("401") || 
          response.data?.error?.includes("Authentication") ||
          response.data?.error?.includes("session missing")) {
        console.log("[AUTH] Got 401, attempting token refresh and retry");
        
        // First check if we even have a session still
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          console.log("[AUTH] No valid session, user needs to re-login");
          await clearAuthState();
          return;
        }

        const newSession = await refreshSession();

        if (!newSession) {
          // Session is truly invalid, user needs to re-login
          console.log("[AUTH] Session invalid, user needs to re-login");
          await clearAuthState();
          return;
        }
        
        // Retry with new token
        const retryResponse = await supabase.functions.invoke("check-subscription", {
          headers: {
            Authorization: `Bearer ${newSession.access_token}`,
          },
        });

        if (retryResponse.data && !retryResponse.error && !retryResponse.data.error) {
          setSubscription({
            subscribed: retryResponse.data.subscribed,
            planType: retryResponse.data.plan_type || "free",
            creditsRemaining: retryResponse.data.credits_remaining,
            subscriptionEnd: retryResponse.data.subscription_end,
          });
          return;
        }
        
        // If retry failed, set to free plan
        setSubscription({ subscribed: false, planType: "free" });
        return;
      }

      if (response.data && !response.error && !response.data.error) {
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
  }, [session, refreshSession, clearAuthState]);

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

  // Proactive token refresh - check every 30 seconds if token is expiring soon
  useEffect(() => {
    if (!session) return;

    const checkAndRefresh = async () => {
      if (isTokenExpiringSoon(session)) {
        console.log("[AUTH] Token expiring soon, proactively refreshing");
        await refreshSession();
      }
    };

    const interval = setInterval(checkAndRefresh, 30000); // Check every 30 seconds
    
    // Also check immediately
    checkAndRefresh();

    return () => clearInterval(interval);
  }, [session, refreshSession]);

  // Periodic subscription refresh every 60 seconds
  useEffect(() => {
    if (!session?.access_token || !user) return;

    const interval = setInterval(async () => {
      // Re-check if session is still valid before making the call
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        console.log("[AUTH] Session expired, stopping periodic refresh");
        setSession(null);
        setUser(null);
        setSubscription({ subscribed: false, planType: "free" });
        setRole(null);
        return;
      }
      
      console.log("[AUTH] Periodic subscription refresh");
      checkSubscription(currentSession.access_token);
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [session?.access_token, user, checkSubscription]);

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
    await clearAuthState();
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
      refreshSession,
      signUp, 
      signIn, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
