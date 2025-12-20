import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GitHubFile {
  name: string;
  path: string;
  type: "file" | "dir";
  sha: string;
  size: number;
  download_url: string | null;
}

interface FileContent {
  path: string;
  content: string;
}

interface PlanLimits {
  maxFiles: number;
  maxRepos: number;
  delayMs: number;
}

// Plan limits configuration
const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { maxFiles: 100, maxRepos: 3, delayMs: 500 },
  pack: { maxFiles: 200, maxRepos: 10, delayMs: 300 },
  pro: { maxFiles: 500, maxRepos: 50, delayMs: 100 },
  enterprise: { maxFiles: 2000, maxRepos: -1, delayMs: 50 },
};

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

const logStep = (step: string, details?: any) => {
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

// Delay helper for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fetch with retry and exponential backoff
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      // Check for rate limit
      if (response.status === 403) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        
        logStep("Rate limit hit", { 
          remaining: rateLimitRemaining, 
          reset: rateLimitReset,
          attempt: attempt + 1 
        });
        
        // If we're rate limited, wait before retrying
        const waitTime = baseDelayMs * Math.pow(2, attempt);
        logStep(`Waiting ${waitTime}ms before retry`);
        await delay(waitTime);
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logStep(`Fetch attempt ${attempt + 1} failed`, { error: lastError.message });
      
      if (attempt < maxRetries - 1) {
        await delay(baseDelayMs * Math.pow(2, attempt));
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

// Recursively fetch all files from a directory
async function fetchDirectory(
  owner: string,
  repo: string,
  path: string,
  token: string,
  delayMs: number
): Promise<GitHubFile[]> {
  await delay(delayMs); // Rate limiting delay
  
  const response = await fetchWithRetry(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "FreedomCode-App",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 403) {
      logStep(`Rate limited on directory ${path}, returning empty`);
      return [];
    }
    throw new Error(`Failed to fetch directory ${path}: ${response.statusText}`);
  }

  return await response.json();
}

// Fetch file content
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string,
  delayMs: number
): Promise<string> {
  await delay(delayMs); // Rate limiting delay
  
  const response = await fetchWithRetry(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3.raw",
        "User-Agent": "FreedomCode-App",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch file ${path}: ${response.statusText}`);
  }

  return await response.text();
}

// Check if a file path matches priority patterns
function isPriorityFile(path: string): boolean {
  return PRIORITY_PATTERNS.some(pattern => pattern.test(path));
}

// Recursively collect all file paths (without fetching content yet)
async function collectAllFilePaths(
  owner: string,
  repo: string,
  path: string,
  token: string,
  delayMs: number,
  allPaths: GitHubFile[] = []
): Promise<GitHubFile[]> {
  try {
    const items = await fetchDirectory(owner, repo, path, token, delayMs);

    for (const item of items) {
      // Skip node_modules, .git, and other unnecessary directories
      if (
        item.name === "node_modules" ||
        item.name === ".git" ||
        item.name === "dist" ||
        item.name === "build" ||
        item.name === ".next" ||
        item.name === "coverage" ||
        item.name === ".cache" ||
        item.name === "__pycache__"
      ) {
        continue;
      }

      if (item.type === "dir") {
        await collectAllFilePaths(owner, repo, item.path, token, delayMs, allPaths);
      } else if (item.type === "file") {
        allPaths.push(item);
      }
    }
  } catch (error) {
    logStep(`Error collecting paths from ${path}`, { error: error instanceof Error ? error.message : String(error) });
  }

  return allPaths;
}

// Prioritize and limit files based on plan
function prioritizeAndLimitFiles(files: GitHubFile[], maxFiles: number): GitHubFile[] {
  // Separate priority and non-priority files
  const priorityFiles = files.filter(f => isPriorityFile(f.path));
  const otherFiles = files.filter(f => !isPriorityFile(f.path));
  
  // Sort priority files by importance (src > app > components > etc.)
  priorityFiles.sort((a, b) => {
    const aScore = PRIORITY_PATTERNS.findIndex(p => p.test(a.path));
    const bScore = PRIORITY_PATTERNS.findIndex(p => p.test(b.path));
    return aScore - bScore;
  });
  
  // Combine and limit
  const combined = [...priorityFiles, ...otherFiles];
  
  if (maxFiles > 0 && combined.length > maxFiles) {
    logStep(`Limiting files from ${combined.length} to ${maxFiles}`);
    return combined.slice(0, maxFiles);
  }
  
  return combined;
}

// Fetch content for selected files with error handling
async function fetchFilesContent(
  owner: string,
  repo: string,
  files: GitHubFile[],
  token: string,
  delayMs: number
): Promise<{ files: FileContent[]; errors: string[]; rateLimited: boolean }> {
  const result: FileContent[] = [];
  const errors: string[] = [];
  let rateLimited = false;

  // Text file extensions
  const textExtensions = [
    ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".scss", ".less",
    ".html", ".htm", ".md", ".mdx", ".txt", ".yml", ".yaml", ".toml",
    ".env", ".env.example", ".gitignore", ".prettierrc", ".eslintrc",
    ".babelrc", "Dockerfile", "Makefile", ".sh", ".bash", ".zsh",
    ".svg", ".xml"
  ];
  
  const commonTextFiles = [
    "package.json", "tsconfig.json", "vite.config.ts", "tailwind.config.ts",
    "postcss.config.js", "README", "LICENSE", "Dockerfile", "Makefile",
    ".gitignore", ".prettierrc", ".eslintrc"
  ];

  for (const file of files) {
    // Check if it's a text file
    const hasTextExtension = textExtensions.some(
      ext => file.name.endsWith(ext) || file.name === ext.slice(1)
    );
    const isCommonTextFile = commonTextFiles.some(
      name => file.name === name || file.name.includes(name)
    );

    if ((hasTextExtension || isCommonTextFile) && file.size < 500000) {
      try {
        const content = await fetchFileContent(owner, repo, file.path, token, delayMs);
        result.push({ path: file.path, content });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        
        if (errorMsg.includes('403') || errorMsg.includes('rate limit')) {
          logStep(`Rate limited while fetching ${file.path}`, { filesCollected: result.length });
          rateLimited = true;
          // Stop fetching more files when rate limited
          break;
        }
        
        errors.push(`${file.path}: ${errorMsg}`);
        logStep(`Error fetching file ${file.path}`, { error: errorMsg });
      }
    }
  }

  return { files: result, errors, rateLimited };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GITHUB_TOKEN = Deno.env.get("GITHUB_PERSONAL_ACCESS_TOKEN");
    if (!GITHUB_TOKEN) {
      return new Response(
        JSON.stringify({ error: "GitHub token not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: "GitHub URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = parseGitHubUrl(url);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "Invalid GitHub URL format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep(`Fetching repository: ${parsed.owner}/${parsed.repo}`);

    // Verify repo exists and is accessible
    const repoResponse = await fetchWithRetry(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "FreedomCode-App",
        },
      }
    );

    if (!repoResponse.ok) {
      const errorData = await repoResponse.json();
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

    // Step 1: Collect all file paths
    logStep("Collecting file paths...");
    const allFilePaths = await collectAllFilePaths(
      parsed.owner, 
      parsed.repo, 
      "", 
      GITHUB_TOKEN, 
      limits.delayMs
    );
    logStep(`Found ${allFilePaths.length} total files`);

    // Step 2: Prioritize and limit files based on plan
    const selectedFiles = prioritizeAndLimitFiles(allFilePaths, limits.maxFiles);
    logStep(`Selected ${selectedFiles.length} files for analysis (max: ${limits.maxFiles})`);

    // Step 3: Fetch content for selected files
    const { files, errors, rateLimited } = await fetchFilesContent(
      parsed.owner,
      parsed.repo,
      selectedFiles,
      GITHUB_TOKEN,
      limits.delayMs
    );

    logStep(`Fetched ${files.length} files`, { 
      errors: errors.length, 
      rateLimited,
      totalAvailable: allFilePaths.length 
    });

    // Build response with partial analysis info
    const responseData = {
      success: true,
      repository: {
        name: repoInfo.name,
        fullName: repoInfo.full_name,
        description: repoInfo.description,
        defaultBranch: repoInfo.default_branch,
      },
      files,
      fileCount: files.length,
      totalFilesInRepo: allFilePaths.length,
      isPartialAnalysis: files.length < allFilePaths.length,
      partialReason: rateLimited ? "rate_limited" : (files.length < allFilePaths.length ? "plan_limit" : null),
      planType,
      planLimit: limits.maxFiles,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined, // Only return first 5 errors
    };

    if (responseData.isPartialAnalysis) {
      logStep("Returning partial analysis", { 
        fetched: files.length, 
        total: allFilePaths.length,
        reason: responseData.partialReason 
      });
    }

    return new Response(
      JSON.stringify(responseData),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch repository";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
