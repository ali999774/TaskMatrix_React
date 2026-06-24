# AGENTS.md — TaskMatrix

> This file is injected into the system prompt of every AI agent that works in this
> directory (Hermes, Claude Code, Copilot, Cursor). Read it fully before touching code.
> It is the distilled memory of every session that came before you. Treat the
> "Pitfalls" and "Coding Rules" sections as hard constraints, not suggestions.

TaskMatrix is an Eisenhower-matrix task manager: tasks are placed in four quadrants
(importance × urgency), with sticky notes, voice capture, AI task parsing, a Pomodoro
timer, local + push reminders, offline support, and live cross-device sync. It ships as
a web app on GitHub Pages and as a native iOS app via Capacitor (WKWebView wrapper).

---

## Stack

- **React 19** + **TypeScript** (strict) + **Vite** (build: `tsc -b && vite build`)
- **Supabase** — PostgREST (CRUD), Realtime (WebSocket), Edge Functions (Deno), Auth (Google OAuth)
- **Capacitor 8** — iOS WKWebView wrapper (`@capacitor/*` plugins for app, browser, haptics, local-notifications, push-notifications; `@capgo/capacitor-speech-recognition` for native STT)
- **Framer Motion 12** — swipe gestures (`SwipeableRow`), drag, height animations (`AnimatePresence`)
- **Tailwind CSS 4** — CSS-first `@theme` design tokens in `src/index.css`, class-based dark mode
- **Dexie** (IndexedDB) — offline mutation queue
- **Deploy:** GitHub Pages (web, from `main`, origin `https://ali999774.github.io`) + Xcode (iOS build)

`vite.config.ts` sets `base: './'` — relative asset paths are **required** so the bundle
works both on GitHub Pages (subpath) and inside Capacitor's `capacitor://localhost`.

---

## Source File Map

### Entry / orchestration
| File | Role | Key exports / notes |
|------|------|---------------------|
| `src/main.tsx` | Bootstraps React under `StrictMode`; registers `./sw.js` service worker | StrictMode double-mounts effects — guard listeners (see `appUrlOpen`) |
| `src/App.tsx` | **Central orchestrator.** Auth, deep links, quick actions, quick-add, voice handlers, AI suggest, undo snackbar, modal routing, theme, body-scroll lock | `ErrorBoundary`, `useTheme`, `App` |
| `src/types.ts` | `Task`, `StickyNote`, `Quadrant`; quadrant maps & `importanceUrgencyToQuadrant`, `QUADRANT_DEFAULTS` | Single source of quadrant truth |

### Hooks (`src/hooks/`)
| File | Role | Key exports |
|------|------|-------------|
| `useTasks.ts` | Task CRUD, realtime, recurring auto-clone, reminder scheduling, dirty-flag debounce | `useTasks(userId, offlineQueue)` → `{ tasks, addTask, updateStatus, updateTask, deleteTask, restoreTask, clearCompleted, reload }` |
| `useStickyNotes.ts` | Note CRUD, realtime, reorder, dirty-flag debounce | `useStickyNotes(...)` → `{ notes, pinnedNotes, addNote, updateNote, deleteNote, reorderNote }` |
| `useUserSettings.ts` | Categories persistence (Supabase + localStorage cache + realtime); Ali-category migration | `useUserSettings(...)` → `{ categories, updateCategories }` |
| `useAISettings.ts` | localStorage AI config (enabled / provider / model) | `useAISettings()` → `{ aiSettings, updateAISettings, getAIBaseUrl }` |
| `usePomodoro.ts` | Timer state machine, auto-advance, completion alert (haptics + chime + notification) | `usePomodoro(show)`; `SESSION_LABELS` |
| `usePushNotifications.ts` | APNs registration, device-token upsert, deep-link tap → `tm:open-task` event | `usePushNotifications(userId)` |
| `useOfflineQueue.ts` | Dexie-backed queue for failed/offline Supabase writes; auto-flush on reconnect | `useOfflineQueue(userId, supabase)` → `{ enqueue, flush, pendingCount, isFlushing, online }` |
| `useHaptics.ts` | Native iOS haptics + web vibrate fallback; respects reduced-motion | `useHaptics()` → `fire('light'\|'medium'\|'success')` |

### Lib (`src/lib/`)
| File | Role |
|------|------|
| `ai-parse.ts` | 4 AI modes (parse / breakdown / suggest / format) → all POST to the `ai-parse` Supabase edge function. Returns discriminated unions. |
| `notifications.ts` | Local notification scheduling for task reminders; `REMINDER_OPTIONS`, `defaultReminder`, `scheduleTaskReminder`, `cancelTaskReminder`, `listenForReminderTaps`. UUID→int32 `hashTaskId`. |
| `supabase.ts` | Supabase client init from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (throws if missing) |
| `dates.ts` | `parseLocalDate`, `localTodayStr` — **local-midnight** parsing to dodge UTC off-by-one |
| `markdown.ts` | Tiny safe markdown → HTML (bold, strikethrough, lists). **Escape-first.** `renderMarkdown`, `stripMarkdown` |
| `categories.ts` | `CategoryDef`, `DEFAULT_CATEGORIES`, color maps (`CATEGORY_BORDER/BADGE/RING/COLOR_HEX`) |
| `matrix.ts` | `groupTasksByQuadrant` → `QuadrantBucket[]`; `MATRIX_GRID_BREAKPOINT = 640` |
| `speech.ts` | `speechSupported`, `isNativeSpeech`, `formatVoiceNote` |

### Components (`src/components/`)
| File | Role |
|------|------|
| `TaskCard.tsx` | Task row: checkbox, title, due/category meta, drag (desktop), long-press move menu (touch), wraps `SwipeableRow` |
| `TaskDetail.tsx` | Task editor modal (title, category, due/time, reminder, recurrence, subtasks, AI breakdown, notes). Bottom-sheet on mobile w/ swipe-to-dismiss |
| `SwipeableRow.tsx` | iOS swipe-to-reveal actions via `useMotionValue` (zero re-renders during drag) |
| `VoiceButton.tsx` | Native (Capacitor) + web speech recognition; silence/max-duration auto-stop; `autoStart` for quick actions |
| `StickyWall.tsx` | Pinned-notes sidebar; HTML5 drag reorder; renders markdown via `dangerouslySetInnerHTML` |
| `NotesModal.tsx` | All-notes grid + search; swipe actions (edit/pin/delete) |
| `NoteEditModal.tsx` | Note editor; 600ms autosave debounce; formatting toolbar; auto-advancing lists |
| `SettingsModal.tsx` | AI settings + category editor (drag/keyboard reorder, color, icon) |
| `PomodoroPopup.tsx` | Two modes: draggable idle card + full-screen running view; SVG progress ring |
| `CompletedSection.tsx` | Collapsible done-task list; owns its own `status='done'` query; per-row undo + clear-all |
| `TodayStrip.tsx` | Overdue + due-today banners above the matrix |
| `Icons.tsx` | Inline-SVG icon set using `currentColor` (`QUADRANT_ICON_MAP`, `ICON_MAP`) |

### Matrix (`src/components/matrix/`)
| File | Role |
|------|------|
| `MatrixScreen.tsx` | Orchestrator: groups data **once**, renders both layouts, CSS container-query swaps them |
| `MatrixGrid.tsx` | 2×2 wide layout; per-cell drop zones (`grid:*`); Invest emphasis; overflow cap (`MAX_VISIBLE=4`); pinned row |
| `MatrixList.tsx` | Single-column narrow layout; importance gradient order (`invest → do-first → delegate → dont-do`); drop zones (`list:*`) |
| `QuadrantHeader.tsx` | Shared header: accent dot, label, subtitle, count, collapse toggle |
| `CountBadge.tsx` | Numeric pill with optional quadrant tint |
| `CheckCircle.tsx` | Status toggle (○/●) with haptic + completion chime |

### Backend / config
| File | Role |
|------|------|
| `supabase/functions/push-send/index.ts` | Deno edge fn: signs APNs ES256 JWT, sends to `device_tokens`, prunes 410-stale tokens |
| `supabase/migrations/*.sql` | `device_tokens` table (+RLS); `tasks.reminder` column |
| `capacitor.config.ts` | `appId: com.milestonepediatrics.taskmatrix`, `webDir: dist`, `ios.scheme: taskmatrix`, `ios.keyboardResize: 'none'` |
| `vite.config.ts` | React + Tailwind plugins; `base: './'` |
| `src/index.css` | Tailwind 4 `@theme` tokens, dark overrides, safe-area utils, modal keyframes, matrix container query |

> **Note:** the `ai-parse` edge function source is **not** in this repo — it is deployed
> directly to Supabase (project `xulnxwwwjpvgsaqnsllo`). Only `push-send` is checked in.
> The client calls it at `https://xulnxwwwjpvgsaqnsllo.supabase.co/functions/v1/ai-parse`.

---

## Architecture

- **Supabase project ID:** `xulnxwwwjpvgsaqnsllo`
- **Auth:** Google OAuth → Supabase → user-scoped RLS. Native uses `taskmatrix-auth://callback`
  + `@capacitor/browser`; web uses `signInWithOAuth` with same-origin redirect. **Branch on
  `Capacitor.isNativePlatform()`, never on `window.Capacitor`** (the web shim defines it too,
  which previously sent web users down the native OAuth path → broken redirect).
- **Tables:** `tasks`, `sticky_notes`, `user_settings`, `device_tokens` — all `user_id`-scoped
  with RLS. `tasks`/`sticky_notes` use **soft delete** via `deleted_at`.
- **Sync model:**
  - **Dirty-flag + 400ms debounce** for `updateTask` / `updateNote` / `reorderNote` (title edits,
    positions, drag). A per-id JSON snapshot suppresses no-op writes. Pending changes are flushed
    on unmount.
  - **Immediate** writes for `updateStatus` (done/todo), `addTask`, `deleteTask`,
    `clearCompleted` — discrete, infrequent, user-initiated.
  - **Update vs upsert:** offline-queue *create* uses `upsert` (full payload incl. `user_id`);
    *update* uses `update().eq()` to avoid the INSERT branch failing RLS when `user_id` is absent.
- **Realtime:** one Supabase channel per table (`postgres_changes`, filtered by `user_id`).
  The tasks channel drops rows from the active matrix when `status !== 'todo'` or `deleted_at`
  is set. `selectedTask` is re-synced from `tasks` so the open detail modal tracks live edits.
- **AI:** all LLM calls route through the **`ai-parse` Supabase edge function** — the browser
  cannot call DeepSeek/OpenAI directly (CORS) and the API key must stay server-side (Supabase
  secrets). The client forwards `{ transcript, model, baseUrl, mode? }`; the key is **never** in
  client code. Modes: `parse` (default), `breakdown`, `suggest`, `format`.
- **Offline:** `useOfflineQueue` buffers writes in Dexie (cap 500, drop-oldest; discard >24h on
  flush). Auto-flushes when `online && pendingCount > 0`. The online flag is the single source
  of truth for the offline banner + sync indicator.
- **Push:** `usePushNotifications` → `PushNotifications.register()` → APNs token → upsert into
  `device_tokens` → `push-send` edge fn signs an ES256 JWT and POSTs to APNs. Taps dispatch a
  `tm:open-task` CustomEvent that `App.tsx` listens for to open the task.
- **Local notifications:** `scheduleTaskReminder` (native only) fires per-task reminders keyed
  by `hashTaskId(uuid)` so re-scheduling replaces the prior notification. `useTasks` reactively
  schedules/cancels as the task list changes.

---

## Component Tree

```
main.tsx (StrictMode)
└── App  (ErrorBoundary wraps everything)
    ├── [auth gate] Sign-in screen  /  loading skeletons
    ├── <header> quick-add
    │   ├── VoiceButton (voice → task, autoStart on quick action)
    │   ├── quick-add <input> (+ "Try: <AI suggestion>" overlay)
    │   └── actions: Settings · 🎯 What next? · Refresh · Sign out  (mobile = ☰ dropdown)
    ├── offline banner + context (category) switcher
    ├── body
    │   ├── Matrix column
    │   │   ├── TodayStrip (overdue / due-today)
    │   │   └── MatrixScreen           ← groups tasks ONCE; container query swaps:
    │   │       ├── MatrixList         (narrow)
    │   │       │   └── ListQuadrant ×4
    │   │       │       ├── QuadrantHeader → CountBadge
    │   │       │       └── TaskCard
    │   │       │           ├── CheckCircle
    │   │       │           └── SwipeableRow
    │   │       └── MatrixGrid         (wide)
    │   │           ├── GridCell ×4 (→ QuadrantHeader, TaskCard…)
    │   │           └── PinnedRow (pinned tasks)
    │   ├── StickyWall (pinned notes sidebar)
    │   └── CompletedSection (own done-task query)
    ├── TaskDetail        (modal, when selectedTask)
    ├── NotesModal        (modal) → opens NoteEditModal
    ├── NoteEditModal     (modal)
    ├── PomodoroPopup     (idle card ↔ full-screen running)
    ├── SettingsModal     (modal)
    ├── Undo snackbar      (delete / complete)
    └── <nav> bottom bar  (Voice · Focus · Theme · Notes)
```

---

## Complete Pitfalls Catalog

### Capacitor / iOS (WKWebView)
- **Silent JS failures:** WKWebView swallows errors with no visible console. Debug via
  **Safari → Develop → [device] → remote console**. The `ErrorBoundary` in `App.tsx` surfaces
  fatal renders on-screen.
- **`capacitor.config.ts`:** `ios.keyboardResize: 'none'` is intentional — **never** use
  `scrollEnabled: false` or other resize modes; they cause the layout to fight the keyboard.
  `ios.scheme: 'taskmatrix'` powers the `taskmatrix://` / `taskmatrix-auth://` deep links.
  (Some legacy notes mention `hostname: 'localhost'`; the current config does **not** set it —
  don't add it without a reason.)
- **iOS horizontal overflow has TWO causes:** (1) Safari **zoom-on-focus** when an input's
  `font-size < 16px` — the quick-add input is `text-[1rem]` (16px) on purpose; keep all focusable
  inputs ≥16px. (2) keyboard resize. The app defends globally with `overflow-x: clip` on
  `body`/`#root` (clip, **not** `hidden` — `hidden` creates a scroll container and breaks
  `position: sticky`/the fixed header on iOS) plus `max-w-full overflow-x-hidden` on the root div.
- **Body-scroll lock:** any open modal sets `document.body.style.overflow = 'hidden'` (App
  `hasModal` effect) to prevent iOS horizontal overscroll behind the sheet.
- **Deep-link double-fire:** under StrictMode the `appUrlOpen` listener registers twice. Guard
  with an `active` ref and `handlePromise.then(h => h.remove())` on cleanup.
- **`npx cap sync`** copies `dist/` → `ios/App/App/public/`. Make sure `index.html` is copied too.
- **Full Xcode rebuild (⌘R)** is required after **any** Capacitor config change or `cap sync` —
  the WKWebView serves the bundled copy, not your dev server.
- **Native-platform check:** import of `@capacitor/core` defines `window.Capacitor` even in a
  plain browser. Always gate native APIs on `Capacitor.isNativePlatform()` (or the
  try/catch-wrapped `isNativePlatformSafe()` in `speech.ts`).

### AI / LLM
- **Never override the user-selected model on load.** `useAISettings` merges `{ ...DEFAULTS,
  ...parsed }` from localStorage **once** in the `useState` initializer — do not re-write the
  model in an effect on every mount (forced-migration pitfall that silently resets user choice).
- **`deepseek-chat` is dead.** Use `deepseek-v4-flash` (default, fastest) or `deepseek-v4-pro`
  (reasoning). OpenAI options: `gpt-4o-mini`, `gpt-4o`. These are the only values in the
  `SettingsModal` model dropdown — keep `DEFAULTS.model` in sync with it.
- **Check `aiSettings.enabled` FIRST.** Every AI entry point (`handleSuggest`, `handleQuickAdd`,
  `handleVoiceTask`, `handleVoiceNote`) early-returns / falls back when AI is off. A "parse
  failed" symptom is usually just AI disabled, not a network error.
- **All AI failures are non-fatal.** `ai-parse.ts` returns `{ error }` and callers fall back to
  raw transcript / quadrant defaults. Never let an AI error block task/note creation.
- The browser **cannot** call DeepSeek/OpenAI directly (CORS) — everything goes through the
  `ai-parse` edge function. Don't "fix" an AI bug by adding a direct `fetch` to the provider.

### Framer Motion
- **`SwipeableRow` action-button flash on tap:** `dragElastic` introduces a micro x-offset on
  every tap, which would flash the action buttons. Fix = bind button opacity to swipe distance
  with `useTransform(x, [-maxSwipe, -20, 0], [1, 0, 0])` — buttons only appear past ~20px.
- **Nested touch-handler conflict:** the long-press "Move to…" handler lives on the **inner**
  content (`cardInner` in `TaskCard`), **not** the outer wrapper — otherwise it competes with
  `SwipeableRow`'s pan gesture. Keep long-press inside `SwipeableRow`.
- **`bg-inherit` only walks up one level.** The draggable `motion.div` hardcodes
  `bg-white dark:bg-slate-800` so the moving card never shows transparent (revealing the action
  buttons through it). Don't replace it with `bg-inherit`.
- **`z-10` on the draggable `motion.div`** is required so the card sits above the action buttons
  and they don't bleed through.
- **`touchAction: 'pan-y'`** on the draggable element lets vertical page scroll pass through
  while the row owns horizontal pans.
- Drag is desktop-disabled where touch swipe is used: `drag={IS_TOUCH ? 'x' : false}`
  (`IS_TOUCH = matchMedia('(pointer: coarse)')`). TaskCard uses HTML5 `draggable` only when
  `!IS_TOUCH`; touch uses long-press instead because HTML5 DnD doesn't fire on iOS.

### Visual Conventions
- **TaskCard:** `py-2 px-2.5 rounded-xl bg-white dark:bg-slate-800`, `shadow-sm`,
  `border-l-[3px]` colored category accent (transparent when no category).
- **Title:** `text-[0.78125rem] sm:text-[0.875rem] font-semibold`. Done = `line-through` + muted.
- **Meta line:** `text-[0.65625rem] sm:text-[0.75rem]`; category shown as inline `#name` tag in
  blue (**not** a colored pill); due-date label turns red when Today/Overdue.
- **SwipeableRow (iOS mode, `showLabels={false}`):** 44px circular buttons, iOS system colors —
  `#8E8E93` (details/info), `#FF9500` (flag), `#FF3B30` (delete), `#007AFF`/`orange-500` (note
  edit/pin). 6px gap, 8px right pad.
- **StickyWall / notes:** same `border-l-[3px]` left accent as task cards; 4-color palette
  (`red / amber / blue / green`) that visually rhymes with the quadrant accents.
- **Section dividers:** `border-slate-200/60` (light) / `border-slate-800/40` (dark).
  Inter-task dividers: `divide-slate-100 dark:divide-slate-800/40`.
- **Quadrant colors are design tokens** in `index.css` `@theme` (`--color-quad-*`), iOS system
  palette, with dark overrides via the `.dark` class. **Zero raw hex outside `index.css`** —
  reference tokens (`border-l-[var(--color-quad-invest)]`) or Tailwind color utilities.
- **Tap targets:** every interactive element carries `min-h-[44px] min-w-[44px]` (Apple HIG).
- **Reduced motion:** pair scale/animation utilities with `motion-reduce:` variants; the global
  CSS also clamps animation/transition durations under `prefers-reduced-motion`.

### Debugging
- **"Text is white on white" / invisible note text:** notes render in **two** places —
  `NotesModal` *and* `StickyWall` (and `NoteEditModal` preview). Fix the color in **all** of
  them. Note bodies use `dangerouslySetInnerHTML={{ __html: renderMarkdown(...) }}` with explicit
  `text-slate-700 dark:text-slate-300`.
- **Markdown XSS:** `markdown.ts` escapes `&<>` **before** substituting `**`/`~~`. The SECURITY
  INVARIANT comment is load-bearing: escape-first is safe **only** because every emitted tag is
  attribute-free and URL-free. Adding `<a>`/`<img>` requires URL-scheme validation (block
  `javascript:`), not just text escaping.
- **Patch tool corrupting `App.tsx`:** `App.tsx` is large (~870 lines). Always **read the full
  file with no offset/limit before patching** so your edit anchors on exact, current text.

### Dates
- Date-only strings (`YYYY-MM-DD`) passed to `new Date()` parse as **UTC** midnight → off-by-one
  in US timezones. Always use `parseLocalDate()` / `localTodayStr()` from `lib/dates.ts`; never
  `toISOString()` for a display/comparison date.

---

## Deploy Pipeline

```
source change → npm run build → npx cap sync → git add -A → commit → push
```

- **Web:** GitHub Pages deploys from the **`main`** branch only (origin `ali999774.github.io`).
- **Assets** are content-hashed; **merge conflicts on built assets** should be resolved by
  rebuilding on `main` directly rather than hand-merging hashes.
- **iOS:** after every `npx cap sync`, do a full **Xcode rebuild (⌘R)** — the simulator/device
  runs the copied bundle, not the dev server.
- **Required env (web build):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client throws
  without them). **Server secrets** (`ai-parse`, `push-send`): the LLM API key and
  `APNS_KEY_ID` / `APNS_TEAM_ID` / `APNS_PRIVATE_KEY` / `APNS_TOPIC` live in Supabase secrets.

> This repo's CI/agents work on feature branches; do not push to `main` (or open a PR) unless
> explicitly asked.

---

## Coding Rules

- **Discriminated unions, not `T | null`.** Async functions return `{ data: T } | { error: string }`
  (see all of `ai-parse.ts`). Callers branch with `'error' in result` / `'parsed' in result`.
- **Voice recording:** clear **both** the silence timer and the max-duration timer in **every**
  cleanup path (`clearTimers()` is called in stop, abort, error, and unmount). A leaked timer
  keeps the mic logic alive after the component is gone.
- **Capacitor branching:** always check `Capacitor.isNativePlatform()` before any native API.
  Native-only paths (haptics, local/push notifications, native STT) must no-op on web.
- **localStorage migrations run ONCE.** Gate on a version/existence flag (see `useAISettings`
  init-only merge, `useUserSettings` migrate-only-when-empty). Never mutate stored prefs on every
  load.
- **Compute reorder/positions from local state**, never from a fresh Supabase read — a network
  read before the offline check breaks offline reordering (`reorderNote` builds positions purely
  from in-memory `notes`).
- **Optimistic updates everywhere:** mutate local React state first, then persist (immediate or
  debounced). Realtime echoes are de-duped by id.
- **Keep the two matrix layouts behavior-identical.** They share `MatrixLayoutProps` and consume
  the same `QuadrantBucket[]`. `groupTasksByQuadrant` is called **once** in `MatrixScreen`; don't
  re-group per layout, and don't reorder its `[1,2,3,4]` output (the grid depends on it — list
  reordering is a local `useMemo`).
- **Keep the breakpoint in sync:** `MATRIX_GRID_BREAKPOINT` (640) in `lib/matrix.ts` mirrors the
  `@container matrix (min-width: 640px)` rule in `index.css`. Change both together.
- **Status vocabulary is `'todo'` / `'done'`** (there is no `'completed'`). The active matrix
  queries `status='todo'`; `CompletedSection` owns `status='done'`. Completing a recurring task
  auto-clones the next occurrence (`getNextDueDate` in `useTasks`).
- **Post-change workflow is MANDATORY for any UI change:** `build → cap sync → commit → push`.
  A change that isn't synced + rebuilt does not exist on iOS.

---

## Quick Reference

- **Quadrants:** Q1 Do First (urgent+important, red), Q2 Invest (important, amber — emphasized
  with ring+shadow, never repositioned), Q3 Delegate (urgent, blue), Q4 Don't Do (neither, gray).
  `importance >= 3 && urgency >= 3` → Q1, etc. (`importanceUrgencyToQuadrant`).
- **Open a task programmatically:** dispatch `window.dispatchEvent(new CustomEvent('tm:open-task',
  { detail: { task_id } }))` — used by both push and local-notification taps.
- **Quick actions (iOS home-screen):** `taskmatrix://quick-action/{new-note|voice-task|voice-note}`,
  handled cold-start (`getLaunchUrl`) and warm (`appUrlOpen`) in `App.tsx`.
</content>
</invoke>
