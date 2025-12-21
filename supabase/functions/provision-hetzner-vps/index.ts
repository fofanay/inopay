import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HetznerServerType {
  id: number;
  name: string;
  description: string;
  cores: number;
  memory: number;
  disk: number;
  prices: Array<{
    location: string;
    price_monthly: { gross: string };
  }>;
}

interface HetznerLocation {
  id: number;
  name: string;
  description: string;
  country: string;
  city: string;
}

interface ProvisionRequest {
  hetzner_api_token: string;
  server_name: string;
  server_type?: string; // e.g., "cx22", "cpx11"
  location?: string; // e.g., "fsn1", "nbg1", "hel1"
  image?: string; // e.g., "ubuntu-22.04"
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ProvisionRequest = await req.json();
    const { 
      hetzner_api_token, 
      server_name, 
      server_type = 'cx22',
      location = 'fsn1',
      image = 'ubuntu-22.04'
    } = body;

    if (!hetzner_api_token || !server_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: hetzner_api_token, server_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[provision-hetzner] User ${user.id} requesting VPS: ${server_name}`);

    // Validate Hetzner API token by fetching server types
    const validateResponse = await fetch('https://api.hetzner.cloud/v1/server_types', {
      headers: {
        'Authorization': `Bearer ${hetzner_api_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!validateResponse.ok) {
      const errorData = await validateResponse.json().catch(() => ({}));
      console.error('Hetzner API validation failed:', errorData);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid Hetzner API token',
          details: errorData.error?.message || 'Token validation failed'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate SSH key for the server (optional, user can use password)
    const rootPassword = generateSecurePassword();

    // Create the server via Hetzner API
    console.log(`[provision-hetzner] Creating server with type: ${server_type}, location: ${location}`);
    
    const createServerResponse = await fetch('https://api.hetzner.cloud/v1/servers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hetzner_api_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: server_name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        server_type: server_type,
        location: location,
        image: image,
        start_after_create: true,
        automount: false,
        labels: {
          managed_by: 'inopay',
          user_id: user.id,
        },
        user_data: generateCloudInit(rootPassword),
      }),
    });

    const serverData = await createServerResponse.json();

    if (!createServerResponse.ok) {
      console.error('Hetzner server creation failed:', serverData);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create server',
          details: serverData.error?.message || 'Server creation failed',
          code: serverData.error?.code
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const server = serverData.server;
    const ipAddress = server.public_net?.ipv4?.ip || 'pending';

    console.log(`[provision-hetzner] Server created: ID ${server.id}, IP: ${ipAddress}`);

    // Generate setup ID for callback
    const setupId = crypto.randomUUID();

    // Store server in database
    const { data: dbServer, error: dbError } = await supabase
      .from('user_servers')
      .insert({
        user_id: user.id,
        name: server_name,
        ip_address: ipAddress,
        provider: 'hetzner',
        status: 'provisioning',
        setup_id: setupId,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Try to delete the Hetzner server since we couldn't save it
      await fetch(`https://api.hetzner.cloud/v1/servers/${server.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${hetzner_api_token}`,
        },
      });
      
      return new Response(
        JSON.stringify({ error: 'Failed to save server configuration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate installation command
    const supabasePublicUrl = Deno.env.get('SUPABASE_URL')!;
    const installCommand = `curl -fsSL "${supabasePublicUrl}/functions/v1/serve-setup-script?setup_id=${setupId}" | bash`;

    return new Response(
      JSON.stringify({
        success: true,
        server: {
          id: dbServer.id,
          name: server_name,
          ip_address: ipAddress,
          provider: 'hetzner',
          status: 'provisioning',
          hetzner_id: server.id,
        },
        credentials: {
          root_password: rootPassword,
          ssh_command: `ssh root@${ipAddress}`,
        },
        installCommand,
        setupId,
        message: 'Server is being provisioned. It will be ready in 1-2 minutes.',
        next_steps: [
          'Wait 1-2 minutes for the server to boot',
          `Connect via SSH: ssh root@${ipAddress}`,
          'Run the installation command to setup Coolify',
        ],
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    console.error('[provision-hetzner] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Generate a secure random password
function generateSecurePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
  const length = 24;
  let password = '';
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length];
  }
  return password;
}

// Generate cloud-init script to set root password and prepare for Coolify
function generateCloudInit(rootPassword: string): string {
  return `#cloud-config
users:
  - name: root
    lock_passwd: false
    
chpasswd:
  list: |
    root:${rootPassword}
  expire: false

ssh_pwauth: true

package_update: true
package_upgrade: true

packages:
  - curl
  - wget
  - git
  - htop
  - ufw

runcmd:
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw allow 8000/tcp
  - ufw --force enable
  - echo "Server ready for Coolify installation" > /root/inopay-ready.txt
`;
}
