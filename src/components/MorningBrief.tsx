// MorningBrief — first-open-of-day AI orientation card
// Appears above the matrix on first open each day (or pull-down to summon)

import { X, Sparkles, AlertTriangle, Calendar, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import type { MorningBrief as MorningBriefData } from '../lib/ai-parse'

interface Props {
  brief: MorningBriefData | null
  loading: boolean
  error: string | null
  collapsed: boolean
  onToggle: () => void
  onDismiss: () => void
  onPlanDay: () => void
  onRetry: () => void
}

const iconClass = 'w-4 h-4 flex-shrink-0'

export default function MorningBrief({ brief, loading, error, collapsed, onToggle, onDismiss, onPlanDay, onRetry }: Props) {
  if (error) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[0.8125rem] text-amber-700 dark:text-amber-300">
        <button onClick={onDismiss} className="float-right p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-full min-h-[44px] min-w-[44px] inline-flex items-center justify-center" aria-label="Dismiss">
          <X className="w-4 h-4" />
        </button>
        <p className="font-semibold mb-1">Couldn't load morning brief</p>
        <p className="text-amber-600 dark:text-amber-400 mb-2">{error}</p>
        <button
          onClick={onRetry}
          className="text-[0.75rem] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 px-3 py-1.5 rounded-lg transition-colors min-h-[44px]"
        >
          🔄 Retry
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-3 mb-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-[0.8125rem] animate-pulse">
          <Sparkles className={iconClass} />
          <span>Preparing your morning brief…</span>
        </div>
      </div>
    )
  }

  if (!brief) return null

  return (
    <div className="mx-3 mb-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm transition-all duration-300">
      {/* Header — tappable to collapse/expand */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        aria-label={collapsed ? 'Expand morning brief' : 'Collapse morning brief'}
      >
        <Sparkles className={`${iconClass} text-blue-500`} />
        <span className="text-[0.875rem] font-semibold text-slate-700 dark:text-slate-200 flex-1">
          {brief.greeting}
        </span>
        <span className="text-[0.75rem] text-slate-400 mr-1">
          {brief.overdue.length > 0 && `${brief.overdue.length} overdue · `}
          {brief.due_today.length} due today
        </span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 space-y-3">
          {/* Summary */}
          <p className="text-[0.8125rem] text-slate-600 dark:text-slate-400 leading-relaxed">
            {brief.summary}
          </p>

          {/* Overdue tasks */}
          {brief.overdue.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[0.75rem] text-red-500 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Overdue
              </div>
              {brief.overdue.map(t => (
                <div key={t.id} className="text-[0.8125rem] text-slate-700 dark:text-slate-300 pl-5">
                  • {t.title}
                  <span className="text-[0.6875rem] text-red-400 ml-1">({t.days}d ago)</span>
                </div>
              ))}
            </div>
          )}

          {/* Due today */}
          {brief.due_today.length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[0.75rem] text-amber-600 dark:text-amber-400 font-medium">
                <Calendar className="w-3.5 h-3.5" />
                Due today
              </div>
              {brief.due_today.map(t => (
                <div key={t.id} className="text-[0.8125rem] text-slate-700 dark:text-slate-300 pl-5">
                  • {t.title}
                </div>
              ))}
            </div>
          )}

          {/* Focus areas */}
          {brief.focus_areas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {brief.focus_areas.map((area, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[0.6875rem] font-medium">
                  {area}
                </span>
              ))}
            </div>
          )}

          {/* Momentum + tip */}
          <div className="space-y-2 pt-1">
            <p className="text-[0.75rem] text-slate-500 dark:text-slate-500 italic">
              {brief.momentum}
            </p>
            <div className="flex items-start gap-1.5 text-[0.75rem] text-slate-500 dark:text-slate-400">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>{brief.tip}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onPlanDay}
              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 active:opacity-80 text-white rounded-lg text-[0.8125rem] font-medium transition-all min-h-[44px]"
            >
              📋 Plan my day
            </button>
            <button
              onClick={onDismiss}
              className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-600 dark:text-slate-400 rounded-lg text-[0.8125rem] transition-all min-h-[44px]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
