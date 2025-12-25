-- ============================================================
-- INOPAY - MASTER SQL MIGRATION SCRIPT (FIXED ORDER)
-- ============================================================
-- Generated: 2024-12-25 (Fixed)
-- Purpose: Complete database schema migration for private Supabase instance
-- Instructions: Execute this script in your Supabase SQL Editor
-- IMPORTANT: Tables must be created BEFORE functions that reference them
-- ============================================================

-- ============================================================
-- STEP 1: EXTENSIONS (Optionnel)
-- ============================================================

-- Note: pg_cron et pg_net peuvent ne pas être disponibles sur toutes les instances
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- STEP 2: ENUM TYPES
-- ============================================================

-- Create app_role enum for role-based access control
DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- STEP 3: BASIC FUNCTION (sans dépendances de tables)
-- ============================================================

-- Function to update updated_at timestamps automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================
-- STEP 4: CRITICAL BASE TABLES (user_roles MUST be first!)
-- ============================================================

-- ----------------------------------------
-- TABLE: user_roles (MUST BE CREATED BEFORE has_role function)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Basic policy without has_role function (to avoid circular dependency)
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- STEP 5: SECURITY DEFINER FUNCTIONS (after user_roles exists)
-- ============================================================

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Now add admin policies to user_roles (after has_role exists)
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- STEP 6: OTHER FUNCTIONS
-- ============================================================

-- Function to clean up expired OTP records
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_verifications 
  WHERE expires_at < now() OR verified = true;
END;
$$;

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 7: BASE TABLES (sans dépendances FK)
-- ============================================================

-- ----------------------------------------
-- TABLE: profiles (utilisateurs)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  phone text,
  phone_verified boolean DEFAULT false,
  avatar_url text,
  billing_address_line1 text,
  billing_address_line2 text,
  billing_city text,
  billing_postal_code text,
  billing_country text DEFAULT 'FR',
  company_name text,
  vat_number text,
  last_login_at timestamptz,
  last_login_ip inet,
  profile_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- ----------------------------------------
-- TABLE: banned_users
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.banned_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  reason TEXT,
  banned_by UUID REFERENCES auth.users(id),
  banned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage banned users" ON public.banned_users
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- TABLE: user_settings
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  api_provider TEXT NOT NULL DEFAULT 'openai',
  api_key TEXT,
  github_token TEXT,
  github_source_token TEXT,
  github_destination_token TEXT,
  github_destination_username TEXT,
  preferred_deploy_platform TEXT DEFAULT 'vercel',
  default_repo_private BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'fr',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user_settings" ON public.user_settings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- TABLE: subscriptions
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'inactive',
  credits_remaining INTEGER DEFAULT 0,
  free_credits INTEGER DEFAULT 0,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_subscription UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all subscriptions" ON public.subscriptions
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- TABLE: projects_analysis
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.projects_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  file_name TEXT,
  portability_score INTEGER DEFAULT 0,
  detected_issues JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projects_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analyses" ON public.projects_analysis
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analyses" ON public.projects_analysis
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analyses" ON public.projects_analysis
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses" ON public.projects_analysis
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all projects_analysis" ON public.projects_analysis
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_projects_analysis_updated_at
  BEFORE UPDATE ON public.projects_analysis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- TABLE: deployment_history
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.deployment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  host TEXT,
  files_uploaded INTEGER DEFAULT 0,
  deployment_type TEXT NOT NULL DEFAULT 'ftp',
  status TEXT NOT NULL DEFAULT 'success',
  deployed_url TEXT,
  cost_analysis JSONB DEFAULT NULL,
  cleaned_dependencies TEXT[] DEFAULT '{}',
  server_ip TEXT DEFAULT NULL,
  coolify_url TEXT DEFAULT NULL,
  portability_score_before INTEGER DEFAULT NULL,
  portability_score_after INTEGER DEFAULT 100,
  hosting_type TEXT DEFAULT 'vps',
  liberation_report_generated BOOLEAN DEFAULT FALSE,
  services_replaced JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deployment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deployments" ON public.deployment_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deployments" ON public.deployment_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deployments" ON public.deployment_history
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all deployment_history" ON public.deployment_history
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_deployment_history_user_id ON public.deployment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_deployment_history_created_at ON public.deployment_history(created_at DESC);

-- ----------------------------------------
-- TABLE: user_servers
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  provider TEXT,
  coolify_url TEXT,
  coolify_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  setup_id TEXT UNIQUE,
  error_message TEXT,
  db_host TEXT,
  db_port INTEGER DEFAULT 5432,
  db_name TEXT,
  db_user TEXT,
  db_password TEXT,
  db_url TEXT,
  jwt_secret TEXT,
  anon_key TEXT,
  service_role_key TEXT,
  db_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_servers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own servers" ON public.user_servers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own servers" ON public.user_servers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own servers" ON public.user_servers
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own servers" ON public.user_servers
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_servers_updated_at
  BEFORE UPDATE ON public.user_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- STEP 8: TABLES WITH FK DEPENDENCIES
-- ============================================================

-- ----------------------------------------
-- TABLE: server_deployments (depends on user_servers)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.server_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  server_id UUID NOT NULL REFERENCES public.user_servers(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  github_repo_url TEXT,
  domain TEXT,
  coolify_app_uuid TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  deployed_url TEXT,
  error_message TEXT,
  health_status TEXT DEFAULT 'unknown',
  last_health_check TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  auto_restart_count INTEGER DEFAULT 0,
  last_restart_at TIMESTAMPTZ,
  secrets_cleaned BOOLEAN DEFAULT false,
  secrets_cleaned_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.server_deployments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deployments" ON public.server_deployments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deployments" ON public.server_deployments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deployments" ON public.server_deployments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deployments" ON public.server_deployments
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_server_deployments_updated_at
  BEFORE UPDATE ON public.server_deployments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for server_deployments
ALTER TABLE public.server_deployments REPLICA IDENTITY FULL;

-- ----------------------------------------
-- TABLE: cleaning_cache (depends on projects_analysis)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.cleaning_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects_analysis(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  cleaned_content TEXT,
  tokens_used INTEGER DEFAULT 0,
  api_cost_cents INTEGER DEFAULT 0,
  cleaned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, file_path, file_hash)
);

ALTER TABLE public.cleaning_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cache" ON public.cleaning_cache
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cache" ON public.cleaning_cache
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cache" ON public.cleaning_cache
  FOR UPDATE USING (auth.uid() = user_id);

-- ----------------------------------------
-- TABLE: cleaning_estimates (depends on projects_analysis)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.cleaning_estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects_analysis(id) ON DELETE SET NULL,
  project_name TEXT NOT NULL,
  total_files INTEGER NOT NULL DEFAULT 0,
  total_lines INTEGER NOT NULL DEFAULT 0,
  estimated_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  actual_tokens_used INTEGER,
  actual_cost_cents INTEGER,
  sale_price_cents INTEGER,
  margin_cents INTEGER,
  margin_percentage NUMERIC(5,2),
  requires_admin_approval BOOLEAN DEFAULT false,
  admin_approved BOOLEAN,
  admin_approved_by TEXT,
  admin_approved_at TIMESTAMP WITH TIME ZONE,
  excluded_paths TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cleaning_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own estimates" ON public.cleaning_estimates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own estimates" ON public.cleaning_estimates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own estimates" ON public.cleaning_estimates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all estimates" ON public.cleaning_estimates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
  );

CREATE POLICY "Admins can update all estimates" ON public.cleaning_estimates
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin')
  );

CREATE TRIGGER update_cleaning_estimates_updated_at
  BEFORE UPDATE ON public.cleaning_estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- TABLE: security_audit_logs (depends on user_servers, server_deployments)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  server_id UUID REFERENCES public.user_servers(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES public.server_deployments(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.security_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage audit logs" ON public.security_audit_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user ON public.security_audit_logs(user_id);

-- ----------------------------------------
-- TABLE: health_check_logs (depends on server_deployments)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.health_check_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID REFERENCES public.server_deployments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  response_time_ms INTEGER,
  http_status INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_check_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view health logs for their deployments" ON public.health_check_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.server_deployments sd WHERE sd.id = deployment_id AND sd.user_id = auth.uid())
  );

CREATE POLICY "Service role can manage health logs" ON public.health_check_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_health_check_logs_deployment ON public.health_check_logs(deployment_id);
CREATE INDEX IF NOT EXISTS idx_health_check_logs_checked_at ON public.health_check_logs(checked_at DESC);

-- ----------------------------------------
-- TABLE: user_purchases (depends on server_deployments, user_servers)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  service_type text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'cad',
  status text NOT NULL DEFAULT 'completed',
  is_subscription boolean DEFAULT false,
  subscription_status text,
  subscription_ends_at timestamptz,
  used boolean DEFAULT false,
  used_at timestamptz,
  deployment_id uuid REFERENCES public.server_deployments(id) ON DELETE SET NULL,
  server_id uuid REFERENCES public.user_servers(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases" ON public.user_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all purchases" ON public.user_purchases
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update purchases" ON public.user_purchases
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access" ON public.user_purchases
  FOR ALL USING (auth.role() = 'service_role'::text);

CREATE TRIGGER update_user_purchases_updated_at
  BEFORE UPDATE ON public.user_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_user_purchases_user ON public.user_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_service ON public.user_purchases(service_type);
CREATE INDEX IF NOT EXISTS idx_user_purchases_status ON public.user_purchases(status);

-- ----------------------------------------
-- TABLE: sync_configurations (depends on server_deployments)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_configurations (
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
  widget_token TEXT UNIQUE,
  widget_token_created_at TIMESTAMPTZ,
  widget_token_used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  widget_token_revoked BOOLEAN DEFAULT FALSE,
  widget_token_last_ip TEXT DEFAULT NULL,
  zen_mode BOOLEAN DEFAULT false,
  time_saved_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sync_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync configs" ON public.sync_configurations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sync configs" ON public.sync_configurations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync configs" ON public.sync_configurations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sync configs" ON public.sync_configurations
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all sync configs" ON public.sync_configurations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Public widget token read access" ON public.sync_configurations
  FOR SELECT USING (widget_token IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_sync_configurations_widget_token 
  ON public.sync_configurations(widget_token) 
  WHERE widget_token IS NOT NULL AND widget_token_revoked = FALSE;

CREATE TRIGGER update_sync_configurations_updated_at
  BEFORE UPDATE ON public.sync_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- TABLE: sync_history (depends on sync_configurations)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_history (
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

ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync history" ON public.sync_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all sync history" ON public.sync_history
  FOR ALL USING (auth.role() = 'service_role');

-- ----------------------------------------
-- TABLE: admin_activity_logs (depends on user_servers, server_deployments)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  server_id UUID REFERENCES public.user_servers(id) ON DELETE SET NULL,
  deployment_id UUID REFERENCES public.server_deployments(id) ON DELETE SET NULL,
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'info',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity logs" ON public.admin_activity_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage activity logs" ON public.admin_activity_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_created ON public.admin_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_logs_status ON public.admin_activity_logs(status);

-- ============================================================
-- STEP 9: STANDALONE TABLES (sans dépendances)
-- ============================================================

-- ----------------------------------------
-- TABLE: user_notifications
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications" ON public.user_notifications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage notifications" ON public.user_notifications
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications(user_id, read) WHERE read = false;

-- ----------------------------------------
-- TABLE: newsletter_subscribers
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  subscribed_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  source text DEFAULT 'footer',
  unsubscribed_at timestamp with time zone
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public newsletter signup" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all subscribers" ON public.newsletter_subscribers
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage subscribers" ON public.newsletter_subscribers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- TABLE: otp_verifications
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5
);

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage OTP verifications" ON public.otp_verifications
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_otp_verifications_email ON public.otp_verifications(email);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON public.otp_verifications(expires_at);

-- ----------------------------------------
-- TABLE: pending_liberation_payments
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.pending_liberation_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  project_id TEXT,
  total_files INTEGER NOT NULL,
  max_files_allowed INTEGER NOT NULL DEFAULT 500,
  excess_files INTEGER NOT NULL,
  base_token_cost_cents INTEGER NOT NULL,
  inopay_margin_multiplier NUMERIC(3,2) NOT NULL DEFAULT 2.5,
  supplement_amount_cents INTEGER NOT NULL,
  files_data JSONB,
  selected_paths TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.pending_liberation_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pending payments" ON public.pending_liberation_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending payments" ON public.pending_liberation_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending payments" ON public.pending_liberation_payments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all pending payments" ON public.pending_liberation_payments
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all pending payments" ON public.pending_liberation_payments
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_pending_liberation_user ON public.pending_liberation_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_liberation_status ON public.pending_liberation_payments(status);
CREATE INDEX IF NOT EXISTS idx_pending_liberation_session ON public.pending_liberation_payments(stripe_checkout_session_id);

CREATE TRIGGER update_pending_liberation_payments_updated_at
  BEFORE UPDATE ON public.pending_liberation_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- TABLE: admin_config
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text UNIQUE NOT NULL,
  config_value jsonb NOT NULL DEFAULT '{}',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage config" ON public.admin_config
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can read config" ON public.admin_config
  FOR SELECT USING (auth.role() = 'service_role'::text);

-- Insert default configuration
INSERT INTO public.admin_config (config_key, config_value) 
VALUES ('SECURITY_LIMITS', '{
  "MAX_FILES_PER_LIBERATION": 500,
  "MAX_FILE_SIZE_CHARS": 50000,
  "MAX_API_COST_CENTS": 5000,
  "CACHE_TTL_HOURS": 24,
  "KILL_SWITCH_ENABLED": false
}'::jsonb)
ON CONFLICT (config_key) DO NOTHING;

-- ============================================================
-- STEP 10: EMAIL SYSTEM TABLES
-- ============================================================

-- ----------------------------------------
-- TABLE: email_templates
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_templates" ON public.email_templates
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- TABLE: email_contacts
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.email_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_contacts" ON public.email_contacts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_email_contacts_email ON public.email_contacts(email);
CREATE INDEX IF NOT EXISTS idx_email_contacts_status ON public.email_contacts(status);

CREATE TRIGGER update_email_contacts_updated_at
  BEFORE UPDATE ON public.email_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- TABLE: email_lists
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.email_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_lists" ON public.email_lists
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_lists_updated_at
  BEFORE UPDATE ON public.email_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- TABLE: email_list_contacts (many-to-many)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.email_list_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.email_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.email_contacts(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(list_id, contact_id)
);

ALTER TABLE public.email_list_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_list_contacts" ON public.email_list_contacts
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_email_list_contacts_list ON public.email_list_contacts(list_id);

-- ----------------------------------------
-- TABLE: email_campaigns (depends on email_templates, email_lists)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.email_templates(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  trigger_days INTEGER,
  status TEXT DEFAULT 'active',
  last_run TIMESTAMPTZ,
  name TEXT,
  description TEXT,
  list_id UUID REFERENCES public.email_lists(id) ON DELETE SET NULL,
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_campaigns" ON public.email_campaigns
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_campaigns_updated_at
  BEFORE UPDATE ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------
-- TABLE: email_logs (depends on email_campaigns, email_templates)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent',
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_logs" ON public.email_logs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------
-- TABLE: email_sends (depends on email_campaigns, email_templates, email_contacts)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS public.email_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.email_contacts(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_sends" ON public.email_sends
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_email_sends_campaign ON public.email_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_sends_status ON public.email_sends(status);

-- ============================================================
-- STEP 11: STORAGE BUCKETS
-- ============================================================

-- Note: Ces instructions nécessitent l'accès au schéma storage
-- Bucket pour les archives nettoyées
INSERT INTO storage.buckets (id, name, public)
VALUES ('cleaned-archives', 'cleaned-archives', false)
ON CONFLICT (id) DO NOTHING;

-- Bucket pour les avatars
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true, 
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for cleaned-archives
CREATE POLICY "Users can upload cleaned archives" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'cleaned-archives' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own cleaned archives" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'cleaned-archives' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own cleaned archives" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'cleaned-archives' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for avatars
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- STEP 12: REALTIME CONFIGURATION
-- ============================================================

-- Enable realtime for specific tables
-- Note: Ces instructions peuvent échouer si la publication existe déjà
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_activity_logs;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.server_deployments;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- STEP 13: ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_server_deployments_health 
  ON public.server_deployments(health_status) 
  WHERE status = 'deployed';

-- ============================================================
-- END OF MIGRATION SCRIPT
-- ============================================================

-- NOTE: After running this script, you should:
-- 1. Create your first admin user in user_roles table
-- 2. Configure your secrets (STRIPE_SECRET_KEY, RESEND_API_KEY, etc.)
-- 3. Deploy your Edge Functions separately using the Supabase CLI

-- To create an admin user, run:
-- INSERT INTO public.user_roles (user_id, role) VALUES ('YOUR_USER_UUID', 'admin');
