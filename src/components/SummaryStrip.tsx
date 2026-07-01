// SummaryStrip — unified horizontal tab row with inline expand/collapse,
// matching the quadrant rows' AnimatePresence + chevron pattern.
// Same component on web and mobile — mobile just scrolls the tab row.
//
// Default: nothing selected, content area hidden.

import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Task } from '../types'
import { parseLocalDate, localTodayStr } from '../lib/dates'
import { isInTodayView, isInUpcomingView } from '../lib/visibility'
import CheckCircle from './matrix/CheckCircle'
import { Sparkles, Loader2, AlertTriangle, CalendarDays, Calendar, ChevronRight } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────

type TabId = 'overdue' | 'today' | 'upcoming' | 'brief'

interface TabDef {
  id: TabId
  label: string
  count?: number
}

interface Props {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onComplete?: (id: string) => void
  // Morning brief
  aiEnabled: boolean
  overdueCount: number | null
  dueTodayCount: number | null
  briefLoading: boolean
  briefError: string | null
  onBriefTap: () => void
}

// ── Config per tab ───────────────────────────────────────────────────────

const TAB_CONFIG: Record<Exclude<TabId, 'brief'>, {
  headerLabel: string
  rowBg: string
  rowBorder: string
  rowDateClassName: string
  tokenClass: string
  icon: typeof AlertTriangle
}> = {
  overdue: {
    headerLabel: 'Overdue',
    rowBg: 'bg-red-50 dark:bg-red-950/30',
    rowBorder: 'border border-red-200 dark:border-red-800/40',
    rowDateClassName: 'text-red-400 dark:text-red-500',
    tokenClass: 'text-[var(--color-bucket-overdue-text)]',
    icon: AlertTriangle,
  },
  today: {
    headerLabel: 'Today',
    rowBg: 'bg-amber-50 dark:bg-amber-950/30',
    rowBorder: 'border border-amber-200 dark:border-amber-800/40',
    rowDateClassName: 'text-amber-400 dark:text-amber-500',
    tokenClass: 'text-[var(--color-bucket-today-text)]',
    icon: CalendarDays,
  },
  upcoming: {
    headerLabel: 'Upcoming',
    rowBg: 'bg-blue-50 dark:bg-blue-950/30',
    rowBorder: 'border border-blue-200 dark:border-blue-800/40',
    rowDateClassName: 'text-blue-400 dark:text-blue-500',
    tokenClass: 'text-[var(--color-bucket-upcoming-text)]',
    icon: Calendar,
  },
}

const PREVIEW_CAP = 3

// ── Component ────────────────────────────────────────────────────────────

export default function SummaryStrip({
  tasks,
  onTaskClick,
  onComplete,
  aiEnabled,
  overdueCount,
  dueTodayCount,
  briefLoading,
  briefError,
  onBriefTap,
}: Props) {
  const todayStr = localTodayStr()
  const [selectedTab, setSelectedTab] = useState<TabId | null>(null)
  const [showAll, setShowAll] = useState(false)

  // ── Derive task buckets ─────────────────────────────────────────────
  const buckets = useMemo(() => {
    const overdue: Task[] = []
    const dueToday: Task[] = []
    const upcoming: Task[] = []

    for (const t of tasks) {
      if (!t.due_date || t.status === 'done') continue
      if (t.due_date < todayStr) {
        overdue.push(t)
      } else if (isInTodayView(t, todayStr)) {
        dueToday.push(t)
      } else if (isInUpcomingView(t, todayStr)) {
        upcoming.push(t)
      }
    }

    return { overdue, dueToday, upcoming }
  }, [tasks, todayStr])

  // ── Build tab definitions with live counts ──────────────────────────
  const tabs: TabDef[] = useMemo(() => {
    const base: TabDef[] = [
      { id: 'overdue', label: 'Overdue', count: buckets.overdue.length },
      { id: 'today', label: 'Today', count: buckets.dueToday.length },
      { id: 'upcoming', label: 'Upcoming', count: buckets.upcoming.length },
    ]
    if (aiEnabled) {
      base.push({ id: 'brief', label: 'Morning brief' })
    }
    return base
  }, [buckets, aiEnabled])

  // ── Selected tab's task list ────────────────────────────────────────
  const activeItems = useMemo((): Task[] | null => {
    if (!selectedTab || selectedTab === 'brief') return null
    if (selectedTab === 'overdue') return buckets.overdue
    if (selectedTab === 'today') return buckets.dueToday
    return buckets.upcoming
  }, [selectedTab, buckets])

  // ── Tab toggle — exclusive: only one open at a time ────────────────
  const handleTabClick = (tabId: TabId) => {
    if (tabId === selectedTab) {
      setSelectedTab(null)
      setShowAll(false)
    } else {
      setSelectedTab(tabId)
      setShowAll(false)
    }
  }

  // ── Task row renderer (shared) ─────────────────────────────────────
  const renderTaskRows = (items: Task[], config: typeof TAB_CONFIG['overdue']) => {
    const capped = showAll ? items : items.slice(0, PREVIEW_CAP)
    const hidden = items.length - capped.length

    return (
      <div className="space-y-1">
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
            onClick={() => setShowAll(true)}
            className="w-full text-left px-3 py-2 rounded-lg text-[0.8125rem] font-medium
              text-slate-500 dark:text-slate-400
              bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800
              transition-colors min-h-[44px]"
          >
            +{hidden} more — tap to show
          </button>
        )}
      </div>
    )
  }

  // ── Brief content ───────────────────────────────────────────────────
  const renderBriefContent = () => {
    const hasCounts = overdueCount !== null && dueTodayCount !== null

    if (briefError) {
      return (
        <button
          onClick={onBriefTap}
          className="w-full text-left flex items-center gap-1 px-1 min-h-[44px]
            hover:opacity-80 transition-opacity"
        >
          <span className="text-[0.75rem] font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
            <span className="inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Brief unavailable
            </span>
          </span>
          <span className="text-[0.75rem] text-amber-400 dark:text-amber-500 ml-2">· Retry</span>
        </button>
      )
    }

    if (briefLoading) {
      return (
        <div className="w-full text-left flex items-center gap-1 px-1 min-h-[44px]">
          <span className="text-[0.75rem] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
            <span className="inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Generating…
            </span>
          </span>
        </div>
      )
    }

    return (
      <button
        onClick={onBriefTap}
        className="w-full text-left flex items-center gap-1 px-1 min-h-[44px]
          hover:opacity-80 transition-opacity"
        aria-label="Open morning brief"
      >
        <span className="text-[0.75rem] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Morning brief
          </span>
        </span>
        {hasCounts && (
          <span className="text-[0.75rem] text-slate-400 dark:text-slate-500 ml-2">
            · {overdueCount} earlier · {dueTodayCount} today
          </span>
        )}
        <span className="text-[0.625rem] text-slate-400 dark:text-slate-500 ml-auto">›</span>
      </button>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────

  const isExpanded = selectedTab !== null

  return (
    <div className="mb-4">
      {/* ── Tab row — horizontally scrollable on narrow screens ───── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {tabs.map((t) => {
          const isSelected = selectedTab === t.id
          const isOverdue = t.id === 'overdue'

          return (
            <button
              key={t.id}
              onClick={() => handleTabClick(t.id)}
              aria-pressed={isSelected}
              className={`text-[0.75rem] px-3 py-2 rounded-full font-medium transition-all
                active:scale-95 motion-reduce:scale-100 active:opacity-80
                min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1
                whitespace-nowrap shrink-0
                ${isSelected
                  ? isOverdue
                    ? 'bg-[var(--color-bucket-overdue-text)] text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
            >
              {t.id !== 'brief' ? (() => {
                const cfg = TAB_CONFIG[t.id]
                const Icon = cfg.icon
                return <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              })() : <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className="tabular-nums">· {t.count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Inline expand — matching quadrant AnimatePresence pattern ─ */}
      <AnimatePresence initial={false}>
        {isExpanded && selectedTab !== 'brief' && activeItems && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              {/* Collapse header — chevron-up affordance, matching quadrant pattern */}
              <button
                onClick={() => { setSelectedTab(null); setShowAll(false) }}
                aria-expanded={true}
                aria-controls={`tm-section-${selectedTab}`}
                className="w-full text-left flex items-center gap-1 px-1 mb-1.5
                  hover:opacity-80 transition-opacity
                  min-h-[44px]"
              >
                {(() => {
                  const cfg = TAB_CONFIG[selectedTab]
                  const Icon = cfg.icon
                  return (
                    <Icon className={`w-4 h-4 shrink-0 ${cfg.tokenClass}`} />
                  )
                })()}
                <span className={`text-[0.75rem] font-semibold uppercase tracking-wider flex-1 ${TAB_CONFIG[selectedTab].tokenClass}`}>
                  {TAB_CONFIG[selectedTab].headerLabel} ({activeItems.length})
                </span>
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 rotate-90 text-slate-400 dark:text-slate-500"
                ><ChevronRight className="w-3.5 h-3.5" /></span>
              </button>

              <div id={`tm-section-${selectedTab}`}>
                {activeItems.length > 0 ? (
                  renderTaskRows(activeItems, TAB_CONFIG[selectedTab])
                ) : (
                  <p className="text-[0.8125rem] text-slate-400 dark:text-slate-500 px-1 py-2">
                    No {TAB_CONFIG[selectedTab].headerLabel.toLowerCase()} tasks.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {isExpanded && selectedTab === 'brief' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pt-2">
              {/* Collapse header — chevron-up affordance */}
              <button
                onClick={() => setSelectedTab(null)}
                aria-expanded={true}
                className="w-full text-left flex items-center gap-1 px-1 mb-1.5
                  hover:opacity-80 transition-opacity
                  min-h-[44px]"
              >
                <Sparkles className="w-4 h-4 shrink-0 text-blue-500 dark:text-blue-400" />
                <span className="text-[0.75rem] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider flex-1">
                  Morning brief
                </span>
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 rotate-90 text-slate-400 dark:text-slate-500"
                ><ChevronRight className="w-3.5 h-3.5" /></span>
              </button>
              {renderBriefContent()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
