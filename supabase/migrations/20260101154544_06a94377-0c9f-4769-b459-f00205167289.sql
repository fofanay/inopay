-- Table pour suivre les jobs de libération
CREATE TABLE liberation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('zip', 'github', 'local')),
  source_url TEXT,
  project_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'cleaning', 'auditing', 'generating', 'completed', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  audit_score INTEGER CHECK (audit_score >= 0 AND audit_score <= 100),
  audit_report JSONB,
  result_url TEXT,
  error_message TEXT,
  files_count INTEGER DEFAULT 0,
  files_cleaned INTEGER DEFAULT 0,
  proprietary_removed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE liberation_jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own liberation jobs" ON liberation_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create jobs
CREATE POLICY "Users can create liberation jobs" ON liberation_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own jobs
CREATE POLICY "Users can update own liberation jobs" ON liberation_jobs
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can view all jobs
CREATE POLICY "Admins can view all liberation jobs" ON liberation_jobs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage all
CREATE POLICY "Service role can manage liberation jobs" ON liberation_jobs
  FOR ALL USING (auth.role() = 'service_role'::text);

-- Add index for faster lookups
CREATE INDEX idx_liberation_jobs_user_id ON liberation_jobs(user_id);
CREATE INDEX idx_liberation_jobs_status ON liberation_jobs(status);

-- Trigger for updated_at
CREATE TRIGGER update_liberation_jobs_updated_at
  BEFORE UPDATE ON liberation_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();