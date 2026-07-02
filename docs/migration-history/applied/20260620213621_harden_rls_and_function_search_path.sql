-- TaskMatrix DB hardening — resolves Supabase security advisor WARNs.

-- (1) Pin the trigger function's search_path  [lint 0011_function_search_path_mutable]
alter function public.update_updated_at() set search_path = '';

-- (2) Scope RLS policies to the authenticated role  [lint 0012_auth_allow_anonymous_sign_ins]
alter policy "users_own_tasks"               on public.tasks          to authenticated;
alter policy "users_own_notes"               on public.sticky_notes   to authenticated;
alter policy "Users can read own settings"   on public.user_settings  to authenticated;
alter policy "Users can insert own settings" on public.user_settings  to authenticated;
alter policy "Users can update own settings" on public.user_settings  to authenticated;
