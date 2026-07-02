-- Task 1: recover 22 tasks orphaned by a status rename that was never backfilled.
UPDATE public.tasks
SET status = 'done'
WHERE status = 'completed' AND deleted_at IS NULL;

-- Prevent this drift from happening again.
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'done'));
