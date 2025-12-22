import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
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

    const { server_id } = await req.json();

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: 'server_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify server belongs to user
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('id, coolify_url, coolify_token')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server) {
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all deployments for this server
    const { data: deployments, error: deploymentsError } = await supabase
      .from('server_deployments')
      .select('id, coolify_app_uuid, project_name, status')
      .eq('server_id', server_id)
      .eq('user_id', user.id);

    if (deploymentsError) {
      console.error('[purge-deployments] Error fetching deployments:', deploymentsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch deployments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[purge-deployments] Found ${deployments?.length || 0} deployments to purge`);

    // Also delete from Coolify if we have credentials
    let coolifyDeleted = 0;
    if (server.coolify_url && server.coolify_token && deployments) {
      const coolifyHeaders = {
        'Authorization': `Bearer ${server.coolify_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      for (const dep of deployments) {
        if (dep.coolify_app_uuid) {
          try {
            console.log(`[purge-deployments] Deleting Coolify app: ${dep.coolify_app_uuid}`);
            const deleteResponse = await fetch(
              `${server.coolify_url}/api/v1/applications/${dep.coolify_app_uuid}`,
              { method: 'DELETE', headers: coolifyHeaders }
            );
            if (deleteResponse.ok) {
              coolifyDeleted++;
              console.log(`[purge-deployments] Deleted Coolify app: ${dep.coolify_app_uuid}`);
            } else {
              console.log(`[purge-deployments] Failed to delete app: ${await deleteResponse.text()}`);
            }
          } catch (e) {
            console.error(`[purge-deployments] Error deleting Coolify app:`, e);
          }
        }
      }

      // Also clean up all projects in Coolify
      try {
        console.log('[purge-deployments] Fetching Coolify projects for cleanup...');
        const projectsResponse = await fetch(`${server.coolify_url}/api/v1/projects`, {
          method: 'GET',
          headers: coolifyHeaders
        });
        
        if (projectsResponse.ok) {
          const projects = await projectsResponse.json();
          for (const project of projects) {
            try {
              console.log(`[purge-deployments] Deleting Coolify project: ${project.name}`);
              await fetch(`${server.coolify_url}/api/v1/projects/${project.uuid}`, {
                method: 'DELETE',
                headers: coolifyHeaders
              });
            } catch (e) {
              console.error(`[purge-deployments] Error deleting project:`, e);
            }
          }
        }
      } catch (e) {
        console.error('[purge-deployments] Error cleaning projects:', e);
      }
    }

    // Delete all deployments from database
    const { error: deleteError, count } = await supabase
      .from('server_deployments')
      .delete()
      .eq('server_id', server_id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('[purge-deployments] Error deleting deployments:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete deployments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[purge-deployments] Purged ${deployments?.length || 0} deployments, ${coolifyDeleted} from Coolify`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deployments?.length || 0,
        coolify_deleted: coolifyDeleted,
        message: `Purged ${deployments?.length || 0} deployments`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[purge-deployments] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
