import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SECURITY: Mask secrets for logging (show only last 4 chars)
const maskSecret = (value: string | null): string => {
  if (!value) return '[empty]';
  if (value.length <= 4) return '***';
  return `***${value.slice(-4)}`;
};

// === AES-256-GCM Encryption for secrets at rest ===
const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

async function deriveKey(masterSecret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(masterSecret), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: ALGORITHM, length: KEY_LENGTH }, false, ['encrypt']
  );
}

async function encryptToken(plaintext: string, masterSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(masterSecret, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data);
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

function getMasterKey(): string {
  const dedicatedKey = Deno.env.get('ENCRYPTION_MASTER_KEY');
  if (dedicatedKey) return dedicatedKey;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) throw new Error('No encryption key available');
  return serviceRoleKey.substring(0, 64);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    console.log('[setup-callback] Raw body received, length:', bodyText.length);
    
    let parsedBody;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('[setup-callback] JSON parse error:', parseError);
      console.error('[setup-callback] Body preview:', bodyText.substring(0, 500));
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { 
      setup_id, 
      server_ip, 
      coolify_port, 
      coolify_token, 
      status,
      // DB credentials from bash script
      db_host,
      db_port,
      db_name,
      db_user,
      db_password
    } = parsedBody;

    // Detailed logging for debugging
    console.log('[setup-callback] Parsed body:', {
      setup_id,
      server_ip,
      coolify_port,
      has_coolify_token: !!coolify_token,
      coolify_token_length: coolify_token?.length || 0,
      status,
      db_host,
      db_port,
      db_name,
      db_user,
      has_db_password: !!db_password,
      db_password_length: db_password?.length || 0
    });

    if (!setup_id) {
      console.error('[setup-callback] Missing setup_id');
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
      console.error('[setup-callback] Server not found for setup_id:', setup_id);
      return new Response(
        JSON.stringify({ error: 'Server not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build coolify URL
    const coolifyUrl = `http://${server_ip || server.ip_address}:${coolify_port || 8000}`;

    // Build database URL if credentials provided
    const dbHost = db_host || server_ip || server.ip_address;
    const dbPort = db_port || 5432;
    const dbUrl = db_password 
      ? `postgresql://${db_user}:${db_password}@${dbHost}:${dbPort}/${db_name}`
      : null;

    // Update server with installation status AND database credentials
    const updateData: Record<string, unknown> = {
      status: status === 'ready' ? 'ready' : 'error',
      coolify_url: coolifyUrl,
      updated_at: new Date().toISOString(),
      // SECURITY: Clear setup_id immediately after successful callback
      setup_id: null
    };

    // SECURITY: Encrypt sensitive credentials before storing
    const masterKey = getMasterKey();

    // Save Coolify token if provided (encrypted)
    if (coolify_token) {
      try {
        updateData.coolify_token = await encryptToken(coolify_token, masterKey);
        console.log('[setup-callback] Coolify token encrypted before storage');
      } catch (e) {
        console.error('[setup-callback] Failed to encrypt coolify_token, storing as-is:', e);
        updateData.coolify_token = coolify_token;
      }
    }

    // Save all database credentials if provided
    if (db_host || server_ip) {
      updateData.db_host = dbHost;
    }
    if (db_port) {
      updateData.db_port = dbPort;
    }
    if (db_name) {
      updateData.db_name = db_name;
    }
    if (db_user) {
      updateData.db_user = db_user;
    }
    if (db_password) {
      try {
        updateData.db_password = await encryptToken(db_password, masterKey);
        // Also encrypt the full db_url
        if (dbUrl) {
          updateData.db_url = await encryptToken(dbUrl, masterKey);
        }
        console.log('[setup-callback] Database password encrypted before storage');
      } catch (e) {
        console.error('[setup-callback] Failed to encrypt db_password, storing as-is:', e);
        updateData.db_password = db_password;
        updateData.db_url = dbUrl;
      }
      updateData.db_status = 'ready';
    }

    if (status === 'error') {
      updateData.error_message = 'Installation failed';
    }

    // SECURITY: Log without exposing secrets
    console.log(`[setup-callback] Updating server ${server.id}:`, {
      status: updateData.status,
      coolify_url: coolifyUrl,
      db_host: updateData.db_host,
      db_port: updateData.db_port,
      db_name: updateData.db_name,
      db_status: updateData.db_status,
      has_password: !!db_password,
      password_masked: maskSecret(db_password || null),
      token_masked: maskSecret(coolify_token || null),
      setup_id_cleared: true
    });

    const { error: updateError } = await supabase
      .from('user_servers')
      .update(updateData)
      .eq('id', server.id);

    if (updateError) {
      console.error('[setup-callback] Update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update server status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create security audit log (SECURITY: no secrets in audit)
    await supabase
      .from('security_audit_logs')
      .insert({
        user_id: server.user_id,
        server_id: server.id,
        action: 'server_setup_complete',
        details: {
          ip_address: server_ip || server.ip_address,
          coolify_configured: !!coolifyUrl,
          database_configured: !!db_password,
          setup_id_cleared: true,
          timestamp: new Date().toISOString()
        }
      });

    console.log(`[setup-callback] Server ${server.id} updated successfully, setup_id cleared`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Server configuration updated',
        coolify_url: coolifyUrl,
        setup_id_cleared: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[setup-callback] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
