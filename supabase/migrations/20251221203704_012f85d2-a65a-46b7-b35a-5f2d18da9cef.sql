-- Create newsletter_subscribers table
CREATE TABLE public.newsletter_subscribers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  subscribed_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  source text DEFAULT 'footer',
  unsubscribed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Allow public inserts (for anonymous newsletter signups)
CREATE POLICY "Allow public newsletter signup"
ON public.newsletter_subscribers
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admins can view all subscribers
CREATE POLICY "Admins can view all subscribers"
ON public.newsletter_subscribers
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can manage subscribers
CREATE POLICY "Admins can manage subscribers"
ON public.newsletter_subscribers
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));