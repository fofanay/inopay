-- Table pour stocker les serveurs VPS des utilisateurs
CREATE TABLE public.user_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  provider TEXT, -- 'hetzner', 'ionos', 'digitalocean', 'vultr', 'scaleway', 'ovh'
  coolify_url TEXT, -- URL de l'instance Coolify (ex: http://IP:8000)
  coolify_token TEXT, -- Token API Coolify
  status TEXT NOT NULL DEFAULT 'pending', -- pending, installing, ready, error
  setup_id TEXT UNIQUE, -- ID unique pour le script d'installation
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table pour l'historique des déploiements sur serveurs VPS
CREATE TABLE public.server_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  server_id UUID NOT NULL REFERENCES public.user_servers(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  github_repo_url TEXT,
  domain TEXT,
  coolify_app_uuid TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, deploying, deployed, failed
  deployed_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_deployments ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_servers
CREATE POLICY "Users can view their own servers"
  ON public.user_servers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own servers"
  ON public.user_servers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own servers"
  ON public.user_servers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own servers"
  ON public.user_servers FOR DELETE
  USING (auth.uid() = user_id);

-- RLS policies for server_deployments
CREATE POLICY "Users can view their own deployments"
  ON public.server_deployments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deployments"
  ON public.server_deployments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deployments"
  ON public.server_deployments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deployments"
  ON public.server_deployments FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_servers_updated_at
  BEFORE UPDATE ON public.user_servers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_server_deployments_updated_at
  BEFORE UPDATE ON public.server_deployments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();