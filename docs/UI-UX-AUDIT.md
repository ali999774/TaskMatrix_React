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
| Touch targets ≥44px (§1) | ❌ | Quick-add quadrant buttons, context pills, voice button, header icon buttons all use `p-1.5`–`p-3` without `min-h-[44px]`. Only pomodoro ± buttons hit 24px floor (barely). |
| 24px hard floor (§1) | ⚠️ | Pomodoro duration ± at `w-6 h-6` (24px) pass. Quadrant collapse toggle at `p-0.5` (~12px) fails. |
| 8px spacing between targets (§1) | ⚠️ | Header buttons use `gap-2` (8px). Context pills use `gap-1.5` (6px). Quadrant quick-add dropdown uses `gap-1.5` (6px). Below the 8px minimum in places. |
| Press/`active:` states (§4) | ⚠️ | Excellent coverage on 90% of controls (`active:scale-90/95`). Missing on: pomodoro start/pause/reset buttons, pomodoro close ×, TaskDetail close ×. These are primary interaction points. |
| Optimistic updates (§4) | ✅ | `addTask`, `updateStatus`, `updateTask`, `deleteTask` all update local state BEFORE the Supabase await. Realtime subscription reconciles on conflict. This is textbook. |
| Skeleton loads (§4) | ❌ | `Loading...` and `Loading tasks...` plain text. No shimmer. No layout-mirroring skeleton. |
| `prefers-reduced-motion` (§5) | ❌ | Zero `motion-reduce:` variants in the codebase. Animations present: `animate-in`, `animate-[slideUp_0.3s_ease]`, `animate-pulse`. All fire unconditionally. |
| Dark mode (§6) | ✅ | System detect + manual toggle + localStorage persist + every component has dark variants. `backdrop-blur` headers in both modes. Exemplary. |
| `aria-label` on icon buttons (§7) | ⚠️ | Top bar icons are all labeled (theme, pomodoro, refresh, sign-out, voice, status-cycle). Missing on: sticky note × delete, TaskDetail close ×, pomodoro start/pause/reset/±/close, subtask × delete. ~60% coverage. |
| Dynamic type (§7) | ❌ | `text-sm`, `text-xs`, `text-base`, `text-lg` used exclusively. No `rem`-based or relative sizing anywhere. Fixed sizes fight the user's system font-scaling. |
| Focus indicator hygiene (§7) | ⚠️ | Inputs use `focus:border-slate-400` and `focus:ring-blue-500` which is good. But `outline-none` on some inputs may hide focus. No `focus-visible:` gating — focus rings appear on mouse clicks too, which is visually noisy. |
| One-handed reach (§2) | ⚠️ | Desktop layout is fine. Mobile: quick-add and primary actions are in the sticky header at the top — not reachable one-handed. The bottom of the screen is used for content display, not actions. |
| Swipe gestures (§3) | ❌ | Drag-and-drop for task movement only. No swipe-to-complete. No gesture affordances. |
| State persistence (§8) | ✅ | Theme, quadrant collapse, sticky wall collapse all in localStorage. Tasks in Supabase with realtime sync. |
| Offline behavior (§9) | ❌ | No service worker. No offline indicator. No sync queue. No cache-first render. App goes blank without connectivity. |

### Stack module: React + Tailwind

| Area | Status | Evidence |
|---|---|---|
| `active:` on every button | ⚠️ | 90% covered. Pomodoro controls (start/pause/reset/close) are the gaps. |
| Touch targets via `min-h-[44px]` | ❌ | No explicit `min-h`/`min-w` on any interactive element. |
| `rem`-based / relative sizing | ❌ | All fixed Tailwind sizes. |
| `motion-reduce:` variants | ❌ | No gating. |
| Skeleton over text loading | ❌ | Plain "Loading tasks…" text. |
| Sticky notes disk-IO pattern | ✅ | The dirty-flag + debounce pattern noted in the module is implemented in `useStickyNotes`. |

### Stack module: Capacitor + iOS WebView

| Area | Status | Evidence |
|---|---|---|
| `dvh` instead of `vh` | ✅ | `#root { min-height: 100dvh }` in index.css. |
| Safe-area insets | ❌ | No `env(safe-area-inset-*)` anywhere. No Capacitor StatusBar plugin. |
| `@capacitor/haptics` | ❌ | Not imported. No haptic feedback. |
| Platform detection | ❌ | No `Capacitor.getPlatform()` gating. App doesn't distinguish iOS from web. |
| Keyboard avoidance | ⚠️ | Not explicitly tested but standard input patterns should work. |
| Liquid Glass material | ✅ | Not used (correctly — no fake glass behind content). |

### Stack module: PWA / Offline

| Area | Status | Evidence |
|---|---|---|
| Service worker | ❌ | No `sw.js`, no Workbox, no registration code. |
| Offline indicator | ❌ | No banner, no detection. |
| IndexedDB mutation queue | ❌ | No offline mutation storage. All writes go direct to Supabase. |
| Cache-first render | ❌ | Always fetches from Supabase on load. Returning visitors get a loading spinner. |
| Performance targets | ⚠️ | LCP/FCP not measured in deployed context. Bundle size unknown without build analysis. |

---

## What's genuinely good

This codebase punches above its weight in three areas:

1. **Optimistic updates are textbook.** Every mutation updates local state first, then persists. Realtime subscription reconciles conflicts. This is the pattern the standards call for, implemented correctly.

2. **Dark mode is complete.** System detect, manual toggle, persistence, every component has `dark:` variants. No half-lit components. The `backdrop-blur` headers in dark mode are a nice touch.

3. **`active:` states are almost everywhere.** 90% of interactive elements give immediate tap feedback via `active:scale-*`. The consistency is notable — it reads like someone did a pass. The remaining gaps (pomodoro controls) look like they were missed rather than ignored.

4. **`aria-label` coverage on top-level controls is better than most PWAs.** Every header icon has a descriptive label. The status-cycle button's label is dynamic (`Cycle status: ${task.status}`). The pattern is established — it just wasn't carried through to secondary controls.

---

## Priority roadmap

### Phase 1 — Offline (highest impact)
1. **Service worker** — register a basic SW with Workbox. Cache app shell + build assets (stale-while-revalidate). This alone prevents the blank-screen-on-offline failure.
2. **Offline indicator** — banner, not modal. Show when a mutation fails due to connectivity.
3. **IndexedDB queue** — store pending writes in Dexie, flush on reconnect. This is the hardest piece; the optimistic-update pattern in `useTasks` already gives us the right architecture (local-first mutations, server reconciliation).

### Phase 2 — Touch & feel
1. **Press states on pomodoro controls** — the missing `active:` states. 10-minute fix.
2. **Touch target bump** — add `min-h-[44px] min-w-[44px]` to header icon buttons, context pills, and quick-add quadrant buttons. This is mostly a CSS change — no layout rework needed.
3. **Skeleton shimmer** — replace "Loading tasks…" with a 2×2 grid of `animate-pulse` placeholders matching the matrix layout. Low effort, high polish.

### Phase 3 — Accessibility
1. **`aria-label` on remaining icon buttons** — sticky note ×, TaskDetail close ×, pomodoro controls, subtask ×. Systematically label every button that has no visible text.
2. **`prefers-reduced-motion` gate** — wrap animations in a hook or use Tailwind's `motion-reduce:` variants. Add `motion-reduce:transition-none` to all animated elements.
3. **`focus-visible:` migration** — replace bare `focus:` with `focus-visible:` on interactive elements so focus rings don't appear on mouse clicks.

### Phase 4 — Capacitor native feel
1. **Safe-area insets** — add `env(safe-area-inset-top/bottom)` padding so content doesn't disappear under the notch/home indicator.
2. **Haptics** — `@capacitor/haptics` on task complete/delete. The Capacitor module has the exact pattern.
3. **Platform detection** — gate haptics and safe-area behind `isIOS` so the web PWA doesn't break.

### Phase 5 — Dynamic type
1. Replace fixed `text-sm`/`text-xs` with `rem`-based equivalents. This touches every component — largest scope, lowest priority because current sizes aren't *broken* at default zoom.

---

## Previously identified issues (from prior audit)

Items from the desk-review audit confirmed or updated by code inspection:

| Item | Was | Now | Note |
|---|---|---|---|
| Optimistic updates | ✅ | ✅ | Confirmed in code |
| Dark mode | ✅ | ✅ | Confirmed in code |
| State persistence | ✅ | ✅ | Confirmed in code |
| Touch targets ≥44px | ⚠️ | ❌ | Downgraded — live inspection confirms under-target |
| Press/`active:` states | ❌ | ⚠️ | Upgraded — 90% covered, specific gaps found |
| Skeleton load | ❌ | ❌ | Confirmed |
| `aria-label` on icon buttons | ❌ | ⚠️ | Upgraded — top-level controls are labeled |
| `prefers-reduced-motion` | ❌ | ❌ | Confirmed |
| Dynamic type | ❌ | ❌ | Confirmed |
| Haptics | ❌ | ❌ | Confirmed |
| Safe-area insets | ❌ | ❌ | Confirmed |
| `100vh`→`dvh` | ⚠️ | ✅ | Confirmed — `dvh` is used |
| Swipe-to-complete | ❌ | ❌ | Confirmed |
| Service worker / offline | ❌ | ❌ | Confirmed |
| Sync queue | ❌ | ❌ | Confirmed |

**Net change from desk review:** 2 upgrades (press states, aria-label), 1 downgrade (touch targets), 1 resolved (dvh).

---

*Audit: live code inspection, June 2026. 17 source files, every component read.*
