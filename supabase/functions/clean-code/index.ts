// @inopay-core-protected
// INOPAY CLEANING ENGINE - Core liberation function
// This file MUST NOT be cleaned or removed during self-liberation
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rate-limiter.ts";
import { needsCleaning, SECURITY_LIMITS } from "../_shared/proprietary-patterns.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Tu es un expert DevOps et architecte cloud. Réécris ce code pour supprimer toute dépendance propriétaire Lovable ET optimiser les coûts en remplaçant les services cloud payants par des alternatives Open Source auto-hébergées.

## RÈGLES DE NETTOYAGE PROPRIÉTAIRE:
- Remplace @lovable/ et @gptengineer/ imports par des alternatives open-source
- Remplace use-mobile par un hook personnalisé utilisant window.matchMedia
- Remplace use-toast par react-hot-toast ou sonner
- Supprime les fichiers de configuration .lovable, .gptengineer
- Garde les alias @/ mais documente comment les configurer dans vite.config.ts

## RÈGLES D'OPTIMISATION DES COÛTS (Services Cloud → Open Source):
1. **OpenAI → Ollama**:
   - Remplace "import OpenAI from 'openai'" par un client HTTP vers Ollama
   - Remplace les appels openai.chat.completions.create par fetch vers http://OLLAMA_URL/api/chat
   - Utilise la variable d'environnement OLLAMA_BASE_URL

2. **Pinecone → PGVector**:
   - Remplace "@pinecone-database/pinecone" par "pg" avec requêtes SQL pgvector
   - Adapte les requêtes de similarité: SELECT * FROM items ORDER BY embedding <=> $1 LIMIT 10

3. **Clerk → Supabase Auth**:
   - Remplace "@clerk/react" par "@supabase/supabase-js"
   - useUser() → supabase.auth.getUser()
   - SignIn/SignUp → composants personnalisés avec supabase.auth.signInWithPassword

4. **Auth0 → PocketBase ou Supabase Auth**:
   - Remplace "@auth0/auth0-react" par le SDK PocketBase ou Supabase
   - useAuth0() → pb.authStore ou supabase.auth

5. **Algolia → Meilisearch**:
   - Remplace "algoliasearch" par "meilisearch"
   - L'API est très similaire, adapter le client: new MeiliSearch({ host: MEILISEARCH_URL })

6. **Pusher → Soketi**:
   - Garde "pusher-js" mais change les options de connexion
   - { wsHost: 'soketi', wsPort: 6001, forceTLS: false }

7. **SendGrid/Resend → Nodemailer SMTP**:
   - Remplace les SDK email par nodemailer avec config SMTP
   - transporter.sendMail({ from, to, subject, html })

8. **Cloudinary → MinIO + Sharp**:
   - Remplace les uploads Cloudinary par AWS SDK S3 pointant vers MinIO
   - Utilise Sharp pour les transformations d'images côté serveur

## RÈGLES GÉNÉRALES:
- Conserve la structure et la logique du code original
- Ajoute des commentaires // INOPAY: expliquant les changements de services
- Utilise des variables d'environnement pour les URLs des services self-hosted
- Retourne UNIQUEMENT le code nettoyé et optimisé, sans explication`;

// Simple hash function for cache key
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

// Provider configurations
const PROVIDERS = {
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
    name: 'DeepSeek'
  },
  openrouter_deepseek: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-chat',
    name: 'OpenRouter (DeepSeek)'
  },
  anthropic: {
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4'
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    name: 'OpenAI GPT-4o'
  }
};

// Call DeepSeek API (direct or via OpenRouter)
async function callDeepSeek(apiKey: string, code: string, fileName: string, useOpenRouter = false): Promise<{ cleanedCode: string; tokensUsed: number }> {
  const config = useOpenRouter ? PROVIDERS.openrouter_deepseek : PROVIDERS.deepseek;
  
  console.log(`[CLEAN-CODE] Calling ${config.name}...`);
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  
  if (useOpenRouter) {
    headers['HTTP-Referer'] = 'https://getinopay.com';
    headers['X-Title'] = 'Inopay Code Cleaner';
  }
  
  const response = await fetch(config.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Fichier: ${fileName || 'code.tsx'}\n\n\`\`\`tsx\n${code}\n\`\`\`` }
      ],
      max_tokens: 8192,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[CLEAN-CODE] ${config.name} error:`, response.status, errorText);
    throw new Error(`${config.name} API error: ${response.status}`);
  }

  const data = await response.json();
  const cleanedCode = data.choices[0].message.content;
  const tokensUsed = data.usage?.total_tokens || 0;
  
  console.log(`[CLEAN-CODE] ${config.name} success, tokens: ${tokensUsed}`);
  
  return { cleanedCode, tokensUsed };
}

// Call Anthropic API (fallback)
async function callAnthropic(apiKey: string, code: string, fileName: string): Promise<{ cleanedCode: string; tokensUsed: number }> {
  console.log('[CLEAN-CODE] Calling Claude Sonnet (fallback)...');
  
  const response = await fetch(PROVIDERS.anthropic.url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PROVIDERS.anthropic.model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Fichier: ${fileName || 'code.tsx'}\n\n\`\`\`tsx\n${code}\n\`\`\`` }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[CLEAN-CODE] Anthropic API error:', response.status, errorText);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  const cleanedCode = data.content[0].text;
  const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
  
  console.log('[CLEAN-CODE] Claude success, tokens:', tokensUsed);
  
  return { cleanedCode, tokensUsed };
}

// Call OpenAI API (for BYOK users)
async function callOpenAI(apiKey: string, code: string, fileName: string): Promise<{ cleanedCode: string; tokensUsed: number }> {
  console.log('[CLEAN-CODE] Calling OpenAI (user key)...');
  
  const response = await fetch(PROVIDERS.openai.url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: PROVIDERS.openai.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Fichier: ${fileName || 'code.tsx'}\n\n\`\`\`tsx\n${code}\n\`\`\`` }
      ],
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[CLEAN-CODE] OpenAI API error:', response.status, errorText);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const cleanedCode = data.choices[0].message.content;
  const tokensUsed = data.usage?.total_tokens || 0;
  
  console.log('[CLEAN-CODE] OpenAI success, tokens:', tokensUsed);
  
  return { cleanedCode, tokensUsed };
}

// Notify admin of fallback usage
async function notifyAdminFallback(supabaseAdmin: any, reason: string, details: string) {
  try {
    await supabaseAdmin.from('admin_activity_logs').insert({
      action_type: 'ai_fallback',
      title: 'DeepSeek → Claude Fallback',
      description: reason,
      status: 'warning',
      metadata: { details, timestamp: new Date().toISOString() }
    });
    console.log('[CLEAN-CODE] Admin notified of fallback');
  } catch (e) {
    console.error('[CLEAN-CODE] Failed to notify admin:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user for rate limiting
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (authHeader) {
      const tempSupabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user } } = await tempSupabase.auth.getUser();
      userId = user?.id || null;
    }

    // Rate limiting - 20 requests per minute per user
    const rateLimitResponse = withRateLimit(req, userId, "clean-code", corsHeaders);
    if (rateLimitResponse) {
      console.log(`[CLEAN-CODE] Rate limit exceeded for user ${userId?.substring(0, 8) || 'anonymous'}`);
      return rateLimitResponse;
    }

    const { code, fileName, projectId } = await req.json();

    if (!code) {
      return new Response(JSON.stringify({ error: 'Code requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Security check: file size limit
    if (code.length > SECURITY_LIMITS.MAX_FILE_SIZE_CHARS) {
      return new Response(JSON.stringify({ 
        error: `Fichier trop volumineux: ${code.length} > ${SECURITY_LIMITS.MAX_FILE_SIZE_CHARS} caractères` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Quick check if cleaning is needed
    if (!needsCleaning(code)) {
      console.log(`[CLEAN-CODE] File ${fileName} does not need cleaning, returning as-is`);
      return new Response(JSON.stringify({ 
        cleanedCode: code,
        fromCache: false,
        noCleaningNeeded: true,
        tokensUsed: 0,
        apiCostCents: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate hash for cache lookup
    const fileHash = await hashContent(code);
    console.log(`[CLEAN-CODE] File: ${fileName}, Hash: ${fileHash.substring(0, 8)}...`);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check cache first (with TTL check)
    if (userId) {
      const ttlHoursAgo = new Date(Date.now() - SECURITY_LIMITS.CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
      
      const { data: cachedResult } = await supabaseAdmin
        .from('cleaning_cache')
        .select('cleaned_content, tokens_used, cleaned_at')
        .eq('user_id', userId)
        .eq('file_path', fileName || 'unknown')
        .eq('file_hash', fileHash)
        .gte('cleaned_at', ttlHoursAgo)
        .maybeSingle();

      if (cachedResult?.cleaned_content) {
        console.log(`[CLEAN-CODE] CACHE HIT for ${fileName} - Saved API call!`);
        return new Response(JSON.stringify({ 
          cleanedCode: cachedResult.cleaned_content,
          fromCache: true,
          tokensSaved: cachedResult.tokens_used || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check for user's own API key (BYOK)
    let userApiKey: string | null = null;
    let userApiProvider: string | null = null;
    let isUsingBYOK = false;

    if (userId && authHeader) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } }
      });
      
      const { data: settings } = await supabase
        .from('user_settings')
        .select('api_key, api_provider')
        .eq('user_id', userId)
        .maybeSingle();

      if (settings?.api_key) {
        userApiKey = settings.api_key;
        userApiProvider = settings.api_provider;
        isUsingBYOK = true;
        console.log(`[CLEAN-CODE] BYOK mode: Using user's ${userApiProvider} key`);
      }
    }

    // Get project-level keys
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY');
    const openrouterKey = Deno.env.get('OPENROUTER_API_KEY');
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

    let cleanedCode: string;
    let tokensUsed = 0;
    let usedFallback = false;
    let providerUsed = 'unknown';

    // Priority: User BYOK > DeepSeek > OpenRouter DeepSeek > Anthropic (fallback)
    try {
      if (isUsingBYOK && userApiKey) {
        // Use user's own key
        if (userApiProvider === 'anthropic') {
          const result = await callAnthropic(userApiKey, code, fileName);
          cleanedCode = result.cleanedCode;
          tokensUsed = result.tokensUsed;
          providerUsed = 'anthropic_byok';
        } else {
          const result = await callOpenAI(userApiKey, code, fileName);
          cleanedCode = result.cleanedCode;
          tokensUsed = result.tokensUsed;
          providerUsed = 'openai_byok';
        }
      } else if (deepseekKey) {
        // Primary: DeepSeek direct
        try {
          const result = await callDeepSeek(deepseekKey, code, fileName, false);
          cleanedCode = result.cleanedCode;
          tokensUsed = result.tokensUsed;
          providerUsed = 'deepseek';
        } catch (deepseekError) {
          console.error('[CLEAN-CODE] DeepSeek failed, trying OpenRouter...', deepseekError);
          
          // Try OpenRouter as intermediate fallback
          if (openrouterKey) {
            try {
              const result = await callDeepSeek(openrouterKey, code, fileName, true);
              cleanedCode = result.cleanedCode;
              tokensUsed = result.tokensUsed;
              providerUsed = 'openrouter_deepseek';
            } catch (openrouterError) {
              throw openrouterError; // Will be caught by outer catch
            }
          } else {
            throw deepseekError;
          }
        }
      } else if (openrouterKey) {
        // Secondary: OpenRouter DeepSeek
        const result = await callDeepSeek(openrouterKey, code, fileName, true);
        cleanedCode = result.cleanedCode;
        tokensUsed = result.tokensUsed;
        providerUsed = 'openrouter_deepseek';
      } else if (anthropicKey) {
        // Tertiary: Anthropic Claude
        const result = await callAnthropic(anthropicKey, code, fileName);
        cleanedCode = result.cleanedCode;
        tokensUsed = result.tokensUsed;
        providerUsed = 'anthropic';
      } else {
        throw new Error('Aucune clé API configurée. Veuillez configurer votre clé API dans les paramètres.');
      }
    } catch (primaryError) {
      // Fallback to Anthropic if available and not already tried
      if (anthropicKey && providerUsed !== 'anthropic') {
        console.log('[CLEAN-CODE] Primary provider failed, falling back to Claude...');
        
        try {
          const result = await callAnthropic(anthropicKey, code, fileName);
          cleanedCode = result.cleanedCode;
          tokensUsed = result.tokensUsed;
          providerUsed = 'anthropic_fallback';
          usedFallback = true;
          
          // Notify admin of fallback
          await notifyAdminFallback(
            supabaseAdmin,
            `DeepSeek a échoué, basculement sur Claude`,
            `Erreur: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}, Fichier: ${fileName}`
          );
        } catch (fallbackError) {
          console.error('[CLEAN-CODE] Fallback also failed:', fallbackError);
          throw primaryError; // Throw original error
        }
      } else {
        throw primaryError;
      }
    }

    // Extract code from markdown if present
    const codeMatch = cleanedCode.match(/```(?:tsx?|jsx?|javascript|typescript)?\n?([\s\S]*?)```/);
    if (codeMatch) {
      cleanedCode = codeMatch[1].trim();
    }

    // Calculate API cost in cents based on provider
    // CRITICAL: For BYOK users, we DO NOT count internal costs since they use their own API key
    const inputTokens = Math.ceil(code.length / 4);
    const outputTokens = Math.ceil(cleanedCode.length / 4);
    let apiCostCents: number;
    let internalCostCents: number = 0; // Cost to Inopay (zero for BYOK)

    if (isUsingBYOK) {
      // BYOK: User pays directly to their AI provider, Inopay incurs no cost
      apiCostCents = 0; // No cost to track for Inopay
      internalCostCents = 0;
      console.log(`[CLEAN-CODE] BYOK mode: No internal cost recorded (user's ${providerUsed} key)`);
    } else {
      // Inopay is paying: Calculate actual cost
      // DeepSeek is much cheaper: ~$0.14/1M input, ~$0.28/1M output
      // Claude: $3/1M input, $15/1M output
      if (providerUsed.includes('deepseek')) {
        internalCostCents = Math.ceil(((inputTokens * 0.14) + (outputTokens * 0.28)) / 10000);
      } else if (providerUsed.includes('anthropic')) {
        internalCostCents = Math.ceil(((inputTokens * 3) + (outputTokens * 15)) / 10000);
      } else {
        // OpenAI pricing: $2.5/1M input, $10/1M output for GPT-4o
        internalCostCents = Math.ceil(((inputTokens * 2.5) + (outputTokens * 10)) / 10000);
      }
      apiCostCents = internalCostCents;
      console.log(`[CLEAN-CODE] Inopay cost: ${internalCostCents}¢ for ${providerUsed}`);
    }

    // Store in cache with timestamp
    if (userId) {
      await supabaseAdmin.from('cleaning_cache').upsert({
        user_id: userId,
        project_id: projectId || null,
        file_path: fileName || 'unknown',
        file_hash: fileHash,
        cleaned_content: cleanedCode,
        tokens_used: tokensUsed,
        api_cost_cents: apiCostCents,
        cleaned_at: new Date().toISOString(),
      }, {
        onConflict: 'project_id,file_path,file_hash'
      });

      console.log(`[CLEAN-CODE] Cached result for ${fileName}, provider: ${providerUsed}, tokens: ${tokensUsed}, cost: ${apiCostCents}¢`);
    }

    return new Response(JSON.stringify({ 
      cleanedCode,
      fromCache: false,
      tokensUsed,
      apiCostCents,
      providerUsed,
      usedFallback,
      isUsingBYOK
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[CLEAN-CODE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
