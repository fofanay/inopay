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

    const { server_id, delete_failed_deployments = false } = await req.json();

    if (!server_id) {
      return new Response(
        JSON.stringify({ error: 'server_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        JSON.stringify({ error: 'Server Coolify configuration is incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const coolifyHeaders = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    console.log('[cleanup-coolify-orphans] Starting cleanup for server:', server_id);

    // Get all deployed project names from our database
    const { data: deployments } = await supabase
      .from('server_deployments')
      .select('project_name, coolify_app_uuid, status')
      .eq('server_id', server_id)
      .eq('user_id', user.id);

    const activeProjectNames = new Set(
      (deployments || [])
        .filter(d => d.status === 'deployed' || d.status === 'success')
        .map(d => d.project_name)
    );

    console.log('[cleanup-coolify-orphans] Active project names:', Array.from(activeProjectNames));

    // Get all Coolify projects
    const projectsResponse = await fetch(`${server.coolify_url}/api/v1/projects`, {
      method: 'GET',
      headers: coolifyHeaders
    });

    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text();
      throw new Error(`Failed to fetch Coolify projects: ${errorText}`);
    }

    const coolifyProjects = await projectsResponse.json();
    console.log('[cleanup-coolify-orphans] Coolify projects found:', coolifyProjects.length);

    // Find orphan projects (in Coolify but not in active deployments)
    const orphanProjects = coolifyProjects.filter(
      (p: { name: string; uuid: string }) => !activeProjectNames.has(p.name)
    );

    console.log('[cleanup-coolify-orphans] Orphan projects to delete:', orphanProjects.length);

    const deletedProjects: string[] = [];
    const failedDeletions: { name: string; error: string }[] = [];

    // Delete orphan projects from Coolify
    for (const project of orphanProjects) {
      try {
        console.log(`[cleanup-coolify-orphans] Deleting orphan project: ${project.name} (${project.uuid})`);
        const deleteResponse = await fetch(`${server.coolify_url}/api/v1/projects/${project.uuid}`, {
          method: 'DELETE',
          headers: coolifyHeaders
        });

        if (deleteResponse.ok) {
          deletedProjects.push(project.name);
          console.log(`[cleanup-coolify-orphans] Successfully deleted: ${project.name}`);
        } else {
          const errorText = await deleteResponse.text();
          failedDeletions.push({ name: project.name, error: errorText });
          console.error(`[cleanup-coolify-orphans] Failed to delete ${project.name}:`, errorText);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        failedDeletions.push({ name: project.name, error: errorMessage });
        console.error(`[cleanup-coolify-orphans] Error deleting ${project.name}:`, err);
      }
    }

    // Optionally delete failed deployment records from database
    let deletedDeploymentRecords = 0;
    if (delete_failed_deployments) {
      // First count, then delete
      const { data: failedDeployments } = await supabase
        .from('server_deployments')
        .select('id')
        .eq('server_id', server_id)
        .eq('user_id', user.id)
        .eq('status', 'failed');

      const failedCount = failedDeployments?.length || 0;

      if (failedCount > 0) {
        const { error: deleteError } = await supabase
          .from('server_deployments')
          .delete()
          .eq('server_id', server_id)
          .eq('user_id', user.id)
          .eq('status', 'failed');

        if (!deleteError) {
          deletedDeploymentRecords = failedCount;
          console.log(`[cleanup-coolify-orphans] Deleted ${deletedDeploymentRecords} failed deployment records`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          coolify_projects_checked: coolifyProjects.length,
          orphan_projects_found: orphanProjects.length,
          projects_deleted: deletedProjects.length,
          failed_deletions: failedDeletions.length,
          failed_deployment_records_deleted: deletedDeploymentRecords
        },
        deleted_projects: deletedProjects,
        failed_deletions: failedDeletions
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[cleanup-coolify-orphans] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
