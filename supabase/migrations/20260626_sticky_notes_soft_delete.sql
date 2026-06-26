-- Note recoverability: soft-delete for sticky_notes (parity with tasks.deleted_at).
--
-- Before this change, deleting a sticky note issued a destructive DELETE — the row
-- was gone, with no restore path. Tasks already use a `deleted_at` timestamp
-- (see useTasks.deleteTask / restoreTask); this brings notes to the same model so
-- a deleted note can be restored from the Trash view and survives the offline queue.
--
-- Additive, nullable, idempotent. Existing rows have deleted_at = NULL (= active).

ALTER TABLE public.sticky_notes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partition active-vs-trash lookups by user. The active list filters
-- deleted_at IS NULL; the Trash view filters deleted_at IS NOT NULL.
CREATE INDEX IF NOT EXISTS sticky_notes_user_deleted_idx
  ON public.sticky_notes (user_id, deleted_at);
