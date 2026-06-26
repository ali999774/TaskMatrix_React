# Spec — Category filter UX (Item 2)

**Route:** Decision made here; implementation handed off (surgical CSS/markup).
**Status:** Ready for Nestor.
**Owner of decision:** Claude (decided on merits — no product call needed).

---

## Decision

**Keep the filter-pill model. Upgrade its visual execution so each pill carries
its category's colour identity.** Do **not** switch to a segmented toggle or a
swipe-to-filter gesture.

### Why pills, and what was rejected

| Model | Verdict | Reason |
|---|---|---|
| **Filter pills (current)** | ✅ Keep | Horizontally scrollable → handles any number of categories. Shows every option at once. Single tap to filter. The model is correct; only the styling is weak. |
| Segmented toggle (iOS `UISegmentedControl`) | ❌ Reject | Fixed-width, non-scrolling. Works for 2–4 fixed segments; categories are **user-configurable and can grow past 4**. "All + 4 defaults" = 5 segments already crowds a phone; Ali's set is also 4 + All. Labels truncate, icons drop. A control that can't scroll can't represent a variable set. |
| Swipe-to-filter (swipe to cycle category) | ❌ Reject | Invisible affordance — no overview of which categories exist or which is active. Easy to trigger by accident. **Collides** with the existing `SwipeableRow` swipe actions on notes and with the pill row's own horizontal scroll. Discoverability is poor for a primary filter. |

### Single-select stays (no multi-select)

The pills drive a single `context` value (`'all'` or one category). Keep it
single-select:
- A 2×2 priority matrix is used by focusing on **one** area at a time.
- Quick-add auto-inherits the active context as the new task's category
  (`App.tsx` `handleQuickAdd` → `autoCategory = context !== 'all' ? context`).
  Multi-select would make "which category does a new task get?" ambiguous.

### The actual problem being fixed

Current pills (`App.tsx` ~705–734) are low-contrast: transparent background with
grey text, selected state a flat `bg-slate-200/700`. The category's **colour**
(which already exists in `lib/categories.ts` and tints task-card borders) is
absent from the filter, so the filter feels disconnected from the cards it
filters. Pills are also wide (icon + full label), so few fit per row.

---

## Visual implementation

**File:** `src/App.tsx` — the context switcher block (currently ~705–734).
**Supporting:** `src/lib/categories.ts` already exports `CATEGORY_COLOR_HEX`,
`CATEGORY_BADGE`, `CATEGORY_RING`. Reuse those — do not invent new colours.

### Target behaviour
- Each category pill shows its icon + label and adopts its own colour:
  - **Selected:** filled with a soft tint of the category colour + coloured text
    + a subtle ring. Reads as "this category is active."
  - **Unselected:** neutral/ghost (current muted grey) so the row stays calm.
- The **All** pill stays neutral (it has no colour); selected = the existing
  slate fill.
- Keep the row horizontally scrollable (`overflow-x-auto`), keep `min-h-[44px]`
  touch targets, keep `scrollbar-hide`.

### Markup change (per-category pill)

Replace the category `<button>` inside `categories.map(...)` so the className is
colour-aware. Pull the colour token from the category and map it through the
existing dictionaries:

```tsx
import { CATEGORY_BADGE, CATEGORY_RING } from './lib/categories'

{categories.map((cat) => {
  const active = context === cat.label
  return (
    <button
      key={cat.label}
      aria-label={`Filter by ${cat.display}`}
      aria-pressed={active}
      onClick={() => setContext(cat.label)}
      className={`text-[0.75rem] px-3 py-2 rounded-full font-medium whitespace-nowrap
        transition-all active:scale-95 motion-reduce:scale-100 active:opacity-80
        min-h-[44px] inline-flex items-center gap-1
        ${active
          ? `${CATEGORY_BADGE[cat.color] ?? ''} ring-1 ${CATEGORY_RING[cat.color] ?? 'ring-slate-300'}`
          : 'bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
        }`}
    >
      <span aria-hidden="true">{cat.icon} {cat.display}</span>
    </button>
  )
})}
```

Notes for the implementer:
- `CATEGORY_BADGE[cat.color]` already pairs a tinted bg with matching text in
  both light/dark — that's the selected fill + text colour in one token.
- Removed the fixed `min-w-[44px]` from the category pill so labelled pills size
  to content (the 44px height already satisfies the touch target). **Keep**
  `min-w-[44px]` on the icon-only **All** pill.
- `gap-1` tightens the icon/label so more pills fit per scroll view.

### The "All" pill — leave as-is

```tsx
className={`... min-h-[44px] min-w-[44px] inline-flex items-center justify-center
  ${context === 'all'
    ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
    : 'bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
```

### Optional scroll affordance (nice-to-have, not required)
Add a thin right-edge fade so it's obvious the row scrolls when categories
overflow: wrap the row in a relative container and add
`after:absolute after:right-0 after:top-0 after:bottom-0 after:w-6
after:bg-gradient-to-l after:from-white dark:after:from-slate-950 after:pointer-events-none`.
Skip if it fights the sticky header background.

---

## Component-structure note (bigger than CSS?)

**No structural change required.** Everything above is markup + class edits on the
existing inline map in `App.tsx`. The only non-cosmetic dependency is importing
`CATEGORY_BADGE` / `CATEGORY_RING` (already exist).

**Optional refactor (not in scope):** the pill could be extracted into a
`<CategoryPill>` component since the same icon+label+colour pattern appears in the
context switcher and could be reused elsewhere. Only worth doing if a second call
site appears — otherwise it's churn.

---

## Acceptance
- [ ] Selected category pill is tinted with its own colour (light + dark).
- [ ] Unselected pills stay muted; the row reads calm, not rainbow.
- [ ] "All" pill unchanged.
- [ ] Row still scrolls horizontally; 44px touch height preserved.
- [ ] `aria-pressed` reflects the active filter.
- [ ] Quick-add still inherits the active category (no logic change).
