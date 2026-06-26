import { useMemo } from 'react'
import type { Quadrant, Task } from '../../types'
import type { CategoryDef } from '../../lib/categories'
import { groupTasksByQuadrant } from '../../lib/matrix'
import MatrixGrid from './MatrixGrid'
import MatrixList from './MatrixList'

interface MatrixScreenProps {
  tasks: Task[]
  onMove: (taskId: string, toQuadrant: Quadrant) => void
  onFlag: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onTaskClick: (task: Task) => void
  categories: CategoryDef[]
}

/**
 * MatrixScreen — the orchestrator component.
 *
 * 1. Owns the single grouping call (groupTasksByQuadrant).
 * 2. Wraps content in a container-query context.
 * 3. CSS @container query swaps between MatrixList and MatrixGrid
 *    based on the container's available inline-size — NOT the viewport.
 *    This correctly degrades under iPad split-view / multitasking.
 *
 * Both layouts are in the DOM but only one is visible (display: contents / none).
 * This avoids re-mounting and preserves DnD state across the switch.
 */
export default function MatrixScreen({
  tasks,
  onMove,
  onFlag,
  onStatusChange,
  onDelete,
  onTaskClick,
  categories,
}: MatrixScreenProps) {
  // Group ONCE — both layouts consume the same output.
  const buckets = useMemo(() => groupTasksByQuadrant(tasks), [tasks])

  const layoutProps = {
    buckets,
    onMove,
    onFlag,
    onStatusChange,
    onDelete,
    onTaskClick,
    categories,
  }

  return (
    <div className="matrix-container w-full">
      {/* Narrow: single-column list */}
      <div className="matrix-show-list">
        <MatrixList {...layoutProps} />
      </div>

      {/* Wide: 2×2 grid */}
      <div className="matrix-show-grid">
        <MatrixGrid {...layoutProps} />
      </div>
    </div>
  )
}
