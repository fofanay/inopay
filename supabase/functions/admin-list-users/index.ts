import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[ADMIN-LIST-USERS] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use anon key client for auth check
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // Verify the requesting user is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Invalid token");
    }

    logStep("User authenticated", { userId: userData.user.id });

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Check if user is admin
    const { data: roleData, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (roleError || roleData?.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    logStep("Admin verified");

    // Get all auth users via admin API
    const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });

    if (authError) {
      throw new Error(`Failed to list auth users: ${authError.message}`);
    }

    logStep("Auth users fetched", { count: authUsers.users.length });

    // Get subscriptions
    const { data: subscriptions, error: subError } = await adminClient
      .from("subscriptions")
      .select("*");

    if (subError) {
      logStep("Subscriptions error", { error: subError });
    }

    // Get project counts
    const { data: projects, error: projError } = await adminClient
      .from("projects_analysis")
      .select("user_id, portability_score");

    if (projError) {
      logStep("Projects error", { error: projError });
    }

    // Get banned users
    const { data: bannedUsers, error: banError } = await adminClient
      .from("banned_users")
      .select("user_id");

    if (banError) {
      logStep("Banned users error", { error: banError });
    }

    const bannedSet = new Set(bannedUsers?.map(b => b.user_id) || []);
    const subMap = new Map(subscriptions?.map(s => [s.user_id, s]) || []);

    // Build user list with all data
    const users = authUsers.users.map(authUser => {
      const subscription = subMap.get(authUser.id);
      const userProjects = projects?.filter(p => p.user_id === authUser.id) || [];
      const scores = userProjects.map(p => p.portability_score).filter(s => s !== null);
      const avgScore = scores.length > 0 
        ? Math.round(scores.reduce((a, b) => a + (b || 0), 0) / scores.length)
        : 0;

      return {
        user_id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        plan_type: subscription?.plan_type || "free",
        status: subscription?.status || "inactive",
        credits_remaining: subscription?.credits_remaining || 0,
        project_count: userProjects.length,
        avg_score: avgScore,
        is_banned: bannedSet.has(authUser.id),
      };
    });

    logStep("Users compiled", { count: users.length });

    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
