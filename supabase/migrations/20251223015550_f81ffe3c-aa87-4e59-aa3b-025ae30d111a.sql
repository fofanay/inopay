-- Add columns for dual GitHub connection (Source + Destination)
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS github_source_token TEXT,
ADD COLUMN IF NOT EXISTS github_destination_token TEXT,
ADD COLUMN IF NOT EXISTS github_destination_username TEXT;

-- Add comment for clarity
COMMENT ON COLUMN user_settings.github_source_token IS 'Token for reading from Lovable GitHub (optional, for private repos)';
COMMENT ON COLUMN user_settings.github_destination_token IS 'Personal Access Token for writing to user own GitHub account';
COMMENT ON COLUMN user_settings.github_destination_username IS 'Username of the destination GitHub account';