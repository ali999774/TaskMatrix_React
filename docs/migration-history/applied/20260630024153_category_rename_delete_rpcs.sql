-- Atomic category rename/delete RPCs. SECURITY DEFINER (bypasses RLS) so every
-- statement is scoped to auth.uid(); search_path locked to '' with fully-qualified
-- objects. Single-transaction bodies cannot half-apply, which is what prevents the
-- offline two-write cascade from re-minting orphans.

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
