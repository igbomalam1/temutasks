-- Add proof_url column to temutask_submissions for participant task completion screenshots
ALTER TABLE public.temutask_submissions
ADD COLUMN IF NOT EXISTS proof_url TEXT;

COMMENT ON COLUMN public.temutask_submissions.proof_url IS 'Public URL of participant task completion screenshot';

-- Ensure storage bucket 'temutask-proofs' exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('temutask-proofs', 'temutask-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy to allow authenticated users to upload proof screenshots
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload proof images'
  ) THEN
    CREATE POLICY "Authenticated users can upload proof images"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'temutask-proofs');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public can view proof images'
  ) THEN
    CREATE POLICY "Public can view proof images"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'temutask-proofs');
  END IF;
END $$;
