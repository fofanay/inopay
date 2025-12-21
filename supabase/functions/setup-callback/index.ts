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
    const { setup_id, server_ip, coolify_port, coolify_token, status } = await req.json();

    if (!setup_id) {
      return new Response(
        JSON.stringify({ error: 'setup_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the server by setup_id
    const { data: server, error: findError } = await supabase
      .from('user_servers')
      .select('*')
      .eq('setup_id', setup_id)
      .single();

    if (findError || !server) {
      console.error('Server not found for setup_id:', setup_id);
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build coolify URL
    const coolifyUrl = `http://${server_ip || server.ip_address}:${coolify_port || 8000}`;

    // Update server with installation status
    const updateData: Record<string, unknown> = {
      status: status === 'ready' ? 'ready' : 'error',
      coolify_url: coolifyUrl,
      updated_at: new Date().toISOString()
    };

    if (coolify_token) {
      updateData.coolify_token = coolify_token;
    }

    if (status === 'error') {
      updateData.error_message = 'Installation failed';
    }

    const { error: updateError } = await supabase
      .from('user_servers')
      .update(updateData)
      .eq('id', server.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update server status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Server ${server.id} updated: status=${status}, coolify_url=${coolifyUrl}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Server configuration updated',
        coolify_url: coolifyUrl
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in setup-callback:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
