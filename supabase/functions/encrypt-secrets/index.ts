import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

async function deriveKey(masterSecret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterSecret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptToken(plaintext: string, masterSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(masterSecret, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv },
    key,
    data
  );

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
  if (!serviceRoleKey) {
    throw new Error('No encryption key available');
  }
  return serviceRoleKey.substring(0, 64);
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
        JSON.stringify({ error: 'Authorization required' }),
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

    const { action, secret_type, secret_value, target_id } = await req.json();

    if (action !== 'encrypt') {
      return new Response(
        JSON.stringify({ error: 'Invalid action. Use "encrypt"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!secret_type || !secret_value) {
      return new Response(
        JSON.stringify({ error: 'secret_type and secret_value are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const masterKey = getMasterKey();
    const encryptedValue = await encryptToken(secret_value, masterKey);

    // Store encrypted value based on secret type
    if (secret_type === 'github_token') {
      const { error: updateError } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          github_token: encryptedValue,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (updateError) throw updateError;

      console.log('[encrypt-secrets] GitHub token encrypted and stored for user:', user.id);
    } 
    else if (secret_type === 'coolify_token' && target_id) {
      // Verify server ownership
      const { data: server, error: serverError } = await supabase
        .from('user_servers')
        .select('id')
        .eq('id', target_id)
        .eq('user_id', user.id)
        .single();

      if (serverError || !server) {
        return new Response(
          JSON.stringify({ error: 'Server not found or access denied' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabase
        .from('user_servers')
        .update({
          coolify_token: encryptedValue,
          updated_at: new Date().toISOString(),
        })
        .eq('id', target_id);

      if (updateError) throw updateError;

      console.log('[encrypt-secrets] Coolify token encrypted and stored for server:', target_id);
    }
    else {
      return new Response(
        JSON.stringify({ error: 'Invalid secret_type or missing target_id for coolify_token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log security audit
    await supabase.from('security_audit_logs').insert({
      user_id: user.id,
      action: 'secret_encrypted',
      server_id: secret_type === 'coolify_token' ? target_id : null,
      details: {
        secret_type,
        encrypted_length: encryptedValue.length,
        timestamp: new Date().toISOString(),
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${secret_type} encrypted and stored securely`,
        encrypted_length: encryptedValue.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[encrypt-secrets] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Encryption failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
