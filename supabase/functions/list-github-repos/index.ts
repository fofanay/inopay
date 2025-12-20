import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the GitHub provider token from user identities
    const githubIdentity = user.identities?.find(i => i.provider === "github");
    
    if (!githubIdentity) {
      return new Response(
        JSON.stringify({ error: "GitHub not connected. Please sign in with GitHub." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the stored GitHub token to fetch repos
    // We need to get the provider_token from the session
    const { data: sessionData } = await supabase.auth.admin.getUserById(user.id);
    
    // Fallback to using the GITHUB_PERSONAL_ACCESS_TOKEN if available
    const GITHUB_TOKEN = Deno.env.get("GITHUB_PERSONAL_ACCESS_TOKEN");
    
    if (!GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ error: "GitHub token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching repos for user: ${user.email}`);

    // Fetch user's repositories
    const reposResponse = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=100&type=all",
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "FreedomCode-App",
        },
      }
    );

    if (!reposResponse.ok) {
      const errorData = await reposResponse.json();
      console.error("GitHub API error:", errorData);
      return new Response(
        JSON.stringify({ error: `GitHub API error: ${errorData.message}` }),
        { status: reposResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const repos = await reposResponse.json();

    console.log(`Found ${repos.length} repositories`);

    return new Response(
      JSON.stringify({
        success: true,
        repos: repos.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          private: repo.private,
          html_url: repo.html_url,
          updated_at: repo.updated_at,
          stargazers_count: repo.stargazers_count,
          default_branch: repo.default_branch,
          language: repo.language,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch repositories";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
