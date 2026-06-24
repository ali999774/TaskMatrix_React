import type { Quadrant } from '../../types'

/** Quadrant-specific accent colors for count badge and icon. */
const HEADER_ACCENT: Record<Quadrant, string> = {
  1: 'text-red-500 dark:text-red-400',
  2: 'text-amber-500 dark:text-amber-400',
  3: 'text-blue-500 dark:text-blue-400',
  4: 'text-emerald-500 dark:text-emerald-400',
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
      <span className={`w-2 h-2 rounded-full shrink-0 ${HEADER_ACCENT[quadrant]}`} />

      {/* Label + subtitle + count */}
      <div className="flex-1 min-w-0" aria-hidden="true">
        <div className="flex items-baseline gap-1.5">
          <h3 className="text-[0.71875rem] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">{label}</h3>
          <span className="text-[0.65625rem] font-medium text-slate-300 dark:text-slate-600">· {count}</span>
        </div>
        <p className="text-[0.59375rem] text-slate-400/80 dark:text-slate-500/80 leading-tight">{subtitle}</p>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="text-[0.75rem] opacity-30 hover:opacity-60 transition-all
          active:scale-75 motion-reduce:scale-100
          p-0.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
        title={collapsed ? 'Expand' : 'Collapse'}
        aria-label={collapsed ? 'Expand quadrant' : 'Collapse quadrant'}
      >
        {collapsed ? <span aria-hidden="true" className="inline-block transition-transform duration-200 rotate-0">▶</span> : <span aria-hidden="true" className="inline-block transition-transform duration-200 rotate-90">▶</span>}
      </button>
    </div>
  )
}
