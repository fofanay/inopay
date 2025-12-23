import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { needsCleaning } from "../_shared/proprietary-patterns.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      deployment_id,
      branch = 'main' // Dynamic branch from webhook
    } = await req.json();

    console.log(`[diff-clean] Processing ${files_changed?.length || 0} files for commit ${commit_sha} on branch ${branch}`);

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

        // Check if file needs cleaning (using shared patterns)
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
    const failedFiles: { path: string; error: string }[] = [];

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
          
          // Commit cleaned code back to repo using dynamic branch
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
                branch: branch, // Use dynamic branch from webhook
              }),
            }
          );

          if (updateResponse.ok) {
            cleanedFiles.push(file.path);
            console.log(`[diff-clean] Cleaned and committed: ${file.path}`);
          } else {
            const errorText = await updateResponse.text();
            console.error(`[diff-clean] Failed to commit ${file.path}:`, errorText);
            failedFiles.push({ path: file.path, error: `GitHub commit failed: ${updateResponse.status}` });
          }
        } else {
          const errorText = await cleanResponse.text();
          console.error(`[diff-clean] Failed to clean ${file.path}:`, errorText);
          failedFiles.push({ path: file.path, error: `Clean failed: ${cleanResponse.status}` });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[diff-clean] Error cleaning ${file.path}:`, err);
        failedFiles.push({ path: file.path, error: errorMsg });
      }
    }

    // Update sync history
    const duration = Date.now() - startTime;
    
    if (history_id) {
      await supabaseAdmin
        .from('sync_history')
        .update({
          files_cleaned: cleanedFiles,
          status: failedFiles.length > 0 ? 'partial' : 'deploying',
          duration_ms: duration,
          error_message: failedFiles.length > 0 ? JSON.stringify(failedFiles) : null,
        })
        .eq('id', history_id);
    }

    // Trigger rolling update
    await triggerRollingUpdate(supabaseAdmin, deployment_id, sync_config_id, history_id);

    return new Response(JSON.stringify({ 
      success: true, 
      files_cleaned: cleanedFiles.length,
      cleaned_files: cleanedFiles,
      failed_files: failedFiles,
      duration_ms: duration,
      branch,
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
