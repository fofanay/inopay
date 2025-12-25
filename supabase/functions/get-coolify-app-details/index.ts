import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CoolifyApp {
  uuid: string;
  name: string;
  fqdn: string | null;
  git_repository: string | null;
  git_branch: string | null;
  git_commit_sha: string | null;
  build_pack: string | null;
  status: string | null;
  description: string | null;
  base_directory: string | null;
  dockerfile_location: string | null;
  ports_exposes: string | null;
  is_static: boolean | null;
  updated_at: string | null;
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
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin access or allow user to see their own server apps
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const isAdmin = userRole?.role === 'admin';

    const { server_id, app_uuid } = await req.json();

    if (!server_id) {
      return new Response(JSON.stringify({ error: 'server_id requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get server with Coolify credentials - admin can access any, user only their own
    const serverQuery = supabase
      .from('user_servers')
      .select('coolify_url, coolify_token, user_id')
      .eq('id', server_id);
    
    if (!isAdmin) {
      serverQuery.eq('user_id', user.id);
    }
    
    const { data: server, error: serverError } = await serverQuery.single();

    if (serverError || !server) {
      return new Response(JSON.stringify({ error: 'Serveur non trouvé' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!server.coolify_url || !server.coolify_token) {
      return new Response(JSON.stringify({ error: 'Credentials Coolify non configurés' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const headers = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // If app_uuid is provided, get specific app details with full configuration
    if (app_uuid) {
      console.log(`[Coolify] Fetching details for app ${app_uuid}`);
      const appResponse = await fetch(`${server.coolify_url}/api/v1/applications/${app_uuid}`, { headers });
      
      if (!appResponse.ok) {
        const errText = await appResponse.text();
        console.error(`[Coolify] Failed to fetch app: ${errText}`);
        return new Response(JSON.stringify({ error: `Application non trouvée: ${appResponse.status}`, details: errText }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const app = await appResponse.json();
      console.log(`[Coolify] App details:`, JSON.stringify({
        uuid: app.uuid,
        name: app.name,
        build_pack: app.build_pack,
        base_directory: app.base_directory,
        dockerfile_location: app.dockerfile_location,
        git_repository: app.git_repository ? '***configured***' : null,
        git_branch: app.git_branch,
        git_commit_sha: app.git_commit_sha
      }));
      
      const appDetails: CoolifyApp = {
        uuid: app.uuid,
        name: app.name,
        fqdn: app.fqdn,
        git_repository: app.git_repository,
        git_branch: app.git_branch,
        git_commit_sha: app.git_commit_sha || null,
        build_pack: app.build_pack,
        status: app.status,
        description: app.description,
        base_directory: app.base_directory || '/',
        dockerfile_location: app.dockerfile_location || '/Dockerfile',
        ports_exposes: app.ports_exposes,
        is_static: app.is_static || false,
        updated_at: app.updated_at,
      };
      
      // Also get recent deployments for this app
      let deployments: unknown[] = [];
      try {
        const deploymentsRes = await fetch(`${server.coolify_url}/api/v1/applications/${app_uuid}/deployments`, { headers });
        if (deploymentsRes.ok) {
          deployments = await deploymentsRes.json();
        }
      } catch (e) {
        console.warn('[Coolify] Could not fetch deployments:', e);
      }
      
      return new Response(JSON.stringify({ 
        app: appDetails,
        deployments: Array.isArray(deployments) ? deployments.slice(0, 5) : [],
        diagnostics: {
          build_pack_ok: app.build_pack === 'dockerfile',
          base_directory_ok: !app.base_directory || app.base_directory === '/' || app.base_directory === './',
          dockerfile_location_ok: !app.dockerfile_location || app.dockerfile_location === '/Dockerfile' || app.dockerfile_location === 'Dockerfile',
          git_configured: !!app.git_repository
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List all applications
    console.log(`[Coolify] Fetching all applications from ${server.coolify_url}`);
    const appsResponse = await fetch(`${server.coolify_url}/api/v1/applications`, { headers });

    if (!appsResponse.ok) {
      const status = appsResponse.status;
      if (status === 401) {
        return new Response(JSON.stringify({ error: 'Token Coolify invalide ou expiré' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: `Erreur Coolify: HTTP ${status}` }), {
        status: status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apps = await appsResponse.json();
    console.log(`[Coolify] Found ${apps.length} applications`);
    
    const appsList: CoolifyApp[] = apps.map((app: Record<string, unknown>) => ({
      uuid: app.uuid as string,
      name: app.name as string,
      fqdn: app.fqdn as string | null,
      git_repository: app.git_repository as string | null,
      git_branch: app.git_branch as string | null,
      build_pack: app.build_pack as string | null,
      status: app.status as string | null,
      description: app.description as string | null,
      base_directory: (app.base_directory as string) || '/',
      dockerfile_location: (app.dockerfile_location as string) || '/Dockerfile',
      ports_exposes: app.ports_exposes as string | null,
      is_static: app.is_static as boolean | null,
      updated_at: app.updated_at as string | null,
    }));

    // Find apps that might be related to inopay
    const inopayApps = appsList.filter(app => 
      app.name?.toLowerCase().includes('inopay') ||
      app.name?.toLowerCase().includes('getinopay') ||
      app.git_repository?.toLowerCase().includes('inopay')
    );

    return new Response(JSON.stringify({ 
      apps: appsList,
      inopay_apps: inopayApps,
      total: appsList.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[get-coolify-app-details] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
