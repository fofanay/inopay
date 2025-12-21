import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

// Verify HMAC-SHA256 signature from GitHub
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!signature || !signature.startsWith('sha256=')) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expectedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expectedSignature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get raw body for signature verification
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    // Extract GitHub signature
    const signature = req.headers.get('x-hub-signature-256');
    
    // Get event type
    const eventType = req.headers.get('x-github-event');
    
    // Only process push events
    if (eventType !== 'push') {
      console.log(`[github-sync-webhook] Ignoring event type: ${eventType}`);
      return new Response(JSON.stringify({ message: 'Event ignored' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Extract repo URL from payload
    const repoUrl = payload.repository?.html_url || payload.repository?.clone_url;
    if (!repoUrl) {
      console.error('[github-sync-webhook] No repository URL in payload');
      return new Response(JSON.stringify({ error: 'Missing repository URL' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Normalize repo URL (remove .git suffix if present)
    const normalizedRepoUrl = repoUrl.replace(/\.git$/, '');

    // Find sync configuration for this repo
    const { data: syncConfigs, error: configError } = await supabaseAdmin
      .from('sync_configurations')
      .select('*, server_deployments(*)')
      .eq('sync_enabled', true)
      .or(`github_repo_url.eq.${normalizedRepoUrl},github_repo_url.eq.${normalizedRepoUrl}.git`);

    if (configError) {
      console.error('[github-sync-webhook] Error fetching sync config:', configError);
      return new Response(JSON.stringify({ error: 'Database error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!syncConfigs || syncConfigs.length === 0) {
      console.log(`[github-sync-webhook] No active sync config found for repo: ${normalizedRepoUrl}`);
      return new Response(JSON.stringify({ message: 'No sync configuration found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const syncConfig = syncConfigs[0];

    // Verify HMAC signature
    const isValid = await verifySignature(rawBody, signature || '', syncConfig.github_webhook_secret);
    if (!isValid) {
      console.error('[github-sync-webhook] Invalid signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Check branch
    const branch = payload.ref?.replace('refs/heads/', '');
    const allowedBranches = syncConfig.allowed_branches || ['main', 'master'];
    
    if (!allowedBranches.includes(branch)) {
      console.log(`[github-sync-webhook] Branch ${branch} not in allowed list: ${allowedBranches.join(', ')}`);
      return new Response(JSON.stringify({ message: 'Branch not configured for sync' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Rate limiting: max 10 syncs per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentSyncs } = await supabaseAdmin
      .from('sync_history')
      .select('*', { count: 'exact', head: true })
      .eq('sync_config_id', syncConfig.id)
      .gte('started_at', oneHourAgo);

    if ((recentSyncs || 0) >= 10) {
      console.log('[github-sync-webhook] Rate limit exceeded');
      return new Response(JSON.stringify({ error: 'Rate limit exceeded (max 10 syncs/hour)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    // Extract commit info
    const headCommit = payload.head_commit;
    const commitSha = headCommit?.id || payload.after;
    const commitMessage = headCommit?.message || '';

    // Extract modified files
    const filesAdded = payload.head_commit?.added || [];
    const filesModified = payload.head_commit?.modified || [];
    const filesRemoved = payload.head_commit?.removed || [];
    const allChangedFiles = [...filesAdded, ...filesModified];

    // Filter to only source code files
    const sourceFiles = allChangedFiles.filter((f: string) => 
      f.endsWith('.ts') || f.endsWith('.tsx') || 
      f.endsWith('.js') || f.endsWith('.jsx') ||
      f.endsWith('.css') || f.endsWith('.json')
    );

    console.log(`[github-sync-webhook] Processing commit ${commitSha}`);
    console.log(`[github-sync-webhook] Changed files: ${sourceFiles.length}`);

    // Create sync history record
    const { data: historyRecord, error: historyError } = await supabaseAdmin
      .from('sync_history')
      .insert({
        sync_config_id: syncConfig.id,
        user_id: syncConfig.user_id,
        commit_sha: commitSha,
        commit_message: commitMessage,
        files_changed: sourceFiles,
        status: 'processing',
      })
      .select()
      .single();

    if (historyError) {
      console.error('[github-sync-webhook] Error creating history record:', historyError);
    }

    // Trigger diff-clean function asynchronously
    const diffCleanResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/diff-clean`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sync_config_id: syncConfig.id,
          history_id: historyRecord?.id,
          github_repo_url: syncConfig.github_repo_url,
          commit_sha: commitSha,
          files_changed: sourceFiles,
          deployment_id: syncConfig.deployment_id,
        }),
      }
    );

    if (!diffCleanResponse.ok) {
      const errorText = await diffCleanResponse.text();
      console.error('[github-sync-webhook] diff-clean error:', errorText);
      
      // Update history with error
      if (historyRecord) {
        await supabaseAdmin
          .from('sync_history')
          .update({ 
            status: 'failed', 
            error_message: `Diff-clean failed: ${errorText}`,
            completed_at: new Date().toISOString(),
          })
          .eq('id', historyRecord.id);
      }
    }

    // Update sync config
    await supabaseAdmin
      .from('sync_configurations')
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: 'processing',
        last_sync_commit: commitSha,
        sync_count: syncConfig.sync_count + 1,
      })
      .eq('id', syncConfig.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Sync triggered',
      commit: commitSha,
      files_changed: sourceFiles.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('[github-sync-webhook] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
