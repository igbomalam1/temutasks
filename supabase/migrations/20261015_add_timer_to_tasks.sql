-- Add duration_hours and expires_at to temutask_tasks
ALTER TABLE public.temutask_tasks
ADD COLUMN IF NOT EXISTS duration_hours INT DEFAULT 24,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.temutask_tasks.duration_hours IS 'Duration of the task in hours (default 24h)';
COMMENT ON COLUMN public.temutask_tasks.expires_at IS 'Exact expiration timestamp of the task round';

-- Backfill expires_at for existing tasks based on created_at + 24 hours
UPDATE public.temutask_tasks
SET 
  duration_hours = COALESCE(duration_hours, 24),
  expires_at = COALESCE(expires_at, created_at + (COALESCE(duration_hours, 24) || ' hours')::INTERVAL)
WHERE expires_at IS NULL;
