-- Table pour stocker les configurations de synchronisation
CREATE TABLE public.sync_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  deployment_id UUID NOT NULL REFERENCES public.server_deployments(id) ON DELETE CASCADE,
  github_repo_url TEXT NOT NULL,
  github_webhook_secret TEXT NOT NULL,
  sync_enabled BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'pending',
  last_sync_commit TEXT,
  last_sync_error TEXT,
  sync_count INTEGER DEFAULT 0,
  allowed_branches TEXT[] DEFAULT ARRAY['main', 'master'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table pour l'historique des synchronisations
CREATE TABLE public.sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_config_id UUID NOT NULL REFERENCES public.sync_configurations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  commit_sha TEXT NOT NULL,
  commit_message TEXT,
  files_changed TEXT[],
  files_cleaned TEXT[],
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.sync_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sync_configurations
CREATE POLICY "Users can view their own sync configs"
  ON public.sync_configurations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sync configs"
  ON public.sync_configurations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync configs"
  ON public.sync_configurations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync configs"
  ON public.sync_configurations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all sync configs"
  ON public.sync_configurations FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for sync_history
CREATE POLICY "Users can view their own sync history"
  ON public.sync_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all sync history"
  ON public.sync_history FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger pour updated_at
CREATE TRIGGER update_sync_configurations_updated_at
  BEFORE UPDATE ON public.sync_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();