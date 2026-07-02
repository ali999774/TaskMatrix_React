-- tasks.category DEFAULT 'Personal' -> NULL. A hardcoded label is never safe
-- across users (labels are user-defined); NULL = uncategorized, which every read
-- path already handles. Metadata-only change; does not rewrite existing rows.
ALTER TABLE public.tasks ALTER COLUMN category SET DEFAULT NULL;
