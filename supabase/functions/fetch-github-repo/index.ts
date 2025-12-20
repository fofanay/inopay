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

// Recursively fetch all files from a directory
async function fetchDirectory(
  owner: string,
  repo: string,
  path: string,
  token: string
): Promise<GitHubFile[]> {
  const response = await fetch(
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
    throw new Error(`Failed to fetch directory ${path}: ${response.statusText}`);
  }

  return await response.json();
}

// Fetch file content
async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token: string
): Promise<string> {
  const response = await fetch(
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

// Recursively get all files from repo
async function getAllFiles(
  owner: string,
  repo: string,
  path: string,
  token: string,
  allFiles: FileContent[] = []
): Promise<FileContent[]> {
  const items = await fetchDirectory(owner, repo, path, token);

  for (const item of items) {
    // Skip node_modules, .git, and other unnecessary directories
    if (
      item.name === "node_modules" ||
      item.name === ".git" ||
      item.name === "dist" ||
      item.name === "build" ||
      item.name === ".next" ||
      item.name === "coverage"
    ) {
      continue;
    }

    if (item.type === "dir") {
      await getAllFiles(owner, repo, item.path, token, allFiles);
    } else if (item.type === "file") {
      // Only fetch text files (skip binaries, images, etc.)
      const textExtensions = [
        ".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".scss", ".less",
        ".html", ".htm", ".md", ".mdx", ".txt", ".yml", ".yaml", ".toml",
        ".env", ".env.example", ".gitignore", ".prettierrc", ".eslintrc",
        ".babelrc", "Dockerfile", "Makefile", ".sh", ".bash", ".zsh",
        ".svg", ".xml"
      ];
      
      const hasTextExtension = textExtensions.some(
        ext => item.name.endsWith(ext) || item.name === ext.slice(1)
      );
      
      // Also check for files without extensions that are commonly text
      const commonTextFiles = [
        "package.json", "tsconfig.json", "vite.config.ts", "tailwind.config.ts",
        "postcss.config.js", "README", "LICENSE", "Dockerfile", "Makefile",
        ".gitignore", ".prettierrc", ".eslintrc"
      ];
      
      const isCommonTextFile = commonTextFiles.some(
        name => item.name === name || item.name.includes(name)
      );

      if ((hasTextExtension || isCommonTextFile) && item.size < 500000) {
        try {
          const content = await fetchFileContent(owner, repo, item.path, token);
          allFiles.push({ path: item.path, content });
        } catch (error) {
          console.error(`Error fetching ${item.path}:`, error);
        }
      }
    }
  }

  return allFiles;
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

    console.log(`Fetching repository: ${parsed.owner}/${parsed.repo}`);

    // Verify repo exists and is accessible
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

    // Fetch all files from the repository
    console.log("Fetching repository files...");
    const files = await getAllFiles(parsed.owner, parsed.repo, "", GITHUB_TOKEN);

    console.log(`Fetched ${files.length} files`);

    return new Response(
      JSON.stringify({
        success: true,
        repository: {
          name: repoInfo.name,
          fullName: repoInfo.full_name,
          description: repoInfo.description,
          defaultBranch: repoInfo.default_branch,
        },
        files,
        fileCount: files.length,
      }),
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
