/**
 * INOPAY LIBERATOR API - POST /liberate
 * =====================================
 * Endpoint principal pour lancer une libération de projet
 * 
 * © 2024 Inovaq Canada Inc.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LiberateRequest {
  source: 'zip' | 'github' | 'local';
  data?: string;
  projectName?: string;
  options?: {
    removeProprietaryImports?: boolean;
    removeProprietaryFiles?: boolean;
    removeTelemetry?: boolean;
    generatePolyfills?: boolean;
    includeDockerConfig?: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    const body: LiberateRequest = await req.json();
    
    if (!body.source) {
      return new Response(
        JSON.stringify({ error: 'source is required (zip, github, or local)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: job, error: jobError } = await supabase
      .from('liberation_jobs')
      .insert({
        user_id: user.id,
        source_type: body.source,
        source_url: body.source === 'github' ? body.data : null,
        project_name: body.projectName || `project-${Date.now()}`,
        status: 'pending',
        progress: 0,
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job:', jobError);
      return new Response(
        JSON.stringify({ error: 'Failed to create liberation job', details: jobError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[LIBERATE] Job created: ${job.id} for user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        liberationId: job.id,
        status: 'queued',
        message: 'Liberation job created. Use GET /audit/:id to check progress.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LIBERATE] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
