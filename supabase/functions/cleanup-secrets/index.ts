import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupRequest {
  server_id: string;
  deployment_id: string;
  verify_health?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { server_id, deployment_id, verify_health = true }: CleanupRequest = await req.json();

    console.log(`[cleanup-secrets] Starting cleanup for server ${server_id}, deployment ${deployment_id}`);

    // Récupérer les infos du serveur et du déploiement
    const { data: server, error: serverError } = await supabase
      .from('user_servers')
      .select('*')
      .eq('id', server_id)
      .single();

    if (serverError || !server) {
      throw new Error(`Server not found: ${serverError?.message}`);
    }

    const { data: deployment, error: deployError } = await supabase
      .from('server_deployments')
      .select('*')
      .eq('id', deployment_id)
      .single();

    if (deployError || !deployment) {
      throw new Error(`Deployment not found: ${deployError?.message}`);
    }

    // Vérifier la santé du site si demandé
    if (verify_health && deployment.deployed_url) {
      console.log(`[cleanup-secrets] Verifying health of ${deployment.deployed_url}`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const healthResponse = await fetch(deployment.deployed_url, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!healthResponse.ok) {
          console.warn(`[cleanup-secrets] Health check failed with status ${healthResponse.status}, skipping cleanup`);
          return new Response(JSON.stringify({
            success: false,
            reason: 'health_check_failed',
            status: healthResponse.status,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.log(`[cleanup-secrets] Health check passed (${healthResponse.status})`);
      } catch (healthError: unknown) {
        const errorMessage = healthError instanceof Error ? healthError.message : 'Unknown error';
        console.warn(`[cleanup-secrets] Health check error: ${errorMessage}, skipping cleanup`);
        return new Response(JSON.stringify({
          success: false,
          reason: 'health_check_error',
          error: errorMessage,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Nettoyer les secrets sensibles du serveur
    // On garde : coolify_url, coolify_token (pour futurs déploiements), anon_key, db_host, db_name, db_user
    // On supprime : db_password, jwt_secret, service_role_key, setup_id
    const cleanedDbUrl = server.db_url 
      ? server.db_url.replace(/:[^:@]+@/, ':***@') // Masquer le mot de passe dans l'URL
      : null;

    const { error: updateServerError } = await supabase
      .from('user_servers')
      .update({
        db_password: null,
        jwt_secret: null,
        service_role_key: null,
        setup_id: null,
        db_url: cleanedDbUrl,
      })
      .eq('id', server_id);

    if (updateServerError) {
      throw new Error(`Failed to clean server secrets: ${updateServerError.message}`);
    }

    // Marquer le déploiement comme nettoyé
    const { error: updateDeployError } = await supabase
      .from('server_deployments')
      .update({
        secrets_cleaned: true,
        secrets_cleaned_at: new Date().toISOString(),
        health_status: 'healthy',
        last_health_check: new Date().toISOString(),
      })
      .eq('id', deployment_id);

    if (updateDeployError) {
      throw new Error(`Failed to update deployment: ${updateDeployError.message}`);
    }

    // Logger l'opération dans l'audit (SANS secrets!)
    const { error: auditError } = await supabase
      .from('security_audit_logs')
      .insert({
        user_id: server.user_id,
        server_id: server_id,
        deployment_id: deployment_id,
        action: 'secrets_cleaned',
        details: {
          cleaned_fields: ['db_password', 'jwt_secret', 'service_role_key', 'setup_id'],
          masked_fields: ['db_url'],
          retained_fields: ['coolify_url', 'coolify_token', 'anon_key', 'db_host', 'db_name', 'db_user'],
          deployed_url: deployment.deployed_url,
          cleaned_at: new Date().toISOString(),
        },
      });

    if (auditError) {
      console.warn(`[cleanup-secrets] Failed to create audit log: ${auditError.message}`);
    }

    console.log(`[cleanup-secrets] Successfully cleaned secrets for server ${server_id}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Secrets cleaned successfully',
      cleaned_fields: ['db_password', 'jwt_secret', 'service_role_key', 'setup_id'],
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cleanup-secrets] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
