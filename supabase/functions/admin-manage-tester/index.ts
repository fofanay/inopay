import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[ADMIN-MANAGE-TESTER] ${step}`, details ? JSON.stringify(details) : "");
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

    // Parse request body
    const { action, email, user_id } = await req.json();
    logStep("Request received", { action, email, user_id });

    if (action === "add") {
      if (!email) {
        throw new Error("Email is required");
      }

      // Find user by email
      const { data: authUsers, error: authError } = await adminClient.auth.admin.listUsers({
        perPage: 1000,
      });

      if (authError) {
        throw new Error(`Failed to list users: ${authError.message}`);
      }

      const targetUser = authUsers.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      );

      if (!targetUser) {
        throw new Error("Utilisateur non trouvé. Vérifiez que l'email est correct et que l'utilisateur est inscrit.");
      }

      logStep("Target user found", { targetUserId: targetUser.id });

      // Check if subscription exists
      const { data: existingSub } = await adminClient
        .from("subscriptions")
        .select("*")
        .eq("user_id", targetUser.id)
        .maybeSingle();

      if (existingSub) {
        // Update existing subscription
        const { error } = await adminClient
          .from("subscriptions")
          .update({
            plan_type: "pro",
            status: "active",
            credits_remaining: 999999,
            free_credits: 999999,
            current_period_end: "2099-12-31",
          })
          .eq("user_id", targetUser.id);

        if (error) {
          logStep("Update error", { error });
          throw new Error(`Failed to update subscription: ${error.message}`);
        }
        logStep("Subscription updated");
      } else {
        // Create new subscription
        const { error } = await adminClient
          .from("subscriptions")
          .insert({
            user_id: targetUser.id,
            plan_type: "pro",
            status: "active",
            credits_remaining: 999999,
            free_credits: 999999,
            current_period_end: "2099-12-31",
          });

        if (error) {
          logStep("Insert error", { error });
          throw new Error(`Failed to create subscription: ${error.message}`);
        }
        logStep("Subscription created");
      }

      return new Response(JSON.stringify({ success: true, message: `${email} ajouté comme testeur` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else if (action === "remove") {
      if (!user_id) {
        throw new Error("User ID is required");
      }

      // Reset to free plan
      const { error } = await adminClient
        .from("subscriptions")
        .update({
          plan_type: "free",
          status: "inactive",
          credits_remaining: 0,
          free_credits: 0,
          current_period_end: null,
        })
        .eq("user_id", user_id);

      if (error) {
        logStep("Remove error", { error });
        throw new Error(`Failed to remove tester: ${error.message}`);
      }

      logStep("Tester removed");

      return new Response(JSON.stringify({ success: true, message: "Testeur retiré" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else {
      throw new Error("Invalid action. Use 'add' or 'remove'.");
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
