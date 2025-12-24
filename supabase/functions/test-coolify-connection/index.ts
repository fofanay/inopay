import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  coolify_url: string;
  coolify_token: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Non authentifié' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentification invalide' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: RequestBody = await req.json();
    const { coolify_url, coolify_token } = body;

    if (!coolify_url || !coolify_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL et token Coolify requis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize URL (remove trailing slash)
    const normalizedUrl = coolify_url.trim().replace(/\/$/, '');

    console.log(`[test-coolify-connection] Testing Coolify at ${normalizedUrl}`);

    // Test Coolify API connection via /api/v1/applications endpoint
    try {
      const appsUrl = `${normalizedUrl}/api/v1/applications`;
      console.log(`[test-coolify-connection] Fetching ${appsUrl}`);
      
      const response = await fetch(appsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${coolify_token}`,
          'Accept': 'application/json',
        },
      });

      console.log(`[test-coolify-connection] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[test-coolify-connection] Error: ${response.status} - ${errorText}`);
        
        let errorMessage = `Erreur Coolify HTTP ${response.status}`;
        if (response.status === 401) {
          errorMessage = 'Token Coolify invalide ou expiré';
        } else if (response.status === 403) {
          errorMessage = 'Token sans permissions suffisantes';
        } else if (response.status === 404) {
          errorMessage = 'API Coolify non trouvée - vérifiez l\'URL';
        }
        
        return new Response(
          JSON.stringify({ success: false, error: errorMessage, status: response.status }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const apps = await response.json();
      const appsCount = Array.isArray(apps) ? apps.length : 0;

      // Look for an inopay app
      interface CoolifyApp {
        name?: string;
        git_repository?: string;
        fqdn?: string;
      }
      
      const inopayApp = (apps as CoolifyApp[]).find((app: CoolifyApp) => 
        app.name?.toLowerCase().includes('inopay') ||
        app.git_repository?.includes('inopay')
      );

      console.log(`[test-coolify-connection] Found ${appsCount} apps, inopay: ${inopayApp?.name || 'none'}`);

      return new Response(
        JSON.stringify({
          success: true,
          apps_count: appsCount,
          inopay_app: inopayApp?.name || null,
          app_url: inopayApp?.fqdn || null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (fetchError: unknown) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Erreur inconnue';
      console.error('[test-coolify-connection] Fetch error:', errorMessage);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Impossible de joindre Coolify: ${errorMessage}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[test-coolify-connection] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
