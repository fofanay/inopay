-- Add columns to deployment_history for Liberation Report
ALTER TABLE public.deployment_history 
ADD COLUMN IF NOT EXISTS cost_analysis JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS cleaned_dependencies TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS server_ip TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS coolify_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS portability_score_before INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS portability_score_after INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS hosting_type TEXT DEFAULT 'vps',
ADD COLUMN IF NOT EXISTS liberation_report_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS services_replaced JSONB DEFAULT '[]';