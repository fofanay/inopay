import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[ADMIN-SIGNOUT-ALL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    }

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Authentication failed");
    }

    logStep("User authenticated", { userId: userData.user.id });

    // Check if user is admin using service role client
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: roleData } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      logStep("Access denied - not admin", { userId: userData.user.id, role: roleData?.role });
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 403,
      });
    }

    logStep("Admin access confirmed");

    // Use the Admin API to sign out all users
    const usersResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
      },
    });

    if (!usersResponse.ok) {
      const errorText = await usersResponse.text();
      logStep("Failed to fetch users", { status: usersResponse.status, error: errorText });
      throw new Error(`Failed to fetch users: ${usersResponse.status}`);
    }

    const usersData = await usersResponse.json();
    const users = usersData.users || usersData || [];
    logStep("Found users", { count: users.length });

    let signedOutCount = 0;
    const errors: string[] = [];

    // Sign out each user by temporarily banning then unbanning
    for (const user of users) {
      // Skip the current admin user
      if (user.id === userData.user.id) {
        logStep("Skipping current admin user", { userId: user.id });
        continue;
      }

      try {
        // Ban user briefly to invalidate sessions
        const banResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
          method: "PUT",
          headers: {
            "Authorization": `Bearer ${serviceRoleKey}`,
            "apikey": serviceRoleKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ban_duration: "1s" }),
        });

        if (banResponse.ok) {
          // Immediately unban
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${user.id}`, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${serviceRoleKey}`,
              "apikey": serviceRoleKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ban_duration: "none" }),
          });
          signedOutCount++;
          logStep("User signed out", { userId: user.id });
        } else {
          const errorText = await banResponse.text();
          errors.push(`User ${user.id}: ${errorText}`);
        }
      } catch (err) {
        errors.push(`User ${user.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    logStep("Sign out operation completed", { signedOutCount, errorsCount: errors.length });

    // Log this admin action
    await supabaseClient.from("admin_activity_logs").insert({
      user_id: userData.user.id,
      action_type: "signout_all_users",
      title: "Déconnexion de tous les utilisateurs",
      description: `${signedOutCount} utilisateurs déconnectés sur ${users.length - 1}`,
      status: errors.length === 0 ? "success" : "partial",
      metadata: { signedOutCount, totalUsers: users.length - 1, errors: errors.slice(0, 10) },
    });

    return new Response(JSON.stringify({
      success: true,
      message: `${signedOutCount} utilisateurs ont été déconnectés`,
      signedOutCount,
      totalUsers: users.length - 1,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    }), {
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
