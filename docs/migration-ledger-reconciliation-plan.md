# Migration Ledger Reconciliation Plan

**Status: DIAGNOSTIC / AWAITING APPROVAL — nothing in this document has been executed.**

- Project: `xulnxwwwjpvgsaqnsllo` (TaskMatrix)
- Date of diagnosis: 2026-07-02
- Scope: `public` schema, migration ledger (`supabase_migrations.schema_migrations`), repo `supabase/migrations/`
- No SQL writes, no migrations applied, no ledger rows touched while producing this plan. All live-database access was read-only (`SELECT` against catalogs and the ledger).

---

## 1. Definitive diff: applied ledger vs. repo files

### 1.1 The applied ledger (18 records, not 15)

The prior audit counted 15 applied migrations; there are now **18**. `supabase_migrations.schema_migrations` in prod contains, in order:

| # | Version | Name |
|---|---------|------|
| 1 | `20260605003032` | `add_tasks_sticky_notes_to_realtime` |
| 2 | `20260605003104` | `set_replica_identity_full` |
| 3 | `20260613161203` | `add_position_to_sticky_notes` |
| 4 | `20260613204112` | `create_user_settings_table` |
| 5 | `20260613204117` | `set_replica_identity_user_settings` |
| 6 | `20260620213621` | `harden_rls_and_function_search_path` |
| 7 | `20260621003056` | `add_completed_at_to_tasks` |
| 8 | `20260621233823` | `device_tokens` |
| 9 | `20260621235200` | `task_reminders` |
| 10 | `20260626133345` | `sticky_notes_soft_delete` |
| 11 | `20260627003941` | `core_table_rls` |
| 12 | `20260627004336` | `harden_user_settings_update_with_check` |
| 13 | `20260629192953` | `add_lead_days` |
| 14 | `20260630024136` | `category_default_null` |
| 15 | `20260630024153` | `category_rename_delete_rpcs` |
| 16 | `20260702132653` | `backfill_completed_status_and_constrain` |
| 17 | `20260702133643` | `fix_green_category_color` |
| 18 | `20260702133702` | `fix_green_category_color_v2` |

**Load-bearing discovery:** the ledger's `statements` column stores the **full SQL text** of every one of these 18 migrations. Nothing that went through the ledger is lost — the complete applied history is recoverable verbatim with a read-only `SELECT`. This materially changes the cost/benefit of the two reconciliation strategies (see §4).

### 1.2 The repo (6 files)

`supabase/migrations/` contains:

| File | CLI-parsed version |
|------|--------------------|
| `20260621_device_tokens.sql` | `20260621` |
| `20260621_task_reminders.sql` | `20260621` ⚠️ duplicate |
| `20260624_core_table_rls.sql` | `20260624` |
| `20260626_sticky_notes_soft_delete.sql` | `20260626` |
| `20260627_add_series_id.sql` | `20260627` |
| `20260629_add_lead_days.sql` | `20260629` |

Note there is also **no `supabase/config.toml`** — the repo has never been `supabase init`-ed/linked, which is consistent with `supabase db push` never having been the applier.

### 1.3 Root cause of the "non-matching version strings"

This is the version-string mismatch case the task asked to check for specifically, and it explains almost everything:

- Repo files were named with **date-only prefixes** (`20260621_…`), so the CLI parses their versions as 8-digit strings (`20260621`).
- The migrations were actually applied via the **Supabase MCP `apply_migration` tool** (or SQL editor equivalent), which stamps its own **14-digit timestamp** (`20260621233823`) into the ledger at apply time.
- Result: five of the six repo files **were applied, with identical or equivalent SQL, under a different version string**. They are not "missing from prod" — they are mis-keyed. This needs a *ledger/file alignment* fix, not a re-apply.

Additional repo-file defects found:

- **Version collision:** `20260621_device_tokens.sql` and `20260621_task_reminders.sql` both parse to version `20260621`. The Supabase CLI requires unique versions; this breaks `db push` / `db reset` ordering independent of everything else.
- `20260624_core_table_rls.sql` is a *consolidated rewrite*: its content corresponds to **two** ledger entries (`20260627003941_core_table_rls` + `20260627004336_harden_user_settings_update_with_check`). Its end state matches prod, but there is no 1:1 ledger row for it.

### 1.4 The diff itself

**A. Applied in prod, no corresponding repo file (13 ledger entries):**

Rows 1–7, 12, 14–18 in the table above — i.e. the entire pre-June-21 history (realtime publication, replica identities, `sticky_notes.position`, `user_settings` table creation, RLS/function hardening, `completed_at`), plus `harden_user_settings_update_with_check`, plus all five post-June-29 entries (`category_default_null`, `category_rename_delete_rpcs`, `backfill_completed_status_and_constrain`, `fix_green_category_color` v1 and v2).

**B. In repo AND applied, but under a different version string (5 files):**

| Repo file | Applied as | Content match |
|-----------|-----------|---------------|
| `20260621_device_tokens.sql` | `20260621233823_device_tokens` | identical |
| `20260621_task_reminders.sql` | `20260621235200_task_reminders` | identical |
| `20260626_sticky_notes_soft_delete.sql` | `20260626133345_sticky_notes_soft_delete` | identical (comments differ) |
| `20260624_core_table_rls.sql` | `20260627003941` **+** `20260627004336` (two entries) | end-state equivalent |
| `20260629_add_lead_days.sql` | `20260629192953_add_lead_days` | identical (comments differ) |

**C. In repo, never applied under ANY version string (1 file):**

- `20260627_add_series_id.sql` — no ledger record with this content exists. The `series_id` column **does** exist in prod, meaning it was added **fully out-of-band** (SQL editor / direct DDL, no ledger row). See §5.

**D. In prod, in NEITHER the ledger NOR the repo (pre-ledger / out-of-band objects):**

- `public.tasks` — the base table itself (26 columns), its PK, `tasks_user_id_fkey`, indexes `idx_tasks_user_id` and `idx_tasks_user_active` (partial, `WHERE deleted_at IS NULL`), trigger `tasks_updated_at`.
- `public.sticky_notes` — base table, PK, FK, `idx_sticky_notes_user_id`, trigger `sticky_notes_updated_at`.
- `public.update_updated_at()` trigger function (later hardened by ledger entry 6, but never created by any recorded migration).
- The original RLS policies `users_own_tasks` / `users_own_notes` (ledger entry 6 *alters* them; entry 11 later drop/recreates them — but their first creation predates the ledger).
- `tasks.series_id uuid` column (out-of-band, ~June 27).
- **`uniq_active_occurrence_per_series`** — `CREATE UNIQUE INDEX … ON public.tasks (series_id) WHERE deleted_at IS NULL AND status = 'todo'`. Out-of-band, in no file and no ledger entry, and load-bearing: it is the DB-side guard for the recurrence spawn logic in `src/lib/recurrence.ts` / `useTasks.ts`.

The ledger's first entry (June 5) already *assumes* `tasks` and `sticky_notes` exist. **True creation history for the base tables does not exist anywhere and cannot be recovered.** This is decisive for §4.

---

## 2. Live schema ground truth (verified 2026-07-02)

This is what any reconciliation must reproduce. Verified directly against catalogs (`pg_constraint`, `pg_policies`, `pg_indexes`, `pg_trigger`, `pg_proc`, `pg_publication_tables`, `pg_class.relreplident`), not inferred from migration files.

### Tables (public schema, RLS enabled on all four)

**`tasks`** (300 rows) — `id uuid PK default gen_random_uuid()`, `user_id uuid NOT NULL FK→auth.users(id)`, `title text NOT NULL`, `notes`, `category text` (default **NULL** — changed from `'Personal'` by ledger 14), `importance int default 5`, `urgency int default 5`, `status text default 'todo'` with **`tasks_status_check CHECK (status IN ('todo','done'))`**, `due_date date`, `due_time time`, `estimated_duration int`, `recurring bool default false`, `recur_frequency text`, `recur_interval int default 1`, `recur_days int[]`, `tags text[]`, `subtasks jsonb default '[]'`, `pinned bool default false`, `created_at/updated_at timestamptz default now()`, `deleted_at timestamptz`, `position int default 0`, `completed_at timestamptz`, `reminder text`, `series_id uuid`, `lead_days int`.

**`sticky_notes`** (30 rows) — `id uuid PK`, `user_id uuid FK`, `content text default ''`, `color text default 'yellow'`, `position_x/position_y int default 0`, `created_at/updated_at`, `pinned bool default false`, `title text default ''`, `position int`, `deleted_at timestamptz`.

**`user_settings`** (3 rows) — `id uuid PK`, `user_id uuid UNIQUE FK ON DELETE CASCADE`, `categories jsonb` with default = the four-category array **(personal/emerald, work/blue, health/red, learning/purple)** — i.e. the *v2* color fix is what's live, `created_at/updated_at`.

**`device_tokens`** (0 rows) — `id bigint identity PK`, `user_id uuid FK ON DELETE CASCADE`, `token text NOT NULL`, `platform text default 'ios'` CHECK (`ios|android|web`), `created_at/updated_at NOT NULL`, `UNIQUE(user_id, token)`.

### Indexes (beyond PK/UNIQUE)

- `tasks`: `idx_tasks_user_id`, `idx_tasks_user_active` (partial: `deleted_at IS NULL`), `idx_tasks_completed_at (completed_at DESC NULLS LAST)`, **`uniq_active_occurrence_per_series` (UNIQUE, partial: `deleted_at IS NULL AND status='todo'`)**
- `sticky_notes`: `idx_sticky_notes_user_id`, `sticky_notes_user_deleted_idx (user_id, deleted_at)`
- `user_settings`: `idx_user_settings_user_id`
- `device_tokens`: `idx_device_tokens_user_platform (user_id, platform)`

### RLS policies

- `tasks` → `users_own_tasks`: FOR ALL, TO `authenticated`, USING + WITH CHECK `auth.uid() = user_id`
- `sticky_notes` → `users_own_notes`: same shape
- `user_settings` → three command-scoped policies (INSERT with-check / SELECT using / UPDATE using+with-check), TO `authenticated`; **no DELETE policy** (intentional)
- `device_tokens` → `"Users can manage own tokens"`: FOR ALL, role **`public`** (not scoped to `authenticated` — matches its migration as written; flag as a candidate hardening *after* reconciliation, not silently during it)

### Functions / RPCs

- `rename_category(p_old text, p_new text)` — SECURITY DEFINER, `search_path=''`, plpgsql; EXECUTE granted to `authenticated`, revoked from PUBLIC
- `delete_category(p_label text, p_reassign_to text)` — same hardening profile
- `update_updated_at()` — trigger function, `search_path=''`

### Triggers

- `tasks_updated_at`, `sticky_notes_updated_at` — BEFORE UPDATE, FOR EACH ROW → `update_updated_at()`

### Realtime / replication

- Publication `supabase_realtime` contains: `tasks`, `sticky_notes`, `user_settings` (NOT `device_tokens`)
- `REPLICA IDENTITY FULL` on `tasks`, `sticky_notes`, `user_settings`; `device_tokens` is default

---

## 3. Post-audit out-of-repo changes, confirmed against live state

All three changes you listed are confirmed live — with one correction to the framing: **they are all recorded in the ledger** (they were applied via MCP `apply_migration`, which writes a ledger row). They bypassed the *repo*, not the migration system. That means each one's exact SQL is recoverable from the ledger — nothing needs to be reverse-engineered.

1. **CHECK constraint on `tasks.status`** — ledger `20260702132653_backfill_completed_status_and_constrain`. Confirmed live: `tasks_status_check CHECK (status IN ('todo','done'))` exists; 0 rows violate it (the same migration backfilled 22 orphaned `'completed'` rows to `'done'`). Note the migration is **not idempotent as stored** (bare `ADD CONSTRAINT`, no guard) — relevant only if its SQL is ever replayed.
2. **Default-color fix on `user_settings.categories`** — ledger `20260702133643` **and** `20260702133702` (v2 corrected v1: v1 set health→emerald, v2 set health→red per `CATEGORY_DEFAULTS`). Confirmed live: the column default matches **v2** exactly. Any reconstruction must reproduce the v2 end state; v1 is dead weight.
3. **`rename_category` / `delete_category` RPCs** — ledger `20260630024153`. Confirmed live with SECURITY DEFINER + `search_path=''` + grants exactly as the ledger records. The same June 30 session also applied `20260630024136_category_default_null` (`tasks.category` default `'Personal'` → `NULL`) — confirmed live; this is a **fourth** post-audit change not on your list.

**Additional undocumented changes found (in neither ledger nor repo):**

4. **`uniq_active_occurrence_per_series`** partial unique index on `tasks(series_id)` — exists live, created by nobody on record. It enforces "at most one active todo occurrence per recurring series" and the app code relies on that guarantee.
5. **`tasks.series_id` column itself** — exists live with no ledger record (see §5).

---

## 4. Reconciliation strategy: recommendation and tradeoff

### Recommendation: **(a) baseline migration + ledger reset — with the full applied history exported to the repo as a read-only archive first.**

### The tradeoff, honestly

The usual argument for (b) *reconstructing individual missing migration files* is that it preserves true history. **That argument mostly doesn't apply here**, for three reasons specific to this repo:

1. **True history is already unrecoverable at the base.** `tasks`, `sticky_notes`, their triggers, `update_updated_at()`, and the original RLS policies predate the first ledger entry. Under option (b) you would still have to *fabricate* a "migration zero" that was never actually a migration — so (b) doesn't give you a true history either; it gives you a fabricated base plus 13 reconstructed files, each an opportunity for transcription drift.
2. **The history-preservation benefit can be captured without replayability.** Because the ledger stores full statements, we can export all 18 applied migrations verbatim into `docs/migration-history/` (plus the 6 legacy repo files). Git then holds the complete audit trail forever — we lose only the ability to *replay* history step-by-step, which has no consumer: fresh environments need the end state, not the journey, and several steps are pure data backfills (`'completed'`→`'done'`, green→red) that are meaningless on an empty database.
3. **(b) requires strictly more ledger surgery, not less.** Under (b) you must still: rename all 6 repo files to their 14-digit ledger versions (including splitting `core_table_rls` into two files to match rows 11+12, and resolving the `20260621` version collision), write ~13 new files whose versions exactly match existing ledger rows, insert a fabricated base row *into the ledger* (or every `db reset` diverges from prod), and repair the ledger for `add_series_id` + the series index. That is ~20 exact-match operations vs. the baseline's one-shot repair. Every mismatch produces exactly the class of bug we're fixing.

What (a) genuinely costs: `git blame` on a migration file will no longer tell you *when and why* each schema element appeared — you'll consult the archive directory instead of the live migration folder. And the ledger reset itself is the one moment of real (metadata-only) risk; §6 step 8 confines and verifies it.

What (a) buys: one file that is *generated from prod by tooling* (`supabase db dump`) rather than hand-reconstructed, so the risk of "reconciled repo still doesn't match prod" drops to near zero; a repo that can build a fresh environment (currently impossible); a clean version namespace going forward; and the `add_series_id` problem disappears entirely (the file is archived, not fixed).

**Choose (b) only if** you have an external consumer of step-by-step replay (e.g. long-lived preview branches that must migrate incrementally from intermediate states). Nothing in this repo indicates that.

---

## 5. `add_series_id.sql` specifically

The file's entire body is:

```sql
ALTER TABLE tasks
ADD COLUMN series_id UUID;
```

**Diagnosis: it is the mild case, plus one omission — not structurally worse.**

- **Why it fails:** purely the missing `IF NOT EXISTS` guard. The column was added to prod out-of-band (no ledger record), so the ledger has no version that matches this file; `supabase db push` would treat it as pending, run it, and fail with `42701: column "series_id" of relation "tasks" already exists`.
- **Has the column drifted from what the file assumes?** No. Live: `series_id uuid`, nullable, no default, no FK — exactly what the file creates. 136 of 300 tasks carry a non-null `series_id`; a guarded `ADD COLUMN IF NOT EXISTS` is a clean no-op against that data.
- **BUT a guard alone is not sufficient for fresh-environment correctness:** prod also has `uniq_active_occurrence_per_series` (unique, partial: `WHERE deleted_at IS NULL AND status = 'todo'`), which no file creates. A guarded `add_series_id.sql` would stop erroring on push, yet a fresh environment built from the repo would silently lack the uniqueness guarantee the recurrence code depends on — a correctness hole, not an error, which is worse. Any fix must carry both the column *and* the index.
- **Under the recommended baseline strategy this file is archived, not fixed** — the baseline dump captures both the column and the index from live state automatically. If you choose option (b) instead, the reconstructed file needs: `ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_occurrence_per_series …`, a 14-digit version stamp, and a matching ledger row inserted via `supabase migration repair --status applied`.

---

## 6. The plan: ordered, concrete steps (NONE executed yet)

Steps 1–7 touch only the repo and local tooling — zero live-database writes. **Step 8 is the single live-write moment** (ledger metadata only, no schema DDL) and is gated on your approval of the verified artifacts from step 7.

> **Step 1 — Freeze out-of-band schema changes for the reconciliation window.**
> *What it does:* No MCP `apply_migration`, no SQL-editor DDL, no dashboard schema edits until this plan completes.
> *What it changes:* Process only.
> *Verify:* Record the current ledger max version (`20260702133702`) now; re-run `list_migrations` immediately before step 8 and abort if anything new appeared (if it did, regenerate the baseline from step 5 first).

> **Step 2 — Initialize and link the Supabase CLI project.**
> *What it does:* `supabase init` (creates `supabase/config.toml`), then `supabase link --project-ref xulnxwwwjpvgsaqnsllo`. Read-only with respect to the database.
> *What it changes:* Adds `supabase/config.toml` to the repo.
> *Verify:* `supabase migration list` runs and shows the exact 18-remote / 6-local mismatch documented in §1 — this doubles as independent confirmation of the diagnosis.

> **Step 3 — Export the complete applied history into the repo as an archive.**
> *What it does:* Read-only `SELECT version, name, statements FROM supabase_migrations.schema_migrations ORDER BY version`, writing one file per row to `docs/migration-history/applied/<version>_<name>.sql`, verbatim.
> *What it changes:* Adds 18 archive files under `docs/` (outside `supabase/migrations/`, so the CLI never sees them as pending).
> *Verify:* 18 files exist; file count and versions match `list_migrations` exactly; spot-check 3 files (`20260702132653`, `20260630024153`, `20260605003032`) against the ledger text character-for-character.

> **Step 4 — Archive the six legacy repo migration files.**
> *What it does:* `git mv supabase/migrations/*.sql docs/migration-history/repo-legacy/` with a README noting each file's disposition per §1.4 (5 applied-under-other-versions, 1 never applied).
> *What it changes:* `supabase/migrations/` becomes empty; nothing about the database.
> *Verify:* `ls supabase/migrations/` is empty; the 6 files are intact under `docs/migration-history/repo-legacy/`; full history preserved in git.

> **Step 5 — Generate the baseline migration from live prod schema.**
> *What it does:* `supabase db dump --linked --schema public -f supabase/migrations/20260703000000_baseline.sql` (read-only against prod). Then manually verify/append the pieces schema dumps commonly omit: `ALTER PUBLICATION supabase_realtime ADD TABLE tasks, sticky_notes, user_settings;` and the three `REPLICA IDENTITY FULL` statements, if absent from the dump.
> *What it changes:* Adds exactly one file to `supabase/migrations/`. No database change.
> *Verify (checklist against §2, item by item):* the file contains all 4 tables with all columns/defaults; `tasks_status_check`; `uniq_active_occurrence_per_series` and all §2 indexes; all 6 RLS policies with correct roles/USING/WITH CHECK + the 4 `ENABLE ROW LEVEL SECURITY` statements; `rename_category`/`delete_category`/`update_updated_at` with SECURITY DEFINER, `search_path=''`, and the REVOKE/GRANT pairs; both triggers; publication + replica-identity statements. The `user_settings.categories` default must be the **v2** array (health=red).

> **Step 6 — Prove the baseline reproduces prod, locally (no prod interaction).**
> *What it does:* `supabase db start` (local stack) + `supabase db reset` (applies only the baseline file to the local DB). Then dump both schemas — local (`pg_dump --schema-only --schema=public` against the local container) and prod (`supabase db dump --linked --schema public`) — normalize (strip comments/SET lines, sort), and diff.
> *What it changes:* Local Docker containers only.
> *Verify:* Empty diff (or only cosmetic ordering differences, each individually explained). **Do not proceed past this step until the diff is clean.** This is the step that makes the baseline trustworthy-by-construction instead of trusted-by-hope.

> **Step 7 — Commit the reconciliation branch and stop for review.**
> *What it does:* Commit steps 2–5 artifacts (config.toml, archive, baseline) to a branch; open a PR for review. Include the step-6 diff output (empty) in the PR description as evidence.
> *What it changes:* Repo only.
> *Verify:* CI/review pass; explicit human approval to proceed to step 8. **This is the execution gate.**

> **Step 8 — Repair the prod ledger (THE ONLY LIVE WRITE; metadata-only, no schema DDL).**
> *What it does:* Marks the 18 historical versions as no longer pending-relevant and registers the baseline as already applied — the baseline SQL is **never executed against prod** (prod already *is* that schema):
> `supabase migration repair --status reverted 20260605003032 … 20260702133702` (all 18), then
> `supabase migration repair --status applied 20260703000000`.
> *What it changes:* Rows in `supabase_migrations.schema_migrations` only. Zero DDL, zero data changes, zero user-visible effect. Reversible: the archived rows from step 3 contain everything needed to reinsert the old ledger verbatim.
> *Verify:* `supabase migration list` shows exactly one version (`20260703000000`) both local and remote, in sync; `SELECT count(*) FROM supabase_migrations.schema_migrations` = 1.

> **Step 9 — End-to-end confirmation.**
> *What it does:* `supabase db push --dry-run` → must report nothing to apply; `supabase db diff --linked` → must report no schema changes; run `get_advisors` (security) for regressions; app smoke test (sign in, CRUD a task, rename a category via RPC, confirm realtime updates still flow — exercises RLS, RPC grants, and the publication).
> *What it changes:* Nothing.
> *Verify:* All four checks pass. If `db diff` is non-empty, stop and reconcile the residue (expected residue: none, given step 6).

> **Step 10 — Guardrails so this never recurs.**
> *What it does:* (i) Team rule: all schema changes ship as files in `supabase/migrations/` applied via `supabase db push` — MCP `apply_migration` only if the identical file lands in the repo in the same change; MCP `execute_sql` for reads only. (ii) CI job: `supabase db start && supabase db reset` on every PR touching `supabase/` (proves the migration chain builds a database from scratch). (iii) Scheduled or pre-deploy `supabase db diff --linked` drift check that fails loudly when prod and repo diverge. (iv) Migration filenames must use full 14-digit timestamps (`supabase migration new <name>` generates these correctly).
> *What it changes:* CI config + contributor docs.
> *Verify:* CI red when a migration file is broken or missing; drift check green immediately after step 9, and stays green.

### Rollback posture

- Steps 1–7: revert the git branch; nothing else happened.
- Step 8: reinsert the 18 archived ledger rows (version, name, statements are all preserved verbatim in `docs/migration-history/applied/`) and delete the baseline row. The schema itself is never touched at any step, so there is no schema rollback scenario.

### Out-of-scope items noticed during diagnosis (do NOT fold into this reconciliation)

- `device_tokens` policy applies to role `public` rather than `authenticated` — a hardening candidate, but changing it during reconciliation would make the baseline *not* match prod. Reconcile first, harden in a normal follow-up migration.
- Ledger entries 16–18 as stored are non-idempotent (bare `ADD CONSTRAINT`, unguarded `SET DEFAULT`) — moot once archived, noted for the record.
