-- Follow-up reconciliation: capture live-only objects the repo never declared.
--
-- WHY THIS FILE EXISTS
-- The live database (Supabase project xulnxwwwjpvgsaqnsllo) contains three
-- objects that a fresh environment built from this repo would NOT recreate,
-- because their DDL was applied out-of-band (Supabase SQL editor / a migration
-- whose .sql file was never committed here):
--
--   1. rename_category(text, text)  — SECURITY DEFINER RPC
--   2. delete_category(text, text)  — SECURITY DEFINER RPC
--        Live ledger records these under version 20260630024153
--        (name: category_rename_delete_rpcs), but no .sql for it is in the repo.
--   3. uniq_active_occurrence_per_series — a PARTIAL UNIQUE INDEX on
--        tasks(series_id) WHERE deleted_at IS NULL AND status = 'todo'.
--        Present live, but recorded in NO ledger migration. The repo's
--        20260627_add_series_id.sql adds the series_id COLUMN only, never the
--        index — the same declared-vs-actual gap as the column itself.
--
-- The definitions below are transcribed verbatim from the live database
-- (pg_get_functiondef + pg_indexes) so this file reproduces exactly what runs
-- in prod. It is idempotent: CREATE OR REPLACE + CREATE INDEX IF NOT EXISTS
-- make applying it to prod a no-op that yields the current deployed state.
--
-- DEPENDENCY / KNOWN LIMITATION: this file ALTERs `public.tasks` and references
-- `public.user_settings`, but NEITHER table is created by any migration in this
-- repo (only `device_tokens` is). Until a full baseline migration that CREATEs
-- tasks / sticky_notes / user_settings is committed, a from-zero `supabase db
-- reset` against this repo still cannot succeed. This file closes the RPC/index
-- gap; it does not substitute for that missing baseline.

-- ── 1 & 2: category rename/delete RPCs ──────────────────────────────────────
-- Atomic category rename/delete. SECURITY DEFINER (bypasses RLS) so every
-- statement is scoped to auth.uid(); search_path locked to '' with fully
-- qualified objects. Single-transaction bodies cannot half-apply.

CREATE OR REPLACE FUNCTION public.rename_category(p_old text, p_new text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_old IS NULL OR btrim(p_old) = '' THEN
    RAISE EXCEPTION 'p_old (current label) is required';
  END IF;
  IF p_new IS NULL OR btrim(p_new) = '' THEN
    RAISE EXCEPTION 'p_new (new label) is required';
  END IF;

  UPDATE public.user_settings us
  SET categories = (
    SELECT jsonb_agg(
             CASE WHEN elem->>'label' = p_old
                  THEN jsonb_set(elem, '{label}', to_jsonb(p_new))
                  ELSE elem END
             ORDER BY ord
           )
    FROM jsonb_array_elements(us.categories) WITH ORDINALITY AS e(elem, ord)
  )
  WHERE us.user_id = v_uid
    AND us.categories @> jsonb_build_array(jsonb_build_object('label', p_old));

  UPDATE public.tasks
  SET category = p_new
  WHERE category = p_old AND user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_category(p_label text, p_reassign_to text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_label IS NULL OR btrim(p_label) = '' THEN
    RAISE EXCEPTION 'p_label is required';
  END IF;

  IF p_reassign_to IS NOT NULL THEN
    IF p_reassign_to = p_label THEN
      RAISE EXCEPTION 'cannot reassign tasks to the category being deleted';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_settings us,
           jsonb_array_elements(us.categories) AS e(elem)
      WHERE us.user_id = v_uid
        AND e.elem->>'label' = p_reassign_to
    ) THEN
      RAISE EXCEPTION 'reassign target % is not an existing category', p_reassign_to;
    END IF;
  END IF;

  UPDATE public.user_settings us
  SET categories = COALESCE((
    SELECT jsonb_agg(elem ORDER BY ord)
    FROM jsonb_array_elements(us.categories) WITH ORDINALITY AS e(elem, ord)
    WHERE elem->>'label' <> p_label
  ), '[]'::jsonb)
  WHERE us.user_id = v_uid;

  UPDATE public.tasks
  SET category = p_reassign_to
  WHERE category = p_label AND user_id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_category(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_category(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_category(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_category(text, text) TO authenticated;

-- ── 3: partial unique index enforcing one active occurrence per series ───────
-- Guarantees a recurring series has at most one live, not-yet-done occurrence.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_occurrence_per_series
  ON public.tasks USING btree (series_id)
  WHERE ((deleted_at IS NULL) AND (status = 'todo'::text));
