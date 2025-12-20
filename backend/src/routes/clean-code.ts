import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getSupabaseClient } from '../services/supabase';

export const cleanCodeRouter = Router();

const SYSTEM_PROMPT = `Tu es un expert DevOps. Réécris ce code pour supprimer toute dépendance propriétaire Lovable. Remplace les hooks spécifiques par du React standard et Tailwind. Assure-toi que le code tourne avec npm install et npm run dev sans outils tiers.

Règles spécifiques:
- Remplace @lovable/ et @gptengineer/ imports par des alternatives open-source
- Remplace use-mobile par un hook personnalisé utilisant window.matchMedia
- Remplace use-toast par react-hot-toast ou sonner
- Supprime les fichiers de configuration .lovable, .gptengineer
- Garde les alias @/ mais documente comment les configurer dans vite.config.ts
- Conserve la structure et la logique du code original
- Retourne UNIQUEMENT le code nettoyé, sans explication`;

cleanCodeRouter.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { code, fileName } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code requis' });
    }

    // Priority: Environment variables > User settings
    let apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
    let apiProvider = process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai';

    // Fallback to user settings
    if (!apiKey && req.user) {
      const supabase = getSupabaseClient();
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', req.user.id)
        .maybeSingle();

      if (settings?.api_key) {
        apiKey = settings.api_key;
        apiProvider = settings.api_provider;
      }
    }

    if (!apiKey) {
      return res.status(400).json({ 
        error: 'Clé API non configurée. Veuillez configurer ANTHROPIC_API_KEY ou OPENAI_API_KEY.' 
      });
    }

    let cleanedCode: string;

    if (apiProvider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
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
        return res.status(500).json({ error: `Erreur API Anthropic: ${response.status}` });
      }

      const data = await response.json();
      cleanedCode = data.content[0].text;
    } else {
      const openai = new OpenAI({ apiKey });
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Fichier: ${fileName || 'code.tsx'}\n\n\`\`\`tsx\n${code}\n\`\`\`` 
          }
        ],
        max_tokens: 8192,
      });

      cleanedCode = response.choices[0].message.content || '';
    }

    // Extract code from markdown if present
    const codeMatch = cleanedCode.match(/```(?:tsx?|jsx?|javascript|typescript)?\n?([\s\S]*?)```/);
    if (codeMatch) {
      cleanedCode = codeMatch[1].trim();
    }

    res.json({ cleanedCode });
  } catch (error) {
    console.error('Error in clean-code:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Erreur interne' 
    });
  }
});
