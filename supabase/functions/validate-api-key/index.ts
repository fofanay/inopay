import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey, provider } = await req.json();

    if (!apiKey || !provider) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Clé API et provider requis' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[VALIDATE-API-KEY] Testing ${provider} key...`);

    let isValid = false;
    let providerName = '';
    let modelInfo = '';

    try {
      if (provider === 'openai') {
        // Test OpenAI key with minimal request
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 
            'Authorization': `Bearer ${apiKey}`,
          },
        });
        
        if (response.ok) {
          isValid = true;
          providerName = 'OpenAI';
          modelInfo = 'GPT-4o disponible';
        } else {
          const error = await response.text();
          console.log('[VALIDATE-API-KEY] OpenAI error:', response.status, error);
        }
      } else if (provider === 'anthropic') {
        // Test Anthropic key with minimal request (models endpoint)
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });

        // A successful request or a rate limit error both indicate valid key
        if (response.ok || response.status === 429) {
          isValid = true;
          providerName = 'Anthropic';
          modelInfo = 'Claude Sonnet 4 disponible';
        } else if (response.status === 401) {
          isValid = false;
        } else {
          // Other errors (like 400) with valid auth still mean the key works
          const error = await response.json();
          if (!error.error?.message?.includes('invalid') && !error.error?.message?.includes('unauthorized')) {
            isValid = true;
            providerName = 'Anthropic';
            modelInfo = 'Claude disponible';
          }
        }
      } else if (provider === 'deepseek') {
        // Test DeepSeek key
        const response = await fetch('https://api.deepseek.com/v1/models', {
          headers: { 
            'Authorization': `Bearer ${apiKey}`,
          },
        });
        
        if (response.ok) {
          isValid = true;
          providerName = 'DeepSeek';
          modelInfo = 'DeepSeek V3 disponible';
        } else {
          console.log('[VALIDATE-API-KEY] DeepSeek error:', response.status);
        }
      }
    } catch (fetchError) {
      console.error('[VALIDATE-API-KEY] Network error:', fetchError);
      return new Response(JSON.stringify({ 
        valid: false, 
        error: 'Erreur de connexion au provider' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isValid) {
      console.log(`[VALIDATE-API-KEY] ${providerName} key is valid`);
      
      // If user is authenticated, save the key
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } }
        });
        
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Upsert the API key into user_settings
          const { error } = await supabase
            .from('user_settings')
            .upsert({
              user_id: user.id,
              api_key: apiKey,
              api_provider: provider,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
          
          if (error) {
            console.error('[VALIDATE-API-KEY] Error saving key:', error);
          } else {
            console.log('[VALIDATE-API-KEY] Key saved for user', user.id.substring(0, 8));
          }
        }
      }
      
      return new Response(JSON.stringify({ 
        valid: true, 
        provider: providerName,
        model: modelInfo,
        message: `Clé ${providerName} valide et sauvegardée !`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: `Clé ${provider.toUpperCase()} invalide ou expirée`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('[VALIDATE-API-KEY] Error:', error);
    return new Response(JSON.stringify({ 
      valid: false, 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
