-- Table des contacts email
CREATE TABLE public.email_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained')),
  source TEXT DEFAULT 'manual',
  tags TEXT[] DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table des listes de diffusion
CREATE TABLE public.email_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table de liaison contacts-listes (many-to-many)
CREATE TABLE public.email_list_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.email_lists(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.email_contacts(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(list_id, contact_id)
);

-- Table des envois email (historique détaillé)
CREATE TABLE public.email_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.email_contacts(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'complained')),
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ajouter des colonnes à email_campaigns pour plus de fonctionnalités
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES public.email_lists(id) ON DELETE SET NULL;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS sent_count INTEGER DEFAULT 0;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS opened_count INTEGER DEFAULT 0;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS clicked_count INTEGER DEFAULT 0;
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.email_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_list_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

-- Policies pour admins seulement
CREATE POLICY "Admins can manage email_contacts" ON public.email_contacts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage email_lists" ON public.email_lists
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage email_list_contacts" ON public.email_list_contacts
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage email_sends" ON public.email_sends
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Index pour performances
CREATE INDEX idx_email_contacts_email ON public.email_contacts(email);
CREATE INDEX idx_email_contacts_status ON public.email_contacts(status);
CREATE INDEX idx_email_sends_campaign ON public.email_sends(campaign_id);
CREATE INDEX idx_email_sends_status ON public.email_sends(status);
CREATE INDEX idx_email_list_contacts_list ON public.email_list_contacts(list_id);

-- Trigger pour updated_at
CREATE TRIGGER update_email_contacts_updated_at
  BEFORE UPDATE ON public.email_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_lists_updated_at
  BEFORE UPDATE ON public.email_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();