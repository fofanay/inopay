-- Table pour tracker les impressions et conversions upsell post-libération
CREATE TABLE public.liberation_upsell_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  files_count INTEGER DEFAULT 0,
  offers_shown TEXT[] DEFAULT '{}',
  offer_clicked TEXT,
  converted BOOLEAN DEFAULT FALSE,
  purchase_id UUID REFERENCES public.user_purchases(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  converted_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.liberation_upsell_views ENABLE ROW LEVEL SECURITY;

-- Users can insert their own views
CREATE POLICY "Users can insert their own upsell views" 
ON public.liberation_upsell_views 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can view their own views
CREATE POLICY "Users can view their own upsell views" 
ON public.liberation_upsell_views 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can update their own views (for tracking clicks/conversions)
CREATE POLICY "Users can update their own upsell views" 
ON public.liberation_upsell_views 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all upsell views" 
ON public.liberation_upsell_views 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage all
CREATE POLICY "Service role can manage upsell views" 
ON public.liberation_upsell_views 
FOR ALL 
USING (auth.role() = 'service_role'::text);

-- Index for faster queries
CREATE INDEX idx_upsell_views_user_id ON public.liberation_upsell_views(user_id);
CREATE INDEX idx_upsell_views_created_at ON public.liberation_upsell_views(created_at DESC);