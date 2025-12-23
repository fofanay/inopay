import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Token estimation constants
const CHARS_PER_TOKEN = 4; // Average chars per token for code
const TOKENS_PER_FILE_OVERHEAD = 150; // System prompt + formatting overhead per file
const OUTPUT_TOKEN_RATIO = 1.2; // Output is usually 20% larger than input after cleaning

// Pricing (in cents per 1M tokens) - Claude Sonnet
const INPUT_PRICE_PER_1M = 300; // $3 per 1M input tokens
const OUTPUT_PRICE_PER_1M = 1500; // $15 per 1M output tokens

// Thresholds
const LARGE_PROJECT_FILES = 500;
const MAX_MARGIN_PERCENTAGE = 60; // Block if API cost > 60% of sale price
const SALE_PRICE_CENTS = 2900; // $29 base price

interface FileInfo {
  path: string;
  content?: string;
  lines: number;
  chars: number;
  needsCleaning: boolean;
}

interface EstimationResult {
  totalFiles: number;
  cleanableFiles: number;
  totalLines: number;
  totalChars: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostCents: number;
  salePriceCents: number;
  marginCents: number;
  marginPercentage: number;
  isLargeProject: boolean;
  requiresAdminApproval: boolean;
  files: FileInfo[];
  excludedPaths: string[];
}

const PROPRIETARY_PATTERNS = [
  '@lovable/',
  '@gptengineer/',
  '.bolt',
  'lovable-tagger',
  '@lovable-router',
  'gptengineer.app',
  'lovable.dev',
  'use-mobile.tsx',
  'use-toast.ts',
];

function needsCleaning(content: string): boolean {
  return PROPRIETARY_PATTERNS.some(pattern => content.includes(pattern));
}

function estimateTokens(chars: number, lines: number): { input: number; output: number } {
  const inputTokens = Math.ceil(chars / CHARS_PER_TOKEN) + TOKENS_PER_FILE_OVERHEAD;
  const outputTokens = Math.ceil(inputTokens * OUTPUT_TOKEN_RATIO);
  return { input: inputTokens, output: outputTokens };
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * INPUT_PRICE_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M;
  return Math.ceil(inputCost + outputCost);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: userData } = await supabaseClient.auth.getUser(token);
      userId = userData.user?.id || null;
    }

    const { files, projectName, excludedPaths = [] } = await req.json();

    if (!files || !Array.isArray(files)) {
      return new Response(
        JSON.stringify({ error: 'Files array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze each file
    const fileInfos: FileInfo[] = [];
    let totalLines = 0;
    let totalChars = 0;
    let cleanableFiles = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (const file of files) {
      // Skip excluded paths
      const isExcluded = excludedPaths.some((path: string) => 
        file.path.startsWith(path) || file.path.includes(path)
      );
      
      if (isExcluded) continue;

      // Skip non-code files
      const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.css', '.scss', '.html'];
      const hasCodeExtension = codeExtensions.some(ext => file.path.endsWith(ext));
      
      if (!hasCodeExtension) continue;

      const content = file.content || '';
      const lines = content.split('\n').length;
      const chars = content.length;
      const requiresCleaning = needsCleaning(content);

      totalLines += lines;
      totalChars += chars;

      if (requiresCleaning) {
        cleanableFiles++;
        const tokens = estimateTokens(chars, lines);
        totalInputTokens += tokens.input;
        totalOutputTokens += tokens.output;
      }

      fileInfos.push({
        path: file.path,
        lines,
        chars,
        needsCleaning: requiresCleaning,
      });
    }

    // Calculate costs
    const estimatedCostCents = calculateCost(totalInputTokens, totalOutputTokens);
    const marginCents = SALE_PRICE_CENTS - estimatedCostCents;
    const marginPercentage = ((marginCents / SALE_PRICE_CENTS) * 100);
    const isLargeProject = fileInfos.length > LARGE_PROJECT_FILES;
    const requiresAdminApproval = (estimatedCostCents / SALE_PRICE_CENTS) * 100 > MAX_MARGIN_PERCENTAGE;

    const result: EstimationResult = {
      totalFiles: fileInfos.length,
      cleanableFiles,
      totalLines,
      totalChars,
      estimatedInputTokens: totalInputTokens,
      estimatedOutputTokens: totalOutputTokens,
      estimatedCostCents,
      salePriceCents: SALE_PRICE_CENTS,
      marginCents,
      marginPercentage: parseFloat(marginPercentage.toFixed(2)),
      isLargeProject,
      requiresAdminApproval,
      files: fileInfos,
      excludedPaths,
    };

    // Store estimate if user is authenticated
    if (userId && projectName) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabaseAdmin.from('cleaning_estimates').insert({
        user_id: userId,
        project_name: projectName,
        total_files: fileInfos.length,
        total_lines: totalLines,
        estimated_tokens: totalInputTokens + totalOutputTokens,
        estimated_cost_cents: estimatedCostCents,
        sale_price_cents: SALE_PRICE_CENTS,
        margin_cents: marginCents,
        margin_percentage: marginPercentage,
        requires_admin_approval: requiresAdminApproval,
        excluded_paths: excludedPaths,
        status: requiresAdminApproval ? 'pending_approval' : 'approved',
      });
    }

    console.log(`[ESTIMATE] Project: ${projectName}, Files: ${fileInfos.length}, Cleanable: ${cleanableFiles}, Cost: ${estimatedCostCents}¢, Margin: ${marginPercentage.toFixed(1)}%`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in estimate-cleaning-cost:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
