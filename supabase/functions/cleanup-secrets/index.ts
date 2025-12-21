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
  force?: boolean; // Force cleanup even if health check fails
}

// SECURITY: Mask secrets for logging
const maskSecret = (value: string | null): string => {
  if (!value) return '[empty]';
  if (value.length <= 4) return '***';
  return `***${value.slice(-4)}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { server_id, deployment_id, verify_health = true, force = false }: CleanupRequest = await req.json();

    console.log(`[cleanup-secrets] Starting cleanup for server ${server_id}, deployment ${deployment_id}`);
    console.log(`[cleanup-secrets] Options: verify_health=${verify_health}, force=${force}`);

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

    // Skip if already cleaned
    if (deployment.secrets_cleaned) {
      console.log(`[cleanup-secrets] Secrets already cleaned for deployment ${deployment_id}`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Secrets already cleaned',
        already_cleaned: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Vérifier la santé du site si demandé (sauf si force=true)
    let healthCheckPassed = false;
    if (verify_health && deployment.deployed_url && !force) {
      console.log(`[cleanup-secrets] Verifying health of ${deployment.deployed_url}`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const healthResponse = await fetch(deployment.deployed_url, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!healthResponse.ok) {
          console.warn(`[cleanup-secrets] Health check failed with status ${healthResponse.status}`);
          return new Response(JSON.stringify({
            success: false,
            reason: 'health_check_failed',
            status: healthResponse.status,
            message: 'Site not responding correctly, cleanup postponed',
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        healthCheckPassed = true;
        console.log(`[cleanup-secrets] Health check passed (${healthResponse.status})`);
      } catch (healthError: unknown) {
        const errorMessage = healthError instanceof Error ? healthError.message : 'Unknown error';
        console.warn(`[cleanup-secrets] Health check error: ${errorMessage}`);
        
        if (!force) {
          return new Response(JSON.stringify({
            success: false,
            reason: 'health_check_error',
            error: errorMessage,
            message: 'Could not verify site health, cleanup postponed',
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    } else {
      healthCheckPassed = true; // Skip health check
    }

    // Log what we're about to clean (SECURITY: masked values)
    console.log(`[cleanup-secrets] Cleaning secrets for server ${server_id}:`, {
      db_password_masked: maskSecret(server.db_password),
      jwt_secret_masked: maskSecret(server.jwt_secret),
      service_role_key_masked: maskSecret(server.service_role_key),
      has_setup_id: !!server.setup_id
    });

    // Nettoyer les secrets sensibles du serveur
    // On garde : coolify_url, coolify_token (pour futurs déploiements), anon_key, db_host, db_name, db_user
    // On supprime : db_password, jwt_secret, service_role_key, setup_id, db_url (contains password)
    
    const { error: updateServerError } = await supabase
      .from('user_servers')
      .update({
        db_password: null,
        jwt_secret: null,
        service_role_key: null,
        setup_id: null,
        db_url: null, // Clear entirely - contains password
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
        health_status: healthCheckPassed ? 'healthy' : 'unknown',
        last_health_check: new Date().toISOString(),
      })
      .eq('id', deployment_id);

    if (updateDeployError) {
      throw new Error(`Failed to update deployment: ${updateDeployError.message}`);
    }

    // Logger l'opération dans l'audit (SECURITY: NO secrets, only metadata)
    const { error: auditError } = await supabase
      .from('security_audit_logs')
      .insert({
        user_id: server.user_id,
        server_id: server_id,
        deployment_id: deployment_id,
        action: 'secrets_cleaned',
        details: {
          cleaned_fields: ['db_password', 'jwt_secret', 'service_role_key', 'setup_id', 'db_url'],
          retained_fields: ['coolify_url', 'coolify_token', 'anon_key', 'db_host', 'db_name', 'db_user'],
          deployed_url: deployment.deployed_url,
          health_check_passed: healthCheckPassed,
          forced: force,
          cleaned_at: new Date().toISOString(),
        },
      });

    if (auditError) {
      console.warn(`[cleanup-secrets] Failed to create audit log: ${auditError.message}`);
    }

    console.log(`[cleanup-secrets] Successfully cleaned secrets for server ${server_id}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Secrets cleaned successfully (Zero-Knowledge)',
      cleaned_fields: ['db_password', 'jwt_secret', 'service_role_key', 'setup_id', 'db_url'],
      health_status: healthCheckPassed ? 'healthy' : 'unknown',
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
