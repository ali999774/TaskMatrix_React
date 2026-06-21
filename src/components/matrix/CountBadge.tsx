import type { Quadrant } from '../../types'

/** Quadrant-specific tint classes for the badge background. */
const BADGE_TINT: Record<Quadrant, string> = {
  1: 'bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  2: 'bg-amber-100/80 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  3: 'bg-blue-100/80 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  4: 'bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
}

interface CountBadgeProps {
  count: number
  /** Optional quadrant — when provided, the badge picks up that quadrant's tint. */
  quadrant?: Quadrant
  className?: string
}

/** Tiny pill showing a numeric count. */
export default function CountBadge({ count, quadrant, className = '' }: CountBadgeProps) {
  const tint = quadrant ? BADGE_TINT[quadrant] : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'

  return (
    <span
      className={`inline-flex items-center justify-center text-[0.6875rem] font-semibold
        leading-none tabular-nums rounded-full min-w-[1.25rem] px-1.5 py-0.5
        ${tint} ${className}`}
    >
      {count}
    </span>
  )
}
