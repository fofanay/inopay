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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { name, ip_address, provider } = await req.json();

    if (!name || !ip_address) {
      return new Response(
        JSON.stringify({ error: 'Name and IP address are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique setup ID
    const setupId = crypto.randomUUID().replace(/-/g, '').substring(0, 16);

    // Create server entry in database
    const { data: server, error: insertError } = await supabase
      .from('user_servers')
      .insert({
        user_id: user.id,
        name,
        ip_address,
        provider: provider || 'other',
        setup_id: setupId,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create server entry' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate the installation script URL
    const scriptUrl = `${supabaseUrl}/functions/v1/serve-setup-script?id=${setupId}`;
    
    // Installation command for the user
    const installCommand = `curl -sSL "${scriptUrl}" | bash`;

    console.log(`Created server setup for user ${user.id}, setup_id: ${setupId}`);

    return new Response(
      JSON.stringify({
        success: true,
        server,
        setupId,
        installCommand,
        instructions: [
          "1. Connectez-vous à votre VPS via SSH",
          `2. Exécutez cette commande : ${installCommand}`,
          "3. Patientez 3-5 minutes pendant l'installation",
          "4. Inopay détectera automatiquement quand Coolify sera prêt"
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in setup-vps:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
