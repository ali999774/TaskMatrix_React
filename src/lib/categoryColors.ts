/**
 * categoryColors.ts
 *
 * Single source of truth for category-owned hue assignment.
 *
 * Design rules:
 *  - Every task gets its color from CATEGORY, not priority/quadrant.
 *  - Red (#ef4444) is reserved as an urgency overlay on calendar/schedule views only.
 *    It NEVER appears as a base fill or stripe color.
 *  - Colors are applied via inline style hex (not dynamic Tailwind classes) so JIT
 *    purging can't remove them at build time.
 *  - The mapping is deterministic: same category label always yields same color,
 *    across matrix, calendar, and schedule — guaranteed by the hash.
 */

import type { CategoryDef } from './categories'

// ─── Urgency overlay (calendar + schedule Q1 only) ────────────────────────────
/** Red reserved EXCLUSIVELY for the Q1 urgency ring/dot overlay on calendar/schedule.
 *  Never use as a base fill. */
export const URGENCY_COLOR = '#ef4444'

// ─── Curated palette — red excluded ──────────────────────────────────────────
/**
 * 8 vivid, perceptually distinct hues. Red is intentionally absent.
 * Ordered so adjacent indices are easy to distinguish at a glance.
 * These work in both light and dark mode as inline hex values.
 */
export const CATEGORY_PALETTE: readonly string[] = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#14b8a6', // teal
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
]

// ─── Named-color → hex map (for CategoryDef.color field) ─────────────────────
/**
 * Maps the Tailwind color keys used in CategoryDef.color to palette hex.
 * 'red' deliberately redirects to violet so no category is ever red.
 * 'slate' gets a muted neutral (uncategorized feel).
 */
const COLOR_NAME_HEX: Record<string, string> = {
  slate:   '#94a3b8', // muted neutral — used for uncategorized
  red:     '#8b5cf6', // redirected → violet (red is urgency-only)
  amber:   '#f59e0b',
  emerald: '#10b981',
  blue:    '#0ea5e9',
  purple:  '#8b5cf6',
  pink:    '#ec4899',
}

// ─── Null-category fallback ───────────────────────────────────────────────────
const NO_CATEGORY_COLOR = '#94a3b8' // slate-400 — neutral, never draws attention

// ─── DJB2 hash (32-bit) ───────────────────────────────────────────────────────
/**
 * Classic DJB2 string hash. Fast, zero-dependency, deterministic.
 * Maps a string → non-negative integer so we can mod into the palette.
 */
function djb2(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return hash >>> 0 // unsigned 32-bit
}

// ─── Main export ──────────────────────────────────────────────────────────────
/**
 * Returns the hex color for a given task category.
 *
 * Resolution order:
 *  1. If `categories` array is provided and has a matching CategoryDef:
 *     use its `color` field mapped through COLOR_NAME_HEX.
 *  2. Else if `category` is a non-empty string: hash it → CATEGORY_PALETTE.
 *  3. Else: NO_CATEGORY_COLOR (slate neutral).
 *
 * @param category   task.category string (or null/undefined)
 * @param categories user's CategoryDef[] array (optional)
 */
export function categoryColor(
  category: string | null | undefined,
  categories?: CategoryDef[],
): string {
  if (!category) return NO_CATEGORY_COLOR

  // Try to find a user-defined CategoryDef and map its named color
  if (categories && categories.length > 0) {
    const def = categories.find(
      (c) => c.label.toLowerCase() === category.toLowerCase(),
    )
    if (def) {
      return COLOR_NAME_HEX[def.color] ?? CATEGORY_PALETTE[djb2(def.color) % CATEGORY_PALETTE.length]
    }
  }

  // Fallback: deterministic hash of the raw label
  return CATEGORY_PALETTE[djb2(category.toLowerCase()) % CATEGORY_PALETTE.length]
}
