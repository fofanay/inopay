-- Create deployment_history table
CREATE TABLE public.deployment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  host TEXT,
  files_uploaded INTEGER DEFAULT 0,
  deployment_type TEXT NOT NULL DEFAULT 'ftp',
  status TEXT NOT NULL DEFAULT 'success',
  deployed_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.deployment_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own deployments" 
ON public.deployment_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deployments" 
ON public.deployment_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deployments" 
ON public.deployment_history 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_deployment_history_user_id ON public.deployment_history(user_id);
CREATE INDEX idx_deployment_history_created_at ON public.deployment_history(created_at DESC);