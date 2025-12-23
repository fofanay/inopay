-- Add columns for revocable widget tokens
ALTER TABLE public.sync_configurations
ADD COLUMN IF NOT EXISTS widget_token_used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS widget_token_revoked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS widget_token_last_ip TEXT DEFAULT NULL;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_sync_configurations_widget_token 
ON public.sync_configurations(widget_token) 
WHERE widget_token IS NOT NULL AND widget_token_revoked = FALSE;