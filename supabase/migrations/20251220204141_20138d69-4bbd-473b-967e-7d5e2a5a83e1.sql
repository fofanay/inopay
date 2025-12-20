-- Add github_token column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS github_token TEXT;