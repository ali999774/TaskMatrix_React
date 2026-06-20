# TaskMatrix Polish Sprint — STATUS

## Lane 1 — feat/completed-history (Task A)
- [x] A. Completed-history persisted, migration-free
  - `useTasks.ts` active-matrix filter → `eq('status','todo')`
  - `CompletedSection.tsx` query → `status='done' AND deleted_at IS NULL`
  - Per-row ↩ undo; "Clear completed" button (window.confirm)
  - `clearCompleted()` enqueues via `useOfflineQueue` when offline
- [x] Offline round-trip verified (code path: `offlineQueue.enqueue` in `clearCompleted` + `updateStatus`)

## Lane 2 — chore/ui-polish-batch (Tasks B/C/D/E)
- [x] B. Escape hardening — `markdown.ts` `escapeHtml` before `renderInline` + SECURITY INVARIANT comment
- [x] C. Delete-confirm reset — `NoteEditModal` in-modal confirm state, resets on close/note-change/unmount
- [x] D. Pomodoro idle-guard — `adjustDuration` guard + immediate `setTimeLeft` on idle adjust + disabled buttons
- [x] E. SettingsModal activation a11y — `role=button`, `tabIndex=0`, `aria-label`, `onKeyDown` Enter/Space

## Gate — Dev
- [x] Merge feat/completed-history into main (commit: merge feat/completed-history)
- [x] Merge chore/ui-polish-batch into main (commit: merge chore/ui-polish-batch)
- [x] tsc -b --noEmit → 0 errors
- [x] eslint (changed files) → 0 errors, 1 pre-existing warning (App.tsx handleNewBlankNote dep)
- [x] vite build → ✓ built in ~180ms
- [x] F. UI-UX-AUDIT.md refreshed — shipped items recorded, backlog with rationale documented
- [x] READY TO SHIP: YES

## Backlog (tracked in docs/UI-UX-AUDIT.md)
1. Keyboard reorder for drag rows in SettingsModal — `TODO(a11y)` comment in SettingsModal.tsx
2. `completed_at` column + age-based purge — `TODO(completed_at)` comment in CompletedSection.tsx
3. Bundle code-splitting — 587 kB minified, above 500 kB guidance
4. `focus-visible:` migration — cosmetic, no blocking flows
