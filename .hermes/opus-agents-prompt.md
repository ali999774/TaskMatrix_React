# Opus Task: Rewrite TaskMatrix AGENTS.md

You have ~1 hour of Claude Opus 4. Read the entire TaskMatrix codebase and produce a comprehensive AGENTS.md. This document is injected into the system prompt of every AI agent that works in this directory (Hermes, Claude Code, Copilot, Cursor) — it's the single highest-leverage artifact you can produce.

## Step 1: Read the codebase (30 min)

Read every source file in order. The project is at `/Users/ali/dev/apps/TaskMatrix_React/`.

Priority order:
1. `src/App.tsx` — central orchestration (voice handlers, AI settings, quick-add, suggestions, pomodoro, push notifications)
2. `src/types.ts` — Task, Note, UserSettings interfaces
3. `src/hooks/useTasks.ts` — task CRUD, Supabase sync, recurring task auto-clone, reminder scheduling
4. `src/hooks/useStickyNotes.ts` — notes CRUD, Supabase sync
5. `src/hooks/useAISettings.ts` — localStorage AI config (enabled, provider, model)
6. `src/hooks/usePomodoro.ts` — timer state machine, completion alerts (haptics + chime + notification)
7. `src/hooks/usePushNotifications.ts` — APNs push registration, token storage, deep-link handling
8. `src/hooks/useOfflineQueue.ts` — offline queue for Supabase writes
9. `src/lib/ai-parse.ts` — 4 AI modes (parse, breakdown, suggest, format) via Supabase edge function
10. `src/lib/notifications.ts` — local notification scheduling for task reminders
11. `src/lib/supabase.ts` — Supabase client initialization
12. `src/lib/dates.ts`, `src/lib/markdown.ts`, `src/lib/categories.ts`, `src/lib/matrix.ts`, `src/lib/speech.ts`
13. All components: TaskCard, TaskDetail, NotesModal, NoteEditModal, StickyWall, SwipeableRow, VoiceButton, SettingsModal, PomodoroPopup, CompletedSection, TodayStrip, Icons
14. Matrix components: MatrixScreen, MatrixGrid, MatrixList, QuadrantHeader, CountBadge, CheckCircle
15. `capacitor.config.ts`, `vite.config.ts`, `package.json`
16. `supabase/functions/ai-parse/index.ts`, `supabase/functions/push-send/index.ts`
17. Existing docs: `AGENTS.md`, `ARCH-NOTES.md`, `README.md`, `STATUS.md`, `docs/UI-UX-AUDIT.md`

## Step 2: Produce AGENTS.md (30 min)

Write a NEW AGENTS.md that replaces the current one. Structure:

### Stack
- React 19 + TypeScript + Vite
- Supabase (PostgREST + Realtime + Edge Functions)
- Capacitor (iOS WKWebView wrapper)
- Framer Motion (animations, swipe gestures, drag)
- Tailwind CSS 4
- GitHub Pages (web deploy) + Xcode (iOS build)

### Source File Map
Every file with its role, key exports, and dependencies. Use the format:
```
src/App.tsx — Central orchestrator. Voice handlers, AI settings, quick-add bar, 
  suggestion system, pomodoro timer, push notification deep-link handling.
  Imports: useTasks, useStickyNotes, useAISettings, usePomodoro, usePushNotifications
```

### Architecture
- Supabase project ID: xulnxwwwjpvgsaqnsllo
- Auth: Google OAuth → Supabase → user-scoped RLS
- Sync: dirty-flag + 400ms debounce for notes. Immediate for task status changes.
- Realtime: WebSocket for live cross-device updates
- AI: All LLM calls route through Supabase edge function `ai-parse` (CORS blocks browser→DeepSeek). API key in Supabase secrets, never in client code.
- Offline: useOfflineQueue buffers failed Supabase writes
- Push: Capacitor PushNotifications → APNs token → device_tokens table → push-send edge function
- Local notifications: @capacitor/local-notifications for task reminders (zero backend)

### Component Tree
```
App
├── MatrixScreen
│   ├── MatrixGrid / MatrixList (toggle)
│   │   └── QuadrantHeader (collapse toggle, count badge)
│   │   └── TaskCard (SwipeableRow → swipe actions)
│   └── TodayStrip (horizontal scroll of today's tasks)
├── TaskDetail (modal: edit, subtasks, AI breakdown, recurring, reminder)
├── NotesModal (all notes, search, quick-add)
├── NoteEditModal (markdown editor, color picker, formatting toolbar)
├── StickyWall (pinned notes grid)
├── SettingsModal (AI toggle, provider/model selectors)
├── PomodoroPopup (timer, idle/active states)
├── VoiceButton (native Capacitor plugin + Web Speech API fallback)
├── CompletedSection (completed tasks list)
└── Quick-add bar (suggestion display, voice task status)
```

### Complete Pitfalls Catalog
Every gotcha you find in the code, organized by domain. Include specific error messages, fixes, and commit SHAs where relevant. At minimum cover:

**macOS/Shell:**
- Shell-init garbage injection on file writes from ~/Documents — always cd /tmp first
- Python heredoc pattern as escape hatch when patch/write_file fail

**Capacitor iOS:**
- WKWebView silent JS failures → debug via Safari DevTools remote console
- capacitor.config.ts: hostname must be 'localhost', keyboardResize: 'none' (never scrollEnabled:false)
- iOS horizontal overflow: TWO causes — Safari zoom-on-focus (font-size < 16px on inputs) AND keyboard resize
- npx cap sync copies dist/ to ios/App/App/public/ — must also copy index.html
- Full Xcode rebuild (⌘R) required after any Capacitor config change
- Safe area in bottom-sheet modals: pb-[calc(1.5rem+env(safe-area-inset-bottom))]

**Supabase:**
- upsert type mismatch → cast `task as any`
- RLS policies: user-scoped, soft-delete via deleted_at
- Edge function CORS: allow capacitor://localhost, taskmatrix://localhost

**AI/LLM:**
- Model name forced migration pitfall — never override user-selected model on every load
- `deepseek-chat` is dead — use deepseek-v4-flash or deepseek-v4-pro
- AI parse failures → check aiSettings.enabled FIRST
- Voice recording auto-stop: silence timer (5s) + max duration cap (5min)

**Framer Motion:**
- SwipeableRow action button flash on tap → bind opacity to swipe distance with useTransform
- Nested touch handler conflict → long-press must be INSIDE SwipeableRow, not on outer wrapper
- bg-inherit only goes one level up → hardcode bg-white/bg-slate-800 on motion.div
- z-10 required on motion.div to prevent button bleed-through
- Quadrant collapse uses AnimatePresence with height animation

**Visual Conventions:**
- Apple Reminders aesthetic: compact white cards on tinted quadrants
- TaskCard: py-2 px-2.5 rounded-xl, shadow-sm, border-l-[3px] colored accent
- Title: text-[0.8125rem] font-semibold
- Details: text-[0.6875rem], category as #name inline tag (not colored pill)
- SwipeableRow: 44px circular buttons, iOS system colors (#8E8E93, #FF9500, #34C759, #FF3B30, #007AFF)
- StickyWall: same 3px left border as task cards, 4-color palette matching quadrants
- All section dividers: border-slate-200/60 (light) / border-slate-800/40 (dark) — opacity for subtlety
- Empty states: ✦ icon + minimal text, no dashed borders

**Debugging:**
- "Text is white on white" → check BOTH NotesModal AND StickyWall (the bug is usually in the other one)
- Patch tool corrupting App.tsx → always read_file with NO offset/limit before patching
- Accessibility: WKWebView hit-region warnings → aria-hidden on decorative elements, explicit h-11 not min-h-[44px]

**Deploy Pipeline:**
- Source change → npm run build → npx cap sync → git add -A → commit → push
- GitHub Pages deploys from main branch only
- Merge conflicts on content-hash assets → rebuild on main directly, don't merge built assets
- iOS requires Xcode rebuild (⌘R) after every cap sync

### Testing
- Playwright tests in tests/ directory
- Capacitor hooks: mock Capacitor.isNativePlatform() for web tests
- Voice: mock SpeechRecognition for Web Speech API tests

### Deploy
- Web: GitHub Pages, deploy.yml triggers on push to main
- iOS: Xcode build from ios/App/, requires Apple Developer account
- Push notifications: manual APNs key setup required (cannot automate)

### Coding Rules
- Return discriminated unions from async functions: `{data: T} | {error: string}`, never `T | null`
- Voice recording: always clear both timers (silence + max duration) in stop, abort, toggle, and unmount
- Capacitor: always branch on Capacitor.isNativePlatform() before using native APIs
- localStorage migrations: run once (version flag), never on every load
- Post-change workflow is MANDATORY for UI changes: build → sync → commit → push → tell user to rebuild

## Quality Bar

This AGENTS.md should make a first-time agent in this project as effective as one that's had 20 sessions of trial and error. Every pitfall that cost us hours of debugging should be documented. Every convention should be explicit. The goal: the next agent reads this and makes zero of the mistakes you found in the codebase.

## Output

Write the complete AGENTS.md to `/Users/ali/dev/apps/TaskMatrix_React/AGENTS.md` (overwrite existing).

Then tell the user: "AGENTS.md written. [N] source files read, [M] pitfalls documented, [K] components mapped. Deploy pipeline, visual conventions, and debugging guide included."
