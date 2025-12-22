import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
        JSON.stringify({ valid: false, error: 'Not authenticated' }),
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
        JSON.stringify({ valid: false, error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { server_id, coolify_token, coolify_url } = await req.json();

    if (!server_id || !coolify_token || !coolify_url) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify server belongs to user
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('id, user_id, ip_address')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Server not found or not authorized' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating Coolify token for server ${server_id} at ${coolify_url}`);

    // Test Coolify API connection
    try {
      const healthUrl = `${coolify_url}/api/v1/version`;
      console.log(`Testing Coolify API at: ${healthUrl}`);
      
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${coolify_token}`,
          'Accept': 'application/json',
        },
      });

      console.log(`Coolify API response status: ${response.status}`);

      if (response.ok) {
        // Try to parse as JSON, fallback to text if it fails
        const responseText = await response.text();
        console.log(`Coolify response: ${responseText}`);
        
        let coolifyVersion = responseText;
        try {
          const versionData = JSON.parse(responseText);
          coolifyVersion = versionData.version || JSON.stringify(versionData);
        } catch {
          // Response is plain text (version string), which is fine
          coolifyVersion = responseText.trim();
        }
        
        console.log(`Coolify version: ${coolifyVersion}`);

        // Token is valid, save it to database
        const { error: updateError } = await supabase
          .from('user_servers')
          .update({ 
            coolify_token: coolify_token,
            coolify_url: coolify_url,
            status: 'ready'
          })
          .eq('id', server_id);

        if (updateError) {
          console.error('Error updating server:', updateError);
          return new Response(
            JSON.stringify({ valid: false, error: 'Failed to save token' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            valid: true, 
            message: 'Token validated and saved',
            coolify_version: coolifyVersion
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const errorText = await response.text();
        console.error(`Coolify API error: ${response.status} - ${errorText}`);
        
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: response.status === 401 
              ? 'Token invalide ou expiré' 
              : `Erreur Coolify: ${response.status}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (fetchError: any) {
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: `Impossible de joindre Coolify: ${fetchError.message}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error in validate-coolify-token:', error);
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
