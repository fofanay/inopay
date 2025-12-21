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

    // Get the GitHub token from the request body (user's OAuth token) or fallback to server token
    let github_token: string | null = null;
    
    try {
      const body = await req.json();
      github_token = body?.github_token || null;
    } catch {
      // No body or invalid JSON, will use server token
    }

    // Prioritize user's GitHub token, fallback to server token
    const GITHUB_TOKEN = github_token || Deno.env.get("GITHUB_PERSONAL_ACCESS_TOKEN");
    const usingUserToken = !!github_token;
    
    if (!GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ error: "GitHub token not available. Please reconnect with GitHub." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[LIST-GITHUB-REPOS] Fetching repos for user: ${user.email}, using ${usingUserToken ? "user" : "server"} token`);

    // Fetch user's repositories
    const reposResponse = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=100&type=all",
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Inopay-FreedomCode-App",
        },
      }
    );

    if (!reposResponse.ok) {
      const errorData = await reposResponse.json();
      console.error("[LIST-GITHUB-REPOS] GitHub API error:", errorData);
      
      // Check if token is expired
      if (reposResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: "Votre connexion GitHub a expiré. Veuillez vous reconnecter.",
            tokenExpired: true
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `GitHub API error: ${errorData.message}` }),
        { status: reposResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const repos = await reposResponse.json();

    console.log(`[LIST-GITHUB-REPOS] Found ${repos.length} repositories (using ${usingUserToken ? "user" : "server"} token)`);

    return new Response(
      JSON.stringify({
        success: true,
        usingUserToken,
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
    console.error("[LIST-GITHUB-REPOS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch repositories";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
