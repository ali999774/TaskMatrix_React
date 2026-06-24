# TaskMatrix Polish — 5 Issues

> **For Hermes:** Execute task-by-task. Verify each on iOS Simulator + web. Full build→cap sync→push pipeline after all tasks.

**Goal:** Fix 5 prioritized UX issues: border spacing, iPad top bar, note autosave, iPhone drag, swipe button flash.

**Source:** TaskMatrix_React at `/Users/ali/dev/apps/TaskMatrix_React`

---

## Key Findings from Code Audit

### The TaskCard still uses HTML5 DnD (not framer-motion drag)
The skill doc describes a framer-motion migration but the actual code at `TaskCard.tsx:141` uses `draggable + onDragStart/onDragEnd`. iOS Safari does **not** support HTML5 drag-and-drop at all — this is why drag "doesn't work on iPhone." The long-press → Move popup already functions correctly.

### The desktop header buttons have NO responsive wrapper
At `App.tsx:621`, the inline buttons div is plain `flex items-center gap-0.5` — always visible on all screen sizes. The hamburger at line 633 is `sm:hidden`. This means both the inline buttons AND the hamburger appear on mobile (below 640px), creating duplicates. On iPad (≥640px), only the inline buttons show — but the "What's Next?" button is gated by `{aiSettings.enabled && (...)}`.

### The SwipeableRow drag activates on tap
At `SwipeableRow.tsx:114`, `drag={IS_TOUCH ? 'x' : false}` enables x-axis drag on touch. Even a micro-tap produces a sub-pixel x offset (from `dragElastic={0.08}`) before snapping back — which briefly renders the absolutely-positioned action buttons visible behind the card.

---

## Task 1: Fix TaskCard left border spacing

**Objective:** Add breathing room between the task card's category `border-l-[3px]` and the quadrant cell's left border.

**Current state:** GridCell has `p-2` (8px). TaskCard's 3px category border renders at its left edge, 8px from the quadrant border. When colors match (e.g., red quadrant + red category task), the 8px gap feels nonexistent.

**Fix:** Increase the GridCell's horizontal padding from `p-2` to `px-3 py-2`. This adds 4px of breathing room without throwing off the tight Apple-minimalist grid.

**File: `src/components/matrix/MatrixGrid.tsx`**, line 190

```diff
- 'p-2 flex flex-col transition-all duration-300',
+ 'px-3 py-2 flex flex-col transition-all duration-300',
```

**Also adjust header padding to match:**
`QuadrantHeader` inside GridCell — currently no horizontal padding override. The header uses `px-2 py-2` already (per skill doc). Change to `px-3 py-2` for visual consistency:

**File: `src/components/matrix/MatrixGrid.tsx`**, line 206 — the `className` prop on QuadrantHeader. Actually, QuadrantHeader's padding is internal. Let's adjust the GridCell padding only. The header already has its own internal px-2, which with the new grid px-3 totals 20px from border (was 16px). Good — subtle improvement.

**Verify:** Open the app and check a task with a category (red/amber/blue/green) inside a quadrant — the colored left border should have visible space from the quadrant's border.

---

## Task 2: Fix iPad top bar — "What's Next?" menu

**Objective:** All action buttons inline on tablet/desktop, hamburger menu on iPhone only. Ensure "What's Next?" shows on iPad.

**Problem:** The desktop buttons div at line 621 has NO responsive wrapper — it's always visible. The hamburger at line 633 is `sm:hidden` (hidden on tablet+). This causes duplicate buttons on iPhone, and the "What's Next?" button (gated by `aiSettings.enabled`) may not appear if AI wasn't enabled on that device.

### Step 1: Add responsive wrapper to desktop buttons

**File: `src/App.tsx`**, line 621

```diff
- <div className="flex items-center gap-0.5">
+ <div className="hidden sm:flex items-center gap-0.5">
```

This hides the inline buttons on iPhone (<640px) and shows them on iPad/desktop.

### Step 2: Ensure the hamburger menu has ALL actions including "What's Next?"

The hamburger already includes "What's Next?" at line 639 — verified. No change needed.

### Step 3: Debug why "What's Next?" might not appear

The button is gated by `{aiSettings.enabled && (...)}`. If AI is disabled in Settings, the button won't appear. This is correct behavior — but the user should see the button and know to enable AI. Consider showing a disabled/greyed-out "What's Next?" button on desktop when AI is off, with a tooltip: "Enable AI in Settings." 

**Optional improvement: show disabled button when AI is off**

```tsx
// Replace the conditional render:
{aiSettings.enabled ? (
  <button onClick={handleSuggest} disabled={suggesting} ...>
    🎯 What next?
  </button>
) : (
  <button onClick={() => setShowSettings(true)} disabled={false}
    className="text-[0.75rem] px-1.5 sm:px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-90 min-h-[44px] shrink-0 cursor-pointer"
    title="Enable AI in Settings to use What's Next?">
    🎯 What next?
  </button>
)}
```

**Verify:** On iPad simulator, all 4 buttons (⚙️ 🎯 ↻ ⏻) should be visible inline in the top bar. On iPhone, the ☰ hamburger should appear with all 4 items in its dropdown.

---

## Task 3: Note autosave — remove Save/Cancel, auto-save on change

**Objective:** Changes to a note autosave immediately. Remove Save and Cancel buttons. Change Delete to trash icon.

### Step 1: Add debounced autosave

**File: `src/components/NoteEditModal.tsx`**

Add a `useRef` for the debounce timer and an `useEffect` that watches `title`, `content`, `color`, `pinned`:

```tsx
// Add near other state declarations (after line 76):
const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
const hasChangesRef = useRef(false)
const noteRef = useRef(note)

// Track latest note to avoid stale closures in the timer
useEffect(() => { noteRef.current = note }, [note])

// Autosave effect — fires on any change after a debounce
useEffect(() => {
  // Skip initial mount (props haven't changed yet)
  if (!hasChangesRef.current) {
    hasChangesRef.current = true
    return
  }
  
  clearTimeout(saveTimerRef.current)
  saveTimerRef.current = setTimeout(() => {
    // Don't save empty notes
    if (!title.trim() && !content.trim()) return
    
    onSave(noteRef.current.id, {
      title: title.trim() || null,
      content: content.trim(),
      color,
      pinned,
    })
  }, 600) // 600ms debounce — feels instant but avoids rapid-fire saves
  
  return () => clearTimeout(saveTimerRef.current)
}, [title, content, color, pinned])
```

### Step 2: Remove Save and Cancel buttons from footer

**File: `src/components/NoteEditModal.tsx`**, lines 327-366

Replace the entire footer div:

```diff
- {/* Footer */}
- <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
-   {confirmingDelete ? ( ... ) : ( ... )}
-   <div className="flex gap-2">
-     <button onClick={handleClose} ...>Cancel</button>
-     <button onClick={handleSave} ...>Save</button>
-   </div>
- </div>
+ {/* Footer — Delete only */}
+ <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end">
+   <button
+     onClick={handleDelete}
+     aria-label="Delete note"
+     className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
+   >
+     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
+       <polyline points="3 6 5 6 21 6"/>
+       <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
+     </svg>
+   </button>
+ </div>
```

**Inline SVG solution not needed** if you prefer — can use text: `🗑️` or a Unicode trash icon. SVG is cleaner at small sizes.

### Step 3: Simplify handleDelete (no more confirmation)

Since notes autosave, the confirmation dance is overkill. Direct delete:

```tsx
const handleDelete = () => {
  haptics('medium')
  onDelete(note.id)
  handleClose()
}
```

Remove the `confirmingDelete` state and related logic.

### Step 4: Clean up unused state

Remove:
- `confirmingDelete` state (line 74)
- `setConfirmingDelete` calls in `handleClose` (line 82) and `useEffect` cleanup (line 99)
- Old `handleSave` function (lines 104-117)
- The `error` state display if no longer needed (lines 320-324)

**Verify:** Open a note, type something, close the modal without pressing any button → reopen → changes should be saved. Delete button should show trash icon only (no text).

---

## Task 5: Disable drag on iPhone/iPad — long-press only

**Objective:** Disable HTML5 drag-and-drop on touch devices. Long-press → Move popup is the only move mechanism on iPhone/iPad.

### Step 1: Make draggable conditional on touch

**File: `src/components/TaskCard.tsx`**, line 141

```diff
- <div ref={cardRef} draggable onDragStart={handleDragStart} onDragEnd={handleDragEnd} onContextMenu={handleContextMenu}
+ <div ref={cardRef} draggable={!IS_TOUCH} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onContextMenu={handleContextMenu}
```

Add `IS_TOUCH` constant at the top of TaskCard.tsx:

```tsx
// Add near other imports / constants at top of component (before line 33):
const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
```

### Step 2: Also guard the drag class handlers

The `handleDragStart` and `handleDragEnd` add/remove CSS classes. These won't fire on touch since `draggable={false}`, but belt-and-suspenders — add early return:

No change needed — `draggable={false}` prevents the events from firing entirely.

### Step 3: Remove HTML5 DnD handlers from GridCell (optional cleanup)

The GridCell still has `onDragOver/onDragEnter/onDragLeave/onDrop` handlers (MatrixGrid.tsx lines 152-169). These are only needed for desktop HTML5 DnD. They don't cause bugs but are dead code on iOS. Keep them for now — the skill doc references a framer-motion migration that wasn't completed, and we shouldn't mix concerns in this PR.

**Verify:** On iPhone Simulator, try to drag a task → nothing should happen (no drag ghost, no visual feedback). Long-press a task → Move popup should appear. On desktop Chrome, drag-and-drop should still work.

---

## Task 7: Fix SwipeableRow action button flash on tap

**Objective:** Prevent the action buttons behind the card from briefly appearing when the user taps a task (instead of swiping).

**Root cause:** `SwipeableRow.tsx` enables `drag={'x'}` on touch with `dragElastic={0.08}`. Even a tap produces a micro x-translation before snapping back, which for a single frame renders the absolutely-positioned buttons visible.

### Fix: Hide action buttons until swipe exceeds minimum threshold

**File: `src/components/SwipeableRow.tsx`**

Add an opacity transition tied to the `x` motion value. The action buttons should be invisible until the card has been swiped past a minimum threshold.

Option A — simplest: add `opacity: 0` to the action buttons container, and use a framer-motion `useTransform` to fade them in as the card is swiped:

```tsx
// Inside SwipeableRow component, after line 48:
const opacity = useTransform(x, [-maxSwipe, -20, 0], [1, 0, 0])
```

Then apply it to the action buttons div (line 81):

```diff
- <div className={`absolute inset-y-0 right-0 flex ${showLabels ? 'rounded-r-xl overflow-hidden' : 'items-center gap-1.5 pr-2'}`}>
+ <motion.div style={{ opacity }} className={`absolute inset-y-0 right-0 flex ${showLabels ? 'rounded-r-xl overflow-hidden' : 'items-center gap-1.5 pr-2'}`}>
```

And close with `</motion.div>`.

Import `useTransform` at the top:

```diff
- import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion'
+ import { motion, useMotionValue, useTransform, animate, type PanInfo } from 'framer-motion'
```

This fades the buttons out at x=0 (card closed), invisible until swiped past -20px, then fully visible at full swipe. The -20px threshold means a light tap won't trigger any visible change.

**Verify:** On iPhone, tap a task — the action buttons (i ⚑ ✕) should NOT appear. Swipe a task left — the buttons should fade in smoothly as the card moves.

---

## Post-Implementation Pipeline

After all 5 tasks:

```bash
cd /Users/ali/dev/apps/TaskMatrix_React
npm run build
npx cap sync
git add -A
git commit -m "fix: border spacing, iPad header, note autosave, touch drag, swipe flash"
git push
```

Then: open `ios/App/App.xcodeproj` in Xcode, ⌘R to rebuild for iOS device testing.

---

## Deferred (not in this plan)
- #4 Pomodoro aesthetics
- #6 `#errands` / `#personal` categories
- #8 Apple Reminders import
- #9 Calendar integration
- #10 Apple Watch
- #11 Browser access discovery
- #12 Dedicated braindump note
- #13 Note length limit
