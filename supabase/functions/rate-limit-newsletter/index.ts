import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SIGNUPS_PER_IP = 3; // Max 3 signups per IP per hour
const MAX_SIGNUPS_PER_EMAIL_DOMAIN = 10; // Max 10 signups per email domain per hour

// In-memory rate limit store (resets on function cold start)
const ipRateLimits = new Map<string, { count: number; resetAt: number }>();
const domainRateLimits = new Map<string, { count: number; resetAt: number }>();

function getEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

function checkRateLimit(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  maxCount: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    // Reset or create new entry
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: maxCount - 1, resetAt };
  }

  if (existing.count >= maxCount) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count++;
  store.set(key, existing);
  return { allowed: true, remaining: maxCount - existing.count, resetAt: existing.resetAt };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';

    // Check IP rate limit
    const ipCheck = checkRateLimit(ipRateLimits, clientIP, MAX_SIGNUPS_PER_IP);
    if (!ipCheck.allowed) {
      console.log(`[rate-limit-newsletter] IP ${clientIP} rate limited`);
      return new Response(
        JSON.stringify({ 
          error: 'Too many signup attempts. Please try again later.',
          retry_after: Math.ceil((ipCheck.resetAt - Date.now()) / 1000)
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((ipCheck.resetAt - Date.now()) / 1000))
          } 
        }
      );
    }

    // Check domain rate limit (to prevent abuse from disposable email services)
    const domain = getEmailDomain(email);
    const domainCheck = checkRateLimit(domainRateLimits, domain, MAX_SIGNUPS_PER_EMAIL_DOMAIN);
    if (!domainCheck.allowed) {
      console.log(`[rate-limit-newsletter] Domain ${domain} rate limited`);
      return new Response(
        JSON.stringify({ 
          error: 'Too many signups from this email provider. Please try again later.',
          retry_after: Math.ceil((domainCheck.resetAt - Date.now()) / 1000)
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil((domainCheck.resetAt - Date.now()) / 1000))
          } 
        }
      );
    }

    // Proceed with newsletter signup
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const normalizedEmail = email.toLowerCase().trim();

    // Check if already subscribed
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id, is_active')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      if (existing.is_active) {
        return new Response(
          JSON.stringify({ success: true, message: 'Already subscribed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Reactivate subscription
        await supabase
          .from('newsletter_subscribers')
          .update({ is_active: true, unsubscribed_at: null })
          .eq('id', existing.id);

        return new Response(
          JSON.stringify({ success: true, message: 'Subscription reactivated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create new subscription
    const { error: insertError } = await supabase
      .from('newsletter_subscribers')
      .insert({
        email: normalizedEmail,
        source: 'api_rate_limited',
        is_active: true
      });

    if (insertError) {
      console.error('[rate-limit-newsletter] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to subscribe' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[rate-limit-newsletter] New subscription: ${normalizedEmail} from IP ${clientIP}`);

    return new Response(
      JSON.stringify({ success: true, message: 'Successfully subscribed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[rate-limit-newsletter] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
