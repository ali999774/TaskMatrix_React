import type { Quadrant } from '../../types'
import { QUADRANT_ICON_MAP } from '../Icons'
import CountBadge from './CountBadge'

/** Quadrant-specific header background tints. */
const HEADER_BG: Record<Quadrant, string> = {
  1: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  2: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  3: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  4: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
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
  const IconComponent = QUADRANT_ICON_MAP[quadrant]

  return (
    <div
      className={`px-4 py-2 ${HEADER_BG[quadrant]} flex items-center gap-2 ${className}`}
    >
      {/* Icon tile */}
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-[var(--radius-icon-tile)]">
        <IconComponent size={18} />
      </span>

      {/* Title + subtitle */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[0.875rem] font-semibold leading-tight">{label}</h3>
        <p className="text-[0.6875rem] font-medium opacity-60 leading-tight">{subtitle}</p>
      </div>

      {/* Count badge */}
      <CountBadge count={count} quadrant={quadrant} />

      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="text-[0.75rem] opacity-50 hover:opacity-100 transition-all
          active:scale-75 motion-reduce:scale-100 ml-1
          p-0.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
        title={collapsed ? 'Expand' : 'Collapse'}
        aria-label={collapsed ? 'Expand quadrant' : 'Collapse quadrant'}
      >
        {collapsed ? '▶' : '▼'}
      </button>
    </div>
  )
}
