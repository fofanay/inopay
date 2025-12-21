-- Table d'audit de sécurité (sans secrets)
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  server_id UUID REFERENCES public.user_servers(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES public.server_deployments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table de logs des health checks
CREATE TABLE IF NOT EXISTS public.health_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID REFERENCES public.server_deployments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  response_time_ms INTEGER,
  http_status INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ajouter colonnes de monitoring à server_deployments
ALTER TABLE public.server_deployments 
ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_restart_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_restart_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS secrets_cleaned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS secrets_cleaned_at TIMESTAMPTZ;

-- Enable RLS
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_check_logs ENABLE ROW LEVEL SECURITY;

-- Policies pour security_audit_logs
CREATE POLICY "Users can view their own audit logs"
ON public.security_audit_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage audit logs"
ON public.security_audit_logs
FOR ALL
USING (auth.role() = 'service_role');

-- Policies pour health_check_logs
CREATE POLICY "Users can view health logs for their deployments"
ON public.health_check_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.server_deployments sd
    WHERE sd.id = deployment_id AND sd.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage health logs"
ON public.health_check_logs
FOR ALL
USING (auth.role() = 'service_role');

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_health_check_logs_deployment ON public.health_check_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_health_check_logs_checked_at ON public.health_check_logs(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user ON public.security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_server_deployments_health ON public.server_deployments(health_status) WHERE status = 'deployed';