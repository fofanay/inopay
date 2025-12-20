-- Create storage bucket for cleaned archives
INSERT INTO storage.buckets (id, name, public)
VALUES ('cleaned-archives', 'cleaned-archives', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for cleaned-archives bucket
-- Users can upload their own files
CREATE POLICY "Users can upload cleaned archives"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'cleaned-archives' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own files
CREATE POLICY "Users can view their own cleaned archives"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'cleaned-archives' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own files
CREATE POLICY "Users can delete their own cleaned archives"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'cleaned-archives' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);