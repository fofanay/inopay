import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-REMINDER-EMAILS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");

    const resend = new Resend(resendKey);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Check if called by admin or cron
    const authHeader = req.headers.get("Authorization");
    let isAdmin = false;

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      if (userData.user) {
        const { data: roleData } = await supabaseClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("role", "admin")
          .single();
        isAdmin = !!roleData;
      }
    }

    const body = await req.json().catch(() => ({}));
    const { campaign_id, test_email } = body;

    // If test email, send to specific address
    if (test_email && isAdmin) {
      logStep("Sending test email", { to: test_email });

      const { data: campaign } = await supabaseClient
        .from("email_campaigns")
        .select("*, email_templates(*)")
        .eq("id", campaign_id)
        .single();

      if (!campaign?.email_templates) {
        throw new Error("Campaign or template not found");
      }

      const template = campaign.email_templates;
      const testHtml = template.html_content
        .replace(/\{\{user_name\}\}/g, "Test User")
        .replace(/\{\{plan_name\}\}/g, "Pro")
        .replace(/\{\{expiry_date\}\}/g, new Date().toLocaleDateString("fr-FR"));

      await resend.emails.send({
        from: "Inopay <noreply@resend.dev>",
        to: [test_email],
        subject: `[TEST] ${template.subject}`,
        html: testHtml,
      });

      return new Response(JSON.stringify({ success: true, message: "Test email sent" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get active campaigns
    const { data: campaigns } = await supabaseClient
      .from("email_campaigns")
      .select("*, email_templates(*)")
      .eq("status", "active");

    if (!campaigns || campaigns.length === 0) {
      logStep("No active campaigns found");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Processing campaigns", { count: campaigns.length });

    let totalSent = 0;
    const now = new Date();

    for (const campaign of campaigns) {
      if (!campaign.email_templates) continue;

      const template = campaign.email_templates;
      let usersToEmail: Array<{ id: string; email: string; name?: string }> = [];

      switch (campaign.trigger_type) {
        case "subscription_expiring":
          // Get users with subscriptions expiring in X days
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + (campaign.trigger_days || 7));
          const expiryStart = new Date(expiryDate);
          expiryStart.setHours(0, 0, 0, 0);
          const expiryEnd = new Date(expiryDate);
          expiryEnd.setHours(23, 59, 59, 999);

          const { data: expiringUsers } = await supabaseClient
            .from("subscriptions")
            .select("user_id, current_period_end")
            .eq("status", "active")
            .gte("current_period_end", expiryStart.toISOString())
            .lte("current_period_end", expiryEnd.toISOString());

          if (expiringUsers) {
            for (const sub of expiringUsers) {
              const { data: userData } = await supabaseClient.auth.admin.getUserById(sub.user_id);
              if (userData.user?.email) {
                usersToEmail.push({
                  id: sub.user_id,
                  email: userData.user.email,
                  name: userData.user.user_metadata?.full_name,
                });
              }
            }
          }
          break;

        case "low_credits":
          const { data: lowCreditUsers } = await supabaseClient
            .from("subscriptions")
            .select("user_id, credits_remaining")
            .lte("credits_remaining", campaign.trigger_days || 1);

          if (lowCreditUsers) {
            for (const sub of lowCreditUsers) {
              const { data: userData } = await supabaseClient.auth.admin.getUserById(sub.user_id);
              if (userData.user?.email) {
                usersToEmail.push({
                  id: sub.user_id,
                  email: userData.user.email,
                  name: userData.user.user_metadata?.full_name,
                });
              }
            }
          }
          break;
      }

      logStep(`Campaign ${campaign.id}`, { trigger: campaign.trigger_type, users: usersToEmail.length });

      // Check if already sent to these users recently
      for (const user of usersToEmail) {
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const { data: recentLog } = await supabaseClient
          .from("email_logs")
          .select("id")
          .eq("user_id", user.id)
          .eq("campaign_id", campaign.id)
          .gte("sent_at", oneDayAgo.toISOString())
          .single();

        if (recentLog) {
          logStep("Skipping user - already emailed", { userId: user.id });
          continue;
        }

        // Replace variables in template
        const html = template.html_content
          .replace(/\{\{user_name\}\}/g, user.name || "Utilisateur")
          .replace(/\{\{user_email\}\}/g, user.email);

        const subject = template.subject
          .replace(/\{\{user_name\}\}/g, user.name || "Utilisateur");

        try {
          await resend.emails.send({
            from: "Inopay <noreply@resend.dev>",
            to: [user.email],
            subject,
            html,
          });

          // Log the email
          await supabaseClient.from("email_logs").insert({
            campaign_id: campaign.id,
            user_id: user.id,
            user_email: user.email,
            template_id: template.id,
            subject,
            status: "sent",
          });

          totalSent++;
          logStep("Email sent", { to: user.email });
        } catch (emailError) {
          logStep("Failed to send email", { to: user.email, error: emailError });
        }
      }

      // Update campaign last_run
      await supabaseClient
        .from("email_campaigns")
        .update({ last_run: now.toISOString() })
        .eq("id", campaign.id);
    }

    logStep("Completed", { totalSent });

    return new Response(JSON.stringify({ success: true, sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
