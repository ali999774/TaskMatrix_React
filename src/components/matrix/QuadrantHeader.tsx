import { ChevronRight } from 'lucide-react'
import type { Quadrant } from '../../types'

/** Quadrant-specific accent colors for left borders (used in grid/list).
 *  Sources from CSS custom properties in index.css — light/dark handled by the vars. */
export const QUADRANT_BORDER_ACCENT: Record<Quadrant, string> = {
  1: 'border-l-[var(--color-quad-do-first)]/80',
  2: 'border-l-[var(--color-quad-invest)]/80',
  3: 'border-l-[var(--color-quad-delegate)]/80',
  4: 'border-l-[var(--color-quad-dont-do)]/80',
}

/** Quadrant-specific accent colors for count badge, icon, and header text.
 *  Sources from CSS custom properties in index.css — light/dark handled by the vars. */
export const HEADER_ACCENT: Record<Quadrant, string> = {
  1: 'text-[var(--color-quad-do-first)]/90',
  2: 'text-[var(--color-quad-invest)]/90',
  3: 'text-[var(--color-quad-delegate)]/90',
  4: 'text-[var(--color-quad-dont-do)]/90',
}

interface QuadrantHeaderProps {
  quadrant: Quadrant
  label: string
  subtitle: string
  count: number
  collapsed: boolean
  onToggleCollapse: () => void
  /** Layout-specific extra classes (e.g. rounding overrides). */
  className?: string
}

/**
 * Shared quadrant header: icon tile + title + subtitle + count badge + collapse toggle.
 * Used identically by MatrixList and MatrixGrid.
 */
export default function QuadrantHeader({
  quadrant,
  label,
  subtitle,
  count,
  collapsed,
  onToggleCollapse,
  className = '',
}: QuadrantHeaderProps) {
  return (
    <div
      className={`px-2 py-2 flex items-center gap-2 ${className}`}
    >
      {/* Accent dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 bg-current ${HEADER_ACCENT[quadrant]}`} />

      {/* Label + subtitle + count */}
      <div className="flex-1 min-w-0" aria-hidden="true">
        <div className="flex items-baseline gap-1.5">
          <h3 className={`text-[0.71875rem] sm:text-[0.8125rem] font-semibold uppercase tracking-wider ${HEADER_ACCENT[quadrant]}`}>{label}</h3>
          <span className="text-[0.65625rem] sm:text-[0.71875rem] font-medium text-slate-300 dark:text-slate-600">· {count}</span>
        </div>
        {/* FLAG(design-tokens): no text-subtitle token in src/index.css @theme yet — using a
            0.6875rem placeholder. Add a `--text-subtitle: 0.6875rem` token and swap this in. */}
        <p className="text-[0.6875rem] sm:text-[0.75rem] text-slate-400/80 dark:text-slate-500/80 leading-tight">{subtitle}</p>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="text-[0.75rem] text-slate-500 dark:text-slate-400 opacity-50 hover:opacity-80 transition-all
          active:scale-75 motion-reduce:scale-100
          p-0.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
        title={collapsed ? 'Expand' : 'Collapse'}
        aria-label={collapsed ? 'Expand quadrant' : 'Collapse quadrant'}
      >
        <ChevronRight
          size={16}
          aria-hidden="true"
          className={`transition-transform duration-200 ${collapsed ? 'rotate-0' : 'rotate-90'}`}
        />
      </button>
    </div>
  )
}
