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

    const { server_id, project_name, github_repo_url, domain } = await req.json();

    if (!server_id || !project_name || !github_repo_url) {
      return new Response(
        JSON.stringify({ error: 'server_id, project_name, and github_repo_url are required' }),
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

    if (server.status !== 'ready') {
      return new Response(
        JSON.stringify({ error: 'Server is not ready for deployment' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!server.coolify_url || !server.coolify_token) {
      return new Response(
        JSON.stringify({ error: 'Server Coolify configuration is incomplete' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing deployments to determine deploy vs redeploy
    const { data: existingDeployments } = await supabase
      .from('server_deployments')
      .select('id')
      .eq('user_id', user.id)
      .eq('server_id', server_id)
      .in('status', ['deployed', 'success']);

    const creditType = (existingDeployments && existingDeployments.length > 0) ? 'redeploy' : 'deploy';
    console.log(`[deploy-coolify] Credit type needed: ${creditType}`);

    // Consume credit before proceeding
    const creditResponse = await fetch(`${supabaseUrl}/functions/v1/use-credit`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ credit_type: creditType })
    });

    if (!creditResponse.ok) {
      const creditError = await creditResponse.json();
      console.log('[deploy-coolify] Credit check failed:', creditError);
      return new Response(
        JSON.stringify({
          error: 'Crédit insuffisant',
          credit_type: creditType,
          details: creditError.message || `Un crédit "${creditType}" est requis`,
          redirect_to_pricing: true
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const creditData = await creditResponse.json();
    console.log(`[deploy-coolify] Credit consumed:`, creditData);

    // Create deployment record
    const { data: deployment, error: deployError } = await supabase
      .from('server_deployments')
      .insert({
        user_id: user.id,
        server_id: server.id,
        project_name,
        github_repo_url,
        domain: domain || null,
        status: 'deploying'
      })
      .select()
      .single();

    // Link the credit to this deployment
    if (!deployError && deployment && creditData.purchase_id) {
      await supabase
        .from('user_purchases')
        .update({ deployment_id: deployment.id })
        .eq('id', creditData.purchase_id);
    }

    if (deployError) {
      console.error('Deploy insert error:', deployError);
      return new Response(
        JSON.stringify({ error: 'Failed to create deployment record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Coolify API to create application
    const coolifyHeaders = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    try {
      // Step 0: Get available servers from Coolify
      console.log('Fetching Coolify servers...');
      const serversResponse = await fetch(`${server.coolify_url}/api/v1/servers`, {
        method: 'GET',
        headers: coolifyHeaders
      });

      if (!serversResponse.ok) {
        const errorText = await serversResponse.text();
        console.error('Failed to fetch Coolify servers:', errorText);
        throw new Error(`Failed to fetch Coolify servers: ${errorText}`);
      }

      const servers = await serversResponse.json();
      console.log('Available Coolify servers:', JSON.stringify(servers));

      if (!servers || servers.length === 0) {
        throw new Error('No servers found in Coolify. Please add a server in Coolify first.');
      }

      // Use the first available server (usually localhost)
      const coolifyServerUuid = servers[0].uuid;
      console.log('Using Coolify server UUID:', coolifyServerUuid);

      // Step 1: Create a project in Coolify
      console.log('Creating Coolify project...');
      const projectResponse = await fetch(`${server.coolify_url}/api/v1/projects`, {
        method: 'POST',
        headers: coolifyHeaders,
        body: JSON.stringify({
          name: project_name,
          description: `Deployed via Inopay`
        })
      });

      if (!projectResponse.ok) {
        const errorText = await projectResponse.text();
        console.error('Coolify project creation failed:', errorText);
        throw new Error(`Failed to create Coolify project: ${errorText}`);
      }

      const projectData = await projectResponse.json();
      console.log('Coolify project created:', projectData);

      // Step 2: Create application from GitHub
      console.log('Creating Coolify application...');
      const appPayload: Record<string, unknown> = {
        project_uuid: projectData.uuid,
        server_uuid: coolifyServerUuid, // Use real server UUID from Step 0
        environment_name: 'production',
        git_repository: github_repo_url,
        git_branch: 'main',
        build_pack: 'nixpacks',
        ports_exposes: '3000'
      };
      
      console.log('Application payload:', JSON.stringify(appPayload));
      
      const appResponse = await fetch(`${server.coolify_url}/api/v1/applications/public`, {
        method: 'POST',
        headers: coolifyHeaders,
        body: JSON.stringify(appPayload)
      });

      if (!appResponse.ok) {
        const errorText = await appResponse.text();
        console.error('Coolify app creation failed:', errorText);
        throw new Error(`Failed to create Coolify application: ${errorText}`);
      }

      const appData = await appResponse.json();
      console.log('Coolify application created:', appData);

      // Step 2.5: Update application with custom domain if provided
      if (domain) {
        console.log('Setting custom domain:', domain);
        const domainResponse = await fetch(`${server.coolify_url}/api/v1/applications/${appData.uuid}`, {
          method: 'PATCH',
          headers: coolifyHeaders,
          body: JSON.stringify({
            fqdn: `https://${domain}`
          })
        });
        
        if (!domainResponse.ok) {
          const errorText = await domainResponse.text();
          console.warn('Domain configuration failed (non-blocking):', errorText);
        } else {
          console.log('Custom domain configured');
        }
      }

      // Step 3: Trigger deployment
      console.log('Triggering deployment...');
      const deployResponse = await fetch(`${server.coolify_url}/api/v1/deploy?uuid=${appData.uuid}`, {
        method: 'GET',
        headers: coolifyHeaders
      });

      if (!deployResponse.ok) {
        const errorText = await deployResponse.text();
        console.error('Coolify deploy failed:', errorText);
        throw new Error(`Failed to trigger deployment: ${errorText}`);
      }

      const deployData = await deployResponse.json();
      console.log('Deployment triggered:', deployData);

      // Update deployment record
      const deployedUrl = domain 
        ? `https://${domain}` 
        : `http://${server.ip_address}:3000`;

      await supabase
        .from('server_deployments')
        .update({
          status: 'deployed',
          coolify_app_uuid: appData.uuid,
          deployed_url: deployedUrl
        })
        .eq('id', deployment.id);

      return new Response(
        JSON.stringify({
          success: true,
          deployment: {
            ...deployment,
            status: 'deployed',
            coolify_app_uuid: appData.uuid,
            deployed_url: deployedUrl
          },
          coolify: {
            project: projectData,
            application: appData
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (coolifyError: unknown) {
      console.error('Coolify API error:', coolifyError);
      const errorMessage = coolifyError instanceof Error ? coolifyError.message : 'Unknown error';
      
      // Update deployment as failed
      await supabase
        .from('server_deployments')
        .update({
          status: 'failed',
          error_message: errorMessage
        })
        .eq('id', deployment.id);

      return new Response(
        JSON.stringify({ 
          error: 'Coolify deployment failed', 
          details: errorMessage 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('Error in deploy-coolify:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
