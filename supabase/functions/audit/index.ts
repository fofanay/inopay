/**
 * INOPAY LIBERATOR API - GET /audit/:id
 * ======================================
 * Récupère le rapport d'audit d'un job de libération
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

    // Extraire l'ID du job depuis l'URL ou le body
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    let jobId = pathParts[pathParts.length - 1];
    
    // Si l'ID n'est pas dans l'URL, essayer le query param
    if (!jobId || jobId === 'audit') {
      jobId = url.searchParams.get('id') || '';
    }

    // Si toujours pas d'ID, essayer le body (POST)
    if (!jobId && req.method === 'POST') {
      try {
        const body = await req.json();
        jobId = body.id || body.jobId || body.liberationId;
      } catch {
        // Pas de body
      }
    }

    if (!jobId) {
      return new Response(
        JSON.stringify({ error: 'Job ID required. Use ?id=xxx or POST with {id: xxx}' }),
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

    // Construire la réponse
    const response = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      projectName: job.project_name,
      sourceType: job.source_type,
      createdAt: job.created_at,
      completedAt: job.completed_at,
      
      // Rapport d'audit (si disponible)
      audit: job.audit_report ? {
        score: job.audit_score,
        grade: job.audit_report.grade || calculateGrade(job.audit_score),
        issues: job.audit_report.issues || { critical: 0, major: 0, minor: 0 },
        recommendations: job.audit_report.recommendations || [],
        owaspScore: job.audit_report.owaspScore,
        sovereigntyScore: job.audit_report.sovereigntyScore,
      } : null,

      // Stats
      stats: {
        filesCount: job.files_count,
        filesCleaned: job.files_cleaned,
        proprietaryRemoved: job.proprietary_removed,
      },

      // Erreur si échec
      error: job.status === 'failed' ? job.error_message : null,

      // URL de téléchargement si complété
      downloadUrl: job.status === 'completed' && job.result_url 
        ? job.result_url 
        : null,
    };

    console.log(`[AUDIT] Retrieved job ${jobId} - status: ${job.status}`);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AUDIT] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateGrade(score: number | null): string {
  if (!score) return 'F';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
