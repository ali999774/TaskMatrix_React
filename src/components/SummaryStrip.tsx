// SummaryStrip — consolidated selector + content area replacing the old
// stacked collapsible-row layout (BriefEntryChip + 3 TodayStrip sections).
// Web/tablet: horizontal pill tab bar. Mobile: native <select>.
// Single shared content area below, used by both.
//
// Default: nothing selected, content area hidden.

import { useState, useMemo, useCallback } from 'react'
import type { Task } from '../types'
import { parseLocalDate, localTodayStr } from '../lib/dates'
import { isInTodayView, isInUpcomingView } from '../lib/visibility'
import CheckCircle from './matrix/CheckCircle'
import BottomSheet from './BottomSheet'
import { Sparkles, Loader2, AlertTriangle, CalendarDays, Calendar, ChevronDown } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────

type TabId = 'overdue' | 'today' | 'upcoming' | 'brief'

interface TabDef {
  id: TabId
  label: string
  emoji: string
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
  headerEmoji: string
  headerLabel: string
  rowBg: string
  rowBorder: string
  rowDateClassName: string
  tokenClass: string   // CSS var for header/text color
}> = {
  overdue: {
    headerEmoji: '⚠',
    headerLabel: 'Overdue',
    rowBg: 'bg-red-50 dark:bg-red-950/30',
    rowBorder: 'border border-red-200 dark:border-red-800/40',
    rowDateClassName: 'text-red-400 dark:text-red-500',
    tokenClass: 'text-[var(--color-bucket-overdue-text)]',
  },
  today: {
    headerEmoji: '📅',
    headerLabel: 'Today',
    rowBg: 'bg-amber-50 dark:bg-amber-950/30',
    rowBorder: 'border border-amber-200 dark:border-amber-800/40',
    rowDateClassName: 'text-amber-400 dark:text-amber-500',
    tokenClass: 'text-[var(--color-bucket-today-text)]',
  },
  upcoming: {
    headerEmoji: '📆',
    headerLabel: 'Upcoming',
    rowBg: 'bg-blue-50 dark:bg-blue-950/30',
    rowBorder: 'border border-blue-200 dark:border-blue-800/40',
    rowDateClassName: 'text-blue-400 dark:text-blue-500',
    tokenClass: 'text-[var(--color-bucket-upcoming-text)]',
  },
}

const PREVIEW_CAP = 3

// ── Picker option icons + colors per tab ─────────────────────────────────

const PICKER_OPTION: Record<TabId, { icon: typeof AlertTriangle; colorClass: string }> = {
  overdue:  { icon: AlertTriangle, colorClass: 'text-[var(--color-bucket-overdue-text)]' },
  today:    { icon: CalendarDays,  colorClass: 'text-[var(--color-bucket-today-text)]' },
  upcoming: { icon: Calendar,      colorClass: 'text-[var(--color-bucket-upcoming-text)]' },
  brief:    { icon: Sparkles,      colorClass: 'text-blue-500 dark:text-blue-400' },
}

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
  const [pickerOpen, setPickerOpen] = useState(false)

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
      { id: 'overdue', label: 'Overdue', emoji: '⚠', count: buckets.overdue.length },
      { id: 'today', label: 'Today', emoji: '📅', count: buckets.dueToday.length },
      { id: 'upcoming', label: 'Upcoming', emoji: '📆', count: buckets.upcoming.length },
    ]
    if (aiEnabled) {
      base.push({ id: 'brief', label: 'Morning brief', emoji: '✨' })
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

  // Reset showAll when tab changes
  const handleTabChange = (tabId: TabId) => {
    if (tabId === selectedTab) {
      // Tap same tab → deselect (toggle off)
      setSelectedTab(null)
      setShowAll(false)
    } else {
      setSelectedTab(tabId)
      setShowAll(false)
    }
  }

  const handlePickerSelect = useCallback((tabId: TabId) => {
    setSelectedTab((prev) => prev === tabId ? null : tabId)
    setShowAll(false)
    setPickerOpen(false)
  }, [])

  // ── Trigger button label ──────────────────────────────────────────
  const selectedDef = tabs.find((t) => t.id === selectedTab)
  const triggerLabel = selectedDef
    ? `${selectedDef.emoji} ${selectedDef.label}${selectedDef.count !== undefined ? ` · ${selectedDef.count}` : ''}`
    : 'Select a view'

  // ── Nothing to show if no tasks and no brief capability ─────────────
  // (brief tab always shows even with 0 counts)

  // ── Task row renderer (shared by tab content + select content) ──────
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

  // ── Render brief content ────────────────────────────────────────────
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

  return (
    <div className="mb-4">
      {/* ── MOBILE: button trigger + BottomSheet picker ────────── */}
      <div className="block sm:hidden mb-2">
        <button
          onClick={() => setPickerOpen(true)}
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
          className="w-full text-[0.875rem] px-3 py-2.5 rounded-xl text-left
            bg-white dark:bg-slate-800
            text-slate-700 dark:text-slate-200
            border border-slate-200 dark:border-slate-700
            min-h-[44px] flex items-center gap-2
            hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
        >
          <span className="flex-1 truncate">{triggerLabel}</span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 ${pickerOpen ? 'rotate-180' : ''}`}
          />
        </button>

        <BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)}>
          <div role="listbox" aria-label="Select a view" className="px-2 pb-2">
            {tabs.map((t) => {
              const opt = PICKER_OPTION[t.id]
              const Icon = opt.icon
              const isSelected = selectedTab === t.id
              return (
                <button
                  key={t.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handlePickerSelect(t.id)}
                  className={`w-full text-left flex items-center gap-2.5 px-3 py-3 rounded-xl
                    min-h-[44px] transition-colors
                    ${isSelected
                      ? 'bg-slate-100 dark:bg-slate-800'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${opt.colorClass}`} />
                  <span className="flex-1 text-[0.875rem] font-medium text-slate-700 dark:text-slate-200">
                    {t.emoji} {t.label}
                  </span>
                  {t.count !== undefined && (
                    <span className="text-[0.8125rem] text-slate-400 dark:text-slate-500 tabular-nums">
                      {t.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </BottomSheet>
      </div>

      {/* ── WEB: horizontal pill tab bar ─────────────────────────── */}
      <div className="hidden sm:flex gap-1.5 mb-2 overflow-x-auto">
        {tabs.map((t) => {
          const isSelected = selectedTab === t.id
          const isOverdue = t.id === 'overdue'

          return (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              aria-pressed={isSelected}
              className={`text-[0.75rem] px-3 py-2 rounded-full font-medium transition-all
                active:scale-95 motion-reduce:scale-100 active:opacity-80
                min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 whitespace-nowrap
                ${isSelected
                  ? isOverdue
                    ? 'bg-[var(--color-bucket-overdue-text)] text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-transparent text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
            >
              <span aria-hidden="true">{t.emoji}</span>
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className="tabular-nums">· {t.count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Content area (shared by web tabs and mobile select) ──── */}
      {selectedTab && (
        <div className="pt-1">
          {selectedTab === 'brief' ? (
            renderBriefContent()
          ) : activeItems && activeItems.length > 0 ? (
            <div>
              <div className="flex items-center gap-1 px-1 mb-1.5 min-h-[44px]">
                <span
                  aria-hidden="true"
                  className={`text-[0.75rem] font-semibold uppercase tracking-wider ${TAB_CONFIG[selectedTab].tokenClass}`}
                >
                  {TAB_CONFIG[selectedTab].headerEmoji} {TAB_CONFIG[selectedTab].headerLabel} ({activeItems.length})
                </span>
              </div>
              {renderTaskRows(activeItems, TAB_CONFIG[selectedTab])}
            </div>
          ) : (
            <p className="text-[0.8125rem] text-slate-400 dark:text-slate-500 px-1 py-2">
              No {TAB_CONFIG[selectedTab].headerLabel.toLowerCase()} tasks.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
