// DayPlan — AI-sequenced action plan, expanded from MorningBrief

import { Zap, Clock, ArrowRight, RefreshCw, ArrowLeft } from 'lucide-react'
import type { DayPlan as DayPlanData } from '../lib/ai-parse'
import type { Task } from '../types'
import { parseLocalDate } from '../lib/dates'
import CheckCircle from './matrix/CheckCircle'

interface Props {
  plan: DayPlanData | null
  loading: boolean
  error: string | null
  onClose: () => void
  onRefresh?: () => void
  onReplan?: () => void
  replanning?: boolean
  offline?: boolean
  // Real tasks, so each plan line can resolve its id to a live task and become
  // actionable (complete / open) instead of read-only prose.
  tasks?: Task[]
  onComplete?: (id: string) => void
  onTaskClick?: (task: Task) => void
}

/** Only show a duration badge when there's a real estimate to display. */
function hasDuration(d: string | undefined): boolean {
  return !!(d && d.trim())
}

export default function DayPlan({ plan, loading, error, onClose, onRefresh, onReplan, replanning, offline, tasks, onComplete, onTaskClick }: Props) {
  const taskById = new Map((tasks ?? []).map((t) => [t.id, t]))
  if (error) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[0.8125rem] text-amber-700 dark:text-amber-300">
        <button onClick={onClose} className="float-right w-9 h-9 rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 hover:bg-amber-300 dark:hover:bg-amber-900/70 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]" aria-label="Back">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <p className="font-semibold mb-1">Couldn't create day plan</p>
        <p className="text-amber-600 dark:text-amber-400">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-3 mb-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-[0.8125rem] animate-pulse">
          <Zap className="w-4 h-4" />
          <span>Sequencing your day…</span>
        </div>
      </div>
    )
  }

  if (!plan || plan.plan.length === 0) {
    return (
      <div className="mx-3 mb-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[0.875rem] font-semibold text-slate-700 dark:text-slate-200">Your Day Plan</span>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]" aria-label="Back">
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <p className="text-[0.8125rem] text-slate-500 dark:text-slate-400 text-center py-3">
          No tasks to plan — capture something and come back
        </p>
      </div>
    )
  }

  return (
    <div className="mx-3 mb-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0" aria-label="Back">
          <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[0.875rem] font-semibold text-slate-700 dark:text-slate-200">Your Day Plan</span>
          <span className="text-[0.6875rem] text-slate-400">{plan.plan.length} tasks</span>
          {plan.total_estimated && (
            <span className="text-[0.6875rem] text-slate-400">· {plan.total_estimated}</span>
          )}
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full min-h-[44px] min-w-[44px] inline-flex items-center justify-center" aria-label="Refresh day plan">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Plan items */}
      <div className="px-4 py-2 space-y-0.5">
        {plan.plan.map((item: DayPlanData['plan'][0], i: number) => {
          // Resolve the model-supplied id to a live task. When matched, the row
          // gets a working checkbox + opens details on tap; otherwise it stays
          // read-only (model may reference a non-existent / stale id).
          const task = item.id ? taskById.get(item.id) : undefined
          const isDone = task?.status === 'done'
          const showDuration = hasDuration(item.suggested_duration)

          return (
            <div
              key={item.id || i}
              className="flex items-start gap-2.5 py-2.5 border-b border-slate-200 dark:border-slate-700/50 last:border-0"
            >
              {/* Checkbox when matched to a real task, else the step number */}
              {task && onComplete ? (
                <CheckCircle status={task.status} onToggle={() => onComplete(task.id)} />
              ) : (
                <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[0.6875rem] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
              )}

              {/* Content — tappable to open the real task when matched */}
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  disabled={!task || !onTaskClick}
                  onClick={() => task && onTaskClick?.(task)}
                  className="text-left disabled:cursor-default"
                >
                  <div className={`text-[0.8125rem] font-medium ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                    {item.title}
                  </div>
                  <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400 mt-0.5">
                    {item.rationale}
                  </div>
                </button>

                {/* Batch hint — pill button with own hit target */}
                {item.batch_hint && (
                  <span className="inline-block mt-1.5 text-[0.6875rem] font-medium text-[var(--color-brief-batch)] bg-[var(--color-brief-batch-soft)] border border-[var(--color-brief-batch-border)] rounded-full px-2.5 py-0.5 min-h-[28px] flex items-center">
                    {item.batch_hint}
                  </span>
                )}
              </div>

              {/* Duration badge — only when there's a real estimate */}
              {showDuration && (
                <span className="text-[0.6875rem] text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {item.suggested_duration}
                </span>
              )}

              {/* Due date — far right, only for matched tasks */}
              {task?.due_date && (
                <span className="text-[0.6875rem] text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5 font-medium tabular-nums">
                  {parseLocalDate(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer with pacing + energy tip */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <p className="text-[0.75rem] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
          <span>{plan.pacing}</span>
        </p>
        <div className="flex items-start gap-1.5 text-[0.75rem] text-amber-600 dark:text-amber-400">
          <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{plan.energy_tip}</span>
        </div>

        {/* ── Re-plan button ───────────────────────────────── */}
        {onReplan && (() => {
          const openCount = (tasks ?? []).filter(t => t.status !== 'done').length
          if (openCount === 0) return null

          return (
            <div className="pt-1">
              <button
                onClick={onReplan}
                disabled={replanning || offline}
                className="w-full py-2.5 rounded-lg text-[0.8125rem] font-medium transition-all min-h-[44px]
                  bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white
                  disabled:opacity-50 disabled:active:scale-100"
              >
                {replanning ? 'Planning…' : 'Plan again'}
              </button>
              {offline && !replanning && (
                <p className="text-[0.6875rem] text-slate-400 dark:text-slate-500 text-center mt-1">
                  Re-planning needs a connection
                </p>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
