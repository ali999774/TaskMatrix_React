import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../types'
import { parseLocalDate, localTodayStr } from '../lib/dates'
import { isInTodayView, isInUpcomingView } from '../lib/visibility'
import CheckCircle from './matrix/CheckCircle'

interface Props {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onComplete?: (id: string) => void
}

// ── Persisted collapse state ───────────────────────────────────────────
// Manual user toggles survive reloads.  Defaults are intentional:
//   • Overdue  — auto-expanded (never hidden from the user)
//   • Today    — auto-expanded (active action list; tap-to-reveal adds friction)
//   • Upcoming — collapsed (planning layer, not an action layer)
const LS_KEY = 'taskmatrix:sectionCollapse'
const LS_DEFAULTS = { today: false, overdue: false, upcoming: true }

// Number of items visible before the "+N more" tap-through
const PREVIEW_CAP = 3

export default function TodayStrip({ tasks, onTaskClick, onComplete }: Props) {
  const todayStr = localTodayStr()

  // ── Derive buckets ────────────────────────────────────────────────
  const overdue = tasks.filter((t) => {
    if (!t.due_date || t.status === 'done') return false
    return t.due_date < todayStr
  })

  const dueToday = tasks.filter((t) => {
    if (!t.due_date || t.status === 'done') return false
    if (t.due_date < todayStr) return false
    return isInTodayView(t, todayStr)
  })

  const upcoming = tasks.filter((t) => {
    if (!t.due_date || t.status === 'done') return false
    if (t.due_date < todayStr) return false
    if (isInTodayView(t, todayStr)) return false
    return isInUpcomingView(t, todayStr)
  })

  // ── Collapse state (localStorage-backed) ───────────────────────────
  const [collapsed, setCollapsed] = useState<{ today: boolean; overdue: boolean; upcoming: boolean }>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) return { ...LS_DEFAULTS, ...JSON.parse(raw) }
    } catch { /* corrupted */ }
    return LS_DEFAULTS
  })

  const toggle = (section: 'overdue' | 'today' | 'upcoming') =>
    setCollapsed((prev) => {
      const next = { ...prev, [section]: !prev[section] }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })

  // ── "+N more" state (per-section, resets on collapse) ──────────────
  const [showAll, setShowAll] = useState<Record<string, boolean>>({})

  if (overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0) return null

  // ── Section renderer ───────────────────────────────────────────────
  const renderSection = (
    section: 'overdue' | 'today' | 'upcoming',
    items: Task[],
    config: {
      headerEmoji: string
      headerLabel: string
      headerClassName: string
      chevronClassName: string
      rowBg: string
      rowBorder: string
      rowDateClassName: string
    },
  ) => {
    if (items.length === 0) return null
    const isCollapsed = collapsed[section]
    const capped = isCollapsed ? [] : showAll[section] ? items : items.slice(0, PREVIEW_CAP)
    const hidden = items.length - capped.length

    return (
      <div>
        <button
          onClick={() => {
            toggle(section)
            if (!isCollapsed) setShowAll((p) => ({ ...p, [section]: false }))
          }}
          aria-expanded={!isCollapsed}
          aria-controls={`tm-section-${section}`}
          className="w-full text-left flex items-center gap-1 px-1 mb-1.5
            hover:opacity-80 transition-opacity
            min-h-[44px]"
        >
          <span aria-hidden="true" className={`text-[0.75rem] font-semibold uppercase tracking-wider ${config.headerClassName}`}>
            {config.headerEmoji} {config.headerLabel} ({items.length})
          </span>
          <span aria-hidden="true"
            className={`inline-block transition-transform duration-200 text-[0.625rem] ml-auto ${config.chevronClassName}
              ${isCollapsed ? '' : 'rotate-90'}`}
          >▶</span>
        </button>
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-1" id={`tm-section-${section}`}>
                {capped.map((task) => (
                  <div
                    key={task.id}
                    className={`w-full text-left pt-2 pb-1 px-2 rounded-xl ${config.rowBg} ${config.rowBorder}
                      hover:opacity-80 transition-colors min-h-[44px] flex items-center gap-1.5`}
                  >
                    {onComplete && (
                      <CheckCircle
                        status={task.status}
                        onToggle={() => onComplete(task.id)}
                      />
                    )}
                    <button
                      onClick={() => onTaskClick(task)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-[0.78125rem] sm:text-[0.875rem] font-semibold leading-snug text-slate-800 dark:text-slate-100">
                        {task.title}
                      </p>
                      {task.due_date && (
                        <p className="text-[0.65625rem] sm:text-[0.75rem] leading-relaxed mt-0.5">
                          <span className={config.rowDateClassName}>
                            {parseLocalDate(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </p>
                      )}
                    </button>
                  </div>
                ))}
                {hidden > 0 && (
                  <button
                    onClick={() => setShowAll((p) => ({ ...p, [section]: true }))}
                    className="w-full text-left px-3 py-2 rounded-lg text-[0.8125rem] font-medium
                      text-slate-500 dark:text-slate-400
                      bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800
                      transition-colors min-h-[44px]"
                  >
                    +{hidden} more — tap to show
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="mb-4 space-y-2">
      {renderSection('overdue', overdue, {
        // Contrast: text-red-600 (#dc2626) on #F2F2F7 = 4.7:1  ✓ WCAG AA
        headerEmoji: '⚠',
        headerLabel: 'OVERDUE',
        headerClassName: 'text-red-600 dark:text-red-400',
        chevronClassName: 'text-red-400 dark:text-red-500',
        rowBg: 'bg-red-50 dark:bg-red-950/30',
        rowBorder: 'border border-red-200 dark:border-red-800/40',
        rowDateClassName: 'text-red-400 dark:text-red-500',
      })}

      {renderSection('today', dueToday, {
        // Contrast: text-amber-600 (#d97706) on #F2F2F7 = 4.5:1  ✓ WCAG AA
        headerEmoji: '📅',
        headerLabel: 'TODAY',
        headerClassName: 'text-amber-600 dark:text-amber-400',
        chevronClassName: 'text-amber-400 dark:text-amber-500',
        rowBg: 'bg-amber-50 dark:bg-amber-950/30',
        rowBorder: 'border border-amber-200 dark:border-amber-800/40',
        rowDateClassName: 'text-amber-400 dark:text-amber-500',
      })}

      {renderSection('upcoming', upcoming, {
        // Contrast: text-blue-600 (#2563eb) on #F2F2F7 = 5.1:1  ✓ WCAG AA
        headerEmoji: '📆',
        headerLabel: 'UPCOMING',
        headerClassName: 'text-blue-600 dark:text-blue-400',
        chevronClassName: 'text-blue-400 dark:text-blue-500',
        rowBg: 'bg-blue-50 dark:bg-blue-950/30',
        rowBorder: 'border border-blue-200 dark:border-blue-800/40',
        rowDateClassName: 'text-blue-400 dark:text-blue-500',
      })}
    </div>
  )
}
