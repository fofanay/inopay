import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Required environment variables for a typical Vite + Supabase project
const REQUIRED_ENV_VARS = [
  { key: 'VITE_SUPABASE_URL', description: 'URL Supabase', isBuildTime: true, required: true },
  { key: 'VITE_SUPABASE_PUBLISHABLE_KEY', description: 'Clé publique Supabase', isBuildTime: true, required: true },
  { key: 'VITE_SUPABASE_ANON_KEY', description: 'Clé anonyme Supabase (alias)', isBuildTime: true, required: false },
];

// Optional but commonly needed
const OPTIONAL_ENV_VARS = [
  { key: 'NODE_ENV', description: 'Environnement Node', isBuildTime: true, defaultValue: 'production' },
  { key: 'VITE_APP_URL', description: 'URL de l\'application', isBuildTime: true },
];

interface EnvVar {
  key: string;
  value: string;
  is_build_time: boolean;
  is_preview: boolean;
  uuid?: string;
}

interface MissingEnvVar {
  key: string;
  description: string;
  isBuildTime: boolean;
  required: boolean;
  suggestedValue?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { server_id, app_uuid, auto_fix = false } = await req.json();

    if (!server_id || !app_uuid) {
      return new Response(JSON.stringify({ error: 'server_id et app_uuid requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get server with Coolify credentials
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('coolify_url, coolify_token')
      .eq('id', server_id)
      .eq('user_id', user.id)
      .single();

    if (serverError || !server) {
      return new Response(JSON.stringify({ error: 'Serveur non trouvé' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!server.coolify_url || !server.coolify_token) {
      return new Response(JSON.stringify({ error: 'Credentials Coolify non configurés' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize Coolify URL
    let coolifyUrl = server.coolify_url.trim();
    if (!coolifyUrl.startsWith('http://') && !coolifyUrl.startsWith('https://')) {
      coolifyUrl = `http://${coolifyUrl}`;
    }
    coolifyUrl = coolifyUrl.replace(/\/+$/, '');
    if (!coolifyUrl.includes(':8000') && !coolifyUrl.includes(':443')) {
      const urlObj = new URL(coolifyUrl);
      if (urlObj.protocol === 'http:') {
        urlObj.port = '8000';
      }
      coolifyUrl = urlObj.toString().replace(/\/+$/, '');
    }

    const headers = {
      'Authorization': `Bearer ${server.coolify_token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    // Step 1: Fetch current env vars from Coolify
    console.log(`[detect-missing-env-vars] Fetching env vars for app ${app_uuid}`);
    const envsResponse = await fetch(`${coolifyUrl}/api/v1/applications/${app_uuid}/envs`, { headers });

    if (!envsResponse.ok) {
      const errText = await envsResponse.text();
      console.error(`[detect-missing-env-vars] Failed to fetch envs: ${errText}`);
      return new Response(JSON.stringify({ error: `Impossible de récupérer les variables: ${envsResponse.status}` }), {
        status: envsResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentEnvs: EnvVar[] = await envsResponse.json();
    console.log(`[detect-missing-env-vars] Found ${currentEnvs.length} existing env vars`);

    // Create a map of existing env vars
    const existingKeys = new Set(currentEnvs.map(e => e.key));

    // Step 2: Detect missing required env vars
    const missingRequired: MissingEnvVar[] = [];
    const missingOptional: MissingEnvVar[] = [];

    for (const envDef of REQUIRED_ENV_VARS) {
      if (!existingKeys.has(envDef.key)) {
        // Check for alternate keys
        if (envDef.key === 'VITE_SUPABASE_PUBLISHABLE_KEY' && existingKeys.has('VITE_SUPABASE_ANON_KEY')) {
          continue; // Has the alternate key
        }
        if (envDef.key === 'VITE_SUPABASE_ANON_KEY' && existingKeys.has('VITE_SUPABASE_PUBLISHABLE_KEY')) {
          continue; // Has the alternate key
        }

        let suggestedValue: string | undefined;
        
        // Suggest values from our environment
        if (envDef.key === 'VITE_SUPABASE_URL') {
          suggestedValue = supabaseUrl;
        } else if (envDef.key === 'VITE_SUPABASE_PUBLISHABLE_KEY' || envDef.key === 'VITE_SUPABASE_ANON_KEY') {
          suggestedValue = supabaseAnonKey;
        }

        missingRequired.push({
          ...envDef,
          suggestedValue
        });
      }
    }

    for (const envDef of OPTIONAL_ENV_VARS) {
      if (!existingKeys.has(envDef.key)) {
        missingOptional.push({
          ...envDef,
          required: false,
          suggestedValue: (envDef as { defaultValue?: string }).defaultValue
        });
      }
    }

    // Step 3: Auto-fix if requested
    const fixedVars: string[] = [];
    const failedVars: { key: string; error: string }[] = [];

    if (auto_fix && missingRequired.length > 0) {
      console.log(`[detect-missing-env-vars] Auto-fixing ${missingRequired.length} missing env vars`);
      
      for (const envVar of missingRequired) {
        if (!envVar.suggestedValue) {
          failedVars.push({ key: envVar.key, error: 'Pas de valeur suggérée' });
          continue;
        }

        try {
          const addEnvRes = await fetch(`${coolifyUrl}/api/v1/applications/${app_uuid}/envs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              key: envVar.key,
              value: envVar.suggestedValue,
              is_build_time: envVar.isBuildTime,
              is_preview: false
            })
          });

          if (addEnvRes.ok) {
            fixedVars.push(envVar.key);
            console.log(`[detect-missing-env-vars] Added ${envVar.key}`);
          } else {
            const errText = await addEnvRes.text();
            failedVars.push({ key: envVar.key, error: errText.slice(0, 100) });
            console.error(`[detect-missing-env-vars] Failed to add ${envVar.key}: ${errText}`);
          }
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          failedVars.push({ key: envVar.key, error: errMsg });
        }
      }

      // Also add optional vars with default values
      for (const envVar of missingOptional) {
        if (!envVar.suggestedValue) continue;

        try {
          const addEnvRes = await fetch(`${coolifyUrl}/api/v1/applications/${app_uuid}/envs`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              key: envVar.key,
              value: envVar.suggestedValue,
              is_build_time: envVar.isBuildTime,
              is_preview: false
            })
          });

          if (addEnvRes.ok) {
            fixedVars.push(envVar.key);
          }
        } catch {
          // Ignore optional var failures
        }
      }
    }

    // Step 4: Analyze potential issues
    const warnings: string[] = [];
    
    // Check if VITE_ vars are marked as build-time
    for (const env of currentEnvs) {
      if (env.key.startsWith('VITE_') && !env.is_build_time) {
        warnings.push(`${env.key} devrait être marqué comme "build-time" pour être inclus dans le build Vite`);
      }
    }

    // Check for common misconfigurations
    const hasSupabaseUrl = existingKeys.has('VITE_SUPABASE_URL') || existingKeys.has('SUPABASE_URL');
    const hasSupabaseKey = existingKeys.has('VITE_SUPABASE_PUBLISHABLE_KEY') || 
                          existingKeys.has('VITE_SUPABASE_ANON_KEY') ||
                          existingKeys.has('SUPABASE_ANON_KEY');

    if (hasSupabaseUrl && !existingKeys.has('VITE_SUPABASE_URL')) {
      warnings.push('SUPABASE_URL existe mais VITE_SUPABASE_URL manque - les apps Vite ont besoin du préfixe VITE_');
    }

    if (hasSupabaseKey && !existingKeys.has('VITE_SUPABASE_PUBLISHABLE_KEY') && !existingKeys.has('VITE_SUPABASE_ANON_KEY')) {
      warnings.push('La clé Supabase existe mais sans préfixe VITE_ - les apps Vite ont besoin du préfixe VITE_');
    }

    const result = {
      current_env_vars: currentEnvs.map(e => ({
        key: e.key,
        is_build_time: e.is_build_time,
        has_value: !!e.value && e.value.length > 0
      })),
      missing_required: missingRequired,
      missing_optional: missingOptional,
      warnings,
      auto_fix_results: auto_fix ? {
        fixed: fixedVars,
        failed: failedVars
      } : null,
      summary: {
        total_current: currentEnvs.length,
        missing_required_count: missingRequired.length,
        missing_optional_count: missingOptional.length,
        warnings_count: warnings.length,
        is_ready: missingRequired.length === 0
      }
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[detect-missing-env-vars] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
