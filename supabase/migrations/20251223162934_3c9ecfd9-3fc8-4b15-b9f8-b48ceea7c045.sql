-- Table for pending liberation payments (large projects awaiting payment)
CREATE TABLE public.pending_liberation_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_name TEXT NOT NULL,
  project_id TEXT,
  
  -- File analysis
  total_files INTEGER NOT NULL,
  max_files_allowed INTEGER NOT NULL DEFAULT 500,
  excess_files INTEGER NOT NULL,
  
  -- Cost calculation
  base_token_cost_cents INTEGER NOT NULL,
  inopay_margin_multiplier NUMERIC(3,2) NOT NULL DEFAULT 2.5,
  supplement_amount_cents INTEGER NOT NULL,
  
  -- Files data (stored for later processing)
  files_data JSONB,
  selected_paths TEXT[],  -- For partial cleaning option
  
  -- Payment status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'partial')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.pending_liberation_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own pending payments"
  ON public.pending_liberation_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending payments"
  ON public.pending_liberation_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending payments"
  ON public.pending_liberation_payments FOR UPDATE
  USING (auth.uid() = user_id);

-- Admin policy (admins can see all)
CREATE POLICY "Admins can view all pending payments"
  ON public.pending_liberation_payments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all pending payments"
  ON public.pending_liberation_payments FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for quick lookup
CREATE INDEX idx_pending_liberation_user ON public.pending_liberation_payments(user_id);
CREATE INDEX idx_pending_liberation_status ON public.pending_liberation_payments(status);
CREATE INDEX idx_pending_liberation_session ON public.pending_liberation_payments(stripe_checkout_session_id);

-- Trigger for updated_at
CREATE TRIGGER update_pending_liberation_payments_updated_at
  BEFORE UPDATE ON public.pending_liberation_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();