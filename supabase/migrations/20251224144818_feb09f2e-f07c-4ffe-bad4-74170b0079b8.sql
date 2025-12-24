-- Create OTP verifications table for email verification during signup
CREATE TABLE public.otp_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5
);

-- Enable RLS
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage OTP records
CREATE POLICY "Service role can manage OTP verifications"
ON public.otp_verifications
FOR ALL
USING (auth.role() = 'service_role');

-- Create index for faster email lookups
CREATE INDEX idx_otp_verifications_email ON public.otp_verifications(email);

-- Create index for cleanup of expired records
CREATE INDEX idx_otp_verifications_expires_at ON public.otp_verifications(expires_at);

-- Create function to clean up expired OTP records (can be called periodically)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_verifications 
  WHERE expires_at < now() OR verified = true;
END;
$$;