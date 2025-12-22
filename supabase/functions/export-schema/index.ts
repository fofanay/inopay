import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Accès admin requis' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[export-schema] Starting schema export for admin:', user.email);

    // 1. Get all tables from public schema
    const { data: tables, error: tablesError } = await supabase.rpc('get_schema_tables');
    
    let sqlStatements: string[] = [];
    let tablesList: string[] = [];
    let rlsPolicies: any[] = [];
    let functions: any[] = [];
    let triggers: any[] = [];

    // If RPC doesn't exist, query information_schema directly
    const tablesQuery = `
      SELECT table_name, column_name, data_type, is_nullable, column_default, 
             character_maximum_length, numeric_precision
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position
    `;

    // Get table info
    const { data: columnsData } = await supabase.from('deployment_history').select('*').limit(0);
    
    // Since we can't run raw SQL, we'll use the known schema from types.ts
    // and generate migration SQL based on the actual table structure
    
    const knownTables = [
      'admin_activity_logs',
      'banned_users', 
      'deployment_history',
      'email_campaigns',
      'email_contacts',
      'email_list_contacts',
      'email_lists',
      'email_logs',
      'email_sends',
      'email_templates',
      'health_check_logs',
      'newsletter_subscribers',
      'projects_analysis',
      'security_audit_logs',
      'server_deployments',
      'subscriptions',
      'sync_configurations',
      'sync_history',
      'user_notifications',
      'user_purchases',
      'user_roles',
      'user_servers',
      'user_settings'
    ];

    // Generate CREATE TABLE statements based on known schema
    const tableDefinitions: Record<string, string> = {
      admin_activity_logs: `
CREATE TABLE IF NOT EXISTS public.admin_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  deployment_id UUID,
  server_id UUID,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'info',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity logs" ON public.admin_activity_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage activity logs" ON public.admin_activity_logs
  FOR ALL USING (auth.role() = 'service_role');`,

      banned_users: `
CREATE TABLE IF NOT EXISTS public.banned_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  banned_by UUID,
  reason TEXT,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.banned_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage banned users" ON public.banned_users
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      deployment_history: `
CREATE TABLE IF NOT EXISTS public.deployment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  deployment_type TEXT NOT NULL DEFAULT 'ftp',
  status TEXT NOT NULL DEFAULT 'success',
  hosting_type TEXT DEFAULT 'vps',
  files_uploaded INTEGER DEFAULT 0,
  server_ip TEXT,
  host TEXT,
  deployed_url TEXT,
  coolify_url TEXT,
  cleaned_dependencies TEXT[] DEFAULT '{}',
  portability_score_before INTEGER,
  portability_score_after INTEGER DEFAULT 100,
  cost_analysis JSONB,
  services_replaced JSONB DEFAULT '[]'::jsonb,
  liberation_report_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deployment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own deployments" ON public.deployment_history
  FOR SELECT USING (auth.uid() = user_id);
  
CREATE POLICY "Users can create their own deployments" ON public.deployment_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
  
CREATE POLICY "Users can delete their own deployments" ON public.deployment_history
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all deployment_history" ON public.deployment_history
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));`,

      email_campaigns: `
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  description TEXT,
  trigger_type TEXT NOT NULL,
  trigger_days INTEGER,
  template_id UUID REFERENCES public.email_templates(id),
  list_id UUID REFERENCES public.email_lists(id),
  status TEXT DEFAULT 'active',
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  last_run TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_campaigns" ON public.email_campaigns
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      email_contacts: `
CREATE TABLE IF NOT EXISTS public.email_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_contacts" ON public.email_contacts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      email_list_contacts: `
CREATE TABLE IF NOT EXISTS public.email_list_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.email_lists(id),
  contact_id UUID NOT NULL REFERENCES public.email_contacts(id),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_list_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_list_contacts" ON public.email_list_contacts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      email_lists: `
CREATE TABLE IF NOT EXISTS public.email_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_lists" ON public.email_lists
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      email_logs: `
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_id UUID REFERENCES public.email_templates(id),
  campaign_id UUID REFERENCES public.email_campaigns(id),
  status TEXT DEFAULT 'sent',
  sent_at TIMESTAMPTZ DEFAULT now(),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_logs" ON public.email_logs
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      email_sends: `
CREATE TABLE IF NOT EXISTS public.email_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  template_id UUID REFERENCES public.email_templates(id),
  campaign_id UUID REFERENCES public.email_campaigns(id),
  contact_id UUID REFERENCES public.email_contacts(id),
  metadata JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_sends" ON public.email_sends
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      email_templates: `
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_templates" ON public.email_templates
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      health_check_logs: `
CREATE TABLE IF NOT EXISTS public.health_check_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deployment_id UUID REFERENCES public.server_deployments(id),
  status TEXT NOT NULL,
  http_status INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.health_check_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view health logs for their deployments" ON public.health_check_logs
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM server_deployments sd 
    WHERE sd.id = health_check_logs.deployment_id AND sd.user_id = auth.uid()
  ));

CREATE POLICY "Service role can manage health logs" ON public.health_check_logs
  FOR ALL USING (auth.role() = 'service_role');`,

      newsletter_subscribers: `
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'footer',
  is_active BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public newsletter signup" ON public.newsletter_subscribers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all subscribers" ON public.newsletter_subscribers
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage subscribers" ON public.newsletter_subscribers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      projects_analysis: `
CREATE TABLE IF NOT EXISTS public.projects_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  portability_score INTEGER DEFAULT 0,
  detected_issues JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));`,

      security_audit_logs: `
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  server_id UUID REFERENCES public.user_servers(id),
  deployment_id UUID REFERENCES public.server_deployments(id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.security_audit_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage audit logs" ON public.security_audit_logs
  FOR ALL USING (auth.role() = 'service_role');`,

      server_deployments: `
CREATE TABLE IF NOT EXISTS public.server_deployments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  server_id UUID NOT NULL REFERENCES public.user_servers(id),
  project_name TEXT NOT NULL,
  github_repo_url TEXT,
  domain TEXT,
  deployed_url TEXT,
  coolify_app_uuid TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  health_status TEXT DEFAULT 'unknown',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  last_health_check TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  auto_restart_count INTEGER DEFAULT 0,
  last_restart_at TIMESTAMPTZ,
  secrets_cleaned BOOLEAN DEFAULT false,
  secrets_cleaned_at TIMESTAMPTZ,
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
  FOR DELETE USING (auth.uid() = user_id);`,

      subscriptions: `
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'inactive',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  credits_remaining INTEGER DEFAULT 0,
  free_credits INTEGER DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all subscriptions" ON public.subscriptions
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage all subscriptions" ON public.subscriptions
  FOR ALL USING (auth.role() = 'service_role');`,

      sync_configurations: `
CREATE TABLE IF NOT EXISTS public.sync_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  deployment_id UUID NOT NULL REFERENCES public.server_deployments(id),
  github_repo_url TEXT NOT NULL,
  github_webhook_secret TEXT NOT NULL,
  sync_enabled BOOLEAN DEFAULT false,
  allowed_branches TEXT[] DEFAULT ARRAY['main', 'master'],
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT DEFAULT 'pending',
  last_sync_commit TEXT,
  last_sync_error TEXT,
  sync_count INTEGER DEFAULT 0,
  time_saved_minutes INTEGER DEFAULT 0,
  zen_mode BOOLEAN DEFAULT false,
  widget_token TEXT,
  widget_token_created_at TIMESTAMPTZ,
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

CREATE POLICY "Public widget token read access" ON public.sync_configurations
  FOR SELECT USING (widget_token IS NOT NULL);

CREATE POLICY "Service role can manage all sync configs" ON public.sync_configurations
  FOR ALL USING (auth.role() = 'service_role');`,

      sync_history: `
CREATE TABLE IF NOT EXISTS public.sync_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_config_id UUID NOT NULL REFERENCES public.sync_configurations(id),
  user_id UUID NOT NULL,
  commit_sha TEXT NOT NULL,
  commit_message TEXT,
  status TEXT DEFAULT 'pending',
  files_changed TEXT[],
  files_cleaned TEXT[],
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

ALTER TABLE public.sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync history" ON public.sync_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all sync history" ON public.sync_history
  FOR ALL USING (auth.role() = 'service_role');`,

      user_notifications: `
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  action_url TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.user_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.user_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage notifications" ON public.user_notifications
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Admins can manage all notifications" ON public.user_notifications
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      user_purchases: `
CREATE TABLE IF NOT EXISTS public.user_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  service_type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'cad',
  status TEXT NOT NULL DEFAULT 'completed',
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  server_id UUID REFERENCES public.user_servers(id),
  deployment_id UUID REFERENCES public.server_deployments(id),
  is_subscription BOOLEAN DEFAULT false,
  subscription_status TEXT,
  subscription_ends_at TIMESTAMPTZ,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases" ON public.user_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all purchases" ON public.user_purchases
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update purchases" ON public.user_purchases
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access" ON public.user_purchases
  FOR ALL USING (auth.role() = 'service_role');`,

      user_roles: `
CREATE TYPE app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));`,

      user_servers: `
CREATE TABLE IF NOT EXISTS public.user_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  setup_id TEXT,
  error_message TEXT,
  coolify_url TEXT,
  coolify_token TEXT,
  db_status TEXT DEFAULT 'pending',
  db_host TEXT,
  db_port INTEGER DEFAULT 5432,
  db_name TEXT,
  db_user TEXT,
  db_password TEXT,
  db_url TEXT,
  jwt_secret TEXT,
  anon_key TEXT,
  service_role_key TEXT,
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
  FOR DELETE USING (auth.uid() = user_id);`,

      user_settings: `
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  api_provider TEXT NOT NULL DEFAULT 'openai',
  api_key TEXT,
  github_token TEXT,
  preferred_deploy_platform TEXT DEFAULT 'vercel',
  default_repo_private BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user_settings" ON public.user_settings
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));`
    };

    // Database functions
    const databaseFunctions = `
-- Helper function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
`;

    // Storage bucket
    const storageBucket = `
-- Create storage bucket for cleaned archives
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cleaned-archives', 'cleaned-archives', false)
ON CONFLICT (id) DO NOTHING;
`;

    // Build full migration SQL
    // Order matters: user_roles first (for app_role type), then independent tables, then dependent tables
    const orderedTables = [
      'user_roles',       // Must be first (creates app_role type)
      'user_servers',     // Independent
      'user_settings',    // Independent
      'subscriptions',    // Independent
      'newsletter_subscribers', // Independent
      'email_templates',  // Independent
      'email_lists',      // Independent
      'email_contacts',   // Independent
      'email_campaigns',  // Depends on email_templates, email_lists
      'email_list_contacts', // Depends on email_lists, email_contacts
      'email_logs',       // Depends on email_templates, email_campaigns
      'email_sends',      // Depends on email_templates, email_campaigns, email_contacts
      'deployment_history', // Independent
      'projects_analysis', // Independent
      'user_notifications', // Independent
      'banned_users',     // Independent
      'server_deployments', // Depends on user_servers
      'health_check_logs', // Depends on server_deployments
      'security_audit_logs', // Depends on user_servers, server_deployments
      'user_purchases',   // Depends on user_servers, server_deployments
      'sync_configurations', // Depends on server_deployments
      'sync_history',     // Depends on sync_configurations
      'admin_activity_logs', // Depends on server_deployments
    ];

    let fullMigrationSQL = `-- ================================================
-- INOPAY Database Migration Script
-- Generated: ${new Date().toISOString()}
-- ================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

`;

    // Add database functions first
    fullMigrationSQL += `-- ================================================
-- Database Functions
-- ================================================
${databaseFunctions}

`;

    // Add tables in order
    fullMigrationSQL += `-- ================================================
-- Tables and RLS Policies
-- ================================================
`;

    for (const tableName of orderedTables) {
      if (tableDefinitions[tableName]) {
        fullMigrationSQL += `
-- Table: ${tableName}
${tableDefinitions[tableName]}

`;
      }
    }

    // Add storage
    fullMigrationSQL += `
-- ================================================
-- Storage Buckets
-- ================================================
${storageBucket}
`;

    // Generate summary
    const summary = {
      tables: orderedTables.length,
      functions: 3,
      storageBuckets: 1,
      secrets: [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'RESEND_API_KEY',
        'ANTHROPIC_API_KEY',
        'GITHUB_PERSONAL_ACCESS_TOKEN'
      ],
      edgeFunctions: 48
    };

    console.log('[export-schema] Schema export completed:', summary);

    return new Response(JSON.stringify({
      success: true,
      sql: fullMigrationSQL,
      summary,
      tables: orderedTables,
      secretsToRecreate: summary.secrets,
      instructions: `
## Instructions de migration

1. **Créer un nouveau projet Supabase** sur https://supabase.com

2. **Exécuter le SQL** ci-dessus dans le SQL Editor de votre nouveau projet

3. **Recréer les secrets** dans la section Edge Functions > Secrets :
${summary.secrets.map(s => `   - ${s}`).join('\n')}

4. **Déployer les Edge Functions** :
   - Cloner le repo
   - Configurer supabase CLI avec votre nouveau projet
   - Exécuter: supabase functions deploy --all

5. **Mettre à jour .env** avec vos nouvelles credentials

6. **Migrer les données** si nécessaire via export/import
`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[export-schema] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
