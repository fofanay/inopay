import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

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

// Prioritize and limit files based on plan
function prioritizeAndLimitFiles(files: string[], maxFiles: number): string[] {
  // Separate priority and non-priority files
  const priorityFiles = files.filter(f => isPriorityFile(f));
  const otherFiles = files.filter(f => !isPriorityFile(f));
  
  // Sort priority files by importance
  priorityFiles.sort((a, b) => {
    const aScore = PRIORITY_PATTERNS.findIndex(p => p.test(a));
    const bScore = PRIORITY_PATTERNS.findIndex(p => p.test(b));
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

// Download repo as zipball and extract files
async function downloadAndExtractRepo(
  owner: string,
  repo: string,
  token: string,
  maxFiles: number
): Promise<{ files: FileContent[]; totalFiles: number; rateLimited: boolean }> {
  logStep("Downloading repository as zipball...");
  
  // Download zipball (single API request!)
  const zipResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/zipball`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "FreedomCode-App",
      },
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

  logStep("Zipball downloaded, extracting...");
  
  const zipBuffer = await zipResponse.arrayBuffer();
  const zip = new JSZip();
  await zip.loadAsync(zipBuffer);

  // Collect all file paths
  const allFilePaths: string[] = [];
  
  zip.forEach((relativePath, file) => {
    if (!file.dir) {
      // Remove the root folder prefix (e.g., "owner-repo-sha/")
      const pathParts = relativePath.split('/');
      const cleanPath = pathParts.slice(1).join('/');
      
      if (cleanPath && !shouldSkipPath(cleanPath) && isTextFile(cleanPath)) {
        allFilePaths.push(cleanPath);
      }
    }
  });

  logStep(`Found ${allFilePaths.length} text files in repository`);

  // Prioritize and limit files
  const selectedPaths = prioritizeAndLimitFiles(allFilePaths, maxFiles);
  logStep(`Selected ${selectedPaths.length} files for analysis`);

  // Extract content for selected files
  const files: FileContent[] = [];
  
  for (const cleanPath of selectedPaths) {
    // Find the file in the zip (need to add back the root folder)
    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (file.dir) continue;
      
      const pathParts = relativePath.split('/');
      const currentCleanPath = pathParts.slice(1).join('/');
      
      if (currentCleanPath === cleanPath) {
        try {
          const content = await file.async('string');
          // Skip very large files (> 500KB)
          if (content.length < 500000) {
            files.push({ path: cleanPath, content });
          }
        } catch (e) {
          logStep(`Error extracting ${cleanPath}`, { error: e instanceof Error ? e.message : String(e) });
        }
        break;
      }
    }
  }

  logStep(`Successfully extracted ${files.length} files`);
  
  return { files, totalFiles: allFilePaths.length, rateLimited: false };
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

    // Verify repo exists and get info
    const repoResponse = await fetch(
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

    // Download and extract repository using zipball API (single request!)
    const { files, totalFiles, rateLimited } = await downloadAndExtractRepo(
      parsed.owner,
      parsed.repo,
      GITHUB_TOKEN,
      limits.maxFiles
    );

    if (rateLimited) {
      return new Response(
        JSON.stringify({ 
          error: "GitHub API rate limit reached. Please try again later.",
          rateLimited: true
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep(`Analysis complete`, { 
      fetched: files.length, 
      total: totalFiles,
      planType 
    });

    // Build response
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
      totalFilesInRepo: totalFiles,
      isPartialAnalysis: files.length < totalFiles,
      partialReason: files.length < totalFiles ? "plan_limit" : null,
      planType,
      planLimit: limits.maxFiles,
    };

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
