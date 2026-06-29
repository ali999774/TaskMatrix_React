import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../types'
import { parseLocalDate, localTodayStr } from '../lib/dates'

interface Props {
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

const LS_KEY = 'taskmatrix:sectionCollapse'
const LS_DEFAULTS = { today: false, overdue: false }

export default function TodayStrip({ tasks, onTaskClick }: Props) {
  // Local date string — toISOString() converts to UTC and can shift the day
  const todayStr = localTodayStr()

  // Status value is 'done' (see TaskCard cycle), not 'completed' — the old
  // check matched nothing, so finished tasks never left the strips.
  const overdue = tasks.filter((t) => {
    if (!t.due_date || t.status === 'done') return false
    return t.due_date < todayStr
  })

  const dueToday = tasks.filter((t) => {
    if (!t.due_date || t.status === 'done') return false
    return t.due_date === todayStr
  })

  const [collapsed, setCollapsed] = useState<{ today: boolean; overdue: boolean }>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) return { ...LS_DEFAULTS, ...JSON.parse(raw) }
    } catch { /* corrupted — fall back to defaults */ }
    return LS_DEFAULTS
  })

  const toggleOverdue = () =>
    setCollapsed((prev) => {
      const next = { ...prev, overdue: !prev.overdue }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })

  const toggleToday = () =>
    setCollapsed((prev) => {
      const next = { ...prev, today: !prev.today }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })

  if (overdue.length === 0 && dueToday.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {overdue.length > 0 && (
        <div>
          <button
            onClick={toggleOverdue}
            aria-expanded={!collapsed.overdue}
            aria-controls="tm-section-overdue"
            className="w-full text-left flex items-center gap-1 px-1 mb-1.5
              hover:opacity-80 transition-opacity
              min-h-[44px]"
          >
            <span aria-hidden="true" className="text-[0.75rem] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider">
              ⚠ Overdue ({overdue.length})
            </span>
            <span aria-hidden="true"
              className={`inline-block transition-transform duration-200 text-[0.625rem] text-red-400 dark:text-red-500 ml-auto
                ${collapsed.overdue ? '' : 'rotate-90'}`}
            >▶</span>
          </button>
          <AnimatePresence initial={false}>
            {!collapsed.overdue && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-1" id="tm-section-overdue">
                  {overdue.slice(0, 5).map((task) => (
                    <button
                      key={task.id}
                      aria-label={`Task: ${task.title}`}
                      onClick={() => onTaskClick(task)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30
                        border border-red-200 dark:border-red-800/40 text-[0.875rem] text-slate-700
                        dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors min-h-[44px]"
                    >
                      <span className="font-medium" aria-hidden="true">{task.title}</span>
                      <span className="ml-2 text-[0.75rem] text-red-400 dark:text-red-500" aria-hidden="true">
                        {task.due_date && parseLocalDate(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </button>
                  ))}
                  {overdue.length > 5 && (
                    <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 px-1">
                      +{overdue.length - 5} more overdue
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {dueToday.length > 0 && (
        <div>
          <button
            onClick={toggleToday}
            aria-expanded={!collapsed.today}
            aria-controls="tm-section-today"
            className="w-full text-left flex items-center gap-1 px-1 mb-1.5
              hover:opacity-80 transition-opacity
              min-h-[44px]"
          >
            <span aria-hidden="true" className="text-[0.75rem] font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
              📅 Today ({dueToday.length})
            </span>
            <span aria-hidden="true"
              className={`inline-block transition-transform duration-200 text-[0.625rem] text-amber-400 dark:text-amber-500 ml-auto
                ${collapsed.today ? '' : 'rotate-90'}`}
            >▶</span>
          </button>
          <AnimatePresence initial={false}>
            {!collapsed.today && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-1" id="tm-section-today">
                  {dueToday.slice(0, 5).map((task) => (
                    <button
                      key={task.id}
                      aria-label={`Task: ${task.title}`}
                      onClick={() => onTaskClick(task)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30
                        border border-amber-200 dark:border-amber-800/40 text-[0.875rem] text-slate-700
                        dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors min-h-[44px]"
                    >
                      <span className="font-medium" aria-hidden="true">{task.title}</span>
                    </button>
                  ))}
                  {dueToday.length > 5 && (
                    <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 px-1">
                      +{dueToday.length - 5} more due today
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
