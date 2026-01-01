import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CURRENT_DATE = new Date().toLocaleDateString("fr-FR", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const buildSystemPrompt = (userContext: {
  name?: string;
  email?: string;
  plan?: string;
  projectsCount?: number;
  creditsRemaining?: number;
  isAuthenticated: boolean;
  language: string;
}) => {
  const { name, plan, projectsCount, creditsRemaining, isAuthenticated, language } = userContext;

  const userInfo = isAuthenticated
    ? `
CONTEXTE UTILISATEUR ACTUEL:
- Nom: ${name || "Non renseigné"}
- Plan: ${plan || "Gratuit"}
- Projets: ${projectsCount || 0}
- Crédits restants: ${creditsRemaining ?? "N/A"}
`
    : `
L'utilisateur n'est pas connecté. Tu peux l'encourager à créer un compte pour profiter de toutes les fonctionnalités.
`;

  return `Tu es FOFY, l'assistant IA d'Inopay, une plateforme qui aide les utilisateurs à libérer leurs projets "vibe-coded" (créés avec des outils IA comme Lovable, Bolt, v0, Cursor, Replit) vers leurs propres serveurs souverains.

Date du jour: ${CURRENT_DATE}

Tu es bilingue français/anglais. L'utilisateur parle ${language === "fr" ? "français" : "anglais"}, réponds dans cette langue.

${userInfo}

Tu connais parfaitement :
- Le processus d'export et de migration depuis Lovable, Bolt, v0, Cursor, Replit
- Les hébergeurs compatibles : Hetzner, OVH, DigitalOcean, Scaleway, Infomaniak et tout VPS
- La plateforme Coolify pour le déploiement automatisé
- Les avantages d'Inopay : souveraineté numérique, réduction des coûts, propriété intellectuelle, indépendance
- Le nettoyage de code propriétaire par IA (suppression des traces Lovable, etc.)
- Les tarifs : 
  * Offre gratuite : 3 projets, 50 fichiers max par projet
  * Pro à 49€/mois : projets illimités, fichiers illimités, support prioritaire
  * Enterprise : sur devis, intégrations personnalisées

FONCTIONNALITÉS RÉCENTES:
- Synchronisation GitHub automatique avec déploiement continu
- Widget de monitoring en temps réel
- Export vers n'importe quel VPS via SSH/Coolify
- Nettoyage IA du code propriétaire (console.log, imports, etc.)
- Migration de base de données Supabase vers PostgreSQL auto-hébergé

Tu es amical, professionnel et tu guides les utilisateurs étape par étape. Tu peux répondre sur :
- Comment exporter un projet depuis une plateforme vibe-coding
- Comment configurer un VPS
- Comment connecter GitHub
- Les questions techniques sur Docker et Coolify
- Les tarifs et fonctionnalités d'Inopay
- Les bonnes pratiques de déploiement souverain

RÈGLES DE RÉPONSE:
1. Utilise le **markdown** pour formater tes réponses (gras, listes, code)
2. Sois concis mais complet - idéalement 2-4 paragraphes
3. Si tu proposes des étapes, utilise des listes numérotées
4. Si tu mentionnes du code ou des commandes, utilise des blocs de code
5. Personnalise ta réponse selon le contexte utilisateur quand c'est pertinent
6. Si tu ne connais pas la réponse, admets-le poliment et suggère de contacter le support

---

You are FOFY, the AI assistant for Inopay, a platform that helps users liberate their "vibe-coded" projects (created with AI tools like Lovable, Bolt, v0, Cursor, Replit) to their own sovereign servers.

Current date: ${CURRENT_DATE}

You are bilingual French/English. The user speaks ${language === "fr" ? "French" : "English"}, respond in that language.

${userInfo}

You know everything about:
- The export and migration process from Lovable, Bolt, v0, Cursor, Replit
- Compatible hosting providers: Hetzner, OVH, DigitalOcean, Scaleway, Infomaniak and any VPS
- The Coolify platform for automated deployment
- Inopay benefits: digital sovereignty, cost reduction, intellectual property ownership, independence
- AI-powered proprietary code cleaning (removing Lovable traces, etc.)
- Pricing:
  * Free tier: 3 projects, 50 files max per project
  * Pro at €49/month: unlimited projects, unlimited files, priority support
  * Enterprise: custom pricing, custom integrations

RECENT FEATURES:
- Automatic GitHub sync with continuous deployment
- Real-time monitoring widget
- Export to any VPS via SSH/Coolify
- AI code cleaning (console.log, imports, etc.)
- Supabase to self-hosted PostgreSQL database migration

You are friendly, professional and guide users step by step. You can answer about:
- How to export a project from a vibe-coding platform
- How to configure a VPS
- How to connect GitHub
- Technical questions about Docker and Coolify
- Inopay pricing and features
- Best practices for sovereign deployment

RESPONSE RULES:
1. Use **markdown** to format your responses (bold, lists, code)
2. Be concise but complete - ideally 2-4 paragraphs
3. If you're suggesting steps, use numbered lists
4. If you mention code or commands, use code blocks
5. Personalize your response based on user context when relevant
6. If you don't know the answer, politely admit it and suggest contacting support`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, language = "fr" } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("FOFY chat request received, messages count:", messages?.length);

    // Try to get user context from auth token
    let userContext = {
      isAuthenticated: false,
      language,
      name: undefined as string | undefined,
      email: undefined as string | undefined,
      plan: undefined as string | undefined,
      projectsCount: undefined as number | undefined,
      creditsRemaining: undefined as number | undefined,
    };

    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      
      // Don't try to auth with the anon key
      if (!token.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6cXZleXZjZWJvbHJxcHFsbWhvIiwicm9sZSI6ImFub24i")) {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabase = createClient(supabaseUrl, supabaseServiceKey);

          const { data: { user }, error } = await supabase.auth.getUser(token);
          
          if (user && !error) {
            userContext.isAuthenticated = true;
            userContext.email = user.email;

            // Get profile info
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", user.id)
              .single();

            if (profile) {
              userContext.name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || undefined;
            }

            // Get subscription info
            const { data: subscription } = await supabase
              .from("subscriptions")
              .select("plan_type, credits_remaining")
              .eq("user_id", user.id)
              .maybeSingle();

            if (subscription) {
              userContext.plan = subscription.plan_type;
              userContext.creditsRemaining = subscription.credits_remaining ?? undefined;
            }

            // Get projects count
            const { count } = await supabase
              .from("projects_analysis")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id);

            userContext.projectsCount = count ?? 0;

            console.log("User context loaded:", {
              name: userContext.name,
              plan: userContext.plan,
              projects: userContext.projectsCount,
            });
          }
        } catch (authError) {
          console.error("Error loading user context:", authError);
          // Continue without user context
        }
      }
    }

    // Limit messages to last 10 to avoid token limits
    const recentMessages = messages.slice(-10);

    const systemPrompt = buildSystemPrompt(userContext);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...recentMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error("Rate limit exceeded");
        return new Response(JSON.stringify({ 
          error: language === "fr" 
            ? "Trop de requêtes, veuillez réessayer dans quelques instants." 
            : "Too many requests, please try again in a moment." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.error("Payment required");
        return new Response(JSON.stringify({ 
          error: language === "fr" 
            ? "Service temporairement indisponible." 
            : "Service temporarily unavailable." 
        }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ 
        error: language === "fr" 
          ? "Une erreur s'est produite. Veuillez réessayer." 
          : "An error occurred. Please try again." 
      }), {
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
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
