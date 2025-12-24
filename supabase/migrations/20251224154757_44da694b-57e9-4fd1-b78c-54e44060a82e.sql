-- Create admin_config table for dynamic SECURITY_LIMITS override
CREATE TABLE IF NOT EXISTS public.admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value jsonb NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write config
CREATE POLICY "Admins can manage config"
ON public.admin_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can read config (for edge functions)
CREATE POLICY "Service role can read config"
ON public.admin_config
FOR SELECT
USING (auth.role() = 'service_role'::text);

-- Insert default SECURITY_LIMITS configuration
INSERT INTO public.admin_config (config_key, config_value) 
VALUES ('SECURITY_LIMITS', '{
  "MAX_FILES_PER_LIBERATION": 500,
  "MAX_FILE_SIZE_CHARS": 50000,
  "MAX_API_COST_CENTS": 5000,
  "CACHE_TTL_HOURS": 24,
  "KILL_SWITCH_ENABLED": false
}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;