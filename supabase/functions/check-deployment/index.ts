import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckResult {
  success: boolean;
  status?: number;
  statusText?: string;
  loadTime?: number;
  isHttps?: boolean;
  hasValidHtml?: boolean;
  title?: string;
  error?: string;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL requise' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Format d\'URL invalide',
        checks: [{
          name: 'Format URL',
          passed: false,
          message: 'L\'URL fournie n\'est pas valide'
        }]
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const checks: CheckResult['checks'] = [];
    const startTime = Date.now();

    // Check 1: HTTPS
    const isHttps = parsedUrl.protocol === 'https:';
    checks.push({
      name: 'Connexion sécurisée (HTTPS)',
      passed: isHttps,
      message: isHttps ? 'Le site utilise HTTPS' : 'Le site n\'utilise pas HTTPS (recommandé pour la production)'
    });

    // Check 2: Fetch the URL
    let response: Response;
    let loadTime: number;
    let htmlContent = '';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'InoPay-DeploymentChecker/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      loadTime = Date.now() - startTime;

      htmlContent = await response.text();
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Erreur inconnue';
      
      checks.push({
        name: 'Accessibilité',
        passed: false,
        message: errorMessage.includes('abort') 
          ? 'Le site ne répond pas (timeout après 15 secondes)'
          : `Impossible d'accéder au site: ${errorMessage}`
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Le site n\'est pas accessible',
        checks
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check 3: HTTP Status
    const statusOk = response.status >= 200 && response.status < 400;
    checks.push({
      name: 'Code de statut HTTP',
      passed: statusOk,
      message: statusOk 
        ? `Le site répond avec le code ${response.status} (${response.statusText || 'OK'})`
        : `Le site répond avec une erreur: ${response.status} ${response.statusText}`
    });

    // Check 4: Response time
    const loadTimeOk = loadTime < 5000;
    checks.push({
      name: 'Temps de réponse',
      passed: loadTimeOk,
      message: loadTimeOk 
        ? `Le site répond en ${loadTime}ms`
        : `Le site est lent (${loadTime}ms). Considérez l'optimisation.`
    });

    // Check 5: Valid HTML
    const hasHtmlTag = htmlContent.toLowerCase().includes('<html');
    const hasBodyTag = htmlContent.toLowerCase().includes('<body');
    const hasValidHtml = hasHtmlTag && hasBodyTag;
    checks.push({
      name: 'Structure HTML',
      passed: hasValidHtml,
      message: hasValidHtml 
        ? 'Le site retourne du HTML valide'
        : 'Le site ne semble pas retourner du HTML valide'
    });

    // Check 6: Extract title
    let title: string | undefined;
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      checks.push({
        name: 'Titre de la page',
        passed: true,
        message: `Titre: "${title}"`
      });
    } else {
      checks.push({
        name: 'Titre de la page',
        passed: false,
        message: 'Aucun titre de page trouvé (important pour le SEO)'
      });
    }

    // Check 7: Meta viewport (mobile-friendly)
    const hasViewport = htmlContent.toLowerCase().includes('viewport');
    checks.push({
      name: 'Compatibilité mobile',
      passed: hasViewport,
      message: hasViewport 
        ? 'Le site semble optimisé pour mobile (meta viewport présent)'
        : 'Meta viewport non trouvé - le site pourrait ne pas être optimisé pour mobile'
    });

    // Check 8: Check for common SPA frameworks
    const isReact = htmlContent.includes('__REACT') || htmlContent.includes('react');
    const isVue = htmlContent.includes('__VUE') || htmlContent.includes('vue');
    const hasAppRoot = htmlContent.includes('id="root"') || htmlContent.includes('id="app"');
    
    if (hasAppRoot) {
      checks.push({
        name: 'Application SPA détectée',
        passed: true,
        message: isReact ? 'Application React détectée' : isVue ? 'Application Vue détectée' : 'Application SPA détectée'
      });
    }

    // Overall success
    const criticalChecks = checks.filter(c => 
      c.name === 'Accessibilité' || 
      c.name === 'Code de statut HTTP' || 
      c.name === 'Structure HTML'
    );
    const allCriticalPassed = criticalChecks.every(c => c.passed);
    const passedCount = checks.filter(c => c.passed).length;

    console.log(`Deployment check for ${url}: ${passedCount}/${checks.length} checks passed`);

    return new Response(JSON.stringify({
      success: allCriticalPassed,
      status: response.status,
      statusText: response.statusText,
      loadTime,
      isHttps,
      hasValidHtml,
      title,
      checks,
      summary: {
        passed: passedCount,
        total: checks.length,
        percentage: Math.round((passedCount / checks.length) * 100)
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in check-deployment function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage,
      checks: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});