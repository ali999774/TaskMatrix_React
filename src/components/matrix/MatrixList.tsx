import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Quadrant, Task, QuadrantId } from '../../types'
import { QUADRANT_ID_MAP } from '../../types'
import type { CategoryDef } from '../../lib/categories'
import type { QuadrantBucket } from '../../lib/matrix'
import QuadrantHeader, { QUADRANT_BORDER_ACCENT } from './QuadrantHeader'
import TaskCard from '../TaskCard'

const LIST_ORDER: QuadrantId[] = ['invest', 'do-first', 'delegate', 'dont-do']

type EmphasisTier = 'lead' | 'high' | 'normal' | 'muted'
const EMPHASIS: Record<QuadrantId, EmphasisTier> = {
  'invest':   'lead',
  'do-first': 'high',
  'delegate': 'normal',
  'dont-do':  'muted',
}
const TIER_CLASSES: Record<EmphasisTier, string> = {
  lead:   'mb-5',
  high:   'mb-4',
  normal: 'mb-3 opacity-80',
  muted:  'mb-2 opacity-50',
}

const CELL_BORDER = 'border-slate-200/70 dark:border-slate-700/40'

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

export default function MatrixList({
  buckets, onMove, onFlag, onStatusChange, onDelete, onTaskClick,
  categories, expandedTaskId, onToggleExpand, onTaskUpdate, suggestedTaskId = null,
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
        <ListQuadrant key={bucket.quadrant} bucket={bucket}
          onMove={onMove} onFlag={onFlag} onStatusChange={onStatusChange}
          onDelete={onDelete} onTaskClick={onTaskClick} categories={categories}
          expandedTaskId={expandedTaskId} onToggleExpand={onToggleExpand}
          onTaskUpdate={onTaskUpdate} suggestedTaskId={suggestedTaskId} />
      ))}
    </div>
  )
}

function ListQuadrant({
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
  const qId = QUADRANT_ID_MAP[bucket.quadrant]
  const tierCls = TIER_CLASSES[EMPHASIS[qId]]
  const [dragOver, setDragOver] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(`tm-q-${bucket.quadrant}`) === 'true',
  )

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

  return (
    <div className={`${tierCls} transition-opacity duration-200`}
      data-drop-id={`list:${qId}`}
      onDragOver={handleDragOver} onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave} onDrop={handleDrop}>
      <div className={['rounded-xl border border-l-[3px] overflow-hidden transition-all duration-300',
        QUADRANT_BORDER_ACCENT[bucket.quadrant], CELL_BORDER,
        dragOver ? 'ring-2 ring-slate-400 dark:ring-slate-500 scale-[1.01]' : '',
      ].filter(Boolean).join(' ')}>
        <QuadrantHeader quadrant={bucket.quadrant} label={bucket.label}
          subtitle={bucket.subtitle} count={bucket.tasks.length}
          collapsed={collapsed} onToggleCollapse={toggleCollapsed} />

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden">
              <div className="px-2 pb-2 space-y-0.5 divide-y divide-slate-100 dark:divide-slate-800/40">
                {bucket.tasks.length === 0 ? (
                  <p className="text-center text-slate-400 dark:text-slate-500 text-[0.8125rem] py-4 px-2 select-none" aria-hidden="true">
                    {EMPTY_COPY[bucket.quadrant]}
                  </p>
                ) : (
                  bucket.tasks.map((task) => (
                    <TaskCard key={task.id} task={task}
                      onStatusChange={onStatusChange} onDelete={onDelete}
                      onClick={onTaskClick} onMove={onMove} onFlag={onFlag}
                      categories={categories} expanded={task.id === expandedTaskId}
                      onToggleExpand={onToggleExpand} onTaskUpdate={onTaskUpdate}
                      suggested={suggestedTaskId === task.id} />
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
