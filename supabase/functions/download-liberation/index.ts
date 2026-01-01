/**
 * INOPAY LIBERATOR API - GET /download/:id
 * =========================================
 * Télécharge le package libéré
 * 
 * © 2024 Inovaq Canada Inc.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Vérifier l'authentification
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

    // Extraire l'ID du job
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    let jobId = pathParts[pathParts.length - 1];
    
    if (!jobId || jobId === 'download-liberation') {
      jobId = url.searchParams.get('id') || '';
    }

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Job ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer le job
    const { data: job, error: jobError } = await supabase
      .from('liberation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: 'Job not found or access denied' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Vérifier que le job est complété
    if (job.status !== 'completed') {
      return new Response(
        JSON.stringify({ 
          error: 'Liberation not completed',
          status: job.status,
          progress: job.progress,
          message: job.status === 'failed' 
            ? `Job failed: ${job.error_message}` 
            : 'Please wait for the liberation to complete'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Si on a une URL de résultat, rediriger
    if (job.result_url) {
      // Télécharger depuis le storage
      const { data: fileData, error: storageError } = await supabase.storage
        .from('cleaned-archives')
        .download(job.result_url);

      if (storageError || !fileData) {
        console.error('Storage error:', storageError);
        return new Response(
          JSON.stringify({ error: 'Failed to retrieve archive' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const filename = `${job.project_name || 'liberation'}-liberated.zip`;
      
      return new Response(fileData, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Si pas d'URL mais complété, générer un package minimal
    const minimalPackage = generateMinimalPackage(job);
    
    console.log(`[DOWNLOAD] Serving liberation package for job ${jobId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Liberation package ready',
        projectName: job.project_name,
        auditScore: job.audit_score,
        // Dans une vraie implémentation, on retournerait le ZIP
        package: minimalPackage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[DOWNLOAD] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

interface LiberationJob {
  id: string;
  project_name: string;
  audit_score: number;
  audit_report: Record<string, unknown>;
  completed_at: string;
}

function generateMinimalPackage(job: LiberationJob) {
  return {
    manifest: {
      version: '1.0.0',
      generatedAt: job.completed_at,
      projectName: job.project_name,
      auditScore: job.audit_score,
      generatedBy: 'Inopay Liberator Engine',
    },
    files: [
      'README.md',
      'Dockerfile',
      'docker-compose.yml',
      'DEPLOY.md',
    ],
    instructions: 'Download the full package from the Inopay dashboard',
  };
}
