import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BlobReader, ZipReader, TextWriter } from "https://deno.land/x/zipjs@v2.7.45/index.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FileContent {
  path: string;
  content: string;
}

interface PlanLimits {
  maxFiles: number;
  maxRepos: number;
}

// Plan limits configuration
const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { maxFiles: 100, maxRepos: 3 },
  pack: { maxFiles: 200, maxRepos: 10 },
  pro: { maxFiles: 500, maxRepos: 50 },
  enterprise: { maxFiles: 2000, maxRepos: -1 },
};

// Maximum repository size in KB (100MB)
const MAX_REPO_SIZE_KB = 100 * 1024;
// Warning threshold in KB (50MB)
const WARN_REPO_SIZE_KB = 50 * 1024;
// Timeout in milliseconds (50 seconds to leave margin for Edge Function limit)
const OPERATION_TIMEOUT_MS = 50000;

// Priority file patterns (these are always included first)
const PRIORITY_PATTERNS = [
  /^package\.json$/,
  /^tsconfig\.json$/,
  /^vite\.config\.(ts|js)$/,
  /^tailwind\.config\.(ts|js)$/,
  /^next\.config\.(js|mjs|ts)$/,
  /^src\/.*\.(tsx?|jsx?)$/,
  /^app\/.*\.(tsx?|jsx?)$/,
  /^pages\/.*\.(tsx?|jsx?)$/,
  /^components\/.*\.(tsx?|jsx?)$/,
  /^lib\/.*\.(tsx?|jsx?)$/,
  /^hooks\/.*\.(tsx?|jsx?)$/,
  /^supabase\/.*$/,
];

// Directories to skip
const SKIP_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
  ".cache",
  "__pycache__",
  ".turbo",
  ".vercel",
];

// Text file extensions
const TEXT_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".scss", ".less",
  ".html", ".htm", ".md", ".mdx", ".txt", ".yml", ".yaml", ".toml",
  ".env", ".gitignore", ".prettierrc", ".eslintrc",
  ".babelrc", ".sh", ".bash", ".zsh", ".svg", ".xml"
];

const COMMON_TEXT_FILES = [
  "package.json", "tsconfig.json", "vite.config.ts", "tailwind.config.ts",
  "postcss.config.js", "README", "LICENSE", "Dockerfile", "Makefile",
  ".gitignore", ".prettierrc", ".eslintrc"
];

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FETCH-GITHUB-REPO] ${step}${detailsStr}`);
};

// Parse GitHub URL to extract owner and repo
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/|$)/,
    /^([^\/]+)\/([^\/]+)$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
    }
  }
  return null;
}

// Check if a file path matches priority patterns
function isPriorityFile(path: string): boolean {
  return PRIORITY_PATTERNS.some(pattern => pattern.test(path));
}

// Check if file should be skipped based on directory
function shouldSkipPath(path: string): boolean {
  const parts = path.split('/');
  return parts.some(part => SKIP_DIRS.includes(part));
}

// Check if file is a text file we want to analyze
function isTextFile(filename: string): boolean {
  const hasTextExtension = TEXT_EXTENSIONS.some(
    ext => filename.endsWith(ext) || filename === ext.slice(1)
  );
  const isCommonTextFile = COMMON_TEXT_FILES.some(
    name => filename === name || filename.includes(name)
  );
  return hasTextExtension || isCommonTextFile;
}

// Create a timeout promise
function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`TIMEOUT: L'opération a dépassé ${Math.round(ms / 1000)} secondes. Le dépôt est peut-être trop volumineux.`));
    }, ms);
  });
}

// Download repo as zipball and extract files using zip.js (Deno compatible)
async function downloadAndExtractRepo(
  owner: string,
  repo: string,
  token: string,
  maxFiles: number,
  abortSignal?: AbortSignal
): Promise<{ files: FileContent[]; totalFiles: number; rateLimited: boolean }> {
  logStep("Starting zipball download...");
  
  // 1. Download zipball with abort signal
  const zipResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/zipball`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "FreedomCode-App",
      },
      signal: abortSignal,
    }
  );

  if (!zipResponse.ok) {
    if (zipResponse.status === 403) {
      const rateLimitRemaining = zipResponse.headers.get('X-RateLimit-Remaining');
      logStep("Rate limited", { remaining: rateLimitRemaining });
      return { files: [], totalFiles: 0, rateLimited: true };
    }
    throw new Error(`Failed to download repository: ${zipResponse.statusText}`);
  }

  const contentLength = zipResponse.headers.get('content-length');
  logStep("Zipball downloaded successfully", { size: contentLength });

  // 2. Create a ZipReader from the blob
  let zipReader: ZipReader<Blob> | null = null;
  
  try {
    const zipBlob = await zipResponse.blob();
    logStep("Blob created", { size: zipBlob.size });
    
    // Check blob size (rough estimate)
    const blobSizeKB = zipBlob.size / 1024;
    if (blobSizeKB > MAX_REPO_SIZE_KB) {
      throw new Error(`TAILLE_EXCESSIVE: Le dépôt compressé fait ${Math.round(blobSizeKB / 1024)}MB, ce qui dépasse la limite de ${MAX_REPO_SIZE_KB / 1024}MB.`);
    }
    
    zipReader = new ZipReader(new BlobReader(zipBlob));
    logStep("ZipReader created, extracting entries...");
    
    // 3. Get all entries
    const entries = await zipReader.getEntries();
    logStep("Entries retrieved", { count: entries.length });

    // 4. Filter text files to analyze
    const textEntries: Array<{ entry: typeof entries[0]; cleanPath: string }> = [];
    
    for (const entry of entries) {
      if (entry.directory) continue;
      
      // Remove the root folder prefix (e.g., "owner-repo-sha/")
      const pathParts = entry.filename.split('/');
      const cleanPath = pathParts.slice(1).join('/');
      
      if (cleanPath && !shouldSkipPath(cleanPath) && isTextFile(cleanPath)) {
        textEntries.push({ entry, cleanPath });
      }
    }

    logStep("Text files filtered", { count: textEntries.length });

    // 5. Sort by priority
    textEntries.sort((a, b) => {
      const aIsPriority = isPriorityFile(a.cleanPath);
      const bIsPriority = isPriorityFile(b.cleanPath);
      if (aIsPriority && !bIsPriority) return -1;
      if (!aIsPriority && bIsPriority) return 1;
      
      // Within priority files, sort by pattern order
      if (aIsPriority && bIsPriority) {
        const aScore = PRIORITY_PATTERNS.findIndex(p => p.test(a.cleanPath));
        const bScore = PRIORITY_PATTERNS.findIndex(p => p.test(b.cleanPath));
        return aScore - bScore;
      }
      
      return 0;
    });

    // 6. Limit files based on plan
    const totalFiles = textEntries.length;
    const limitedEntries = maxFiles > 0 
      ? textEntries.slice(0, maxFiles) 
      : textEntries;

    logStep("Files selected for extraction", { 
      selected: limitedEntries.length, 
      total: totalFiles,
      limit: maxFiles 
    });

    // 7. Extract text content from each file in batches
    const files: FileContent[] = [];
    const BATCH_SIZE = 50; // Process 50 files at a time
    
    for (let i = 0; i < limitedEntries.length; i += BATCH_SIZE) {
      const batch = limitedEntries.slice(i, i + BATCH_SIZE);
      logStep(`Extracting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(limitedEntries.length / BATCH_SIZE)}`, {
        from: i,
        to: Math.min(i + BATCH_SIZE, limitedEntries.length)
      });
      
      for (const { entry, cleanPath } of batch) {
        try {
          if (!entry.getData) {
            logStep("Entry has no getData method", { path: cleanPath });
            continue;
          }
          
          const writer = new TextWriter();
          const content = await entry.getData(writer);
          
          // Skip very large files (> 300KB for faster processing)
          if (content && content.length < 300000) {
            files.push({ path: cleanPath, content });
          } else if (content && content.length >= 300000) {
            logStep("File too large, skipping", { path: cleanPath, size: content.length });
          }
        } catch (extractError) {
          logStep("Error extracting file content", { 
            path: cleanPath, 
            error: extractError instanceof Error ? extractError.message : String(extractError) 
          });
        }
      }
    }

    logStep("Extraction complete", { extracted: files.length });
    
    return { files, totalFiles, rateLimited: false };
    
  } catch (error) {
    logStep("Critical error during extraction", { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  } finally {
    // 8. Close the reader
    if (zipReader) {
      try {
        await zipReader.close();
        logStep("ZipReader closed");
      } catch (closeError) {
        logStep("Error closing ZipReader", { 
          error: closeError instanceof Error ? closeError.message : String(closeError) 
        });
      }
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Verify user authentication
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's plan limits from subscription
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan_type, status, credits_remaining")
      .eq("user_id", user.id)
      .maybeSingle();

    let planType = "free";
    if (subscription) {
      if (subscription.plan_type === "pro" && subscription.status === "active") {
        planType = "pro";
      } else if (subscription.credits_remaining && subscription.credits_remaining >= 999999) {
        // Tester with unlimited credits = enterprise
        planType = "enterprise";
      } else if (subscription.plan_type === "pack" || (subscription.credits_remaining && subscription.credits_remaining > 0)) {
        planType = "pack";
      }
    }

    const limits = PLAN_LIMITS[planType] || PLAN_LIMITS.free;
    logStep("User plan detected", { userId: user.id, planType, limits });

    // Parse request body to get URL and optional user GitHub token
    const requestBody = await req.json();
    const { url, github_token } = requestBody;

    if (!url) {
      return new Response(
        JSON.stringify({ error: "GitHub URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prioritize user's GitHub token, fallback to server token
    const serverToken = Deno.env.get("GITHUB_PERSONAL_ACCESS_TOKEN");
    const GITHUB_TOKEN = github_token || serverToken;
    const usingUserToken = !!github_token;

    if (!GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ error: "GitHub token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Token configuration", { usingUserToken, hasServerToken: !!serverToken });

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "Invalid GitHub URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Fetching repository", { owner: parsed.owner, repo: parsed.repo });

    // Verify repo exists and get info
    const repoResponse = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Inopay-FreedomCode-App",
        },
      }
    );

    if (!repoResponse.ok) {
      const errorData = await repoResponse.json();
      
      // Check if token is expired
      if (repoResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: "Votre connexion GitHub a expiré. Veuillez vous reconnecter.",
            tokenExpired: true
          }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: repoResponse.status === 404 
            ? "Repository not found or not accessible" 
            : `GitHub API error: ${errorData.message}` 
        }),
        { status: repoResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const repoInfo = await repoResponse.json();
    logStep("Repository info retrieved", { name: repoInfo.name, size: repoInfo.size, private: repoInfo.private, usingUserToken });

    // SECURITY: Only allow private repositories if user is using their own token
    // If using server token, only public repos are allowed
    if (repoInfo.private === true && !usingUserToken) {
      logStep("Access denied - private repository with server token", { repo: repoInfo.full_name });
      return new Response(
        JSON.stringify({ 
          error: "Ce dépôt est privé. Veuillez vous connecter avec GitHub pour analyser vos dépôts privés.",
          isPrivate: true,
          needsGitHubAuth: true
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If private repo with user token, log it
    if (repoInfo.private === true && usingUserToken) {
      logStep("Accessing private repository with user token", { repo: repoInfo.full_name });
    }

    // Check repository size BEFORE downloading
    const repoSizeKB = repoInfo.size || 0;
    logStep("Repository size check", { sizeKB: repoSizeKB, maxKB: MAX_REPO_SIZE_KB, warnKB: WARN_REPO_SIZE_KB });

    if (repoSizeKB > MAX_REPO_SIZE_KB) {
      logStep("Repository too large", { sizeKB: repoSizeKB, maxKB: MAX_REPO_SIZE_KB });
      return new Response(
        JSON.stringify({ 
          error: `TAILLE_EXCESSIVE: Ce dépôt fait ${Math.round(repoSizeKB / 1024)}MB, ce qui dépasse la limite de ${MAX_REPO_SIZE_KB / 1024}MB. Essayez avec un dépôt plus petit.`,
          repoTooLarge: true,
          repoSize: repoSizeKB,
          maxSize: MAX_REPO_SIZE_KB
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create abort controller for timeout
    const abortController = new AbortController();
    
    // Download and extract repository using zipball API with zip.js
    // Use Promise.race to implement timeout
    let result: { files: FileContent[]; totalFiles: number; rateLimited: boolean };
    
    try {
      result = await Promise.race([
        downloadAndExtractRepo(
          parsed.owner,
          parsed.repo,
          GITHUB_TOKEN,
          limits.maxFiles,
          abortController.signal
        ),
        createTimeout(OPERATION_TIMEOUT_MS)
      ]);
    } catch (timeoutError) {
      abortController.abort();
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      logStep("Operation timed out", { elapsedSeconds });
      
      const errorMessage = timeoutError instanceof Error ? timeoutError.message : "Timeout";
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          timeout: true,
          elapsedSeconds
        }),
        { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { files, totalFiles, rateLimited } = result;

    if (rateLimited) {
      return new Response(
        JSON.stringify({ 
          error: "GitHub API rate limit reached. Please try again later.",
          rateLimited: true
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    logStep("Analysis complete", { 
      fetched: files.length, 
      total: totalFiles,
      planType,
      elapsedSeconds
    });

    // Build response
    const responseData = {
      success: true,
      repository: {
        name: repoInfo.name,
        fullName: repoInfo.full_name,
        description: repoInfo.description,
        defaultBranch: repoInfo.default_branch,
        size: repoSizeKB,
      },
      files,
      fileCount: files.length,
      totalFilesInRepo: totalFiles,
      isPartialAnalysis: files.length < totalFiles,
      partialReason: files.length < totalFiles ? "plan_limit" : null,
      planType,
      planLimit: limits.maxFiles,
      elapsedSeconds,
    };

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    console.error("Error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch repository";
    
    // Determine error type for client
    let errorType = "unknown";
    if (errorMessage.includes("TIMEOUT")) {
      errorType = "timeout";
    } else if (errorMessage.includes("TAILLE_EXCESSIVE")) {
      errorType = "too_large";
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        errorType,
        elapsedSeconds
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
