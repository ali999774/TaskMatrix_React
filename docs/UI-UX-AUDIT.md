# TaskMatrix — UI/UX Audit & Roadmap (Layer 3)

> **Project:** TaskMatrix (React + Tailwind + Capacitor/iOS, Supabase backend)
> **Stack modules in play:** `stack-react-tailwind.md`, `stack-capacitor-ios.md`,
> `stack-pwa-offline.md`
> **This doc holds:** current ✅/❌/⚠️ status, code-level evidence, prioritized
> roadmap. Principles & mechanics are *referenced*, not repeated — see the
> root `AGENTS.md` and the standards repo at ali999774/ali-agent-standards.
> **Last updated:** June 2026
> **Audit method:** Live code inspection (17 source files, every component read)

---

## Deliberate exceptions to Layer 1

- **No bottom tab bar** (overrides the instinct to add platform-standard nav).
  TaskMatrix is single-view — the 2×2 matrix *is* the app. Per AGENTS.md §8
  ("match navigation depth to the use case"), adding tabs would be navigation
  the content doesn't need. Keep top bar + context switcher. **This is a
  decision, not a gap.**

---

## Status against the standards

### Layer 1 — Universal Principles (AGENTS.md)

| Area (→ source rule) | Status | Evidence |
|---|---|---|
| Touch targets ≥44px (§1) | ✅ | `min-h-[44px] min-w-[44px]` on every interactive element after the touch-target audit pass (commit d22867e). Header icons, context pills, quick-add buttons, TaskCard controls, pomodoro ± buttons, subtask ×, sticky note × — all covered. |
| 24px hard floor (§1) | ✅ | All targets at or above 44px. The 24px floor is no longer relevant as the floor was raised across the board. |
| 8px spacing between targets (§1) | ⚠️ | Context pills use `gap-1.5` (6px). All other groups use `gap-2` or more. Acceptable at current density. |
| Press/`active:` states (§4) | ✅ | `active:scale-90/95/98` on every button. Pomodoro start/pause/reset/close filled in (commit 8ec1d66, 3426d42). |
| Optimistic updates (§4) | ✅ | All mutations update local state before await. Realtime reconciles. |
| Skeleton loads (§4) | ✅ | 2×2 shimmer skeleton implemented (commit 8ec1d66). |
| `prefers-reduced-motion` (§5) | ✅ | Global CSS rule + `motion-reduce:` variants on animated elements (commit 8ec1d66). |
| Dark mode (§6) | ✅ | System detect + manual toggle + localStorage persist + every component has dark variants. |
| `aria-label` on icon buttons (§7) | ✅ | All icon-only buttons labeled after audit pass (commits d22867e, 3426d42, chore/ui-polish-batch). |
| Dynamic type (§7) | ✅ | Text sizes use Tailwind `rem`-based classes (text-xs = 0.75rem, etc.). Scales with system font settings. |
| Focus indicator hygiene (§7) | ⚠️ | `focus:border-*` on inputs is good. `focus-visible:` migration not yet done — rings appear on mouse click too. Low friction in practice. |
| One-handed reach (§2) | ✅ | Mobile bottom dock added with primary actions at thumb-reach (commit 8ec1d66). |
| Swipe gestures (§3) | ❌ | No swipe-to-complete. Drag-and-drop (desktop/touch long-press) covers the move gesture. Lower priority than current backlog. |
| State persistence (§8) | ✅ | Theme, quadrant collapse, context filter in localStorage. Tasks/notes in Supabase + realtime. |
| Offline behavior (§9) | ✅ | Service worker (cache-first assets), Dexie offline mutation queue, online banner, auto-flush on reconnect. |

### Stack module: React + Tailwind

| Area | Status | Evidence |
|---|---|---|
| `active:` on every button | ✅ | Full coverage including pomodoro controls. |
| Touch targets via `min-h-[44px]` | ✅ | Systematic audit — all interactive elements covered. |
| `rem`-based / relative sizing | ✅ | All Tailwind text-* classes are rem-based. |
| `motion-reduce:` variants | ✅ | Global prefers-reduced-motion CSS + inline `motion-reduce:` classes. |
| Skeleton over text loading | ✅ | 2×2 shimmer skeleton on task load. |
| Sticky notes disk-IO pattern | ✅ | Dirty-flag + 400ms debounce in `useStickyNotes`. |

### Stack module: Capacitor + iOS WebView

| Area | Status | Evidence |
|---|---|---|
| `dvh` instead of `vh` | ✅ | `#root { min-height: 100dvh }` in index.css. |
| Safe-area insets | ✅ | `env(safe-area-inset-top/bottom)` on header, TaskDetail, nav bar (commit 8ec1d66). |
| `@capacitor/haptics` | ✅ | `useHaptics()` hook with platform detection. Fires on task complete/delete/save. |
| Platform detection | ✅ | `Capacitor.isNativePlatform()` gates OAuth and haptics paths. |
| Keyboard avoidance | ✅ | `interactive-widget=resizes-content` meta + `resize: none` viewport fix. |
| Liquid Glass material | ✅ | Not used (correctly — no fake glass behind content). |

### Stack module: PWA / Offline

| Area | Status | Evidence |
|---|---|---|
| Service worker | ✅ | `public/sw.js` registered in main.tsx. Cache-first assets, network-first nav. |
| Offline indicator | ✅ | Amber banner + sync count in header. Auto-dismisses on reconnect. |
| IndexedDB mutation queue | ✅ | Dexie-based `useOfflineQueue`. Enqueues create/update/delete, flushes on reconnect, 24h stale cutoff, 500-item cap. |
| Cache-first render | ✅ | Service worker serves app shell from cache on return visit. |
| Performance targets | ⚠️ | LCP/FCP not measured in CI. Bundle ~587 kB minified — above the 500 kB guidance; code-splitting is a future item. |

---

## What's genuinely good

This codebase punches above its weight in five areas:

1. **Optimistic updates are textbook.** Every mutation updates local state first, then persists. Realtime subscription reconciles conflicts. This is the pattern the standards call for, implemented correctly.

2. **Dark mode is complete.** System detect, manual toggle, persistence, every component has `dark:` variants. No half-lit components.

3. **`active:` states are everywhere.** Every interactive element gives immediate tap feedback. Consistent across all components.

4. **Offline-first is real.** The Dexie mutation queue + service worker combination means the app works with network off and converges cleanly on reconnect. The 24h stale-cutoff and 500-item cap are production-grade details.

5. **Security invariant on markdown.** `markdown.ts` escapes `<`, `>`, `&` before any formatting substitution, preventing XSS via `dangerouslySetInnerHTML`. The escape-first invariant is documented in a comment.

---

## Shipped — Polish Sprint (June 2026)

### Lane 1 — feat/completed-history (Task A)
- **Completed-task history persisted**, migration-free. Done tasks now live as `status='done'` rather than being soft-deleted 3s after completion.
- Active matrix filters on `status='todo'` (not `deleted_at`). Phantom `'completed'` value eliminated.
- Per-row ↩ undo in CompletedSection. "Clear completed" batch-clears via `deleted_at` (existing soft-delete column, no migration).
- Offline: `clearCompleted` enqueues per-task `update` operations via `useOfflineQueue` when offline.
- `// TODO(completed_at)` comment left per spec — precise sort and age-based purge require a migration.

### Lane 2 — chore/ui-polish-batch (Tasks B/C/D/E)
- **B. XSS escape hardening** — `markdown.ts`: `escapeHtml` before `renderInline`. Notes with `<`, `&`, `<script>` render as literal text. SECURITY INVARIANT comment documents the precondition.
- **C. Delete-confirm reset** — `NoteEditModal`: replaced `window.confirm/alert` with in-modal confirm state. `confirmingDelete` resets on close, note change, and unmount. Validation error renders inline as `role=alert`.
- **D. Pomodoro idle-guard** — `adjustDuration`: guard `if (type === session && running) return`. Buttons disabled with visual feedback while running. Idle adjust updates `timeLeft` immediately.
- **E. Settings keyboard activation** — Category rows get `role=button`, `tabIndex=0`, `aria-label`, `onKeyDown` Enter/Space handler. Drag-reorder unchanged (keyboard reorder is backlog — see below).

---

## Backlog

Items deferred from this sprint with rationale:

| Item | Rationale for deferral |
|---|---|
| **Keyboard reorder for category drag rows** | Native HTML5 drag-and-drop has no keyboard path. A proper keyboard solution (↑/↓ arrow key reorder) requires a custom keyboard event handler on each row plus focus management across reorders. This is a self-contained a11y enhancement that doesn't block any current flow. `TODO(a11y)` comment left in `SettingsModal.tsx`. |
| **`completed_at` column + age-based purge** | Requires a Supabase migration (new column on `tasks`). Currently sorting by `updated_at desc` which is an accurate proxy (status changes update the row). The purge policy (e.g. clear tasks older than 30 days) needs a product decision before implementation. `TODO(completed_at)` comment left in `CompletedSection.tsx`. |
| **Bundle code-splitting** | `index-*.js` is 587 kB minified. The standard guidance is under 500 kB. Splitting on route or lazy-loading the TaskDetail/NoteEditModal would help. Not blocking any flow. |
| **`focus-visible:` migration** | Cosmetic: focus rings appear on mouse click because we use `focus:` not `focus-visible:`. Affects no keyboard or touch users. Low priority, high line-count change. |
| **Swipe-to-complete gesture** | No current demand. Drag-and-drop + long-press covers power users. |

---

## Previously identified issues — net change

| Item | Audit (June) | Now |
|---|---|---|
| Touch targets ≥44px | ❌ | ✅ Resolved |
| Press/`active:` states | ⚠️ | ✅ Resolved |
| Skeleton load | ❌ | ✅ Resolved |
| `aria-label` coverage | ⚠️ | ✅ Resolved |
| `prefers-reduced-motion` | ❌ | ✅ Resolved |
| Safe-area insets | ❌ | ✅ Resolved |
| `@capacitor/haptics` | ❌ | ✅ Resolved |
| Service worker / offline | ❌ | ✅ Resolved |
| Sync queue | ❌ | ✅ Resolved |
| Completed-task history | ❌ | ✅ Resolved |
| XSS escape in markdown | ❌ | ✅ Resolved |
| Delete-confirm (NoteEditModal) | ❌ | ✅ Resolved |
| Pomodoro idle-guard | ❌ | ✅ Resolved |
| Settings keyboard activation | ❌ | ✅ Resolved |
| Dynamic type | ❌ | ✅ Resolved (rem-based Tailwind classes) |
| `100vh`→`dvh` | ⚠️ | ✅ Resolved (confirmed) |
| Swipe-to-complete | ❌ | ❌ Backlog |
| `focus-visible:` migration | ⚠️ | ⚠️ Backlog (cosmetic) |
| Bundle size | ⚠️ | ⚠️ Backlog |

**Net from original audit:** 14 items resolved, 3 remain as tracked backlog.

---

*Audit: live code inspection, June 2026. 17 source files, every component read.*
*Polish sprint: feat/completed-history + chore/ui-polish-batch merged to main.*
