-- Add widget columns to sync_configurations
ALTER TABLE public.sync_configurations
ADD COLUMN IF NOT EXISTS widget_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS widget_token_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS zen_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS time_saved_minutes INTEGER DEFAULT 0;

-- Create index for widget_token lookups
CREATE INDEX IF NOT EXISTS idx_sync_configurations_widget_token 
ON public.sync_configurations(widget_token) 
WHERE widget_token IS NOT NULL;

-- Create policy for public widget token access (read-only)
CREATE POLICY "Public widget token read access" 
ON public.sync_configurations 
FOR SELECT 
USING (widget_token IS NOT NULL);