-- Table pour stocker le cache de nettoyage des fichiers
CREATE TABLE public.cleaning_cache (
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

-- Table pour stocker les estimations et marges de nettoyage
CREATE TABLE public.cleaning_estimates (
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

-- Enable RLS
ALTER TABLE public.cleaning_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_estimates ENABLE ROW LEVEL SECURITY;

-- Policies for cleaning_cache
CREATE POLICY "Users can view their own cache"
ON public.cleaning_cache FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cache"
ON public.cleaning_cache FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cache"
ON public.cleaning_cache FOR UPDATE
USING (auth.uid() = user_id);

-- Policies for cleaning_estimates
CREATE POLICY "Users can view their own estimates"
ON public.cleaning_estimates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own estimates"
ON public.cleaning_estimates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own estimates"
ON public.cleaning_estimates FOR UPDATE
USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins can view all estimates"
ON public.cleaning_estimates FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can update all estimates"
ON public.cleaning_estimates FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_cleaning_estimates_updated_at
BEFORE UPDATE ON public.cleaning_estimates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();