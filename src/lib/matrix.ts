import type { Task, Quadrant } from '../types'
import { importanceUrgencyToQuadrant, QUADRANT_LABELS, QUADRANT_SUBTITLES } from '../types'

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
 */
export function groupTasksByQuadrant(tasks: Task[]): QuadrantBucket[] {
  const buckets: Record<Quadrant, Task[]> = { 1: [], 2: [], 3: [], 4: [] }
  for (const t of tasks) {
    const q = importanceUrgencyToQuadrant(t.importance, t.urgency)
    buckets[q].push(t)
  }
  return ([1, 2, 3, 4] as Quadrant[]).map(q => ({
    quadrant: q,
    label: QUADRANT_LABELS[q],
    subtitle: QUADRANT_SUBTITLES[q],
    tasks: buckets[q],
  }))
}
