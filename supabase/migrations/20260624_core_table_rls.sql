-- Enforce row-level security on the three core user-scoped tables.
-- (SECURITY-AUDIT #3 — these policies were previously not version-controlled.)
--
-- The client already filters every query by user_id, but that is only
-- defense-in-depth. These policies are the actual access boundary: with RLS
-- enabled and these policies in place, a user can only read/write rows where
-- auth.uid() = user_id, regardless of what the client sends.
--
-- The service_role key (used by edge functions like push-send) bypasses RLS,
-- so server-side writes are unaffected. Realtime continues to work because the
-- client subscribes with its own user JWT.
--
-- Idempotent: ENABLE is a no-op if already on; policies are dropped+recreated.

-- ── tasks ──────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own tasks" ON public.tasks;
CREATE POLICY "Users manage own tasks" ON public.tasks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── sticky_notes ───────────────────────────────────────────────────────────
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own notes" ON public.sticky_notes;
CREATE POLICY "Users manage own notes" ON public.sticky_notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── user_settings ──────────────────────────────────────────────────────────
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;
CREATE POLICY "Users manage own settings" ON public.user_settings
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
