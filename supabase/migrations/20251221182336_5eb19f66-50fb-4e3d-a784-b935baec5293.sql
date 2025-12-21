-- Table pour tracker tous les achats de services
CREATE TABLE public.user_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  service_type text NOT NULL CHECK (service_type IN ('deploy', 'redeploy', 'monitoring', 'server')),
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'cad',
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'pending')),
  is_subscription boolean DEFAULT false,
  subscription_status text CHECK (subscription_status IS NULL OR subscription_status IN ('active', 'canceled', 'expired')),
  subscription_ends_at timestamptz,
  used boolean DEFAULT false,
  used_at timestamptz,
  deployment_id uuid REFERENCES public.server_deployments(id) ON DELETE SET NULL,
  server_id uuid REFERENCES public.user_servers(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_user_purchases_user ON public.user_purchases(user_id);
CREATE INDEX idx_user_purchases_service ON public.user_purchases(service_type);
CREATE INDEX idx_user_purchases_status ON public.user_purchases(status);
CREATE INDEX idx_user_purchases_subscription ON public.user_purchases(is_subscription, subscription_status);

-- Enable RLS
ALTER TABLE public.user_purchases ENABLE ROW LEVEL SECURITY;

-- Policies RLS
CREATE POLICY "Users can view own purchases" ON public.user_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all purchases" ON public.user_purchases
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update purchases" ON public.user_purchases
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access" ON public.user_purchases
  FOR ALL USING (auth.role() = 'service_role'::text);

-- Trigger pour updated_at
CREATE TRIGGER update_user_purchases_updated_at
  BEFORE UPDATE ON public.user_purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();