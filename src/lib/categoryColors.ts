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
 *  - The mapping is deterministic: same category label always yields the same color,
 *    across matrix, calendar, and schedule — guaranteed by the FNV-1a hash.
 */

// ─── Urgency overlay (calendar + schedule Q1 only) ────────────────────────────
/** Red reserved EXCLUSIVELY for the Q1 urgency ring/dot overlay on calendar/schedule.
 *  Never use as a base fill. */
export const URGENCY_COLOR = '#ef4444'

// ─── Curated palette — red excluded ──────────────────────────────────────────
/**
 * 10 vivid, perceptually distinct hues. Red is intentionally absent.
 * These work in both light and dark mode as inline hex values.
 */
export const CATEGORY_PALETTE = [
  '#6366f1', // indigo
  '#0ea5e9', // sky
  '#14b8a6', // teal
  '#84cc16', // lime
  '#f59e0b', // amber
  '#f97316', // orange
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b', // slate
]

// ─── Null-category fallback ───────────────────────────────────────────────────
const NO_CATEGORY_COLOR = '#94a3b8' // slate-400 — neutral, never draws attention

// ─── FNV-1a hash (32-bit) ─────────────────────────────────────────────────────
/**
 * FNV-1a: fast, zero-dependency, excellent avalanche properties for short strings.
 * Maps a category label → a stable palette index regardless of label length.
 */
export function categoryColor(category?: string | null): string {
  if (!category) return NO_CATEGORY_COLOR
  let h = 2166136261
  for (let i = 0; i < category.length; i++) {
    h ^= category.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return CATEGORY_PALETTE[Math.abs(h) % CATEGORY_PALETTE.length]
}
