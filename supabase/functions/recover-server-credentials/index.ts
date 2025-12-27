import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { server_id } = await req.json();

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: 'server_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the server
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('*')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server) {
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[recover-server-credentials] Attempting to recover credentials for server ${server_id}`);
    console.log(`[recover-server-credentials] Server IP: ${server.ip_address}`);

    // For now, we'll generate a new setup_id to allow the user to re-run the installation script
    // This is a fallback mechanism when automatic credential recovery fails
    const newSetupId = crypto.randomUUID();

    // Update the server with a new setup_id
    const { error: updateError } = await supabase
      .from('user_servers')
      .update({
        setup_id: newSetupId,
        status: server.status === 'ready' ? 'ready' : 'pending', // Keep ready if already ready
        updated_at: new Date().toISOString()
      })
      .eq('id', server_id);

    if (updateError) {
      console.error('[recover-server-credentials] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to prepare credential recovery' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate the recovery command
    const recoveryCommand = `curl -fsSL ${supabaseUrl}/functions/v1/serve-setup-script?id=${newSetupId} | bash`;

    console.log(`[recover-server-credentials] Recovery prepared for server ${server_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pour récupérer les credentials, exécutez ce script sur votre serveur:',
        recovery_command: recoveryCommand,
        setup_id: newSetupId,
        instructions: [
          '1. Connectez-vous en SSH à votre serveur',
          `2. Exécutez: ${recoveryCommand}`,
          '3. Le script renverra les credentials à Inopay automatiquement'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[recover-server-credentials] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
