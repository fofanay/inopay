-- Add language preference column to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS language text DEFAULT 'fr' CHECK (language IN ('fr', 'en'));

-- Add comment for documentation
COMMENT ON COLUMN public.user_settings.language IS 'User preferred language (fr or en)';