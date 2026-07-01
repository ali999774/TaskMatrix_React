import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task, Quadrant } from '../types'
import type { CategoryDef } from '../lib/categories'
import { localTodayStr } from '../lib/dates'
import { isInUpcomingView, UPCOMING_HORIZON_DAYS } from '../lib/visibility'
import TaskCard from './TaskCard'

interface Props {
  tasks: Task[]
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onTaskClick: (task: Task) => void
  onMove: (id: string, toQuadrant: Quadrant) => void
  onFlag: (id: string) => void
  onTaskUpdate?: (id: string, updates: Partial<Task>) => void
  categories: CategoryDef[]
}

// Own collapse key (decoupled from TodayStrip's, which rewrites its whole blob
// on toggle and would otherwise clobber a shared field).
const LS_KEY = 'taskmatrix:upcomingCollapse'

/**
 * Upcoming — the relief valve.  Shows every incomplete occurrence whose due_date
 * falls within UPCOMING_HORIZON_DAYS but which has NOT yet been promoted to Today
 * (today < show_date), regardless of its lead_days.  Rows are the real
 * interactive TaskCard, so a future occurrence can be completed early right here.
 */
export default function UpcomingStrip({
  tasks,
  onStatusChange,
  onDelete,
  onTaskClick,
  onMove,
  onFlag,
  onTaskUpdate,
  categories,
}: Props) {
  const todayStr = localTodayStr()

  const upcoming = tasks
    .filter((t) => isInUpcomingView(t, todayStr))
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) return JSON.parse(raw) === true
    } catch { /* corrupted — fall back to expanded */ }
    return false
  })

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggle = () =>
    setCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch { /* quota — ignore */ }
      return next
    })

  if (upcoming.length === 0) return null

  return (
    <div className="mb-4">
      <button
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls="tm-section-upcoming"
        aria-label={collapsed ? 'Show upcoming tasks' : 'Hide upcoming tasks'}
        className="w-full text-left flex items-center gap-1 px-1 mb-1.5
          hover:opacity-80 transition-opacity min-h-[44px]"
      >
        <span aria-hidden="true" className="text-[0.75rem] font-semibold text-sky-500 dark:text-sky-400 uppercase tracking-wider">
          🗓 Upcoming ({upcoming.length})
        </span>
        <span aria-hidden="true" className="text-[0.625rem] text-sky-400 dark:text-sky-500 ml-1 normal-case font-normal tracking-normal">
          next {UPCOMING_HORIZON_DAYS} days
        </span>
        <span aria-hidden="true"
          className={`inline-block transition-transform duration-200 text-[0.625rem] text-sky-400 dark:text-sky-500 ml-auto
            ${collapsed ? '' : 'rotate-90'}`}
        >▶</span>
      </button>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5" id="tm-section-upcoming">
              {upcoming.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  onClick={onTaskClick}
                  onMove={onMove}
                  onFlag={onFlag}
                  onTaskUpdate={onTaskUpdate}
                  categories={categories}
                  expanded={expandedId === task.id}
                  onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
