// DayPlan — AI-sequenced action plan, expanded from MorningBrief

import { Zap, Clock, ArrowRight, RefreshCw } from 'lucide-react'
import type { DayPlan as DayPlanData } from '../lib/ai-parse'
import type { Task } from '../types'
import CheckCircle from './matrix/CheckCircle'

interface Props {
  plan: DayPlanData | null
  loading: boolean
  error: string | null
  onClose: () => void
  onRefresh?: () => void
  // Real tasks, so each plan line can resolve its id to a live task and become
  // actionable (complete / open) instead of read-only prose.
  tasks?: Task[]
  onComplete?: (id: string) => void
  onTaskClick?: (task: Task) => void
}

export default function DayPlan({ plan, loading, error, onClose, onRefresh, tasks, onComplete, onTaskClick }: Props) {
  const taskById = new Map((tasks ?? []).map((t) => [t.id, t]))
  if (error) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[0.8125rem] text-amber-700 dark:text-amber-300">
        <button onClick={onClose} className="float-right w-9 h-9 rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 hover:bg-amber-300 dark:hover:bg-amber-900/70 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]" aria-label="Back">
          <span aria-hidden="true" className="text-[1rem]">←</span>
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
          <span className="text-[0.875rem] font-semibold text-slate-700 dark:text-slate-200">📋 Your Day Plan</span>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]" aria-label="Back">
            <span aria-hidden="true" className="text-[1rem]">←</span>
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
          <span aria-hidden="true" className="text-[1rem]">←</span>
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[0.875rem] font-semibold text-slate-700 dark:text-slate-200">📋 Your Day Plan</span>
          <span className="text-[0.6875rem] text-slate-400">{plan.total_estimated}</span>
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
          return (
            <div
              key={item.id || i}
              className="flex items-start gap-2.5 py-2.5 border-b border-slate-50 dark:border-slate-800/50 last:border-0"
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
              <button
                type="button"
                disabled={!task || !onTaskClick}
                onClick={() => task && onTaskClick?.(task)}
                className="flex-1 min-w-0 text-left disabled:cursor-default"
              >
                <div className={`text-[0.8125rem] font-medium ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                  {item.title}
                </div>
                <div className="text-[0.6875rem] text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.rationale}
                </div>
                {item.batch_hint && (
                  <div className="mt-1 text-[0.6875rem] text-blue-600 dark:text-blue-400 italic">
                    {item.batch_hint}
                  </div>
                )}
              </button>

              {/* Duration */}
              <span className="text-[0.6875rem] text-slate-400 flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {item.suggested_duration}
              </span>
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
      </div>
    </div>
  )
}
