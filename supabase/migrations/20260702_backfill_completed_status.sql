-- Migration: Recover tasks orphaned by a status rename that was never backfilled.
--
-- `tasks.status` had three live values: 'todo', 'done', and legacy 'completed'.
-- The matrix view queries status='todo' and CompletedSection queries status='done',
-- so 'completed' rows were unreachable from any UI surface.

UPDATE public.tasks
SET status = 'done'
WHERE status = 'completed' AND deleted_at IS NULL;

-- Prevent this drift from happening again.
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo', 'done'));
