import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRateLimit } from "../_shared/rate-limiter.ts";

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get user for rate limiting
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
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

    // Priority: Project secrets > User settings
    const anthropicProjectKey = Deno.env.get('ANTHROPIC_API_KEY');
    const openaiProjectKey = Deno.env.get('OPENAI_API_KEY');

    let apiKey: string | null = null;
    let apiProvider: string = 'anthropic';

    // Use project-level secrets first
    if (anthropicProjectKey) {
      apiKey = anthropicProjectKey;
      apiProvider = 'anthropic';
      console.log('Using project-level Anthropic API key');
    } else if (openaiProjectKey) {
      apiKey = openaiProjectKey;
      apiProvider = 'openai';
      console.log('Using project-level OpenAI API key');
    } else {
      // Fallback to user settings
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Non autorisé' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Utilisateur non authentifié' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (settingsError) {
        console.error('Settings error:', settingsError);
        return new Response(JSON.stringify({ error: 'Erreur lors de la récupération des paramètres' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!settings?.api_key) {
        return new Response(JSON.stringify({ error: 'Clé API non configurée. Veuillez configurer votre clé API dans les paramètres ou ajouter ANTHROPIC_API_KEY/OPENAI_API_KEY dans les secrets du projet.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      apiKey = settings.api_key;
      apiProvider = settings.api_provider;
      console.log('Using user settings API key');
    }

    const { code, fileName } = await req.json();

    if (!code) {
      return new Response(JSON.stringify({ error: 'Code requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let response;
    let cleanedCode: string;

    if (apiProvider === 'anthropic') {
      // Call Anthropic API
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey!,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          system: SYSTEM_PROMPT,
          messages: [
            { 
              role: 'user', 
              content: `Fichier: ${fileName || 'code.tsx'}\n\n\`\`\`tsx\n${code}\n\`\`\`` 
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Anthropic API error:', response.status, errorData);
        return new Response(JSON.stringify({ error: `Erreur API Anthropic: ${response.status}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      cleanedCode = data.content[0].text;
    } else {
      // Call OpenAI API
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { 
              role: 'user', 
              content: `Fichier: ${fileName || 'code.tsx'}\n\n\`\`\`tsx\n${code}\n\`\`\`` 
            }
          ],
          max_tokens: 8192,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API error:', response.status, errorData);
        return new Response(JSON.stringify({ error: `Erreur API OpenAI: ${response.status}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      cleanedCode = data.choices[0].message.content;
    }

    // Extract code from markdown if present
    const codeMatch = cleanedCode.match(/```(?:tsx?|jsx?|javascript|typescript)?\n?([\s\S]*?)```/);
    if (codeMatch) {
      cleanedCode = codeMatch[1].trim();
    }

    return new Response(JSON.stringify({ cleanedCode }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in clean-code function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
