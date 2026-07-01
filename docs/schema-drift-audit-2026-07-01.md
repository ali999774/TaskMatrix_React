# Schema / Code Drift Audit — 2026-07-01

Audit of divergence between declared state (repo migrations, code assumptions,
type definitions) and live state (Supabase project `xulnxwwwjpvgsaqnsllo`),
following the `series_id` and `ai-parse` category incidents. Read-only audit;
no code or database state was modified.

**Scope inspected:** all 6 repo migration files vs. the 15-entry live migration
ledger; full live schema (tables, columns, defaults, indexes, constraints,
triggers, functions, RLS policies, realtime publication, extensions); both
edge functions (repo source vs. deployed bundles ai-parse v25, push-send v3);
every `.from()` / `.rpc()` call site in `src/`, both edge functions, and
tests; live data spot-checks on `status`, `category`, `recur_frequency`,
`reminder`, and sticky-note `color` vocabularies.

**Headline:** the two known incidents are not isolated — the same
"declared-but-not-verified" pattern exists in at least 8 other places. The
most urgent are #2 (22 tasks silently invisible to every UI surface right
now) and #4/#5 (the orphan-category generator from the ai-parse incident is
still running in production; the data is only clean because of the manual
cleanup).

---

## 1. Migration ledger and repo files have fully diverged (systemic)

- **Location:** `supabase/migrations/` vs. live `supabase_migrations.schema_migrations`
- **Type of drift:** migration-not-applied / applied-not-in-repo (both directions)
- **Severity:** latent risk — until the next `supabase db push` or environment rebuild, which will fail or mis-provision
- **Evidence:**
  - Live ledger has **15** applied migrations; the repo has **6** files. **10 applied
    migrations have no repo file at all**: `add_tasks_sticky_notes_to_realtime`,
    `set_replica_identity_full`, `add_position_to_sticky_notes`,
    `create_user_settings_table`, `set_replica_identity_user_settings`,
    `harden_rls_and_function_search_path`, `add_completed_at_to_tasks`,
    `harden_user_settings_update_with_check`, `category_default_null`,
    `category_rename_delete_rpcs`.
  - **No repo migration creates the base tables** `tasks`, `sticky_notes`, or
    `user_settings`. A fresh environment cannot be provisioned from the repo.
  - Version strings never match: repo files use date-only prefixes
    (`20260621_device_tokens.sql` → version `20260621`) while the live ledger
    records full timestamps (`20260621233823`). The Supabase CLI therefore
    considers **all 6 repo files unapplied**.
  - Two repo files share the version prefix `20260621` (`device_tokens`,
    `task_reminders`) — duplicate versions in one directory.

## 2. 22 live tasks carry `status='completed'` — invisible to every code path

- **Location:** `tasks.status` (live data) vs. `src/hooks/useTasks.ts:148`, `src/components/CompletedSection.tsx:52`
- **Type of drift:** code-assumes-value-vocabulary (data written by an older code version)
- **Severity:** **silent data loss (active now)** — the rows exist but no user can ever see them
- **Evidence:** live counts: `done` 213, `todo` 64, **`completed` 22**. All 22
  have `deleted_at IS NULL` (not trashed) and `completed_at IS NULL` (created
  2026-03-23 → 2026-06-04, before `add_completed_at_to_tasks`). The matrix
  loads only `eq('status','todo')` (`useTasks.ts:148`, with a comment
  documenting the switch away from `neq('status','completed')`);
  CompletedSection loads only `eq('status','done')`; `clearCompleted` targets
  only `'done'`. Nothing reads, migrates, or displays `'completed'`.
  `App.tsx:616/655/696` still defensively filters `'completed'` and
  `'archived'`, confirming the code half-remembers the legacy vocabulary.
  There is no CHECK constraint on `tasks.status`, so nothing prevents this
  class of drift from recurring.

## 3. `series_id` incident residue: column now live, but the repo file will break the next CLI deploy

- **Location:** `supabase/migrations/20260627_add_series_id.sql` vs. live `tasks.series_id`
- **Type of drift:** migration-not-applied (ledger) + non-idempotent DDL
- **Severity:** latent — guaranteed failure of the first `supabase db push`
- **Evidence:** `tasks.series_id uuid` exists live, but **no ledger entry
  records it** (applied out-of-band). The repo file uses plain
  `ALTER TABLE tasks ADD COLUMN series_id UUID` — no `IF NOT EXISTS`, unlike
  every other repo migration. Because of finding #1 the CLI sees this file as
  pending; applying it against prod errors with `duplicate column`, aborting
  the whole migration run. (All 5 other repo files are idempotent and would
  no-op.)

## 4. ai-parse `parse` mode still generates orphan categories — the client's fix is ignored server-side

- **Location:** `supabase/functions/ai-parse/index.ts:315` (deployed v25 verified byte-identical) vs. `src/lib/ai-parse.ts:73` and `src/App.tsx:546,832,889`
- **Type of drift:** hardcoded-value-list-could-drift (the original incident's generator, still live)
- **Severity:** **visible bug (active now)** — every AI-parsed task can be filed under a category that doesn't exist for that user
- **Evidence:** the client plumbs the user's real category labels into the
  request body (`if (categories && categories.length > 0) body.categories = categories`,
  `ai-parse.ts:73`), but the edge function destructures only
  `{ transcript, model, baseUrl, mode, briefOutput }` — **`body.categories` is
  never read**. The parse prompt instead hardcodes:
  `"Suggest one of: Work, Personal, Health, Learning, Clinic, Dev, Finance, Errands, Home"`.
  `Finance`, `Errands`, `Home` match no user's categories; `Clinic`/`Dev`
  match only Ali's; `Work`/`Health`/`Learning` match only default-category
  users. The result is written to `tasks.category` unvalidated
  (`App.tsx:835/554/904` → `addTask(..., p.category)`). A live query for
  orphan categories currently returns **0 rows** — clean only because the 11
  known orphans were manually repaired; the generator that produced them is
  unchanged.

## 5. `classify` mode: a second hardcoded category list, duplicated in two layers, containing a label that has never existed

- **Location:** `supabase/functions/ai-parse/index.ts:10` (`ALLOWED_CATEGORIES`) and its copy in `src/lib/ai-parse.ts:139` (`valid`)
- **Type of drift:** hardcoded-value-list-could-drift (two copies that can also drift from each other)
- **Severity:** visible bug — quick-add fallback (`App.tsx:851`) writes orphan labels
- **Evidence:** both lists are `['personal', 'dev', 'launch', 'clinic']`. The
  live `user_settings` row for the primary user has label
  **`practice-launch`** (display "Launch") — `'launch'` matches no user's
  categories, ever. For default-category users (`work`/`personal`/`health`/
  `learning`), three of the four values (`dev`, `launch`, `clinic`) are
  orphans. `suggestCategory()` feeds `handleQuickAdd`'s fallback path
  directly into `tasks.category`.

## 6. Category rename/delete fix is half-deployed: RPCs exist in the DB, no code calls them

- **Location:** live functions `public.rename_category(p_old, p_new)`, `public.delete_category(p_label, p_reassign_to)` (ledger entries `20260630..._category_rename_delete_rpcs`, `_category_default_null` — no repo file) vs. `src/components/SettingsModal.tsx` + `src/hooks/useUserSettings.ts:117`
- **Type of drift:** applied-in-DB-but-not-wired-in-code (inverse of series_id)
- **Severity:** visible bug — renaming or deleting a category in Settings strands all its tasks
- **Evidence:** the two SECURITY DEFINER RPCs atomically update
  `user_settings.categories` **and** re-label/reassign `tasks.category` —
  they exist precisely to prevent rename/delete orphans. But
  `grep -r "\.rpc(" src/ supabase/ tests/` returns **zero call sites**. The
  Settings UI saves via `updateCategories()`, which upserts only
  `user_settings` (`useUserSettings.ts:133-138`); tasks keep the old label
  and disappear from category filters. Either the app-side half of this fix
  was never merged, or the DB half was applied ahead of code that doesn't
  exist yet. (The RPCs themselves reference only existing columns and are
  correctly `search_path`-pinned.)

## 7. `user_settings.categories` column DEFAULT encodes a palette/shape the code can't render

- **Location:** live `user_settings.categories` column default vs. `src/lib/categories.ts:70-89`
- **Type of drift:** hardcoded-value-list-could-drift (DB default vs. code constants) — **confirmed in live rows**
- **Severity:** visible bug for affected users (unstyled category), plus schema-shape mismatch
- **Evidence:** the DB default is
  `[{"icon":"💼","color":"blue","label":"Work"}, {"icon":"👤","color":"emerald","label":"Personal"}, {"icon":"❤️","color":"green","label":"Health"}, {"icon":"📚","color":"purple","label":"Learning"}]`
  — emoji icons, **color `green`**, capitalized labels, and **no `display`
  field** (which `CategoryDef` requires). Code declares `CATEGORY_COLORS =
  ['slate','red','amber','emerald','blue','purple','pink']` — **`green` is
  missing from every color map** (`CATEGORY_COLOR_HEX`, `_BORDER`, `_BADGE`,
  `_RING` → `undefined` classNames), and `DEFAULT_CATEGORIES` uses Lucide
  icons with Health = `red`. **2 of the 3 live user rows carry
  `color:"green"` + emoji icons today.** The client-side `EMOJI_MIGRATION`
  (`useUserSettings.ts:23`) patches icons at read time but nothing patches
  `green`.

## 8. push-send: deployed v3 lags the repo (stale-token cleanup)

- **Location:** `supabase/functions/push-send/index.ts:286-290` vs. deployed push-send v3
- **Type of drift:** repo-ahead-of-deployed (edge function)
- **Severity:** latent/minor — APNs 400 `BadDeviceToken` rows accumulate and are retried on every push
- **Evidence:** repo deletes device tokens on APNs status **410 and 400**
  (`const staleStatuses = [410, 400]`); the deployed bundle handles only 410.
  Everything else is identical. Note the deployed entrypoint path is
  `/Users/ali/TaskMatrix_React/...` — functions are deployed ad-hoc from a
  laptop, which is the process-level cause of this whole drift class.
  (ai-parse v25 was verified **byte-identical** to the repo.)

## 9. Live unique constraint on recurrence that no repo artifact declares

- **Location:** live index `uniq_active_occurrence_per_series` — `CREATE UNIQUE INDEX ... ON tasks(series_id) WHERE deleted_at IS NULL AND status = 'todo'`
- **Type of drift:** live-object-not-backed-by-migration (no repo file, no obviously matching ledger entry)
- **Severity:** latent — enforcement exists only in prod; code merely approximates it
- **Evidence:** `useTasks.updateStatus` guards duplicate spawns client-side
  (`findActiveSeriesClone` / `hasActiveOccurrenceOnDate`) against **local
  state only**; the DB index is the real guard for multi-device races. A
  violating spawn returns `23505`, which `persistOrQueue` routes into the
  offline queue, and `useOfflineQueue.flush` then **drops as
  "server rejected"** — correct dedup behavior, but entirely undocumented in
  the repo, and a rebuilt environment (see #1) would silently lose the
  constraint. Also unbacked by the repo: `idx_tasks_user_active`,
  `idx_tasks_completed_at`, `idx_tasks_user_id`, `idx_sticky_notes_user_id`,
  the `update_updated_at()` function and its two triggers.

## 10. AI context builder reads a `quadrant` field that no task row has

- **Location:** `src/lib/ai-parse.ts:228` (`formatTaskList`) and dead `TaskRecord` interface in `supabase/functions/ai-parse/index.ts:12-26`
- **Type of drift:** code-assumes-nonexistent-column
- **Severity:** minor/silent — degrades AI output quality, no crash
- **Evidence:** `tasks` has no `quadrant` column (quadrant is derived from
  importance/urgency via `importanceUrgencyToQuadrant`, `types.ts:52`).
  `App.tsx:618/659/703` pass raw `Task[]` into
  `getWhatNext`/`getMorningBrief`/`getDayPlan`, so `t.quadrant` is always
  `undefined` and **every task is labeled "No quadrant"** in the prompt —
  the priority signal the prompts are built around is never sent. The edge
  function's `TaskRecord` interface also declares `quadrant: number` (unused
  dead type, same false assumption).

---

## Minor observations (no action forced, recorded for completeness)

- **Sticky-note color vocabulary:** code picks from
  `['yellow','green','blue','pink','purple','orange']`
  (`useStickyNotes.ts:6`); live rows also contain `amber` (1) and `red` (1)
  from older versions/tests. Currently harmless — note color is stored and
  synced but not used for rendering (all notes render the fixed yellow
  border).
- **`user_settings.updated_at` has no trigger:** `tasks` and `sticky_notes`
  get `update_updated_at()` triggers; `user_settings` does not, and the
  client upsert doesn't set it — the column silently stays at creation time.
  Nothing reads it today.
- **`device_tokens` RLS policy** (`Users can manage own tokens`) is
  `FOR ALL TO public` with no explicit `WITH CHECK`, unlike the hardened
  core-table policies (`TO authenticated`, explicit `WITH CHECK`). Postgres
  falls back to the USING expression for writes, so it is not exploitable —
  just inconsistent with the declared hardening standard, and its repo file
  (`20260621_device_tokens.sql`) matches the live state.
- **Committed junk directory:** the repo contains a directory literally named
  `"` holding `"/Users/ali/.volta"/...` (9 committed files incl. node/npm
  binaries) — a shell-quoting accident, unrelated to schema but worth
  removing.

## Verified clean (checked, no drift found)

- **RLS policies vs. columns (audit step 5):** all six live policies
  reference only `user_id`, which exists on every table; the live policy set
  exactly matches the reconciled `20260624_core_table_rls.sql` (including the
  `user_settings` UPDATE `WITH CHECK` and the absence of a `user_settings`
  DELETE policy). No policy references a renamed/dropped column.
- **Realtime plumbing:** `supabase_realtime` publication contains exactly
  `tasks`, `sticky_notes`, `user_settings` — matching the three
  `postgres_changes` subscriptions in code.
- **`recur_frequency` vocabulary:** live values (`weekly`, `daily`,
  `monthly`, `semiannually`) ⊂ code's handled set (`getNextDueDate`,
  `useTasks.ts:20-41`).
- **`reminder` vocabulary:** live values (`at_time`, `1day`) ⊂
  `ReminderPreset` (`notifications.ts:10-18`).
- **Orphan categories in data:** zero rows today (post-cleanup) — but see #4/#5
  for the still-active generators.
- **Repo indexes/constraints:** `device_tokens` UNIQUE(user_id, token) +
  platform CHECK, `idx_device_tokens_user_platform`,
  `sticky_notes_user_deleted_idx` all present live and match their repo files.
- **Extensions:** only stock extensions installed (pgcrypto, uuid-ossp,
  pg_stat_statements, vault, plpgsql); no code depends on an uninstalled one.
- **ai-parse deployed v25** is byte-identical to the repo source.

## Root-cause note

Every finding traces to the same workflow gap the incident postmortem
identified: schema changes and edge-function deploys are applied directly to
prod (dashboard/MCP/laptop CLI) while the repo is updated independently, or
not at all — there is no step that asserts repo ⇄ prod equivalence. Findings
#1/#3 make the next attempt to use the repo's migrations fail; #4–#7 are the
category incident still in progress across three layers (edge function,
client constants, DB RPCs) that each hold a different copy of the truth.
