import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QUADRANT_ID_MAP } from '../../types'
import type { Quadrant, Task } from '../../types'
import type { CategoryDef } from '../../lib/categories'
import type { QuadrantBucket } from '../../lib/matrix'
import QuadrantHeader from './QuadrantHeader'
import TaskCard from '../TaskCard'

// Overflow cap: show this many tasks per cell before truncating
const MAX_VISIBLE = 4

const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/** Panel body background tints per quadrant — borders only, no fill. */
const QUADRANT_BG: Record<number, string> = {
  1: 'border-red-200   dark:border-red-800/50 dark:border-l-red-400',
  2: 'border-amber-200 dark:border-amber-800/50 dark:border-l-amber-400',
  3: 'border-blue-200  dark:border-blue-800/50 dark:border-l-blue-400',
  4: 'border-emerald-200 dark:border-emerald-800/50 dark:border-l-emerald-400',
}

/**
 * Extra visual weight for Invest (Q2): subtle ring + shadow keyed to the invest token.
 * Token resolves correctly in both themes — no dark: variants needed here.
 * Emphasizes the quadrant by prominence without repositioning it.
 */
const INVEST_EMPHASIS =
  'ring-2 ring-[var(--color-quad-invest)]/30 shadow-md shadow-[var(--color-quad-invest)]/10'

export interface MatrixLayoutProps {
  buckets: QuadrantBucket[]
  onMove: (taskId: string, toQuadrant: Quadrant) => void
  onFlag: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onTaskClick: (task: Task) => void
  categories: CategoryDef[]
}

/**
 * MatrixGrid — 2×2 wide-screen layout.
 *
 * Conventional Eisenhower positions:
 *   Q1 Do First (top-left)  |  Q2 Invest (top-right)
 *   Q3 Delegate (bot-left)  |  Q4 Don't Do (bot-right)
 *
 * Axis labels: ↑ IMPORTANCE (vertical, left) / URGENCY → (horizontal, below)
 * Invest is emphasised by visual weight (ring + shadow), not by repositioning.
 */
export default function MatrixGrid({
  buckets,
  onMove,
  onFlag,
  onStatusChange,
  onDelete,
  onTaskClick,
  categories,
}: MatrixLayoutProps) {

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* ── Axis wrapper ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 w-full">
        {/* Vertical: ↑ IMPORTANCE */}
        <div className="flex items-center justify-center w-5 shrink-0 select-none">
          <span
            className="[writing-mode:vertical-rl] rotate-180 text-[0.5rem] tracking-widest
              font-semibold text-slate-400/70 dark:text-slate-600 uppercase"
            aria-hidden="true"
          >
            ↑ Importance
          </span>
        </div>

        {/* Grid + horizontal axis */}
        <div className="flex flex-col flex-1 gap-1 min-w-0">
          <div className="grid grid-cols-2 gap-3 items-start w-full">
            {buckets.map((bucket) => (
              <GridCell
                key={bucket.quadrant}
                bucket={bucket}
                onMove={onMove}
                onFlag={onFlag}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                onTaskClick={onTaskClick}
                categories={categories}
              />
            ))}
          </div>

          {/* Horizontal: URGENCY → */}
          <div className="flex justify-end pr-1 select-none">
            <span className="text-[0.5rem] tracking-widest font-semibold text-slate-400/70 dark:text-slate-600 uppercase" aria-hidden="true">
              Urgency →
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GridCell
// ─────────────────────────────────────────────────────────────────────────────

function GridCell({
  bucket,
  onMove,
  onFlag,
  onStatusChange,
  onDelete,
  onTaskClick,
  categories,
}: {
  bucket: QuadrantBucket
  onMove: (taskId: string, toQuadrant: Quadrant) => void
  onFlag: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onTaskClick: (task: Task) => void
  categories: CategoryDef[]
}) {
  const [dragOver, setDragOver] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(`tm-q-${bucket.quadrant}`) === 'true',
  )
  const [showAll, setShowAll] = useState(false)

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(`tm-q-${bucket.quadrant}`, String(next))
      return next
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as HTMLElement)) return
    setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) onMove(taskId, bucket.quadrant)
  }

  const isInvest = bucket.quadrant === 2
  const visibleTasks = showAll ? bucket.tasks : bucket.tasks.slice(0, MAX_VISIBLE)
  const hiddenCount = bucket.tasks.length - MAX_VISIBLE

  // Namespace this drop zone as 'grid:*' — both grid and list are live in the DOM
  // simultaneously (display:none hides one but does not remove it). The prefix
  // prevents any future dnd-kit useDroppable registration from colliding with
  // the list's 'list:*' zones and makes zone attribution unambiguous in DevTools.
  const dropId = `grid:${QUADRANT_ID_MAP[bucket.quadrant]}`

  return (
    <div
      data-drop-id={dropId}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={[
        'rounded-[var(--radius-grid-cell)] border border-l-4 w-full',
        'px-3 py-2 flex flex-col transition-all duration-300',
        QUADRANT_BG[bucket.quadrant],
        collapsed ? 'min-h-0' : 'min-h-[220px]',
        dragOver ? 'ring-2 ring-slate-400 dark:ring-slate-500 scale-[1.02]' : '',
        isInvest && !dragOver ? INVEST_EMPHASIS : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <QuadrantHeader
        quadrant={bucket.quadrant}
        label={bucket.label}
        subtitle={bucket.subtitle}
        count={bucket.tasks.length}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        className={`${collapsed ? 'mb-0' : 'mb-1'} ${isInvest ? 'font-bold' : ''}`}
      />

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
          <div className="px-2 space-y-0.5 divide-y divide-slate-100 dark:divide-slate-800/40">
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onClick={onTaskClick}
              onMove={onMove}
              onFlag={onFlag}
              categories={categories}
            />
          ))}

          {/* Overflow toggle */}
          {!showAll && hiddenCount > 0 && (
            <button
              aria-label={`Show all ${bucket.label} tasks`}
              onClick={() => setShowAll(true)}
              className="w-full text-center text-[0.6875rem] font-medium
                text-slate-500 dark:text-slate-400 hover:text-slate-700
                dark:hover:text-slate-200 py-1.5 transition-colors
                min-h-[44px] rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            >
              <span aria-hidden="true">+{hiddenCount} more</span>
            </button>
          )}
          {showAll && bucket.tasks.length > MAX_VISIBLE && (
            <button
              aria-label={`Show fewer ${bucket.label} tasks`}
              onClick={() => setShowAll(false)}
              className="w-full text-center text-[0.6875rem] font-medium
                text-slate-400 dark:text-slate-500 hover:text-slate-600
                dark:hover:text-slate-300 py-1.5 transition-colors
                min-h-[44px] rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            >
              <span aria-hidden="true">Show less</span>
            </button>
          )}

          {bucket.tasks.length === 0 && (
            <div className="text-center py-4" aria-hidden="true">
              <p className="text-[1.5rem] mb-1 opacity-30">✦</p>
              <p className="text-[0.6875rem] text-slate-300 dark:text-slate-600">
                {dragOver
                  ? 'Drop here'
                  : IS_TOUCH
                    ? 'Long-press a task to move it here'
                    : 'Drag tasks here'}
              </p>
            </div>
          )}
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

