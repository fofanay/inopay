import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ServiceAlternative {
  id: string;
  name: string;
  dockerImage: string;
  dockerComposeSnippet: string;
  configTemplate: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { services, projectName } = await req.json();

    if (!services || !Array.isArray(services) || services.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Services array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract unique volumes from snippets
    const volumeNames = new Set<string>();
    const serviceSnippets: string[] = [];

    for (const service of services as ServiceAlternative[]) {
      serviceSnippets.push(service.dockerComposeSnippet);
      
      // Extract volume names from snippet
      const volumeMatches = service.dockerComposeSnippet.match(/(\w+_data):/g);
      if (volumeMatches) {
        volumeMatches.forEach(match => volumeNames.add(match.replace(":", "")));
      }
    }

    const volumes = Array.from(volumeNames).map(name => `  ${name}:`).join("\n");

    const dockerCompose = `version: "3.8"

# ============================================
# INOPAY - Alternatives Open Source
# Projet: ${projectName || 'Mon Projet'}
# Généré automatiquement par le Conseiller en Économies
# ============================================

services:
${serviceSnippets.join("\n\n")}

volumes:
${volumes}

# ============================================
# Instructions de déploiement:
# 1. Copiez ce fichier dans votre projet
# 2. Lancez: docker-compose -f docker-compose.alternatives.yml up -d
# 3. Mettez à jour vos variables d'environnement avec .env.alternatives
# ============================================
`;

    // Generate .env template
    const envConfigs: string[] = [
      "# ============================================",
      `# INOPAY - Configuration des alternatives Open Source`,
      `# Projet: ${projectName || 'Mon Projet'}`,
      "# Remplacez vos anciennes clés API par ces valeurs",
      "# ============================================",
      ""
    ];

    for (const service of services as ServiceAlternative[]) {
      envConfigs.push(`# ${service.name}`);
      envConfigs.push(service.configTemplate);
      envConfigs.push("");
    }

    const envTemplate = envConfigs.join("\n");

    console.log(`Generated docker-compose for ${services.length} services`);

    return new Response(
      JSON.stringify({ 
        dockerCompose,
        envTemplate,
        servicesCount: services.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating docker alternatives:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
