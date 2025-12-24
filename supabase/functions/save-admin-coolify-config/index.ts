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

    console.log(`[save-admin-coolify-config] Testing Coolify at ${normalizedUrl} for user ${user.id}`);

    // Test Coolify API connection via /api/v1/version endpoint
    try {
      const versionUrl = `${normalizedUrl}/api/v1/version`;
      console.log(`[save-admin-coolify-config] Fetching ${versionUrl}`);
      
      const response = await fetch(versionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${coolify_token}`,
          'Accept': 'application/json',
        },
      });

      console.log(`[save-admin-coolify-config] Coolify response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[save-admin-coolify-config] Coolify error: ${response.status} - ${errorText}`);
        
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

      // Parse version response
      const responseText = await response.text();
      let coolifyVersion = responseText.trim();
      try {
        const versionData = JSON.parse(responseText);
        coolifyVersion = versionData.version || JSON.stringify(versionData);
      } catch {
        // Response is plain text (version string), which is fine
      }

      console.log(`[save-admin-coolify-config] Coolify version: ${coolifyVersion}`);

      // Also test /api/v1/applications to get app count
      let appsCount = 0;
      try {
        const appsResponse = await fetch(`${normalizedUrl}/api/v1/applications`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${coolify_token}`,
            'Accept': 'application/json',
          },
        });
        if (appsResponse.ok) {
          const apps = await appsResponse.json();
          appsCount = Array.isArray(apps) ? apps.length : 0;
        }
      } catch (e) {
        console.log(`[save-admin-coolify-config] Could not fetch apps: ${e}`);
      }

      // Extract IP from URL
      let ipAddress: string;
      try {
        const url = new URL(normalizedUrl);
        ipAddress = url.hostname;
      } catch {
        ipAddress = normalizedUrl.replace(/https?:\/\//, '').split(':')[0];
      }

      // Check if user already has a server entry
      const { data: existingServer } = await supabase
        .from('user_servers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingServer) {
        // Update existing server
        const { error: updateError } = await supabase
          .from('user_servers')
          .update({
            coolify_url: normalizedUrl,
            coolify_token: coolify_token,
            ip_address: ipAddress,
            status: 'ready',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingServer.id);

        if (updateError) {
          console.error('[save-admin-coolify-config] Update error:', updateError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erreur lors de la mise à jour en base' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Create new server entry
        const { error: insertError } = await supabase
          .from('user_servers')
          .insert({
            user_id: user.id,
            name: 'Serveur Coolify',
            ip_address: ipAddress,
            coolify_url: normalizedUrl,
            coolify_token: coolify_token,
            status: 'ready'
          });

        if (insertError) {
          console.error('[save-admin-coolify-config] Insert error:', insertError);
          return new Response(
            JSON.stringify({ success: false, error: 'Erreur lors de la création en base' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.log(`[save-admin-coolify-config] Saved Coolify config for user ${user.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Configuration Coolify sauvegardée',
          coolify_version: coolifyVersion,
          apps_count: appsCount
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (fetchError: unknown) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Erreur inconnue';
      console.error('[save-admin-coolify-config] Fetch error:', errorMessage);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Impossible de joindre Coolify: ${errorMessage}`,
          hint: 'Vérifiez que l\'URL est accessible depuis le serveur (pas de blocage CORS/réseau)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    console.error('[save-admin-coolify-config] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
