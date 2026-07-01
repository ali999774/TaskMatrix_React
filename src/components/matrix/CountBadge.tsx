import type { Quadrant } from '../../types'

/** Quadrant-specific tint classes for the badge background.
 *  Colours derive from CSS custom properties set in index.css,
 *  so they automatically respect light/dark mode without dark: variants. */
const BADGE_TINT: Record<Quadrant, string> = {
  1: 'bg-[var(--color-quad-do-first)]/15 text-[var(--color-quad-do-first)]',
  2: 'bg-[var(--color-quad-invest)]/15 text-[var(--color-quad-invest)]',
  3: 'bg-[var(--color-quad-delegate)]/15 text-[var(--color-quad-delegate)]',
  4: 'bg-[var(--color-quad-dont-do)]/15 text-[var(--color-quad-dont-do)]',
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
