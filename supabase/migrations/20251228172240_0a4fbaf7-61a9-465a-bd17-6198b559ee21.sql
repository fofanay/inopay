-- Add column for AI replacements toggle in liberation process
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS replace_proprietary_ai BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.user_settings.replace_proprietary_ai IS 'Enable automatic replacement of proprietary AI services (OpenAI, Anthropic) with open-source alternatives (Ollama) during code cleaning';