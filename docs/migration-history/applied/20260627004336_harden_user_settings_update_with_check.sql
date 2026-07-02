-- Add WITH CHECK to the user_settings UPDATE policy so a user cannot re-assign
-- their settings row to another user_id. Idempotent: drop + recreate.
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
