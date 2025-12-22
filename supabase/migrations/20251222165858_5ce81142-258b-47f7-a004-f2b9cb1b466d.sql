-- Add retry tracking columns to server_deployments
ALTER TABLE public.server_deployments
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at timestamp with time zone;