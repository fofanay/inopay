-- Drop the dangerous public SELECT policy on sync_configurations
-- Widget access is already properly handled via the widget-auth edge function using service_role
DROP POLICY IF EXISTS "Public widget token read access" ON public.sync_configurations;