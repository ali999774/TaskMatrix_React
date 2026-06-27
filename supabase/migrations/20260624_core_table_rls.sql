-- Core-table RLS policies — reconciled to match the deployed (prod) state.
--
-- DRIFT BACKGROUND: This file's previous version created policies named
-- "Users manage own <x>" (FOR ALL, no role restriction) and was never applied.
-- The live database was actually provisioned by the applied migration
-- `harden_rls_and_function_search_path` (20260620) with DIFFERENT policies:
--   tasks         → users_own_tasks   (FOR ALL, TO authenticated)
--   sticky_notes  → users_own_notes   (FOR ALL, TO authenticated)
--   user_settings → three command-scoped policies (INSERT / SELECT / UPDATE),
--                   TO authenticated, with NO delete policy.
-- Re-running the old version would have layered DUPLICATE policies on prod and
-- silently widened user_settings to allow DELETE. This version reconciles the
-- file to reality instead.
--
-- IDEMPOTENT + CONVERGENT: every known policy alias is dropped IF EXISTS before
-- the canonical policy is (re)created, so applying this on prod is a no-op that
-- yields exactly the deployed policy set, and applying it to a fresh database
-- reproduces prod. Safe to run repeatedly. The DROP+CREATE pairs run inside the
-- migration's transaction, so there is no window where a table is unprotected.
--
-- The service_role key (edge functions like push-send) bypasses RLS, so
-- server-side writes are unaffected. Realtime keeps working because the client
-- subscribes with its own user JWT (the `authenticated` role).
--
-- HARDENING: the user_settings UPDATE policy carries a WITH CHECK so a user
-- cannot re-assign their settings row to another user_id (USING alone only gates
-- which rows are targeted, not the post-update values).

-- ── tasks ────────────────────────────────────────────────────────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own tasks" ON public.tasks;  -- legacy alias from this file's prior version
DROP POLICY IF EXISTS users_own_tasks ON public.tasks;
CREATE POLICY users_own_tasks ON public.tasks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── sticky_notes ─────────────────────────────────────────────────────────────
ALTER TABLE public.sticky_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own notes" ON public.sticky_notes;  -- legacy alias
DROP POLICY IF EXISTS users_own_notes ON public.sticky_notes;
CREATE POLICY users_own_notes ON public.sticky_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── user_settings ────────────────────────────────────────────────────────────
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own settings" ON public.user_settings;  -- legacy alias
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can read own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
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
