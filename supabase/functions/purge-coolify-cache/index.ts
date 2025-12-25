import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeCoolifyUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `http://${normalized}`;
  }
  normalized = normalized.replace(/\/+$/, '');
  if (!normalized.includes(':8000') && !normalized.includes(':443')) {
    const urlObj = new URL(normalized);
    if (urlObj.protocol === 'http:') {
      urlObj.port = '8000';
    }
    normalized = urlObj.toString().replace(/\/+$/, '');
  }
  return normalized;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const { server_id, coolify_app_uuid } = await req.json();

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: 'server_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[purge-coolify-cache] Purging cache for server ${server_id}`);

    // Get server info
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

    if (!server.coolify_url || !server.coolify_token) {
      return new Response(
        JSON.stringify({ error: 'Coolify not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const coolifyUrl = normalizeCoolifyUrl(server.coolify_url);
    const coolifyHeaders = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const actions: string[] = [];
    const errors: string[] = [];

    // Method 1: If app UUID is provided, reset its build cache
    if (coolify_app_uuid) {
      try {
        // Try to patch app with force rebuild settings
        const patchRes = await fetch(`${coolifyUrl}/api/v1/applications/${coolify_app_uuid}`, {
          method: 'PATCH',
          headers: coolifyHeaders,
          body: JSON.stringify({
            // Reset cached values
            git_commit_sha: null,
            // Force fresh build
          })
        });

        if (patchRes.ok) {
          actions.push(`Reset git_commit_sha pour app ${coolify_app_uuid.slice(0, 8)}...`);
        } else {
          const errText = await patchRes.text();
          console.log('[purge-coolify-cache] App PATCH response:', errText);
        }
      } catch (e) {
        console.error('[purge-coolify-cache] App reset error:', e);
        errors.push(`Erreur reset app: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    // Method 2: Try server-level Docker prune (requires Coolify API support)
    try {
      // Get server UUID from Coolify
      const serversRes = await fetch(`${coolifyUrl}/api/v1/servers`, {
        method: 'GET',
        headers: coolifyHeaders
      });

      if (serversRes.ok) {
        const servers = await serversRes.json();
        if (servers && servers.length > 0) {
          const coolifyServerUuid = servers[0].uuid;
          
          // Try to trigger Docker prune via Coolify API
          // Note: This endpoint may not exist in all Coolify versions
          const pruneEndpoints = [
            `/api/v1/servers/${coolifyServerUuid}/actions/cleanup`,
            `/api/v1/servers/${coolifyServerUuid}/cleanup`,
            `/api/v1/servers/${coolifyServerUuid}/docker-cleanup`
          ];

          for (const endpoint of pruneEndpoints) {
            try {
              const pruneRes = await fetch(`${coolifyUrl}${endpoint}`, {
                method: 'POST',
                headers: coolifyHeaders,
                body: JSON.stringify({
                  prune_images: true,
                  prune_build_cache: true,
                  prune_volumes: false
                })
              });

              if (pruneRes.ok) {
                actions.push(`Docker prune via ${endpoint}`);
                break;
              }
            } catch {
              // Endpoint doesn't exist, try next
            }
          }

          if (actions.length === 0 || !actions.some(a => a.includes('prune'))) {
            actions.push('Aucun endpoint de prune disponible - utilisez la commande SSH manuelle');
          }
        }
      }
    } catch (e) {
      console.error('[purge-coolify-cache] Server prune error:', e);
    }

    // Method 3: Provide manual commands
    const manualCommands = [
      'docker system prune -af --volumes',
      'docker builder prune -af',
      'docker image prune -af'
    ];

    return new Response(
      JSON.stringify({
        success: true,
        actions_taken: actions,
        errors: errors,
        manual_commands: manualCommands,
        message: actions.length > 0 
          ? 'Cache Coolify purgé partiellement. Pour un nettoyage complet, exécutez les commandes SSH.'
          : 'Purge automatique non disponible. Exécutez les commandes SSH manuellement.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[purge-coolify-cache] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
