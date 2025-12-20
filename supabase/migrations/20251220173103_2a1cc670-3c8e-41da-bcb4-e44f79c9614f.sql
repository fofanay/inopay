-- Création d'un cron job pour nettoyer les fichiers ZIP de plus de 24h
-- Note: Cette fonctionnalité nécessite l'extension pg_cron qui est disponible sur Supabase

-- Activer l'extension pg_cron si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Créer la fonction qui appellera l'edge function de nettoyage
CREATE OR REPLACE FUNCTION public.trigger_storage_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Log le démarrage du nettoyage
  RAISE NOTICE 'Starting storage cleanup at %', now();
  
  -- L'edge function sera appelée via HTTP par un mécanisme externe
  -- Cette fonction sert de point d'entrée pour le cron
END;
$$;

-- Planifier le nettoyage toutes les heures
SELECT cron.schedule(
  'cleanup-old-archives',
  '0 * * * *', -- Toutes les heures
  $$ SELECT public.trigger_storage_cleanup() $$
);