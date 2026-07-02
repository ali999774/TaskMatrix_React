# Category-cap verification checklist (7→4 transition)

**Purpose:** everything that must be true before merging the 4-category-cap state to main.
**Scope:** verification only — no fixes are made by this document. Items marked ❌ are
confirmed defects that need a decision (fix now vs. accept) before merge.

**Verified against:**
- Code at commit `3bc352a` (branch base).
- Live Supabase project `xulnxwwwjpvgsaqnsllo` ("taskmatrix"), queried 2026-07-02.
- Deployed edge function `ai-parse` **version 26** (fetched via Supabase MCP).

**Legend**

| Mark | Meaning |
|---|---|
| ✅ | Verified passing by agent (SQL against live DB, or code read) — re-run the SQL ones right before merge |
| ❌ | Verified **failing** — confirmed defect, reproducible from code read + live data |
| ⚠️ | Gap/risk confirmed by code read; needs a product decision (fix or explicitly accept) |
| 🖐 | Cannot be verified without a manual test on a live build (device/browser) |

---

## 0. Facts established (so nobody re-litigates them)

- `user_settings.categories` is JSONB, nullable, **no constraint on array length**. 3 rows exist; **every row has exactly 4 categories**. Ali's live labels: `personal`, `dev`, `practice-launch`, `clinic`.
- `tasks.category` is raw `text`, nullable, **no FK, no CHECK**. 300 tasks total, 195 with `NULL` category.
- **Zero orphaned task categories exist in the DB today** — every non-null `tasks.category` matches a settings label exactly (case included). The "7 live categories" state does not currently exist server-side; the residual risk is stale *client* state (localStorage, offline queue, old builds) and the orphan-creating code paths below.
- Two RPCs exist in the live DB — `rename_category(p_old, p_new)` and `delete_category(p_label, p_reassign_to)` — that correctly cascade task reassignment. **The client never calls `.rpc()` anywhere**, and **neither RPC appears in `supabase/migrations/`** (applied out-of-band).
- The **deployed** `ai-parse` edge function (v26) already accepts the caller's live category list (`body.categories`) and validates parse/classify output against it. The **repo copy** (`supabase/functions/ai-parse/index.ts`) is an older version with the hardcoded `ALLOWED_CATEGORIES = ['personal', 'dev', 'launch', 'clinic']` and it ignores `body.categories`. The drift is repo-behind-production, not the reverse.

---

## 1. Database invariants — re-run all four immediately before merge

All four pass as of 2026-07-02. They are cheap; run them again at merge time because
any device that syncs in the meantime can change the answer.

### 1.1 ✅ No orphaned task categories

**Check:** every non-null `tasks.category` matches a label in that user's `user_settings.categories`.

```sql
SELECT t.id, t.user_id, t.category
FROM tasks t
WHERE t.category IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM user_settings us,
         jsonb_array_elements(us.categories) c
    WHERE us.user_id = t.user_id
      AND lower(c->>'label') = lower(t.category)
  );
```

**Pass:** zero rows. **Fail:** any row — each is a task invisible in the category filter (only reachable via "All").

### 1.2 ✅ Every settings row respects the cap

```sql
SELECT user_id, jsonb_array_length(categories) AS n
FROM user_settings
WHERE jsonb_array_length(categories) > 4;
```

**Pass:** zero rows. Currently all 3 rows have exactly 4.

### 1.3 ✅ No duplicate labels within a settings array

```sql
SELECT us.user_id, lower(c->>'label') AS label, count(*)
FROM user_settings us, jsonb_array_elements(us.categories) c
GROUP BY us.user_id, lower(c->>'label')
HAVING count(*) > 1;
```

**Pass:** zero rows. (SettingsModal derives `label` by slugifying `display` and never dedupes — two categories named the same would collide; React keys and `getCategoryDef` both assume unique labels.)

### 1.4 ✅ No case-only mismatches between tasks and settings

```sql
SELECT DISTINCT t.user_id, t.category
FROM tasks t
JOIN user_settings us ON us.user_id = t.user_id,
     jsonb_array_elements(us.categories) c
WHERE t.category IS NOT NULL
  AND lower(c->>'label') = lower(t.category)
  AND c->>'label' <> t.category;
```

**Pass:** zero rows. Rendering is case-insensitive (`getCategoryDef` lowercases) but `CompletedSection.tsx:58` filters with a **case-sensitive** `eq('category', context)` — a case mismatch would hide completed tasks from the filtered view.

---

## 2. Hardcoded category lists (the ai-parse drift pattern)

### 2.1 ❌ Repo edge function is stale vs. deployed v26 — redeploy would regress the fix

- **What:** `supabase/functions/ai-parse/index.ts` in the repo is the OLD version: hardcoded `ALLOWED_CATEGORIES` at line 10 (containing `launch`, which is not a live label), classify prompt hardcoded at lines 102–107, parse prompt hardcodes 9 category names at line 315, and `body.categories` is silently ignored (destructuring at line 54 omits it — the client sends it at `src/lib/ai-parse.ts:73`).
- **How to check:** `mcp Supabase get_edge_function ai-parse` and diff against the repo file. Done — they differ materially.
- **Pass:** repo file byte-matches deployed v26. **Fail (current state):** anyone running `supabase functions deploy ai-parse` from this repo reinstates the exact bug class that orphaned 11 tasks.
- **Verifiable by agent:** yes (done). **Fix decision needed before merge:** copy deployed v26 source into the repo.

### 2.2 ❌ Client `suggestCategory` has its own hardcoded list and corrupts a valid label

- **What:** `src/lib/ai-parse.ts:130-143`. Two defects:
  1. It calls classify mode **without sending the live category list**, so the (fixed) server falls back to its default list — wrong for any user other than Ali (e.g. the `work/personal/health/learning` users get classifications from Ali's set).
  2. It re-validates the response against hardcoded `valid = ['personal', 'dev', 'launch', 'clinic']` using `raw?.includes(c)` — so when the server correctly returns `practice-launch`, the substring match maps it to **`launch`**, a label that exists in no one's settings. Any task created through this path gets an orphan category.
- **Trigger path:** quick-add with AI enabled while filter is "All" (`App.tsx:850-854`).
- **How to check (code):** read the two functions. **How to check (data):** `SELECT id, title FROM tasks WHERE category = 'launch';` — currently zero rows, but re-run at merge (this is the invariant 1.1 query's most likely offender).
- **Pass:** `suggestCategory` passes `categories.map(c => c.label)` through and validates with exact match against that list. **Fail (current state):** hardcoded list + substring match.

### 2.3 ✅ `ALI_CATEGORIES` / `migrateExisting` hardcoded lists are benign

`src/hooks/useUserSettings.ts:15-20, 146-162` — only runs when a user has **no** settings row, and its labels (`clinic`, `practice-launch`, `dev`, `personal`) exactly match Ali's live labels. Verified against live data. No action; just don't let these drift if labels are ever renamed.

---

## 3. Cap enforcement (the 4-slot rule)

### 3.1 ✅ / 🖐 Add is blocked at 4 in the UI

- **Code (✅):** `SettingsModal.tsx:86-87` (`add()` early-returns at `MAX_CATEGORIES`) and `:534-547` (button replaced by "4 categories max" note).
- **UI click-path (🖐):** Settings → Categories → confirm no "+ Add category" button when 4 exist and the max note shows.

### 3.2 ⚠️ / 🖐 `handleSave` does not clamp to 4 — a stale >4 list round-trips through Save

- **What:** `SettingsModal.tsx:111-117` filters empties but never slices to `MAX_CATEGORIES`. The cap only gates the Add button. If the modal opens with >4 items (stale localStorage cache, a row written by an old build, or a realtime event from an old-cap device), the user can reorder/edit and **save all of them back**, re-persisting the over-cap state.
- **How to check (🖐 manual):** seed over-cap state on a test user, then open Settings and hit Save:
  ```sql
  -- seed 7 categories on a test user (NOT ea3bd12a…), then open the app
  UPDATE user_settings SET categories = categories ||
    '[{"label":"errands","display":"Errands","color":"amber","icon":"car"},
      {"label":"finance","display":"Finance","color":"pink","icon":"piggy-bank"},
      {"label":"home","display":"Home","color":"slate","icon":"home"}]'::jsonb
  WHERE user_id = '<test-user>';
  ```
- **Pass:** app either truncates to 4 on load/save or blocks Save with a message. **Expected fail:** all 7 render as filter chips and as settings rows, and Save persists 7.

### 3.3 ⚠️ No server-side cap exists at all

- **What:** verified via `pg_constraint` — `tasks`/`user_settings` carry only the status CHECK and user-FKs. Any old app build, queued offline write, or direct PostgREST call can write 7+ categories; nothing rejects it.
- **How to check:** the constraint query (done). **Decision needed:** add a CHECK (`jsonb_array_length(categories) <= 4`) or a trigger, or explicitly accept client-only enforcement. If accepting, item 3.2's load-time clamp becomes the only backstop and currently doesn't exist.

### 3.4 🖐 Realtime delivery of an over-cap list from another device

- **What:** `useUserSettings.ts:104-110` applies whatever array arrives — no length check. A second device running pre-cap code that saves 6 categories will push all 6 into this device's UI and localStorage.
- **How to check:** with the app open, run the 3.2 seed SQL and watch the live UI (realtime fires on UPDATE).
- **Pass:** defined, non-broken behavior (chips row scrolls — acceptable; settings shows them; Add stays blocked). **Fail:** layout break, crash, or the stale list being silently re-saved (ties to 3.2).

### 3.5 🖐 Stale localStorage `tm-categories` cache from before the cap

- **What:** `useUserSettings.ts:47-57` — initial state comes from localStorage with no cap validation; Supabase truth only replaces it after the async load. Offline, the stale list persists indefinitely.
- **How to check:** in devtools, `localStorage.setItem('tm-categories', JSON.stringify([...7 entries...]))`, reload offline.
- **Pass:** renders without breakage and self-heals (replaced by the 4-entry server list) on next online load. Verify the self-heal actually overwrites localStorage (`useUserSettings.ts:75` — it does, ✅ code).

---

## 4. Delete → reassign flow

### 4.1 ❌ The delete→reassign picker does not exist — delete silently orphans tasks

- **What:** `SettingsModal.tsx:93-97` — `remove(idx)` drops the entry from local state; Save upserts the shrunken array. **No reassignment prompt, no task update, no count warning.** Every task tagged with the deleted label keeps it as an orphan string.
- **UI click-path to reproduce (🖐 to observe, ❌ already confirmed in code):** Settings → Categories → X on a category with live tasks → Yes → Save. Then run the 1.1 orphan query — **fail = rows appear** (it will).
- **Pass criteria for merge:** deleting a category with N>0 tasks either (a) prompts to reassign (ideally via the existing `delete_category` RPC, which already does this atomically), or (b) at minimum warns "N tasks will become uncategorized" and nulls them. Current behavior does neither.

### 4.2 ⚠️ Server-side `delete_category` RPC is correct but unreachable and uncommitted

- **What:** live RPC validates the reassign target exists, removes the label from the JSONB, and reassigns tasks in one transaction. Client has zero `.rpc(` call sites (grep verified). Neither RPC is in `supabase/migrations/`.
- **Check:** `git grep -n "\.rpc("` → must return the new call site once wired; RPC definitions must land in a migration file so the repo can rebuild the DB.

### 4.3 🖐 Delete under the cap frees a slot

After deleting down to 3, "+ Add category" must reappear (`items.length < MAX_CATEGORIES` re-evaluates — ✅ code, 🖐 confirm in UI).

---

## 5. Rename flow

### 5.1 ❌ Editing a display name silently rewrites the label and orphans tasks

- **What:** `SettingsModal.tsx:99-109` — any edit to `display` re-derives `label = slugify(display)`. No task migration happens (the `rename_category` RPC exists for exactly this and is never called).
- **Concrete failure:** Ali's "Launch" category has label `practice-launch`. Touching its name field at all — even retyping "Launch" unchanged — slugifies to `launch`, and Save orphans the 3 live `practice-launch` tasks. Same for any display/label divergence.
- **How to check:** UI path (Settings → tap Launch → edit name → Save), then run:
  ```sql
  SELECT category, count(*) FROM tasks
  WHERE user_id = 'ea3bd12a-3b1d-4b51-acc6-fe9c3446140f'
    AND category = 'practice-launch' GROUP BY category;
  -- and re-run the 1.1 orphan query
  ```
- **Pass criteria for merge:** rename either preserves the existing label (display-only edit) or migrates tasks (RPC / batched update). Current behavior does neither.

---

## 6. Stale filter context (`tm-context`)

### 6.1 🖐 Persisted filter can point at a deleted category

- **What:** `App.tsx:272` restores `context` from localStorage with no validation against live categories. After a category is deleted (this device or another), `filteredTasks` (`App.tsx:717`) filters by a nonexistent label → matrix shows nothing, **no pill renders as selected** (the chip is gone; "All" isn't active either), and `CompletedSection.tsx:57-58` queries completed tasks with the dead label.
- **How to check:** filter to a category → delete that category (Settings, or SQL on another session) → reload. **Pass:** context self-resets to `'all'`. **Expected fail:** empty matrix with no visible explanation.

### 6.2 🖐 Quick-add inherits the stale context — an orphan factory

- **What:** `App.tsx:848` — `autoCategory = context !== 'all' ? context : undefined`. With a stale context, every quick-added task is born orphaned.
- **How to check:** in the 6.1 state, quick-add a task, then run the 1.1 query. **Pass:** zero new rows (requires 6.1 fixed or context validated at write time).

---

## 7. Orphan rendering surfaces (graceful-degradation audit)

How each surface behaves when a task's category isn't in the current 4. All code-verified; the 🖐 ones deserve one eyeball pass on a live build with a seeded orphan task
(`UPDATE tasks SET category = 'zzz-orphan' WHERE id = '<test task>';`).

| Surface | Behavior with orphan label | Verdict |
|---|---|---|
| TaskCard meta (`TaskCard.tsx:165-168`) | Renders raw `#label`; stripe color from FNV hash (`categoryColors.ts:47`) — stable, no crash | ✅ graceful |
| Matrix filter chips (`App.tsx:1169`) | No chip for the orphan → task only findable under "All" | ⚠️ by design, but invisible-task risk; pairs with 4.1 |
| TaskDetail row (`TaskDetail.tsx:343`) | Row shows raw label via `categoryDisplay` fallback | ✅ graceful |
| TaskDetail hidden `<select>` (`TaskDetail.tsx:345-357`) | `value` matches no `<option>` → browser displays "None" while the real value is the orphan; save only fires on change, so no silent data loss | ✅ code / 🖐 confirm the picker isn't misleading in UI |
| MorningBrief grouping (`MorningBrief.tsx:176-182`) | Orphan group labeled "Uncategorized", grey dot | ✅ graceful |
| CalendarView / DayGrid dots & chips | FNV hash color from raw string | ✅ graceful |
| AddTaskModal picker (`AddTaskModal.tsx:151`) | Only offers live categories — cannot create an orphan | ✅ |
| CompletedSection filter (`CompletedSection.tsx:58`) | Only reachable with orphan `context` (see 6.1) | covered by 6.1 |

---

## 8. Offline queue & cross-device sync

### 8.1 ✅ Pre-cap queued writes older than 24 h are discarded

`useOfflineQueue.ts:111-118` — anything queued before the cap shipped is gone by now (>24 h). Verified by code read; no data check possible or needed. **The "offline-queued category writes made before the cap existed" concern is closed by design** — only writes from the last 24 h can replay.

### 8.2 🖐 A fresh (<24 h) queued categories write replays blind — last-write-wins

- **What:** `updateCategories` queues the **full** categories array (`useUserSettings.ts:123-131`); flush upserts it with no version/timestamp comparison. Device A offline-saves, device B meanwhile edits categories, A reconnects → A's snapshot silently overwrites B's, potentially resurrecting a deleted category (whose tasks B reassigned… back to a now-different state).
- **How to check (manual, two sessions):** device A airplane-mode → edit categories → device B edits differently → A reconnects. **Pass:** documented/accepted last-write-wins with no >4 or orphan side effects (run queries 1.1/1.2 after). **Fail:** over-cap or orphan rows appear.

### 8.3 ⚠️ Offline first-ever save can be silently lost

- **What:** queued `user_settings` mutations use op `update`; flush replays `update().eq('user_id', …)` (`useOfflineQueue.ts:153-154`). If the settings row doesn't exist yet (brand-new user, first save made offline), UPDATE matches 0 rows, returns no error, and the mutation is deleted as "success." The online path uses upsert and doesn't have this hole; only the queued path does.
- **How to check:** code read (done); optional manual repro with a fresh user offline. **Decision:** queue as `create`+upsert, or accept (Ali-only app; settings row exists).

### 8.4 ⚠️ Realtime settings subscription only listens for UPDATE

`useUserSettings.ts:100` — an INSERT of the settings row from another device isn't received (first-time setup edge case). Refresh covers it. Accept or extend to `event: '*'`.

### 8.5 ⚠️ / 🖐 Category saves made offline queue silently — no category-aware feedback exists

- **What:** saving category edits in SettingsModal while offline is indistinguishable from a successful save. `updateCategories` (`useUserSettings.ts:123-131`) enqueues to the Dexie queue and returns; the modal closes normally. Nothing tells the user their category change hasn't synced. The only signals are generic and indirect: the offline banner (`App.tsx:1141-1145`) and the pending-count chip (`App.tsx:1066-1078`), neither of which identifies the pending change as a category edit. The only action-gated offline message in the app — DayPlan's "Re-planning needs a connection" (`DayPlan.tsx:186-190`) — is unrelated to categories. No category-specific offline message was ever built.
- **Decision needed:** accept silent queueing (single-user app; generic banner deemed sufficient) or add explicit "saved locally — will sync when online" feedback to SettingsModal.
- **To verify (🖐):** offline → edit/save categories → pending count increments; reconnect → `[TM][QUEUE-REPLAY]` fires in console and the settings row updates (re-run query 1.2 afterward).

### 8.6 ❌ Server-rejected category writes are silently dropped — data loss, not a messaging gap

- **What:** when a replayed mutation is rejected by the server (anything carrying a PostgREST error code or 4xx status — RLS, constraint violation, malformed payload), `useOfflineQueue.ts:162-171` logs `[TM][QUEUE-DROP]` to the console and **deletes the mutation**. No UI notice, no retry, no revert: React state and localStorage keep the user's version, so the device displays categories (or a task category) the server never accepted, and the divergence persists until a realtime event or reload overwrites it.
- **Not offline-only — reachable at any connectivity state:** `persistOrQueue` (`persist.ts:38-64`) routes any failed *online* write into the same queue, and the auto-flush effect (`useOfflineQueue.ts:185-189`) fires immediately while online. So a fully-online rejected save is queued → replayed → rejected → dropped within seconds. The user may see the pending chip flash "1 pending" and then clear — which reads as a successful sync. The offline path merely delays the identical outcome to reconnect. Every category write funnels through this: `updateCategories` (settings) and task-category edits via `useTasks.updateTask`.
- **How to check:** code read (done — confirmed). Manual repro (🖐, optional): on a test user, temporarily add a denying RLS policy on `user_settings` UPDATE, save a category edit while online, watch `[TM][QUEUE-DROP]` in console; UI keeps the edit, DB doesn't.
- **Pass criteria for merge:** a server rejection surfaces to the user (toast/banner) and/or reverts local state to server truth. Console-only logging is a fail.

### 8.7 ⚠️ Old app builds have no version gate

Nothing prevents a device running a pre-cap build from writing 7 categories or old labels; there's no min-client-version check and no server cap (3.3). Realistically closed by: Ali's devices all updating + optionally the server-side CHECK from 3.3.

---

## 9. Repo/DB hygiene (drift housekeeping)

- [ ] ⚠️ Commit `rename_category` + `delete_category` definitions to `supabase/migrations/` (currently live-only; a DB rebuild from the repo would lose them).
- [ ] ❌ Sync `supabase/functions/ai-parse/index.ts` with deployed v26 (see 2.1) **before** anyone redeploys.
- [ ] ⚠️ `docs/SPEC-category-ux.md:20` still says categories "can grow past 4" — stale vs. `MAX_CATEGORIES = 4`; update so the next reader doesn't design against the wrong invariant.

---

## Summary: what blocks merge vs. what's informational

**Confirmed defects (❌) — decide fix-or-accept before merge:**
1. **Server-rejected category writes are silently dropped — data loss at any connectivity state, the most severe item here (8.6).** A rejected save is queued, replayed once, then deleted with console-only logging; the UI keeps showing the edit the server refused.
2. Delete has no reassign/warn — orphans tasks (4.1).
3. Rename re-slugifies labels without task migration — orphans tasks; even a no-op name edit of "Launch" does it (5.1).
4. Client `suggestCategory`: hardcoded list + substring match writes the nonexistent label `launch` (2.2).
5. Repo edge function is stale vs. deployed — redeploy regresses the drift fix (2.1 / 9).

**Agent-verified passing (✅) — re-run §1 SQL at merge time:** DB is currently clean (no orphans, no over-cap rows, no dup labels, no case mismatches); 24 h queue expiry closes the pre-cap offline-write concern; orphan rendering degrades gracefully everywhere except discoverability.

**Needs a live build / manual test (🖐):** 3.1 UI cap, 3.2 over-cap round-trip via Save, 3.4 realtime over-cap delivery, 3.5 stale localStorage, 4.3 slot freed after delete, 6.1–6.2 stale filter + quick-add inheritance, 7 (one eyeball pass with a seeded orphan), 8.2 two-device last-write-wins, 8.5 silent-queueing feedback, 8.6 rejection repro (optional — defect already confirmed by code read).

**Product decisions (⚠️):** server-side cap constraint (3.3), load/save clamp (3.2), wire the RPCs (4.2), offline first-save hole (8.3), INSERT realtime gap (8.4), offline save feedback (8.5), old-build gate (8.7).
