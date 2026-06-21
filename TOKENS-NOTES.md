# TOKENS-NOTES.md — TaskMatrix Design Token Handoff

Generated: 2026-06-21  
File: `src/index.css` (`@theme` block + `@layer base` dark overrides)  
Icons: `src/components/Icons.tsx`

---

## Token Naming Convention

All CSS custom properties follow the pattern:
- **Color** → `--color-<semantic-role>`
- **Font size** → `--font-size-<scale-name>`
- **Font weight** → `--font-weight-<scale-name>`
- **Line height** → `--line-height-<scale-name>`
- **Radius** → `--radius-<component-context>`
- **Font family** → `--font-family-<category>`

In Tailwind 4, these are consumed as utility classes: `bg-quad-invest`, `text-text-muted`, `rounded-card`, etc.

---

## Quadrant Colors

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-quad-do-first` | `#FF3B30` | `#FF453A` | Q1 — Urgent & Important |
| `--color-quad-invest` | `#FF9500` | `#FF9F0A` | Q2 — Important, Not Urgent |
| `--color-quad-delegate` | `#007AFF` | `#0A84FF` | Q3 — Urgent, Not Important |
| `--color-quad-dont-do` | `#C7C7CC` | `#3A3A3C` | Q4 — Neither |

> The Q2 token is explicitly named `--color-quad-invest` per spec.

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

## Category Dot Colors

| Token | Light | Dark | Category |
|---|---|---|---|
| `--color-dot-clinic` | `#34C759` | `#30D158` | Clinic (green) |
| `--color-dot-launch` | `#FF9500` | `#FF9F0A` | Launch (orange) |
| `--color-dot-dev` | `#5856D6` | `#5E5CE6` | Dev (indigo) |
| `--color-dot-personal` | `#8E8E93` | `#98989F` | Personal (gray) |

---

## Type Scale

| Token (size / weight / lh) | px value | Role |
|---|---|---|
| `--font-size-title` / `--font-weight-title` (800) / `--line-height-title` | 24px / 1.3 | Page-level headers |
| `--font-size-section` / `--font-weight-section` (700) / `--line-height-section` | 17px / 1.4 | Quadrant section headers |
| `--font-size-task-title` / `--font-weight-task-title` (600) / `--line-height-task-title` | 15.5px / 1.4 | Task card titles |
| `--font-size-meta` / `--font-weight-meta` (500) / `--line-height-meta` | 12.5px / 1.4 | Due dates, tags, badges |
| `--font-size-subtitle` / `--font-weight-subtitle` (500) / `--line-height-subtitle` | 11.5px / 1.3 | Tab bar labels, secondary chips |

---

## Radius Scale

| Token | Value | Component usage |
|---|---|---|
| `--radius-card` | `15px` | Task cards, modals, panels |
| `--radius-chip` | `16px` | Context filter pills |
| `--radius-grid-cell` | `18px` | Quadrant grid cells |
| `--radius-icon-tile` | `10px` | Icon buttons, avatar tiles |

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
| `.pb-safe` | `padding-bottom: env(safe-area-inset-bottom)` |
| `.pt-safe` | `padding-top: env(safe-area-inset-top)` |
| `.mb-safe` | `margin-bottom: env(safe-area-inset-bottom)` |
| `.pb-nav-safe` | `padding-bottom: calc(5rem + env(safe-area-inset-bottom))` |

---

## Dark Mode Resolution

Two layers, both override the same `--color-*` names:

1. **`.dark` class** (set by `useTheme()` in `App.tsx`) — handles JS-toggled theme, persisted in `localStorage` as `tm-theme`.
2. **`@media (prefers-color-scheme: dark)`** — system-level fallback for cases where JS hasn't run yet or the user has not overridden.

The `.light` / `[data-theme="light"]` guard on the `prefers-color-scheme` block prevents the media query from overriding an explicit light toggle.

---

## Icon Components (`src/components/Icons.tsx`)

All icons accept `size` (default `24`) and all `SVGProps<SVGSVGElement>` including `className`, `aria-label`, etc.

| Export | Icon | Quadrant / Use |
|---|---|---|
| `IconFlame` | Flame | Q1 Do First |
| `IconCalendar` | Calendar | Q2 Invest |
| `IconPeople` | Group/People | Q3 Delegate |
| `IconCircleX` | Circle-X | Q4 Don't Do |
| `IconGrid` | 2×2 Grid | Matrix/home tab |
| `IconTarget` | Target/Bullseye | Focus / AI suggest |
| `IconNote` | Sticky note | Notes tab |
| `IconGear` | Gear/Settings | Settings tab |
| `IconMic` | Microphone | Voice input |
| `IconPlus` | Plus/Add | Create task/note |

Convenience maps:
- `QUADRANT_ICON_MAP[1|2|3|4]` — indexed by quadrant number
- `ICON_MAP` — named map by slug (`'flame'`, `'calendar'`, etc.) + `IconName` type

---

## Zero Raw Hex Invariant

**Rule:** No hex color value (`#XXXXXX`) appears outside `src/index.css`.  
**Verify with:** `grep -rn '#[0-9a-fA-F]\{3,6\}' src/ --include='*.tsx' --include='*.ts' --include='*.css' | grep -v index.css`

The existing `App.tsx` still contains legacy hardcoded hex values from before this token sprint — those will be migrated in the component upgrade step.
