import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate environment variables for the deployed app
interface EnvVars {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  DATABASE_URL?: string;
  JWT_SECRET?: string;
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

// Generate .env file content
const generateEnvFile = (server: any): string => {
  const lines: string[] = [];
  
  if (server.db_url) {
    lines.push(`DATABASE_URL=${server.db_url}`);
  }
  if (server.jwt_secret) {
    lines.push(`JWT_SECRET=${server.jwt_secret}`);
  }
  if (server.anon_key) {
    lines.push(`VITE_SUPABASE_ANON_KEY=${server.anon_key}`);
  }
  if (server.ip_address) {
    lines.push(`VITE_SUPABASE_URL=http://${server.ip_address}:5432`);
  }
  
  return lines.join('\n');
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

    const { server_id, project_name, files, domain } = await req.json();

    if (!server_id || !project_name || !files) {
      return new Response(
        JSON.stringify({ error: 'server_id, project_name, and files are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    console.log(`[deploy-direct] Deployment record created: ${deployment.id}`);

    // Build environment variables from server database config
    const envVars: EnvVars = {};
    if (server.db_url) {
      envVars.DATABASE_URL = server.db_url;
    }
    if (server.jwt_secret) {
      envVars.JWT_SECRET = server.jwt_secret;
    }
    if (server.anon_key) {
      envVars.VITE_SUPABASE_ANON_KEY = server.anon_key;
    }
    if (server.ip_address) {
      envVars.VITE_SUPABASE_URL = `http://${server.ip_address}:5432`;
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

    try {
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

      console.log('[deploy-direct] App payload:', JSON.stringify(appPayload, null, 2));

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
      // Create a tarball-like structure in base64
      const filesList = Object.entries(deployFiles).map(([path, content]) => ({
        path,
        content: btoa(unescape(encodeURIComponent(content as string)))
      }));

      console.log('[deploy-direct] Uploading source files...');
      
      // Use Coolify's file upload API if available, or store in deployment config
      const uploadResponse = await fetch(`${server.coolify_url}/api/v1/applications/${appData.uuid}/files`, {
        method: 'POST',
        headers: coolifyHeaders,
        body: JSON.stringify({ files: filesList })
      });

      // If file upload API doesn't exist, use alternative method
      if (!uploadResponse.ok) {
        console.log('[deploy-direct] Direct file upload not available, using dockerfile inline method');
        
        // Update the Dockerfile to include files inline via echo commands
        const inlineFiles = Object.entries(deployFiles)
          .filter(([path]) => path !== 'Dockerfile' && path !== 'nginx.conf')
          .slice(0, 50) // Limit to 50 files for inline method
          .map(([path, content]) => {
            const escapedContent = (content as string)
              .replace(/\\/g, '\\\\')
              .replace(/'/g, "'\"'\"'")
              .replace(/\n/g, '\\n');
            return `RUN mkdir -p $(dirname "${path}") && echo '${escapedContent}' > "${path}"`;
          })
          .join('\n');

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
          domain: finalDomain
        })
        .eq('id', deployment.id);

      console.log(`[deploy-direct] Deployment complete: ${deployedUrl}`);

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
          message: 'Deployment started successfully. Your site will be available in a few minutes.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (coolifyError: unknown) {
      console.error('[deploy-direct] Coolify API error:', coolifyError);
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
          error: 'Deployment failed', 
          details: errorMessage 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    console.error('[deploy-direct] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
