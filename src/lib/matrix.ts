import type { Task, Quadrant } from '../types'
import { importanceUrgencyToQuadrant, QUADRANT_LABELS, QUADRANT_SUBTITLES } from '../types'
import { parseLocalDate } from './dates'

/**
 * Breakpoint (px) at which the matrix switches from list → grid layout.
 * Keyed off the matrix container's own inline-size via CSS @container query.
 *
 * Keep in sync with the `@container matrix` rule in index.css.
 * Named constant so it's tunable from one place.
 */
export const MATRIX_GRID_BREAKPOINT = 640

/** One quadrant's worth of data, ready for a layout component. */
export interface QuadrantBucket {
  quadrant: Quadrant
  label: string
  subtitle: string
  tasks: Task[]
}

/**
 * Group an array of tasks into the four Eisenhower quadrants.
 * Called ONCE in the parent — both MatrixList and MatrixGrid consume the output.
 *
 * Sort order within each quadrant:
 *   1. Pinned tasks first (pinned = true floats above pinned = false/undefined).
 *   2. `position` ascending (nulls last) — preserves the DB/drag order within each zone.
 *   3. `created_at` descending as a tie-breaker.
 *
 * The array is COPIED before sorting — state/props are never mutated in place.
 */
export function groupTasksByQuadrant(tasks: Task[]): QuadrantBucket[] {
  const buckets: Record<Quadrant, Task[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const t of tasks) {
    if (t.status !== 'todo') continue
    // Hide tasks due strictly in the future (e.g. recurring clones not yet due)
    if (t.due_date) {
      const due = parseLocalDate(t.due_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (due.getTime() > today.getTime()) continue
    }
    const q = importanceUrgencyToQuadrant(t.importance, t.urgency)
    buckets[q].push(t)
  }
  return ([1, 2, 3, 4] as Quadrant[]).map(q => {
    const sorted = [...buckets[q]].sort((a, b) => {
      // 1. Pinned-first
      const aPinned = a.pinned ? 1 : 0
      const bPinned = b.pinned ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      // 2. Position ascending (null/undefined sorts last)
      const aPos = a.position ?? Infinity
      const bPos = b.position ?? Infinity
      if (aPos !== bPos) return aPos - bPos
      // 3. created_at descending
      const aTime = a.created_at ?? ''
      const bTime = b.created_at ?? ''
      return bTime.localeCompare(aTime)
    })
    return {
      quadrant: q,
      label: QUADRANT_LABELS[q],
      subtitle: QUADRANT_SUBTITLES[q],
      tasks: sorted,
    }
  })
}
