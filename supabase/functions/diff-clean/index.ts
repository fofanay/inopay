import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Patterns for proprietary code that needs cleaning
const PROPRIETARY_PATTERNS = [
  /@lovable\//,
  /@gptengineer\//,
  /use-mobile/,
  /lovable-tagger/,
  /\.lovable/,
  /\.gptengineer/,
];

function needsCleaning(content: string): boolean {
  return PROPRIETARY_PATTERNS.some(pattern => pattern.test(content));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      sync_config_id, 
      history_id, 
      github_repo_url, 
      commit_sha, 
      files_changed,
      deployment_id 
    } = await req.json();

    console.log(`[diff-clean] Processing ${files_changed?.length || 0} files for commit ${commit_sha}`);

    if (!files_changed || files_changed.length === 0) {
      console.log('[diff-clean] No files to process');
      
      if (history_id) {
        await supabaseAdmin
          .from('sync_history')
          .update({
            status: 'completed',
            files_cleaned: [],
            duration_ms: Date.now() - startTime,
            completed_at: new Date().toISOString(),
          })
          .eq('id', history_id);
      }

      // Trigger rolling update anyway (might be non-code changes)
      await triggerRollingUpdate(supabaseAdmin, deployment_id, sync_config_id, history_id);

      return new Response(JSON.stringify({ 
        success: true, 
        files_cleaned: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch user's GitHub token
    const { data: syncConfig } = await supabaseAdmin
      .from('sync_configurations')
      .select('user_id')
      .eq('id', sync_config_id)
      .single();

    if (!syncConfig) {
      throw new Error('Sync configuration not found');
    }

    const { data: userSettings } = await supabaseAdmin
      .from('user_settings')
      .select('github_token')
      .eq('user_id', syncConfig.user_id)
      .single();

    const githubToken = userSettings?.github_token;
    
    if (!githubToken) {
      throw new Error('GitHub token not configured');
    }

    // Parse repo owner/name from URL
    const repoMatch = github_repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!repoMatch) {
      throw new Error('Invalid GitHub URL');
    }
    const [, owner, repo] = repoMatch;
    const repoName = repo.replace(/\.git$/, '');

    // Fetch content of changed files
    const filesToClean: { path: string; content: string; sha: string }[] = [];

    for (const filePath of files_changed) {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/contents/${filePath}?ref=${commit_sha}`,
          {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Inopay-Sync',
            },
          }
        );

        if (!response.ok) {
          console.log(`[diff-clean] Could not fetch ${filePath}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const content = atob(data.content.replace(/\n/g, ''));

        // Check if file needs cleaning
        if (needsCleaning(content)) {
          filesToClean.push({
            path: filePath,
            content,
            sha: data.sha,
          });
        }
      } catch (err) {
        console.error(`[diff-clean] Error fetching ${filePath}:`, err);
      }
    }

    console.log(`[diff-clean] ${filesToClean.length} files need cleaning`);

    // Clean files using existing clean-code function
    const cleanedFiles: string[] = [];

    for (const file of filesToClean) {
      try {
        const cleanResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/clean-code`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: file.content,
              fileName: file.path,
            }),
          }
        );

        if (cleanResponse.ok) {
          const { cleanedCode } = await cleanResponse.json();
          
          // Commit cleaned code back to repo
          const updateResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/contents/${file.path}`,
            {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${githubToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Inopay-Sync',
              },
              body: JSON.stringify({
                message: `[Inopay Sync] Clean ${file.path}`,
                content: btoa(cleanedCode),
                sha: file.sha,
                branch: 'main', // TODO: Use the branch from the push event
              }),
            }
          );

          if (updateResponse.ok) {
            cleanedFiles.push(file.path);
            console.log(`[diff-clean] Cleaned and committed: ${file.path}`);
          } else {
            console.error(`[diff-clean] Failed to commit ${file.path}:`, await updateResponse.text());
          }
        }
      } catch (err) {
        console.error(`[diff-clean] Error cleaning ${file.path}:`, err);
      }
    }

    // Update sync history
    const duration = Date.now() - startTime;
    
    if (history_id) {
      await supabaseAdmin
        .from('sync_history')
        .update({
          files_cleaned: cleanedFiles,
          status: 'deploying',
          duration_ms: duration,
        })
        .eq('id', history_id);
    }

    // Trigger rolling update
    await triggerRollingUpdate(supabaseAdmin, deployment_id, sync_config_id, history_id);

    return new Response(JSON.stringify({ 
      success: true, 
      files_cleaned: cleanedFiles.length,
      cleaned_files: cleanedFiles,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[diff-clean] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function triggerRollingUpdate(
  supabase: any,
  deploymentId: string,
  syncConfigId: string,
  historyId: string
) {
  try {
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/rolling-update`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deployment_id: deploymentId,
          sync_config_id: syncConfigId,
          history_id: historyId,
        }),
      }
    );

    if (!response.ok) {
      console.error('[diff-clean] Failed to trigger rolling update:', await response.text());
    }
  } catch (err) {
    console.error('[diff-clean] Error triggering rolling update:', err);
  }
}
