import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Quadrant, Task, QuadrantId } from '../../types'
import { QUADRANT_ID_MAP } from '../../types'
import type { CategoryDef } from '../../lib/categories'
import type { QuadrantBucket } from '../../lib/matrix'
import QuadrantHeader, { QUADRANT_BORDER_ACCENT } from './QuadrantHeader'
import TaskCard from '../TaskCard'

// ─── Display order — list-local presentation decision ────────────────────────
// Importance gradient: Invest leads, Don't Do trails.
// DO NOT modify groupTasksByQuadrant — the grid depends on its [1,2,3,4] order.
// Ordering is derived here via useMemo; the shared buckets are untouched.
const LIST_ORDER: QuadrantId[] = ['invest', 'do-first', 'delegate', 'dont-do']

// ─── Emphasis tiers ───────────────────────────────────────────────────────────
type EmphasisTier = 'lead' | 'high' | 'normal' | 'muted'

const EMPHASIS: Record<QuadrantId, EmphasisTier> = {
  'invest':   'lead',
  'do-first': 'high',
  'delegate': 'normal',
  'dont-do':  'muted',
}

// Single source of truth: tune the gradient here only.
// mb-* controls spacing weight; opacity-* controls visual receding.
const TIER_CLASSES: Record<EmphasisTier, string> = {
  lead:   'mb-5',
  high:   'mb-4',
  normal: 'mb-3 opacity-80',
  muted:  'mb-2 opacity-50',
}

// ─── Uniform neutral container border ───────────────────────────────────────
// Quadrant identity is carried by position + QuadrantHeader label.
// Category hue lives on the task card stripe, not the section container.
const CELL_BORDER = 'border-slate-200/70 dark:border-slate-700/40'

// HTML5 DnD does not fire on iOS touch — empty-state hint must describe the
// actual interaction there (long-press → "Move to…" popup in TaskCard).
const IS_TOUCH =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

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
 * MatrixList — single-column vertical layout with importance gradient.
 *
 * Display order (list-local): Invest → Do First → Delegate → Don't Do.
 * groupTasksByQuadrant is NOT touched — grid consumes its unchanged [1,2,3,4] order.
 * Ordering is a useMemo derivation over LIST_ORDER; no data mutation.
 */
export default function MatrixList({
  buckets,
  onMove,
  onFlag,
  onStatusChange,
  onDelete,
  onTaskClick,
  categories,
}: MatrixLayoutProps) {
  const orderedBuckets = useMemo(() => {
    const byId = Object.fromEntries(
      buckets.map((b) => [QUADRANT_ID_MAP[b.quadrant], b]),
    )
    return LIST_ORDER
      .map((id) => byId[id])
      .filter((b): b is QuadrantBucket => Boolean(b))
  }, [buckets])

  return (
    <div className="flex flex-col w-full">
      {orderedBuckets.map((bucket) => (
        <ListQuadrant
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
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ListQuadrant
// ─────────────────────────────────────────────────────────────────────────────

function ListQuadrant({
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
  const qId = QUADRANT_ID_MAP[bucket.quadrant]
  const tierCls = TIER_CLASSES[EMPHASIS[qId]]

  const [dragOver, setDragOver] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(`tm-q-${bucket.quadrant}`) === 'true',
  )

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

  return (
    // Outer wrapper carries emphasis-tier classes (opacity + spacing).
    // data-drop-id namespaces this zone as 'list:*' — both list and grid are
    // live in the DOM simultaneously (CSS display:none hides the grid on narrow
    // screens, but doesn't remove it). Namespacing prevents conceptual ID
    // collisions and makes zone attribution unambiguous in DevTools.
    <div
      className={`${tierCls} transition-opacity duration-200`}
      data-drop-id={`list:${qId}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* overflow-hidden clips the QuadrantHeader tint to the rounded corners */}
      <div
        className={[
          'rounded-xl border border-l-[3px] overflow-hidden transition-all duration-300',
          QUADRANT_BORDER_ACCENT[bucket.quadrant],
          CELL_BORDER,
          dragOver ? 'ring-2 ring-slate-400 dark:ring-slate-500 scale-[1.01]' : '',
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
            <div className="px-2 pb-2 space-y-0.5 divide-y divide-slate-100 dark:divide-slate-800/40">
            {bucket.tasks.map((task) => (
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

            {/* Compact dashed empty-state — unobtrusive, still a visible drop target */}
            {bucket.tasks.length === 0 && (
              <div className="text-center py-3" aria-hidden="true">
                <p className="text-[1.375rem] mb-1 opacity-25">✦</p>
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
    </div>
  )
}
