-- Baseline migration: reconstructs the live public schema as of 2026-07-02.
--
-- Generated from live catalog queries (pg_attribute/pg_attrdef, pg_constraint,
-- pg_indexes, pg_policies, pg_proc, pg_trigger, pg_publication_tables,
-- pg_class.relreplident) via mcp__Supabase__execute_sql, in place of
-- `supabase db dump --linked` (this environment's egress policy blocks direct
-- network access to the project host, so the CLI command could not run here).
--
-- This file is never executed against prod: prod already is this schema.
-- It exists so a fresh environment (`supabase db reset`) can build the same
-- schema from scratch. See docs/migration-ledger-reconciliation-plan.md and
-- docs/migration-history/ for the full applied history this baseline replaces.

-- =========================================================================
-- Tables
-- =========================================================================

CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  notes text,
  category text,
  importance integer DEFAULT 5,
  urgency integer DEFAULT 5,
  status text DEFAULT 'todo'::text,
  due_date date,
  due_time time without time zone,
  estimated_duration integer,
  recurring boolean DEFAULT false,
  recur_frequency text,
  recur_interval integer DEFAULT 1,
  recur_days integer[],
  tags text[],
  subtasks jsonb DEFAULT '[]'::jsonb,
  pinned boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  position integer DEFAULT 0,
  completed_at timestamp with time zone,
  reminder text,
  series_id uuid,
  lead_days integer
);

CREATE TABLE public.sticky_notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text DEFAULT ''::text,
  color text DEFAULT 'yellow'::text,
  position_x integer DEFAULT 0,
  position_y integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  pinned boolean DEFAULT false,
  title text DEFAULT ''::text,
  position integer,
  deleted_at timestamp with time zone
);

CREATE TABLE public.user_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  categories jsonb DEFAULT '[{"icon": "user", "color": "emerald", "label": "personal", "display": "Personal"}, {"icon": "briefcase-business", "color": "blue", "label": "work", "display": "Work"}, {"icon": "heart", "color": "red", "label": "health", "display": "Health"}, {"icon": "graduation-cap", "color": "purple", "label": "learning", "display": "Learning"}]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.device_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- =========================================================================
-- Constraints (PK / FK / UNIQUE / CHECK)
-- =========================================================================

ALTER TABLE public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'done'::text])));

ALTER TABLE public.sticky_notes ADD CONSTRAINT sticky_notes_pkey PRIMARY KEY (id);
ALTER TABLE public.sticky_notes ADD CONSTRAINT sticky_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_settings ADD CONSTRAINT user_settings_user_id_key UNIQUE (user_id);

ALTER TABLE public.device_tokens ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.device_tokens ADD CONSTRAINT device_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.device_tokens ADD CONSTRAINT device_tokens_user_id_token_key UNIQUE (user_id, token);
ALTER TABLE public.device_tokens ADD CONSTRAINT device_tokens_platform_check CHECK ((platform = ANY (ARRAY['ios'::text, 'android'::text, 'web'::text])));

-- =========================================================================
-- Indexes
-- =========================================================================

CREATE INDEX idx_tasks_user_id ON public.tasks USING btree (user_id);
CREATE INDEX idx_tasks_user_active ON public.tasks USING btree (user_id) WHERE (deleted_at IS NULL);
CREATE INDEX idx_tasks_completed_at ON public.tasks USING btree (completed_at DESC NULLS LAST);
-- Out-of-band in prod (no ledger record, no repo file) prior to this reconciliation.
-- Enforces "at most one active todo occurrence per recurring series"; relied on by
-- src/lib/recurrence.ts.
CREATE UNIQUE INDEX uniq_active_occurrence_per_series ON public.tasks USING btree (series_id) WHERE ((deleted_at IS NULL) AND (status = 'todo'::text));

CREATE INDEX idx_sticky_notes_user_id ON public.sticky_notes USING btree (user_id);
CREATE INDEX sticky_notes_user_deleted_idx ON public.sticky_notes USING btree (user_id, deleted_at);

CREATE INDEX idx_user_settings_user_id ON public.user_settings USING btree (user_id);

CREATE INDEX idx_device_tokens_user_platform ON public.device_tokens USING btree (user_id, platform);

-- =========================================================================
-- Row Level Security
-- =========================================================================

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_tasks ON public.tasks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_own_notes ON public.sticky_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own settings" ON public.user_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Matches live prod exactly: role `public` (not `authenticated`), as originally
-- written in the device_tokens migration. A hardening candidate flagged by the
-- reconciliation plan (§2) as out-of-scope for this reconciliation — do not
-- narrow this during baseline generation, or the baseline stops matching prod.
CREATE POLICY "Users can manage own tokens" ON public.device_tokens
  FOR ALL TO public
  USING (auth.uid() = user_id);

-- =========================================================================
-- Functions
-- =========================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.rename_category(p_old text, p_new text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.delete_category(p_label text, p_reassign_to text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

-- Grants as actually recorded in the live ACL (pg_proc.proacl), not merely as
-- the originating migration's text intended: Supabase's schema-level default
-- privileges additionally grant `anon` EXECUTE on newly created public-schema
-- functions, on top of the explicit REVOKE/GRANT pair the migration issued.
-- This differs from the reconciliation plan's §2 characterization ("EXECUTE
-- granted to authenticated, revoked from PUBLIC") -- flagged in the report.
REVOKE ALL ON FUNCTION public.rename_category(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_category(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_category(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_category(text, text) TO anon, authenticated, service_role;

-- =========================================================================
-- Triggers
-- =========================================================================

CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sticky_notes_updated_at BEFORE UPDATE ON public.sticky_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================================================================
-- Realtime publication and replica identity
-- =========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks, public.sticky_notes, public.user_settings;

ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.sticky_notes REPLICA IDENTITY FULL;
ALTER TABLE public.user_settings REPLICA IDENTITY FULL;
-- device_tokens is intentionally NOT in the publication and keeps default
-- replica identity (primary key) -- matches live prod.
