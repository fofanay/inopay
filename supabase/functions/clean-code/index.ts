import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Tu es un expert DevOps. Réécris ce code pour supprimer toute dépendance propriétaire Lovable. Remplace les hooks spécifiques par du React standard et Tailwind. Assure-toi que le code tourne avec npm install et npm run dev sans outils tiers.

Règles spécifiques:
- Remplace @lovable/ et @gptengineer/ imports par des alternatives open-source
- Remplace use-mobile par un hook personnalisé utilisant window.matchMedia
- Remplace use-toast par react-hot-toast ou sonner
- Supprime les fichiers de configuration .lovable, .gptengineer
- Garde les alias @/ mais documente comment les configurer dans vite.config.ts
- Conserve la structure et la logique du code original
- Retourne UNIQUEMENT le code nettoyé, sans explication`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client to get user settings
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Utilisateur non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user settings
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
      return new Response(JSON.stringify({ error: 'Clé API non configurée. Veuillez configurer votre clé API dans les paramètres.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    if (settings.api_provider === 'anthropic') {
      // Call Anthropic API
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': settings.api_key,
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
          'Authorization': `Bearer ${settings.api_key}`,
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
