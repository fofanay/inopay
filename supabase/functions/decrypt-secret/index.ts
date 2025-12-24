// @inopay-core-protected
// INOPAY SECURITY CORE - Secret Decryption Function
// This file MUST NOT be cleaned or removed during self-liberation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * INTERNAL FUNCTION - Only called by other edge functions (service role)
 * Decrypts stored secrets for use during deployment/sync operations
 */

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

async function decryptToken(encryptedBase64: string, masterSecret: string): Promise<string> {
  const combined = new Uint8Array(
    atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
  );

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 16 + IV_LENGTH);
  const ciphertext = combined.slice(16 + IV_LENGTH);

  const key = await deriveKey(masterSecret, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

function isEncrypted(value: string): boolean {
  if (!value || value.length < 50) return false;
  try {
    const decoded = atob(value);
    return decoded.length >= 44;
  } catch {
    return false;
  }
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
    // Only allow service role calls (internal edge function calls)
    const authHeader = req.headers.get('Authorization');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!authHeader || !authHeader.includes(supabaseServiceKey)) {
      // Also check if it's a valid user token for admin access
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const token = authHeader?.replace('Bearer ', '') || '';
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (error || !user) {
        console.error('[decrypt-secret] Unauthorized access attempt');
        return new Response(
          JSON.stringify({ error: 'Service role or valid user token required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const { secret_type, user_id, server_id } = await req.json();

    if (!secret_type) {
      return new Response(
        JSON.stringify({ error: 'secret_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const masterKey = getMasterKey();

    let decryptedValue: string | null = null;

    if (secret_type === 'github_token' && user_id) {
      const { data: settings, error } = await supabase
        .from('user_settings')
        .select('github_token')
        .eq('user_id', user_id)
        .single();

      if (error || !settings?.github_token) {
        return new Response(
          JSON.stringify({ error: 'GitHub token not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if encrypted, decrypt if so
      if (isEncrypted(settings.github_token)) {
        decryptedValue = await decryptToken(settings.github_token, masterKey);
      } else {
        // Legacy unencrypted token
        decryptedValue = settings.github_token;
      }
    }
    else if (secret_type === 'coolify_token' && server_id) {
      const { data: server, error } = await supabase
        .from('user_servers')
        .select('coolify_token, user_id')
        .eq('id', server_id)
        .single();

      if (error || !server?.coolify_token) {
        return new Response(
          JSON.stringify({ error: 'Coolify token not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if encrypted, decrypt if so
      if (isEncrypted(server.coolify_token)) {
        decryptedValue = await decryptToken(server.coolify_token, masterKey);
      } else {
        // Legacy unencrypted token
        decryptedValue = server.coolify_token;
      }

      // Log decryption for audit (without the actual value)
      await supabase.from('security_audit_logs').insert({
        user_id: server.user_id,
        action: 'secret_decrypted',
        server_id: server_id,
        details: {
          secret_type,
          timestamp: new Date().toISOString(),
          caller: 'edge_function',
        }
      });
    }
    else {
      return new Response(
        JSON.stringify({ error: 'Invalid secret_type or missing required IDs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        value: decryptedValue,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[decrypt-secret] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Decryption failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
