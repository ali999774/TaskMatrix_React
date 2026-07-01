import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QUADRANT_ID_MAP } from '../../types'
import type { Quadrant, Task } from '../../types'
import type { CategoryDef } from '../../lib/categories'
import type { QuadrantBucket } from '../../lib/matrix'
import QuadrantHeader, { QUADRANT_BORDER_ACCENT } from './QuadrantHeader'
import TaskCard from '../TaskCard'

// Overflow cap: show this many tasks per cell before truncating
const MAX_VISIBLE = 4

/** Uniform neutral border for all quadrant cells.
 * Quadrant is communicated by position + label, not hue.
 * Category hue lives on the task card stripe, not the container. */
const CELL_BORDER = 'border-slate-200/70 dark:border-slate-700/40'

/**
 * Extra visual weight for Invest (Q2): subtle ring + shadow in neutral slate.
 */
const INVEST_EMPHASIS =
  'ring-2 ring-slate-300/50 dark:ring-slate-600/40 shadow-md shadow-slate-200/40 dark:shadow-slate-900/30'

const EMPTY_COPY: Record<number, string> = {
  1: 'Nothing urgent here. Breathe.',
  2: 'This is where the important work lives.',
  3: 'Nothing pressing right now.',
  4: 'Clear. Nice.',
}

export interface MatrixLayoutProps {
  buckets: QuadrantBucket[]
  onMove: (taskId: string, toQuadrant: Quadrant) => void
  onFlag: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onTaskClick: (task: Task) => void
  categories: CategoryDef[]
  expandedTaskId?: string | null
  onToggleExpand?: (taskId: string) => void
  onTaskUpdate: (id: string, updates: Partial<Task>) => void
  suggestedTaskId?: string | null
}

export default function MatrixGrid({
  buckets, onMove, onFlag, onStatusChange, onDelete, onTaskClick,
  categories, expandedTaskId, onToggleExpand, onTaskUpdate, suggestedTaskId = null,
}: MatrixLayoutProps) {
  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex gap-2 w-full">
        <div className="flex items-center justify-center w-5 shrink-0 select-none">
          <span className="[writing-mode:vertical-rl] rotate-180 text-[0.5rem] tracking-widest font-semibold text-slate-400/70 dark:text-slate-600 uppercase" aria-hidden="true">
            ↑ Importance
          </span>
        </div>
        <div className="flex flex-col flex-1 gap-1 min-w-0">
          <div className="grid grid-cols-2 gap-3 items-start w-full">
            {buckets.map((bucket) => (
              <GridCell key={bucket.quadrant} bucket={bucket}
                onMove={onMove} onFlag={onFlag} onStatusChange={onStatusChange}
                onDelete={onDelete} onTaskClick={onTaskClick} categories={categories}
                expandedTaskId={expandedTaskId} onToggleExpand={onToggleExpand}
                onTaskUpdate={onTaskUpdate} suggestedTaskId={suggestedTaskId} />
            ))}
          </div>
          <div className="flex justify-end pr-1 select-none">
            <span className="text-[0.5rem] tracking-widest font-semibold text-slate-400/70 dark:text-slate-600 uppercase" aria-hidden="true">Urgency →</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function GridCell({
  bucket, onMove, onFlag, onStatusChange, onDelete, onTaskClick,
  categories, expandedTaskId, onToggleExpand, onTaskUpdate, suggestedTaskId,
}: {
  bucket: QuadrantBucket
  onMove: (taskId: string, toQuadrant: Quadrant) => void
  onFlag: (id: string) => void
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onTaskClick: (task: Task) => void
  categories: CategoryDef[]
  expandedTaskId?: string | null
  onToggleExpand?: (taskId: string) => void
  onTaskUpdate: (id: string, updates: Partial<Task>) => void
  suggestedTaskId?: string | null
}) {
  const [dragOver, setDragOver] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(`tm-q-${bucket.quadrant}`) === 'true',
  )
  const [showAll, setShowAll] = useState(false)

  const toggleCollapsed = () => setCollapsed((prev) => {
    const next = !prev
    localStorage.setItem(`tm-q-${bucket.quadrant}`, String(next))
    return next
  })

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true) }
  const handleDragLeave = (e: React.DragEvent) => {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as HTMLElement)) return
    setDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) onMove(taskId, bucket.quadrant)
  }

  const isInvest = bucket.quadrant === 2
  const visibleTasks = showAll ? bucket.tasks : bucket.tasks.slice(0, MAX_VISIBLE)
  const hiddenCount = bucket.tasks.length - MAX_VISIBLE
  const dropId = `grid:${QUADRANT_ID_MAP[bucket.quadrant]}`

  return (
    <div data-drop-id={dropId} onDragOver={handleDragOver} onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave} onDrop={handleDrop}
      className={['rounded-[var(--radius-grid-cell)] border border-l-[3px] w-full',
        'px-3 py-2 flex flex-col transition-all duration-300',
        QUADRANT_BORDER_ACCENT[bucket.quadrant], CELL_BORDER,
        collapsed ? 'min-h-0' : 'min-h-[220px]',
        dragOver ? 'ring-2 ring-slate-400 dark:ring-slate-500 scale-[1.02]' : '',
        isInvest && !dragOver ? INVEST_EMPHASIS : ''].filter(Boolean).join(' ')}>
      <QuadrantHeader quadrant={bucket.quadrant} label={bucket.label}
        subtitle={bucket.subtitle} count={bucket.tasks.length}
        collapsed={collapsed} onToggleCollapse={toggleCollapsed}
        className={`${collapsed ? 'mb-0' : 'mb-1'} ${isInvest ? 'font-bold' : ''}`} />

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden">
            <div className="px-2 space-y-0.5 divide-y divide-slate-100 dark:divide-slate-800/40">
              {bucket.tasks.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-slate-500 text-[0.8125rem] py-4 px-2 select-none" aria-hidden="true">
                  {EMPTY_COPY[bucket.quadrant]}
                </p>
              ) : (
                visibleTasks.map((task) => (
                  <TaskCard key={task.id} task={task}
                    onStatusChange={onStatusChange} onDelete={onDelete}
                    onClick={onTaskClick} onMove={onMove} onFlag={onFlag}
                    onTaskUpdate={onTaskUpdate} categories={categories}
                    expanded={expandedTaskId === task.id}
                    onToggleExpand={onToggleExpand}
                    suggested={suggestedTaskId === task.id} />
                ))
              )}
            </div>

            {!showAll && hiddenCount > 0 && (
              <button aria-label={`Show all ${bucket.label} tasks`}
                onClick={() => setShowAll(true)}
                className="w-full text-center text-[0.6875rem] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 py-1.5 transition-colors min-h-[44px] rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                <span aria-hidden="true">+{hiddenCount} more</span>
              </button>
            )}
            {showAll && bucket.tasks.length > MAX_VISIBLE && (
              <button aria-label={`Show fewer ${bucket.label} tasks`}
                onClick={() => setShowAll(false)}
                className="w-full text-center text-[0.6875rem] font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 py-1.5 transition-colors min-h-[44px] rounded-lg hover:bg-black/5 dark:hover:bg-white/5">
                <span aria-hidden="true">Show less</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
