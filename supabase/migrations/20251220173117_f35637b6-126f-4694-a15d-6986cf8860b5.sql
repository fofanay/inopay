-- Améliorer le cron job pour appeler directement l'edge function via pg_net
-- Activer pg_net pour les appels HTTP
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Recréer la fonction de nettoyage pour qu'elle appelle l'edge function
CREATE OR REPLACE FUNCTION public.trigger_storage_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Appeler l'edge function de nettoyage via pg_net
  PERFORM extensions.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/cleanup-storage',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
END;
$$;