ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill existing done tasks with their updated_at (best proxy)
UPDATE tasks SET completed_at = updated_at WHERE status = 'done' AND completed_at IS NULL;

-- Index for fast ordering
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks (completed_at DESC NULLS LAST);
