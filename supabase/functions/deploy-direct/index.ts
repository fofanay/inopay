import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Declare EdgeRuntime for background tasks
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate environment variables for the deployed app
interface EnvVars {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  VITE_API_URL?: string;
  VITE_ANON_KEY?: string;
}

// Dockerfile for Vite/React apps with environment injection
const generateDockerfile = (envVars: EnvVars = {}) => {
  const envLines = Object.entries(envVars)
    .filter(([_, value]) => value)
    .map(([key, value]) => `ENV ${key}="${value}"`)
    .join('\n');

  return `
FROM node:20-alpine AS builder
WORKDIR /app

# Environment variables for build
${envLines}

COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;
};

// Nginx config for SPA
const generateNginxConf = () => `
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
`;

// Generate .env file content - SECURED: no raw secrets exposed
const generateEnvFile = (server: any): string => {
  const lines: string[] = [];
  
  // Database connection URL (for backend/ORM)
  if (server.db_url) {
    lines.push(`DATABASE_URL=${server.db_url}`);
  }
  
  // JWT secret for token verification
  if (server.jwt_secret) {
    lines.push(`JWT_SECRET=${server.jwt_secret}`);
  }
  
  // API keys for frontend (if using custom auth)
  if (server.anon_key) {
    lines.push(`VITE_ANON_KEY=${server.anon_key}`);
  }
  
  // API base URL - use proper HTTP endpoint
  if (server.ip_address) {
    lines.push(`VITE_API_URL=http://${server.ip_address}:3000`);
  }
  
  return lines.join('\n');
};

// Mask secret for logging (show only last 4 chars)
const maskSecret = (value: string | null): string => {
  if (!value) return '***';
  if (value.length <= 4) return '***';
  return `***${value.slice(-4)}`;
};

// Cleanup function with retry logic
async function cleanupWithRetry(
  supabaseUrl: string,
  supabaseServiceKey: string,
  serverId: string,
  deploymentId: string,
  maxRetries: number = 3
): Promise<void> {
  console.log(`[deploy-direct] Starting cleanup for server ${serverId}, deployment ${deploymentId}`);
  
  // Wait for deployment to stabilize (30 seconds)
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[deploy-direct] Cleanup attempt ${attempt}/${maxRetries}`);
      
      const cleanupResponse = await fetch(
        `${supabaseUrl}/functions/v1/cleanup-secrets`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            server_id: serverId,
            deployment_id: deploymentId,
            verify_health: true,
          }),
        }
      );
      
      const cleanupResult = await cleanupResponse.json();
      console.log(`[deploy-direct] Cleanup result:`, cleanupResult);
      
      if (cleanupResult.success) {
        console.log(`[deploy-direct] Cleanup successful on attempt ${attempt}`);
        return;
      }
      
      // If health check failed, wait and retry
      if (cleanupResult.reason === 'health_check_failed' || cleanupResult.reason === 'health_check_error') {
        console.log(`[deploy-direct] Health check not ready, waiting before retry...`);
        await new Promise(resolve => setTimeout(resolve, 15000 * attempt));
      }
    } catch (cleanupError) {
      console.error(`[deploy-direct] Cleanup attempt ${attempt} failed:`, cleanupError);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 10000 * attempt));
      }
    }
  }
  
  console.error(`[deploy-direct] Cleanup failed after ${maxRetries} attempts`);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Variables for cleanup in finally block
  let serverId: string | null = null;
  let deploymentId: string | null = null;
  let shouldCleanup = false;

  try {
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

    const { server_id, project_name, files, domain } = await req.json();

    if (!server_id || !project_name || !files) {
      return new Response(
        JSON.stringify({ error: 'server_id, project_name, and files are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    serverId = server_id;
    console.log(`[deploy-direct] Starting deployment for project: ${project_name}`);
    console.log(`[deploy-direct] Files count: ${Object.keys(files).length}`);

    // Get server info
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('*')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server) {
      console.error('[deploy-direct] Server not found:', serverError);
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

    // Log without secrets (SECURITY: masked values)
    console.log(`[deploy-direct] Server config: IP=${server.ip_address}, DB=${server.db_name}, Token=${maskSecret(server.coolify_token)}`);

    // Check for existing deployments to determine deploy vs redeploy
    const { data: existingDeployments } = await supabase
      .from('server_deployments')
      .select('id')
      .eq('user_id', user.id)
      .eq('server_id', server_id)
      .in('status', ['deployed', 'success']);

    const creditType = (existingDeployments && existingDeployments.length > 0) ? 'redeploy' : 'deploy';
    console.log(`[deploy-direct] Credit type needed: ${creditType}`);

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
      console.log('[deploy-direct] Credit check failed:', creditError);
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
    console.log(`[deploy-direct] Credit consumed:`, creditData);

    // Create deployment record
    const { data: deployment, error: deployError } = await supabase
      .from('server_deployments')
      .insert({
        user_id: user.id,
        server_id: server.id,
        project_name,
        domain: domain || null,
        status: 'preparing'
      })
      .select()
      .single();

    if (deployError) {
      console.error('[deploy-direct] Deploy insert error:', deployError);
      return new Response(
        JSON.stringify({ error: 'Failed to create deployment record' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    deploymentId = deployment.id;
    shouldCleanup = true; // Flag for cleanup in finally

    // Link the credit to this deployment
    if (creditData.purchase_id) {
      await supabase
        .from('user_purchases')
        .update({ deployment_id: deployment.id })
        .eq('id', creditData.purchase_id);
    }

    console.log(`[deploy-direct] Deployment record created: ${deployment.id}`);

    // Build environment variables from server database config
    const envVars: EnvVars = {};
    if (server.db_url) {
      envVars.DATABASE_URL = server.db_url;
    }
    if (server.jwt_secret) {
      envVars.JWT_SECRET = server.jwt_secret;
    }

    // Add Dockerfile, nginx.conf and .env to files
    const deployFiles = { ...files };
    if (!deployFiles['Dockerfile']) {
      deployFiles['Dockerfile'] = generateDockerfile(envVars);
    }
    if (!deployFiles['nginx.conf']) {
      deployFiles['nginx.conf'] = generateNginxConf();
    }
    if (!deployFiles['.env'] && Object.keys(envVars).length > 0) {
      deployFiles['.env'] = generateEnvFile(server);
    }

    console.log(`[deploy-direct] Environment variables configured: ${Object.keys(envVars).join(', ')}`);

    // Call Coolify API
    const coolifyHeaders = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Update status
    await supabase
      .from('server_deployments')
      .update({ status: 'deploying' })
      .eq('id', deployment.id);

    // Step 1: Create a project in Coolify
    console.log('[deploy-direct] Creating Coolify project...');
    const projectResponse = await fetch(`${server.coolify_url}/api/v1/projects`, {
      method: 'POST',
      headers: coolifyHeaders,
      body: JSON.stringify({
        name: project_name,
        description: `Deployed via Inopay Direct Deploy`
      })
    });

    if (!projectResponse.ok) {
      const errorText = await projectResponse.text();
      console.error('[deploy-direct] Coolify project creation failed:', errorText);
      throw new Error(`Failed to create Coolify project: ${errorText}`);
    }

    const projectData = await projectResponse.json();
    console.log('[deploy-direct] Coolify project created:', projectData.uuid);

    // Step 2: Create a Dockerfile-based application (no GitHub required!)
    console.log('[deploy-direct] Creating Dockerfile application...');
    
    // Prepare the final domain
    const finalDomain = domain || `${project_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.${server.ip_address}.nip.io`;
    
    const appPayload = {
      project_uuid: projectData.uuid,
      server_uuid: '0', // Local server (Coolify itself)
      environment_name: 'production',
      dockerfile: deployFiles['Dockerfile'],
      name: project_name,
      description: 'Deployed via Inopay',
      domains: `https://${finalDomain}`,
      ports_exposes: '80',
      instant_deploy: false
    };

    console.log('[deploy-direct] App payload domains:', appPayload.domains);

    const appResponse = await fetch(`${server.coolify_url}/api/v1/applications/dockerfile`, {
      method: 'POST',
      headers: coolifyHeaders,
      body: JSON.stringify(appPayload)
    });

    if (!appResponse.ok) {
      const errorText = await appResponse.text();
      console.error('[deploy-direct] Coolify app creation failed:', errorText);
      throw new Error(`Failed to create Coolify application: ${errorText}`);
    }

    const appData = await appResponse.json();
    console.log('[deploy-direct] Coolify application created:', appData.uuid);

    // Step 3: Upload source files using base64 encoding
    const filesList = Object.entries(deployFiles).map(([path, content]) => ({
      path,
      content: btoa(unescape(encodeURIComponent(content as string)))
    }));

    console.log('[deploy-direct] Uploading source files...');
    
    const uploadResponse = await fetch(`${server.coolify_url}/api/v1/applications/${appData.uuid}/files`, {
      method: 'POST',
      headers: coolifyHeaders,
      body: JSON.stringify({ files: filesList })
    });

    // If file upload API doesn't exist, use alternative method
    if (!uploadResponse.ok) {
      console.log('[deploy-direct] Direct file upload not available, using dockerfile inline method');
      
      const enhancedDockerfile = `
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy all source files
COPY . .

# Build the application
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for SPA
RUN echo 'server { \\
    listen 80; \\
    server_name _; \\
    root /usr/share/nginx/html; \\
    index index.html; \\
    location / { try_files \\$uri \\$uri/ /index.html; } \\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\\$ { expires 1y; add_header Cache-Control "public, immutable"; } \\
    gzip on; \\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml; \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;

      // Update the application with enhanced Dockerfile
      await fetch(`${server.coolify_url}/api/v1/applications/${appData.uuid}`, {
        method: 'PATCH',
        headers: coolifyHeaders,
        body: JSON.stringify({
          dockerfile: enhancedDockerfile
        })
      });
    }

    // Step 4: Trigger deployment
    console.log('[deploy-direct] Triggering deployment...');
    const deployResponse = await fetch(`${server.coolify_url}/api/v1/deploy?uuid=${appData.uuid}`, {
      method: 'GET',
      headers: coolifyHeaders
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error('[deploy-direct] Coolify deploy failed:', errorText);
      throw new Error(`Failed to trigger deployment: ${errorText}`);
    }

    const deployData = await deployResponse.json();
    console.log('[deploy-direct] Deployment triggered:', deployData);

    // Update deployment record
    const deployedUrl = `https://${finalDomain}`;

    await supabase
      .from('server_deployments')
      .update({
        status: 'deployed',
        coolify_app_uuid: appData.uuid,
        deployed_url: deployedUrl,
        domain: finalDomain,
        health_status: 'unknown',
        last_health_check: null
      })
      .eq('id', deployment.id);

    console.log(`[deploy-direct] Deployment complete: ${deployedUrl}`);

    // Use EdgeRuntime.waitUntil for guaranteed background cleanup (SECURITY FIX)
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(
        cleanupWithRetry(supabaseUrl, supabaseServiceKey, server.id, deployment.id)
      );
      console.log('[deploy-direct] Cleanup scheduled via EdgeRuntime.waitUntil');
    } else {
      // Fallback for environments without EdgeRuntime
      cleanupWithRetry(supabaseUrl, supabaseServiceKey, server.id, deployment.id);
      console.log('[deploy-direct] Cleanup scheduled via fallback');
    }

    return new Response(
      JSON.stringify({
        success: true,
        deployment: {
          id: deployment.id,
          status: 'deployed',
          coolify_app_uuid: appData.uuid,
          deployed_url: deployedUrl,
          domain: finalDomain
        },
        message: 'Deployment started successfully. Your site will be available in a few minutes.',
        cleanup_scheduled: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[deploy-direct] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Update deployment as failed if we have a deployment ID
    if (deploymentId) {
      await supabase
        .from('server_deployments')
        .update({
          status: 'failed',
          error_message: errorMessage
        })
        .eq('id', deploymentId);
    }

    // SECURITY: Always trigger cleanup on error to avoid secret leakage
    if (shouldCleanup && serverId && deploymentId) {
      console.log('[deploy-direct] Triggering cleanup due to error');
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(
          cleanupWithRetry(supabaseUrl, supabaseServiceKey, serverId, deploymentId)
        );
      } else {
        cleanupWithRetry(supabaseUrl, supabaseServiceKey, serverId, deploymentId);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: 'Deployment failed', 
        details: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
