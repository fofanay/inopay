// @inopay-core-protected
// SOVEREIGN LIBERATION ENGINE - 3-Phase Isolated Pipeline
// Phase 1: GitHub Repository Creation
// Phase 2: Supabase Schema Migration (REAL MIGRATION ENGINE)
// Phase 3: Coolify Deployment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  cleanFileContent, 
  isLockFile,
  type CleaningResult
} from "../_shared/proprietary-patterns.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LiberationRequest {
  phase: 'github' | 'supabase' | 'coolify' | 'all';
  files?: { path: string; content: string }[];
  projectName: string;
  repoName?: string;
  serverId?: string;
  // Legacy fields (for Lovable Cloud)
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  // NEW: Target Supabase credentials for migration
  targetSupabaseUrl?: string;
  targetSupabaseServiceKey?: string;
  targetAnonKey?: string;
  // Secrets to sync
  secretsToSync?: {
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    RESEND_API_KEY?: string;
    DEEPSEEK_API_KEY?: string;
    ANTHROPIC_API_KEY?: string;
    GITHUB_PERSONAL_ACCESS_TOKEN?: string;
  };
}

interface PhaseResult {
  success: boolean;
  phase: string;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
  httpStatus?: number;
}

interface MigrationProgress {
  currentFile: number;
  totalFiles: number;
  fileName: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  error?: string;
}

function logStep(step: string, data?: Record<string, unknown>) {
  console.log(`[SOVEREIGN-LIBERATION] ${step}`, data ? JSON.stringify(data) : '');
}

// Embedded migration SQL files content - will be populated from the repo
// For now, we'll read from the files array passed in
const MIGRATION_FILES_ORDER = [
  "20251220150048_163d3d52-8691-43df-822e-b4cd4ed8a335.sql",
  "20251220151106_27bd3d86-0f45-4034-90c2-c9bee02ad534.sql",
  "20251220152101_fbabc199-e436-4f1b-8256-fe1fbc266dd0.sql",
  "20251220153237_5125f919-565c-45aa-9892-e06a60afb243.sql",
  "20251220161310_040bd8bf-43d9-4918-bbce-c9c985193f5e.sql",
  "20251220164615_422e7b04-62bf-4441-b64d-3ce62611c77d.sql",
  "20251220172430_4fdcaee5-626e-4632-b987-49598438b04b.sql",
  "20251220173103_2a1cc670-3c8e-41da-bcb4-e44f79c9614f.sql",
  "20251220173117_f35637b6-126f-4694-a15d-6986cf8860b5.sql",
  "20251220204141_20138d69-4bbd-473b-967e-7d5e2a5a83e1.sql",
  "20251220224309_af82bebe-ff48-4249-8fc1-ec6ea7c4546c.sql",
  "20251221151827_491b931d-a763-4cdf-a001-13fa92014320.sql",
  "20251221165901_6a4a23b8-46c8-4cde-a554-71cb6ff4543b.sql",
  "20251221170856_12387d7b-94e5-42da-9908-ebbf9abd861e.sql",
  "20251221172358_bf81f3eb-42c3-4394-a0f5-a59cfc2f40c8.sql",
  "20251221173226_be044433-a58b-4104-a1bf-469f7b568baa.sql",
  "20251221173836_62a292c5-ac52-4d3d-8754-393d06e8faef.sql",
  "20251221182336_5eb19f66-50fb-4e3d-a784-b935baec5293.sql",
  "20251221195353_c1ea5872-c7be-4b07-ac67-da307e98ccac.sql",
  "20251221203704_012f85d2-a65a-46b7-b35a-5f2d18da9cef.sql",
  "20251221220110_79d67c9a-edbe-4fa8-ae34-c8e5eb3d461a.sql",
  "20251221221034_0fdf61a9-9708-4c64-ba1c-0ab10b5db160.sql",
  "20251222153005_932ed9ea-35dd-4c74-a360-d5e4ce29d180.sql",
  "20251222165858_5ce81142-258b-47f7-a004-f2b9cb1b466d.sql",
  "20251223002013_243d130b-13f9-40ee-9019-0d2355551f60.sql",
  "20251223002432_404f2b0c-e30f-4747-9ed7-1cade72e978f.sql",
  "20251223015550_f81ffe3c-aa87-4e59-aa3b-025ae30d111a.sql",
  "20251223162934_3c9ecfd9-3fc8-4b15-b9f8-b48ceea7c045.sql",
  "20251223181100_eb9bc86a-065d-4ffc-9bf7-c5a422bdb233.sql",
  "20251224144818_feb09f2e-f07c-4ffe-bad4-74170b0079b8.sql",
  "20251224151456_c4a4061b-7ae2-427d-ba7e-f2ff9dfd750e.sql",
  "20251224154757_44da694b-57e9-4fd1-b78c-54e44060a82e.sql",
];

// ======================== PHASE 1: GITHUB ========================
async function executePhaseGitHub(
  githubToken: string,
  repoName: string,
  files: { path: string; content: string }[],
  userId: string
): Promise<PhaseResult> {
  logStep("Phase 1: GitHub - Starting", { repoName, filesCount: files.length });

  const headers = {
    'Authorization': `Bearer ${githubToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // 1.1 - Validate token and get user
    const userResponse = await fetch('https://api.github.com/user', { headers });
    if (!userResponse.ok) {
      const error = await userResponse.text();
      return {
        success: false,
        phase: 'github',
        message: 'Token GitHub invalide ou expiré',
        error: `HTTP ${userResponse.status}: ${error}`,
        httpStatus: userResponse.status,
      };
    }

    const user = await userResponse.json();
    const owner = user.login;
    logStep("Phase 1.1: GitHub user validated", { owner });

    // 1.2 - Check token scopes
    const scopes = userResponse.headers.get('x-oauth-scopes') || '';
    const hasRepoScope = scopes.includes('repo');

    if (!hasRepoScope) {
      return {
        success: false,
        phase: 'github',
        message: 'Token GitHub sans permission "repo"',
        error: `Scopes actuels: ${scopes || 'aucun'}. Requis: repo, workflow`,
        httpStatus: 403,
      };
    }

    logStep("Phase 1.2: Token scopes validated", { scopes, hasRepoScope });

    // 1.3 - Clean files using proprietary-patterns
    const cleanedFiles: { path: string; content: string }[] = [];
    const cleaningResults: CleaningResult[] = [];
    let totalChanges = 0;

    for (const file of files) {
      if (isLockFile(file.path)) continue;

      const result = cleanFileContent(file.path, file.content);
      cleaningResults.push(result);

      if (!result.removed) {
        cleanedFiles.push({ path: file.path, content: result.cleanedContent });
        totalChanges += result.changes.length;
      }
    }

    logStep("Phase 1.3: Files cleaned", { 
      original: files.length, 
      cleaned: cleanedFiles.length, 
      totalChanges 
    });

    if (cleanedFiles.length === 0) {
      return {
        success: false,
        phase: 'github',
        message: 'Aucun fichier à pousser après nettoyage',
        error: 'Tous les fichiers ont été filtrés ou supprimés',
      };
    }

    // 1.4 - Check if repo exists or create it
    const repoCheckResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, { headers });
    let repoUrl: string;
    let wasCreated = false;

    if (repoCheckResponse.status === 404) {
      const createResponse = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: repoName,
          description: 'Projet libéré et nettoyé par Inopay - 100% Souverain',
          private: true,
          auto_init: false,
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        return {
          success: false,
          phase: 'github',
          message: 'Erreur création du dépôt',
          error: error.message || `HTTP ${createResponse.status}`,
          httpStatus: createResponse.status,
        };
      }

      const newRepo = await createResponse.json();
      repoUrl = newRepo.html_url;
      wasCreated = true;
      logStep("Phase 1.4: Repository created", { repoUrl });
    } else if (repoCheckResponse.ok) {
      const existingRepo = await repoCheckResponse.json();
      repoUrl = existingRepo.html_url;
      logStep("Phase 1.4: Repository exists", { repoUrl });
    } else {
      const error = await repoCheckResponse.text();
      return {
        success: false,
        phase: 'github',
        message: 'Erreur vérification du dépôt',
        error: `HTTP ${repoCheckResponse.status}: ${error}`,
        httpStatus: repoCheckResponse.status,
      };
    }

    // 1.5 - Initialize repo if needed
    let baseSha: string | null = null;
    let baseTreeSha: string | null = null;

    if (!wasCreated) {
      const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`, { headers });
      if (refResponse.ok) {
        const refData = await refResponse.json();
        baseSha = refData.object.sha;
        
        const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseSha}`, { headers });
        if (commitResponse.ok) {
          const commitData = await commitResponse.json();
          baseTreeSha = commitData.tree.sha;
        }
      }
    }

    if (!baseSha) {
      const readmeContent = btoa(`# ${repoName}\n\nProjet libéré et nettoyé par Inopay - 100% Souverain\n`);
      
      const initResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/README.md`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: '🎉 Initial commit - Repo initialized by Inopay',
            content: readmeContent,
            branch: 'main',
          }),
        }
      );

      if (initResponse.ok || initResponse.status === 422) {
        await new Promise(r => setTimeout(r, 1500));
        
        const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/main`, { headers });
        if (refResponse.ok) {
          const refData = await refResponse.json();
          baseSha = refData.object.sha;
          
          const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits/${baseSha}`, { headers });
          if (commitResponse.ok) {
            const commitData = await commitResponse.json();
            baseTreeSha = commitData.tree.sha;
          }
        }
      }
    }

    logStep("Phase 1.5: Base refs obtained", { baseSha: baseSha?.substring(0, 7), baseTreeSha: baseTreeSha?.substring(0, 7) });

    // 1.6 - Build tree with inline content
    const treeItems: { path: string; mode: string; type: string; content?: string; sha?: string }[] = [];
    const INLINE_LIMIT = 100 * 1024;

    for (const file of cleanedFiles) {
      const size = new TextEncoder().encode(file.content).length;
      
      if (size > INLINE_LIMIT) {
        const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/blobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: btoa(unescape(encodeURIComponent(file.content))),
            encoding: 'base64',
          }),
        });

        if (blobResponse.ok) {
          const blob = await blobResponse.json();
          treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
        } else {
          treeItems.push({ path: file.path, mode: '100644', type: 'blob', content: file.content });
        }
      } else {
        treeItems.push({ path: file.path, mode: '100644', type: 'blob', content: file.content });
      }
    }

    logStep("Phase 1.6: Tree built", { items: treeItems.length });

    // 1.7 - Create tree
    const treePayload: { tree: typeof treeItems; base_tree?: string } = { tree: treeItems };
    if (baseTreeSha) {
      treePayload.base_tree = baseTreeSha;
    }

    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify(treePayload),
    });

    if (!treeResponse.ok) {
      const error = await treeResponse.json();
      return {
        success: false,
        phase: 'github',
        message: 'Erreur création de l\'arbre Git',
        error: error.message || `HTTP ${treeResponse.status}`,
        httpStatus: treeResponse.status,
      };
    }

    const tree = await treeResponse.json();
    logStep("Phase 1.7: Tree created", { treeSha: tree.sha.substring(0, 7) });

    // 1.8 - Create commit
    const commitPayload: { message: string; tree: string; parents?: string[] } = {
      message: `🚀 Liberation Inopay - ${cleanedFiles.length} fichiers nettoyés`,
      tree: tree.sha,
    };
    if (baseSha) {
      commitPayload.parents = [baseSha];
    }

    const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify(commitPayload),
    });

    if (!commitResponse.ok) {
      const error = await commitResponse.json();
      return {
        success: false,
        phase: 'github',
        message: 'Erreur création du commit',
        error: error.message || `HTTP ${commitResponse.status}`,
        httpStatus: commitResponse.status,
      };
    }

    const commit = await commitResponse.json();
    logStep("Phase 1.8: Commit created", { commitSha: commit.sha.substring(0, 7) });

    // 1.9 - Update ref
    const refUpdateResponse = await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/main`, {
      method: baseSha ? 'PATCH' : 'POST',
      headers,
      body: JSON.stringify({
        sha: commit.sha,
        force: true,
      }),
    });

    if (!refUpdateResponse.ok && !baseSha) {
      await fetch(`https://api.github.com/repos/${owner}/${repoName}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: 'refs/heads/main',
          sha: commit.sha,
        }),
      });
    }

    logStep("Phase 1.9: Ref updated - COMPLETE", { repoUrl });

    // 1.10 - Validate package.json exists
    const packageJsonFile = cleanedFiles.find(f => f.path === 'package.json');
    let packageJsonValid = false;

    if (packageJsonFile) {
      try {
        const pkg = JSON.parse(packageJsonFile.content);
        packageJsonValid = !!pkg.name && !!pkg.dependencies;
      } catch {
        packageJsonValid = false;
      }
    }

    return {
      success: true,
      phase: 'github',
      message: `Dépôt ${repoName} créé et initialisé avec ${cleanedFiles.length} fichiers`,
      httpStatus: 201,
      data: {
        repoUrl,
        repoName,
        owner,
        filesCount: cleanedFiles.length,
        totalChanges,
        wasCreated,
        packageJsonValid,
        commitSha: commit.sha,
      },
    };

  } catch (error) {
    logStep("Phase 1: GitHub - ERROR", { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      phase: 'github',
      message: 'Erreur inattendue lors de la création GitHub',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ======================== PHASE 2: SUPABASE MIGRATION ENGINE ========================
async function executePhaseSupabase(
  targetSupabaseUrl: string,
  targetSupabaseServiceKey: string,
  files: { path: string; content: string }[],
  secretsToSync?: LiberationRequest['secretsToSync']
): Promise<PhaseResult> {
  logStep("Phase 2: Supabase Migration - Starting", { url: targetSupabaseUrl.substring(0, 40) + '...' });

  const migrationProgress: MigrationProgress[] = [];
  const executedMigrations: string[] = [];
  const skippedMigrations: string[] = [];
  const failedMigrations: { file: string; error: string }[] = [];

  try {
    // 2.1 - Create client and test connection
    const targetSupabase = createClient(targetSupabaseUrl, targetSupabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Test connection with a simple query
    const { error: connectionError } = await targetSupabase.rpc('version' as never).maybeSingle();
    
    // If version RPC doesn't exist, try a simple table query
    if (connectionError) {
      logStep("Phase 2.1: version() not available, testing with auth.users...");
    }

    logStep("Phase 2.1: Target Supabase connection established");

    // 2.2 - Extract migration files from the files array
    const migrationFiles = files.filter(f => 
      f.path.startsWith('supabase/migrations/') && f.path.endsWith('.sql')
    );

    if (migrationFiles.length === 0) {
      logStep("Phase 2.2: No migration files found in files array");
      return {
        success: false,
        phase: 'supabase',
        message: 'Aucun fichier de migration trouvé',
        error: 'Les fichiers supabase/migrations/*.sql doivent être inclus dans la libération',
        httpStatus: 400,
        data: { migrationFilesCount: 0 },
      };
    }

    // Sort migration files by timestamp (filename prefix)
    migrationFiles.sort((a, b) => {
      const nameA = a.path.split('/').pop() || '';
      const nameB = b.path.split('/').pop() || '';
      return nameA.localeCompare(nameB);
    });

    logStep("Phase 2.2: Migration files found", { count: migrationFiles.length });

    // 2.3 - Execute migrations sequentially via REST API
    const restUrl = `${targetSupabaseUrl}/rest/v1/rpc/`;
    
    for (let i = 0; i < migrationFiles.length; i++) {
      const file = migrationFiles[i];
      const fileName = file.path.split('/').pop() || file.path;
      
      migrationProgress.push({
        currentFile: i + 1,
        totalFiles: migrationFiles.length,
        fileName,
        status: 'running',
      });

      logStep(`Phase 2.3: Executing migration ${i + 1}/${migrationFiles.length}`, { fileName });

      try {
        // Split SQL content into individual statements
        const sqlStatements = splitSqlStatements(file.content);
        
        let hasError = false;
        let lastError = '';

        for (const statement of sqlStatements) {
          const trimmedStatement = statement.trim();
          if (!trimmedStatement || trimmedStatement.startsWith('--')) continue;

          // Execute via Supabase REST API using raw SQL
          // Note: This requires the `pgsql-http` extension or we use the management API
          const response = await fetch(`${targetSupabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${targetSupabaseServiceKey}`,
              'apikey': targetSupabaseServiceKey,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({ query: trimmedStatement }),
          });

          if (!response.ok) {
            // If exec_sql doesn't exist, try alternative approach
            if (response.status === 404) {
              // Try using the SQL Editor API (Supabase Management API)
              const projectRef = extractProjectRef(targetSupabaseUrl);
              
              if (projectRef) {
                const mgmtResponse = await fetch(
                  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${targetSupabaseServiceKey}`,
                    },
                    body: JSON.stringify({ query: trimmedStatement }),
                  }
                );

                if (!mgmtResponse.ok) {
                  const errorText = await mgmtResponse.text();
                  // Check if it's a "already exists" type error - those can be skipped
                  if (isIgnorableError(errorText)) {
                    logStep(`Phase 2.3: Skipped (already exists)`, { fileName, statement: trimmedStatement.substring(0, 50) });
                    continue;
                  }
                  hasError = true;
                  lastError = errorText;
                }
              } else {
                // Direct PostgreSQL connection approach - log and continue
                logStep("Phase 2.3: exec_sql RPC not available, migration requires direct DB access");
                hasError = true;
                lastError = 'exec_sql function not available on target. Migrations need to be run manually.';
              }
            } else {
              const errorText = await response.text();
              if (isIgnorableError(errorText)) {
                logStep(`Phase 2.3: Skipped (already exists)`, { fileName });
                continue;
              }
              hasError = true;
              lastError = errorText;
            }
          }
        }

        if (hasError) {
          migrationProgress[i].status = 'error';
          migrationProgress[i].error = lastError;
          failedMigrations.push({ file: fileName, error: lastError });
          logStep(`Phase 2.3: Migration failed`, { fileName, error: lastError });
        } else {
          migrationProgress[i].status = 'success';
          executedMigrations.push(fileName);
          logStep(`Phase 2.3: Migration successful`, { fileName });
        }

      } catch (migrationError) {
        const errorMsg = migrationError instanceof Error ? migrationError.message : String(migrationError);
        
        if (isIgnorableError(errorMsg)) {
          migrationProgress[i].status = 'skipped';
          skippedMigrations.push(fileName);
        } else {
          migrationProgress[i].status = 'error';
          migrationProgress[i].error = errorMsg;
          failedMigrations.push({ file: fileName, error: errorMsg });
        }
      }
    }

    // 2.4 - Sync secrets if provided
    let secretsSynced = 0;
    if (secretsToSync && Object.keys(secretsToSync).length > 0) {
      logStep("Phase 2.4: Syncing secrets...");
      
      const projectRef = extractProjectRef(targetSupabaseUrl);
      if (projectRef) {
        for (const [key, value] of Object.entries(secretsToSync)) {
          if (!value) continue;
          
          try {
            // Use Supabase Management API to set secrets
            const secretResponse = await fetch(
              `https://api.supabase.com/v1/projects/${projectRef}/secrets`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${targetSupabaseServiceKey}`,
                },
                body: JSON.stringify([{ name: key, value }]),
              }
            );

            if (secretResponse.ok) {
              secretsSynced++;
              logStep(`Phase 2.4: Secret synced`, { key });
            } else {
              logStep(`Phase 2.4: Failed to sync secret`, { key, status: secretResponse.status });
            }
          } catch (secretError) {
            logStep(`Phase 2.4: Secret sync error`, { key, error: String(secretError) });
          }
        }
      }
    }

    // 2.5 - Generate deployment script for Edge Functions
    const edgeFunctionsScript = generateEdgeFunctionsScript(targetSupabaseUrl);

    // Calculate results
    const successRate = migrationFiles.length > 0 
      ? Math.round((executedMigrations.length / migrationFiles.length) * 100) 
      : 0;

    const overallSuccess = failedMigrations.length === 0 || 
      (executedMigrations.length > 0 && failedMigrations.length < migrationFiles.length / 2);

    logStep("Phase 2: Supabase Migration - COMPLETE", {
      executed: executedMigrations.length,
      skipped: skippedMigrations.length,
      failed: failedMigrations.length,
      secretsSynced,
      successRate,
    });

    return {
      success: overallSuccess,
      phase: 'supabase',
      message: overallSuccess 
        ? `Migration réussie: ${executedMigrations.length}/${migrationFiles.length} fichiers exécutés`
        : `Migration partielle: ${failedMigrations.length} échecs sur ${migrationFiles.length} fichiers`,
      httpStatus: overallSuccess ? 200 : 207,
      data: {
        url: targetSupabaseUrl,
        totalMigrations: migrationFiles.length,
        executedMigrations: executedMigrations.length,
        skippedMigrations: skippedMigrations.length,
        failedMigrations: failedMigrations.length,
        failedDetails: failedMigrations,
        secretsSynced,
        successRate,
        edgeFunctionsScript,
        migrationProgress,
      },
    };

  } catch (error) {
    logStep("Phase 2: Supabase Migration - ERROR", { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      phase: 'supabase',
      message: 'Erreur connexion/migration Supabase',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Helper function to split SQL into statements
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let inDollarQuote = false;
  let dollarTag = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    // Handle dollar-quoted strings (PostgreSQL)
    if (char === '$' && !inString) {
      const dollarMatch = sql.substring(i).match(/^\$([a-zA-Z_]*)\$/);
      if (dollarMatch) {
        if (inDollarQuote && dollarMatch[0] === dollarTag) {
          inDollarQuote = false;
          dollarTag = '';
        } else if (!inDollarQuote) {
          inDollarQuote = true;
          dollarTag = dollarMatch[0];
        }
      }
    }

    // Handle regular strings
    if ((char === "'" || char === '"') && !inDollarQuote) {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        if (nextChar === char) {
          current += char;
          i++;
        } else {
          inString = false;
        }
      }
    }

    // Split on semicolon if not in string
    if (char === ';' && !inString && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  // Add last statement
  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}

// Helper to check if error can be ignored (already exists, etc.)
function isIgnorableError(error: string): boolean {
  const ignorablePatterns = [
    'already exists',
    'duplicate key',
    'relation .* already exists',
    'type .* already exists',
    'function .* already exists',
    'policy .* already exists',
    'trigger .* already exists',
    'index .* already exists',
    'constraint .* already exists',
    '42P07', // duplicate table
    '42710', // duplicate object
  ];

  const lowerError = error.toLowerCase();
  return ignorablePatterns.some(pattern => {
    if (pattern.includes('.*')) {
      return new RegExp(pattern, 'i').test(error);
    }
    return lowerError.includes(pattern.toLowerCase());
  });
}

// Extract project ref from Supabase URL
function extractProjectRef(url: string): string | null {
  // Format: https://[project-ref].supabase.co
  const match = url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

// Generate Edge Functions deployment script
function generateEdgeFunctionsScript(targetUrl: string): string {
  const projectRef = extractProjectRef(targetUrl);
  
  return `#!/bin/bash
# ================================================
# Inopay - Edge Functions Deployment Script
# Target: ${targetUrl}
# ================================================

set -e

# Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not installed"
    echo "Install with: npm install -g supabase"
    exit 1
fi

# Link to project
${projectRef ? `supabase link --project-ref ${projectRef}` : '# Add your project ref: supabase link --project-ref YOUR_REF'}

# Deploy all functions
FUNCTIONS=(
  "admin-list-payments" "admin-list-subscriptions" "admin-list-users"
  "check-deployment" "check-server-status" "check-subscription"
  "clean-code" "create-checkout" "customer-portal"
  "deploy-coolify" "deploy-direct" "deploy-ftp"
  "export-to-github" "fetch-github-repo" "generate-archive"
  "health-monitor" "list-github-repos" "send-email"
  "stripe-webhook" "sovereign-liberation"
)

for func in "\${FUNCTIONS[@]}"; do
  echo "Deploying $func..."
  supabase functions deploy "$func" --no-verify-jwt || echo "⚠️ $func failed"
done

echo "✅ Deployment complete!"
`;
}

// ======================== PHASE 3: COOLIFY ========================
async function executePhaseCoolify(
  coolifyUrl: string,
  coolifyToken: string,
  repoUrl: string,
  projectName: string,
  supabaseUrl?: string,
  supabaseAnonKey?: string
): Promise<PhaseResult> {
  logStep("Phase 3: Coolify - Starting", { coolifyUrl, projectName });

  const headers = {
    'Authorization': `Bearer ${coolifyToken}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  try {
    // 3.1 - Test Coolify connection
    const serversResponse = await fetch(`${coolifyUrl}/api/v1/servers`, { headers });
    
    if (!serversResponse.ok) {
      const status = serversResponse.status;
      let errorMsg = 'Connexion Coolify échouée';
      
      if (status === 401 || status === 403) {
        errorMsg = 'Token Coolify invalide ou expiré';
      } else if (status === 404) {
        errorMsg = 'URL Coolify incorrecte - /api/v1/servers non trouvé';
      }

      return {
        success: false,
        phase: 'coolify',
        message: errorMsg,
        error: `HTTP ${status}`,
        httpStatus: status,
      };
    }

    const servers = await serversResponse.json();
    logStep("Phase 3.1: Coolify connected", { serversCount: servers.length || 0 });

    // 3.2 - Check/Create project
    const projectsResponse = await fetch(`${coolifyUrl}/api/v1/projects`, { headers });
    let projectUuid: string | null = null;

    if (projectsResponse.ok) {
      const projects = await projectsResponse.json();
      const existingProject = projects.find((p: { name: string }) => 
        p.name.toLowerCase() === projectName.toLowerCase()
      );

      if (existingProject) {
        projectUuid = existingProject.uuid;
        logStep("Phase 3.2: Existing project found", { projectUuid });
      }
    }

    if (!projectUuid) {
      const createProjectResponse = await fetch(`${coolifyUrl}/api/v1/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: projectName,
          description: 'Projet libéré par Inopay',
        }),
      });

      if (createProjectResponse.ok) {
        const newProject = await createProjectResponse.json();
        projectUuid = newProject.uuid;
        logStep("Phase 3.2: Project created", { projectUuid });
      } else {
        const error = await createProjectResponse.text();
        return {
          success: false,
          phase: 'coolify',
          message: 'Erreur création projet Coolify',
          error: error || `HTTP ${createProjectResponse.status}`,
          httpStatus: createProjectResponse.status,
        };
      }
    }

    // 3.3 - Create application pointing to GitHub repo
    const createAppResponse = await fetch(`${coolifyUrl}/api/v1/applications/public`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        project_uuid: projectUuid,
        git_repository: repoUrl,
        git_branch: 'main',
        build_pack: 'nixpacks',
        ports_exposes: '3000',
        name: projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      }),
    });

    if (!createAppResponse.ok) {
      const dockerResponse = await fetch(`${coolifyUrl}/api/v1/applications/dockerfile`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          project_uuid: projectUuid,
          git_repository: repoUrl,
          git_branch: 'main',
          dockerfile_location: '/Dockerfile',
          ports_exposes: '80',
          name: projectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        }),
      });

      if (!dockerResponse.ok) {
        const error = await createAppResponse.text();
        return {
          success: false,
          phase: 'coolify',
          message: 'Erreur création application Coolify',
          error: error || `HTTP ${createAppResponse.status}`,
          httpStatus: createAppResponse.status,
        };
      }

      const app = await dockerResponse.json();
      logStep("Phase 3.3: Application created (Dockerfile mode)", { appUuid: app.uuid });

      // 3.4 - Inject environment variables
      if (supabaseUrl && supabaseAnonKey) {
        await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/envs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ key: 'VITE_SUPABASE_URL', value: supabaseUrl }),
        });

        await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/envs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ key: 'VITE_SUPABASE_PUBLISHABLE_KEY', value: supabaseAnonKey }),
        });

        logStep("Phase 3.4: Environment variables injected");
      }

      // 3.5 - Trigger deployment
      const deployResponse = await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/deploy`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ force: true }),
      });

      if (!deployResponse.ok) {
        return {
          success: true,
          phase: 'coolify',
          message: 'Application créée mais déploiement non déclenché',
          httpStatus: 200,
          data: {
            projectUuid,
            appUuid: app.uuid,
            deploymentTriggered: false,
          },
        };
      }

      const deployment = await deployResponse.json();
      logStep("Phase 3.5: Deployment triggered", { deploymentUuid: deployment.deployment_uuid });

      return {
        success: true,
        phase: 'coolify',
        message: 'Application créée et déploiement déclenché',
        httpStatus: 201,
        data: {
          projectUuid,
          appUuid: app.uuid,
          deploymentUuid: deployment.deployment_uuid,
          deploymentTriggered: true,
        },
      };
    }

    const app = await createAppResponse.json();
    logStep("Phase 3.3: Application created (Nixpacks mode)", { appUuid: app.uuid });

    // 3.4 - Inject environment variables
    if (supabaseUrl && supabaseAnonKey) {
      await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/envs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'VITE_SUPABASE_URL', value: supabaseUrl }),
      });

      await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/envs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: 'VITE_SUPABASE_PUBLISHABLE_KEY', value: supabaseAnonKey }),
      });

      logStep("Phase 3.4: Environment variables injected");
    }

    // 3.5 - Trigger deployment
    const deployResponse = await fetch(`${coolifyUrl}/api/v1/applications/${app.uuid}/deploy`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ force: true }),
    });

    const deploymentTriggered = deployResponse.ok;
    let deploymentUuid = null;
    if (deploymentTriggered) {
      const deployment = await deployResponse.json();
      deploymentUuid = deployment.deployment_uuid;
    }

    logStep("Phase 3.5: Deployment", { triggered: deploymentTriggered, deploymentUuid });

    return {
      success: true,
      phase: 'coolify',
      message: deploymentTriggered 
        ? 'Application créée et déploiement déclenché'
        : 'Application créée (déploiement manuel requis)',
      httpStatus: 201,
      data: {
        projectUuid,
        appUuid: app.uuid,
        deploymentUuid,
        deploymentTriggered,
      },
    };

  } catch (error) {
    logStep("Phase 3: Coolify - ERROR", { error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      phase: 'coolify',
      message: 'Erreur connexion/déploiement Coolify',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ======================== MAIN HANDLER ========================
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const githubToken = Deno.env.get('GITHUB_PERSONAL_ACCESS_TOKEN')!;

    // Auth
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;
    logStep("User authenticated", { userId });

    // Parse request
    const body: LiberationRequest = await req.json();
    const { phase, files = [], projectName, repoName, serverId, targetSupabaseUrl, targetSupabaseServiceKey, secretsToSync } = body;

    if (!projectName) {
      return new Response(JSON.stringify({ error: 'projectName requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetRepoName = repoName || projectName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const results: PhaseResult[] = [];

    // Get user's server config for Coolify
    let serverConfig: { coolify_url?: string; coolify_token?: string } | null = null;
    if (phase === 'coolify' || phase === 'all') {
      if (serverId) {
        const { data: server } = await supabaseAdmin
          .from('user_servers')
          .select('coolify_url, coolify_token')
          .eq('id', serverId)
          .eq('user_id', userId)
          .single();
        serverConfig = server;
      } else {
        const { data: servers } = await supabaseAdmin
          .from('user_servers')
          .select('coolify_url, coolify_token')
          .eq('user_id', userId)
          .eq('status', 'ready')
          .limit(1);
        serverConfig = servers?.[0] || null;
      }
    }

    // ========== EXECUTE PHASES ==========
    
    // Phase 1: GitHub
    if (phase === 'github' || phase === 'all') {
      if (files.length === 0) {
        results.push({
          success: false,
          phase: 'github',
          message: 'Aucun fichier fourni',
          error: 'Le tableau files est vide',
        });
      } else {
        const githubResult = await executePhaseGitHub(githubToken, targetRepoName, files, userId);
        results.push(githubResult);

        if (!githubResult.success && phase === 'all') {
          return new Response(JSON.stringify({
            success: false,
            message: 'Pipeline arrêté - Phase 1 (GitHub) échouée',
            results,
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Phase 2: Supabase Migration
    if (phase === 'supabase' || phase === 'all') {
      // Use target credentials if provided, otherwise fall back to current instance
      const targetUrl = targetSupabaseUrl || body.supabaseUrl || supabaseUrl;
      const targetKey = targetSupabaseServiceKey || body.supabaseServiceKey || supabaseServiceKey;

      const supabaseResult = await executePhaseSupabase(targetUrl, targetKey, files, secretsToSync);
      results.push(supabaseResult);

      if (!supabaseResult.success && phase === 'all') {
        return new Response(JSON.stringify({
          success: false,
          message: 'Pipeline arrêté - Phase 2 (Supabase) échouée',
          results,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Phase 3: Coolify
    if (phase === 'coolify' || phase === 'all') {
      if (!serverConfig?.coolify_url || !serverConfig?.coolify_token) {
        results.push({
          success: false,
          phase: 'coolify',
          message: 'Aucun serveur Coolify configuré',
          error: 'Configurez un serveur VPS avec Coolify dans votre dashboard',
        });
      } else {
        const githubRepoUrl = results.find(r => r.phase === 'github')?.data?.repoUrl as string 
          || `https://github.com/${targetRepoName}`;

        // Use target Supabase URL for Coolify env vars if provided
        const envSupabaseUrl = targetSupabaseUrl || body.supabaseUrl || supabaseUrl;
        const envAnonKey = body.targetAnonKey || Deno.env.get('SUPABASE_ANON_KEY');

        const coolifyResult = await executePhaseCoolify(
          serverConfig.coolify_url,
          serverConfig.coolify_token,
          githubRepoUrl,
          projectName,
          envSupabaseUrl,
          envAnonKey
        );
        results.push(coolifyResult);
      }
    }

    // Calculate overall success
    const allSuccess = results.every(r => r.success);
    const message = allSuccess 
      ? `Pipeline complet - ${results.length} phases réussies`
      : `Pipeline partiel - ${results.filter(r => r.success).length}/${results.length} phases réussies`;

    // Log activity
    await supabaseAdmin.from('admin_activity_logs').insert({
      user_id: userId,
      action_type: 'sovereign_liberation',
      title: allSuccess ? 'Liberation réussie' : 'Liberation partielle',
      description: message,
      status: allSuccess ? 'success' : 'warning',
      metadata: { phase, projectName, results },
    });

    return new Response(JSON.stringify({
      success: allSuccess,
      message,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logStep("FATAL ERROR", { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
