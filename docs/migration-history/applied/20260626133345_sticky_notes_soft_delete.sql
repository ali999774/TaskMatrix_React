-- Note recoverability: soft-delete for sticky_notes (parity with tasks.deleted_at).
-- Additive, nullable, idempotent. Existing rows have deleted_at = NULL (= active).
ALTER TABLE public.sticky_notes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partition active-vs-trash lookups by user. Active list filters deleted_at IS NULL;
-- the Trash view filters deleted_at IS NOT NULL.
CREATE INDEX IF NOT EXISTS sticky_notes_user_deleted_idx
  ON public.sticky_notes (user_id, deleted_at);
