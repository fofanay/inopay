-- Add archive_path and archive_generated_at to deployment_history for ZIP download functionality
ALTER TABLE public.deployment_history 
ADD COLUMN IF NOT EXISTS archive_path TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS archive_generated_at TIMESTAMPTZ DEFAULT NULL;