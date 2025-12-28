import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Crypto utilities (inlined for self-contained function)
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
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Verify caller is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const masterKey = getMasterKey();
    
    // Fetch all user_servers with sensitive secrets
    const { data: servers, error: fetchError } = await supabase
      .from('user_servers')
      .select('id, service_role_key, anon_key, coolify_token, jwt_secret, db_password');

    if (fetchError) {
      throw new Error(`Failed to fetch servers: ${fetchError.message}`);
    }

    const results = {
      total: servers?.length || 0,
      migrated: 0,
      alreadyEncrypted: 0,
      errors: [] as string[],
      details: [] as { serverId: string; fields: string[] }[]
    };

    for (const server of servers || []) {
      const fieldsEncrypted: string[] = [];
      const updates: Record<string, string> = {};

      // Encrypt service_role_key if not already encrypted
      if (server.service_role_key && !isEncrypted(server.service_role_key)) {
        try {
          updates.service_role_key = await encryptToken(server.service_role_key, masterKey);
          fieldsEncrypted.push('service_role_key');
        } catch (e) {
          results.errors.push(`Server ${server.id}: Failed to encrypt service_role_key - ${e}`);
        }
      }

      // Encrypt coolify_token if not already encrypted
      if (server.coolify_token && !isEncrypted(server.coolify_token)) {
        try {
          updates.coolify_token = await encryptToken(server.coolify_token, masterKey);
          fieldsEncrypted.push('coolify_token');
        } catch (e) {
          results.errors.push(`Server ${server.id}: Failed to encrypt coolify_token - ${e}`);
        }
      }

      // Encrypt anon_key if not already encrypted
      if (server.anon_key && !isEncrypted(server.anon_key)) {
        try {
          updates.anon_key = await encryptToken(server.anon_key, masterKey);
          fieldsEncrypted.push('anon_key');
        } catch (e) {
          results.errors.push(`Server ${server.id}: Failed to encrypt anon_key - ${e}`);
        }
      }

      // Encrypt jwt_secret if not already encrypted
      if (server.jwt_secret && !isEncrypted(server.jwt_secret)) {
        try {
          updates.jwt_secret = await encryptToken(server.jwt_secret, masterKey);
          fieldsEncrypted.push('jwt_secret');
        } catch (e) {
          results.errors.push(`Server ${server.id}: Failed to encrypt jwt_secret - ${e}`);
        }
      }

      // Encrypt db_password if not already encrypted
      if (server.db_password && !isEncrypted(server.db_password)) {
        try {
          updates.db_password = await encryptToken(server.db_password, masterKey);
          fieldsEncrypted.push('db_password');
        } catch (e) {
          results.errors.push(`Server ${server.id}: Failed to encrypt db_password - ${e}`);
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('user_servers')
          .update(updates)
          .eq('id', server.id);

        if (updateError) {
          results.errors.push(`Server ${server.id}: Update failed - ${updateError.message}`);
        } else {
          results.migrated++;
          results.details.push({ serverId: server.id, fields: fieldsEncrypted });
        }
      } else {
        results.alreadyEncrypted++;
      }
    }

    // Log security audit
    await supabase.from('security_audit_logs').insert({
      user_id: user.id,
      action: 'SECRETS_MIGRATION',
      details: {
        total: results.total,
        migrated: results.migrated,
        alreadyEncrypted: results.alreadyEncrypted,
        errors: results.errors.length
      }
    });

    console.log('[migrate-encrypted-secrets] Migration complete:', results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[migrate-encrypted-secrets] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
