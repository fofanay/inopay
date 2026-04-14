/**
 * INOPAY — API configuration
 * Supabase has been replaced by the custom Node.js API at api.getinopay.com
 */

export const API_URL = import.meta.env.VITE_API_URL || 'https://api.getinopay.com';

/** Base URL for calling edge functions (previously Supabase edge functions) */
export const EDGE_FUNCTION_URL = `${API_URL}/functions`;

// Legacy aliases kept for backward compatibility
export const SUPABASE_URL = API_URL;
export const SUPABASE_ANON_KEY = '';
export const SUPABASE_PROJECT_ID = '';
