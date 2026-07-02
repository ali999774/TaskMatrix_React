# TOKENS-NOTES.md — TaskMatrix Design Token Handoff

Last verified against source: 2026-07-02  
File: `src/index.css` (`@theme` block + `@layer base` dark overrides)

---

## Token Naming Convention

All CSS custom properties follow the pattern:
- **Color** → `--color-<semantic-role>`
- **Font size** → `--text-<scale-name>` (+ `--text-<scale-name>--line-height` sub-token)
- **Font weight** → `--font-weight-<scale-name>` (documented pairing; applied at call sites via standard `font-*` utilities)
- **Radius** → `--radius-<component-context>`
- **Font family** → `--font-family-<category>`

In Tailwind 4, these are consumed as utility classes: `bg-surface`, `text-task-title`,
`text-text-muted`, `rounded-card`, etc. Note the font-size namespace is `--text-*`
(Tailwind 4's namespace for the `text-<name>` size utilities), not `--font-size-*`.

---

## Quadrant Colors

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-quad-do-first` | `#FF3B30` | `#FF453A` | Q1 — Urgent & Important |
| `--color-quad-invest` | `#FF9500` | `#FF9F0A` | Q2 — Important, Not Urgent |
| `--color-quad-delegate` | `#007AFF` | `#0A84FF` | Q3 — Urgent, Not Important |
| `--color-quad-dont-do` | `#C7C7CC` | `#8E8E93` | Q4 — Neither |

> The Q2 token is explicitly named `--color-quad-invest` per spec.
> Q4 light: the `@theme` block declares `#A0A0A6`, but the `@layer base` `:root`
> override (`#C7C7CC`) wins at runtime because `base` follows `theme` in the
> cascade. `#C7C7CC` is the effective value.

---

## Accent

| Token | Light | Dark |
|---|---|---|
| `--color-accent` | `#007AFF` | `#0A84FF` |

---

## Backgrounds & Surfaces

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-bg` | `#F2F2F7` | `#000000` | Page/app background |
| `--color-surface` | `#FFFFFF` | `#1C1C1E` | Cards, sheets, modals |

---

## Text Levels

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-text-primary` | `#1C1C1E` | `#FFFFFF` | Body copy, task titles |
| `--color-text-muted` | `#8E8E93` | `#98989F` | Secondary labels, metadata |

---

## Category Colors

Category colors are **not** CSS tokens. They live in `src/lib/categories.ts`
(`CATEGORY_COLOR_HEX`, plus the `CATEGORY_BORDER` / `CATEGORY_BADGE` /
`CATEGORY_RING` Tailwind-class maps) because categories are user-configurable —
each category stores a color *key* (`slate | red | amber | emerald | blue |
purple | pink`) that resolves through those maps. Single source of truth:
`getCategoryDef()` + `CATEGORY_COLOR_HEX`.

---

## Type Scale

| Token (size / intended weight / lh) | px value | Utility | Role |
|---|---|---|---|
| `--text-title` / 800 / 1.3 | 24px | `text-title` | Page-level headers |
| `--text-section` / 700 / 1.4 | 17px | `text-section` | Section headers |
| `--text-task-title` / 600 / 1.4 | **13px** | `text-task-title` | Task card titles (compact Apple-minimal look) |
| `--text-meta` / 500 / 1.4 | **12px** | `text-meta` | Due dates, tags, badges |
| `--text-subtitle` / 500 / 1.3 | **11px** | `text-subtitle` | Tab bar labels, secondary chips |

Line-height ships with the size via `--text-*--line-height` sub-tokens; the
weight column is the intended pairing, applied per call site with `font-*`
utilities (`font-semibold`, `font-medium`, …).

---

## Radius Scale

| Token | Value | Component usage |
|---|---|---|
| `--radius-card` | `15px` | Task cards, modals, panels |
| `--radius-chip` | `16px` | Context filter pills |
| `--radius-grid-cell` | `18px` | Quadrant grid cells |
| `--radius-icon-tile` | `10px` | Icon buttons, avatar tiles |

---

## Other Token Groups (see `src/index.css` for values)

| Group | Tokens | Role |
|---|---|---|
| Pomodoro / Focus | `--color-pomodoro-*` | Immersive timer: bg is always dark ("cinema" mode), arcs, dots, controls |
| Brief insights | `--color-brief-{urgent,protect,batch,quickwin,admin}[-soft/-border]` | MorningBrief + DayPlan insight cards |
| Date-bucket headers | `--color-bucket-{overdue,today,upcoming}-text` | WCAG AA-checked header text vs. bg |
| Layout | `--navbar-height` (`5rem`) | Single source of truth for bottom-nav clearance |

---

## Font Stack

| Token | Value |
|---|---|
| `--font-family-sans` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif` |

---

## Safe-Area Utility Classes

Defined in `@layer utilities`:

| Class | Value |
|---|---|
| `.header-safe-top` | `padding-top: max(env(safe-area-inset-top), 20px)` |
| `.pb-safe` | `padding-bottom: env(safe-area-inset-bottom)` |
| `.pt-safe` | `padding-top: env(safe-area-inset-top)` |
| `.mb-safe` | `margin-bottom: env(safe-area-inset-bottom)` |
| `.pb-nav-safe` | `padding-bottom: calc(var(--navbar-height) + env(safe-area-inset-bottom))` |

---

## Dark Mode Resolution

Two layers, both override the same `--color-*` names:

1. **`.dark` class** (set by `useTheme()` in `App.tsx`) — handles JS-toggled theme, persisted in `localStorage` as `tm-theme`.
2. **`@media (prefers-color-scheme: dark)`** — system-level fallback for cases where JS hasn't run yet or the user has not overridden.

The `.light` / `[data-theme="light"]` guard on the `prefers-color-scheme` block prevents the media query from overriding an explicit light toggle.

---

## Icons

The old `src/components/Icons.tsx` was removed in the icon-standardization pass —
all icons now come from `lucide-react` directly. Category icons resolve through
`src/lib/categories.ts` (`CATEGORY_ICON_NAMES`, `CategoryIcon`, emoji fallback);
quadrant icons through `QUADRANT_ICONS` in `src/types.ts`.

---

## Zero Raw Hex Invariant

**Rule:** No hex color value (`#XXXXXX`) appears outside `src/index.css`, **except**
`src/lib/categories.ts` (`CATEGORY_COLOR_HEX`, applied as inline styles so JIT
purging can't strip user-picked colors) and `src/App.tsx` legacy values pending
the component-upgrade migration.  
**Verify with:** `grep -rn '#[0-9a-fA-F]\{3,6\}' src/ --include='*.tsx' --include='*.ts' --include='*.css' | grep -v index.css | grep -v 'lib/categories.ts'`
