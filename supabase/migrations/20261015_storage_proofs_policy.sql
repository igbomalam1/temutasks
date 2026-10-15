-- ============================================================================
-- Migration: Add storage policies for 'temutask-proofs' bucket
-- Allows authenticated and anon users to upload and view task proof screenshots
-- ============================================================================

-- Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'temutask-proofs',
  'temutask-proofs',
  true,
  12582912, -- 12MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 12582912,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow uploads to temutask-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read of temutask-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates to temutask-proofs" ON storage.objects;

-- Allow uploads (INSERT)
CREATE POLICY "Allow uploads to temutask-proofs"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'temutask-proofs');

-- Allow public read (SELECT)
CREATE POLICY "Allow public read of temutask-proofs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'temutask-proofs');

-- Allow updates (UPDATE)
CREATE POLICY "Allow updates to temutask-proofs"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'temutask-proofs');
