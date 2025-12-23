/**
 * Crypto utilities for AES-256-GCM encryption/decryption
 * Used for storing sensitive tokens (GitHub, Coolify) securely
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derive an AES key from a master secret using PBKDF2
 */
export async function deriveKey(masterSecret: string, salt: Uint8Array): Promise<CryptoKey> {
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

/**
 * Encrypt a plaintext string using AES-256-GCM
 * Returns a base64-encoded string containing salt + iv + ciphertext
 */
export async function encryptToken(plaintext: string, masterSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Derive key from master secret
  const key = await deriveKey(masterSecret, salt);

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: iv },
    key,
    data
  );

  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a base64-encoded encrypted token
 * Expects format: base64(salt + iv + ciphertext)
 */
export async function decryptToken(encryptedBase64: string, masterSecret: string): Promise<string> {
  // Decode base64
  const combined = new Uint8Array(
    atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
  );

  // Extract salt, iv, and ciphertext
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 16 + IV_LENGTH);
  const ciphertext = combined.slice(16 + IV_LENGTH);

  // Derive key from master secret
  const key = await deriveKey(masterSecret, salt);

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

/**
 * Check if a string looks like it's already encrypted (base64 with expected length)
 */
export function isEncrypted(value: string): boolean {
  if (!value || value.length < 50) return false;
  
  // Check if it's valid base64 and starts with what looks like encrypted data
  try {
    const decoded = atob(value);
    // Minimum length: 16 (salt) + 12 (iv) + 16 (min ciphertext with auth tag) = 44 bytes
    return decoded.length >= 44;
  } catch {
    return false;
  }
}

/**
 * Get the encryption master key from environment
 * Falls back to SUPABASE_SERVICE_ROLE_KEY if no dedicated key is set
 */
export function getMasterKey(): string {
  const dedicatedKey = Deno.env.get('ENCRYPTION_MASTER_KEY');
  if (dedicatedKey) return dedicatedKey;
  
  // Fallback to service role key (not ideal but works)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) {
    throw new Error('No encryption key available');
  }
  
  // Use a hash of the service role key as the encryption key
  return serviceRoleKey.substring(0, 64);
}
