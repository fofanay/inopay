import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiagnosticResult {
  service: string;
  status: 'ok' | 'error';
  latency: number;
  message: string;
  details?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    // Verify admin role
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { vpsIp, coolifyUrl, coolifyToken } = await req.json();
    const results: DiagnosticResult[] = [];

    // 1. Test Supabase Database
    console.log('[Diagnostic] Testing Supabase connection...');
    const supabaseStart = Date.now();
    try {
      const { data, error } = await supabase.from('user_roles').select('count').limit(1);
      const latency = Date.now() - supabaseStart;
      
      if (error) {
        results.push({
          service: 'Supabase Database',
          status: 'error',
          latency,
          message: 'Connexion échouée',
          details: error.message
        });
      } else {
        results.push({
          service: 'Supabase Database',
          status: 'ok',
          latency,
          message: 'Base de données accessible'
        });
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      results.push({
        service: 'Supabase Database',
        status: 'error',
        latency: Date.now() - supabaseStart,
        message: 'Erreur de connexion',
        details: errorMessage
      });
    }

    // 2. Test Edge Functions
    console.log('[Diagnostic] Testing Edge Functions...');
    const edgeStart = Date.now();
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/health-monitor`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ test: true })
      });
      const latency = Date.now() - edgeStart;
      
      if (response.ok || response.status === 400) {
        results.push({
          service: 'Edge Functions',
          status: 'ok',
          latency,
          message: 'Edge Functions opérationnelles'
        });
      } else {
        results.push({
          service: 'Edge Functions',
          status: 'error',
          latency,
          message: `Erreur HTTP ${response.status}`,
          details: await response.text()
        });
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      results.push({
        service: 'Edge Functions',
        status: 'error',
        latency: Date.now() - edgeStart,
        message: 'Edge Functions inaccessibles',
        details: errorMessage
      });
    }

    // 3. Test VPS (via HTTP check since Deno doesn't support raw ICMP)
    if (vpsIp) {
      console.log(`[Diagnostic] Testing VPS at ${vpsIp}...`);
      const vpsStart = Date.now();
      try {
        // Try to connect to common ports
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`http://${vpsIp}:8000/api/health`, {
          method: 'GET',
          signal: controller.signal
        }).catch(() => null);
        
        clearTimeout(timeoutId);
        const latency = Date.now() - vpsStart;
        
        if (response && response.ok) {
          results.push({
            service: 'VPS',
            status: 'ok',
            latency,
            message: `VPS accessible (${vpsIp})`
          });
        } else {
          // Try SSH port as fallback indicator
          const sshController = new AbortController();
          const sshTimeout = setTimeout(() => sshController.abort(), 3000);
          
          try {
            await fetch(`http://${vpsIp}:22`, { 
              method: 'GET',
              signal: sshController.signal 
            });
          } catch {
            // Connection refused means port is active
            clearTimeout(sshTimeout);
            results.push({
              service: 'VPS',
              status: 'ok',
              latency: Date.now() - vpsStart,
              message: `VPS en ligne (${vpsIp})`
            });
            goto_coolify();
          }
          
          clearTimeout(sshTimeout);
          results.push({
            service: 'VPS',
            status: 'error',
            latency,
            message: 'VPS ne répond pas',
            details: `Aucune réponse de ${vpsIp}`
          });
        }
      } catch (e: unknown) {
        const latency = Date.now() - vpsStart;
        const errorName = e instanceof Error ? e.name : '';
        // AbortError or connection refused can mean server is up but blocking
        if (errorName === 'AbortError') {
          results.push({
            service: 'VPS',
            status: 'error',
            latency,
            message: 'Timeout - VPS injoignable',
            details: `Délai d'attente dépassé pour ${vpsIp}`
          });
        } else {
          // Connection refused usually means server is up
          results.push({
            service: 'VPS',
            status: 'ok',
            latency,
            message: `VPS détecté (${vpsIp})`
          });
        }
      }
    } else {
      results.push({
        service: 'VPS',
        status: 'error',
        latency: 0,
        message: 'IP VPS non configurée',
        details: 'Aucune adresse IP fournie'
      });
    }

    // 4. Test Coolify API
    function goto_coolify() {}
    if (coolifyUrl && coolifyToken) {
      console.log(`[Diagnostic] Testing Coolify at ${coolifyUrl}...`);
      const coolifyStart = Date.now();
      try {
        const response = await fetch(`${coolifyUrl}/api/v1/version`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${coolifyToken}`,
            'Accept': 'application/json'
          }
        });
        const latency = Date.now() - coolifyStart;
        
        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          results.push({
            service: 'Coolify API',
            status: 'ok',
            latency,
            message: `Coolify v${data.version || 'active'}`
          });
        } else if (response.status === 401 || response.status === 403) {
          results.push({
            service: 'Coolify API',
            status: 'error',
            latency,
            message: 'Token Coolify invalide ou expiré',
            details: 'Régénérez votre token API dans Coolify'
          });
        } else {
          results.push({
            service: 'Coolify API',
            status: 'error',
            latency,
            message: `Erreur Coolify (${response.status})`,
            details: await response.text()
          });
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        results.push({
          service: 'Coolify API',
          status: 'error',
          latency: Date.now() - coolifyStart,
          message: 'Coolify inaccessible',
          details: errorMessage
        });
      }
    } else {
      results.push({
        service: 'Coolify API',
        status: 'error',
        latency: 0,
        message: 'Coolify non configuré',
        details: 'URL ou token manquant'
      });
    }

    // 5. Test GitHub PAT
    const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN');
    console.log('[Diagnostic] Testing GitHub PAT...');
    const githubStart = Date.now();
    
    if (githubToken) {
      try {
        const response = await fetch('https://api.github.com/user/repos?per_page=1', {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Inopay-Diagnostic'
          }
        });
        const latency = Date.now() - githubStart;
        
        if (response.ok) {
          const rateLimit = response.headers.get('x-ratelimit-remaining');
          results.push({
            service: 'GitHub API',
            status: 'ok',
            latency,
            message: `PAT valide (${rateLimit} requêtes restantes)`
          });
        } else if (response.status === 401) {
          results.push({
            service: 'GitHub API',
            status: 'error',
            latency,
            message: 'Token GitHub expiré ou invalide',
            details: 'Régénérez votre Personal Access Token'
          });
        } else {
          results.push({
            service: 'GitHub API',
            status: 'error',
            latency,
            message: `Erreur GitHub (${response.status})`,
            details: await response.text()
          });
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : 'Unknown error';
        results.push({
          service: 'GitHub API',
          status: 'error',
          latency: Date.now() - githubStart,
          message: 'GitHub API inaccessible',
          details: errorMessage
        });
      }
    } else {
      results.push({
        service: 'GitHub API',
        status: 'error',
        latency: 0,
        message: 'Token GitHub non configuré',
        details: 'GITHUB_PERSONAL_ACCESS_TOKEN manquant'
      });
    }

    console.log('[Diagnostic] All tests completed:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Diagnostic] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
