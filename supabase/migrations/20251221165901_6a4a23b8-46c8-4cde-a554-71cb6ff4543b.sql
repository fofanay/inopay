-- Add deployment preferences columns to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS preferred_deploy_platform text DEFAULT 'vercel',
ADD COLUMN IF NOT EXISTS default_repo_private boolean DEFAULT true;

-- Add a comment explaining the valid values for preferred_deploy_platform
COMMENT ON COLUMN public.user_settings.preferred_deploy_platform IS 'Valid values: vercel, netlify, railway, none';
COMMENT ON COLUMN public.user_settings.default_repo_private IS 'Whether to create private repos by default when exporting to GitHub';