-- lead_days = days BEFORE due_date a task is promoted to the Today view.
-- Nullable, default NULL (NOT 0): NULL = "never set", distinct from explicit 0.
-- Coalesced NULL->0 at READ time only; never written as 0-for-unset.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lead_days integer;
