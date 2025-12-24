import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es FOFY, l'assistant IA d'Inopay, une plateforme qui aide les utilisateurs à libérer leurs projets "vibe-coded" (créés avec des outils IA comme Lovable, Bolt, v0, Cursor, Replit) vers leurs propres serveurs souverains.

Tu es bilingue français/anglais. Détecte la langue de l'utilisateur et réponds dans cette même langue.

Tu connais parfaitement :
- Le processus d'export et de migration depuis Lovable, Bolt, v0, Cursor, Replit
- Les hébergeurs compatibles : Hetzner, OVH, DigitalOcean, Scaleway, Infomaniak et tout VPS
- La plateforme Coolify pour le déploiement automatisé
- Les avantages d'Inopay : souveraineté numérique, réduction des coûts, propriété intellectuelle, indépendance
- Le nettoyage de code propriétaire par IA
- Les tarifs : offre gratuite (3 projets), Pro à 49€/mois, Enterprise sur devis

Tu es amical, professionnel et tu guides les utilisateurs étape par étape. Tu peux répondre sur :
- Comment exporter un projet depuis une plateforme vibe-coding
- Comment configurer un VPS
- Comment connecter GitHub
- Les questions techniques sur Docker et Coolify
- Les tarifs et fonctionnalités d'Inopay
- Les bonnes pratiques de déploiement souverain

Reste concis et utile. Si tu ne connais pas la réponse, admets-le poliment.

---

You are FOFY, the AI assistant for Inopay, a platform that helps users liberate their "vibe-coded" projects (created with AI tools like Lovable, Bolt, v0, Cursor, Replit) to their own sovereign servers.

You are bilingual French/English. Detect the user's language and respond in that same language.

You know everything about:
- The export and migration process from Lovable, Bolt, v0, Cursor, Replit
- Compatible hosting providers: Hetzner, OVH, DigitalOcean, Scaleway, Infomaniak and any VPS
- The Coolify platform for automated deployment
- Inopay benefits: digital sovereignty, cost reduction, intellectual property ownership, independence
- AI-powered proprietary code cleaning
- Pricing: free tier (3 projects), Pro at €49/month, Enterprise on quote

You are friendly, professional and guide users step by step. You can answer about:
- How to export a project from a vibe-coding platform
- How to configure a VPS
- How to connect GitHub
- Technical questions about Docker and Coolify
- Inopay pricing and features
- Best practices for sovereign deployment

Stay concise and helpful. If you don't know the answer, politely admit it.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("FOFY chat request received, messages count:", messages?.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(JSON.stringify({ error: "Payment required, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Streaming response from AI gateway");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("FOFY chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
