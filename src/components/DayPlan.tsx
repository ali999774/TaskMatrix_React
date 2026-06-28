// DayPlan — AI-sequenced action plan, expanded from MorningBrief

import { X, Zap, Clock, ArrowRight } from 'lucide-react'
import type { DayPlan as DayPlanData } from '../lib/ai-parse'

interface Props {
  plan: DayPlanData | null
  loading: boolean
  error: string | null
  onClose: () => void
}

export default function DayPlan({ plan, loading, error, onClose }: Props) {
  if (error) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[0.8125rem] text-amber-700 dark:text-amber-300">
        <button onClick={onClose} className="float-right p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-full min-h-[44px] min-w-[44px] inline-flex items-center justify-center" aria-label="Close">
          <X className="w-4 h-4" />
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
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full min-h-[44px] min-w-[44px] inline-flex items-center justify-center" aria-label="Close">
            <X className="w-4 h-4 text-slate-400" />
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
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-[0.875rem] font-semibold text-slate-700 dark:text-slate-200">📋 Your Day Plan</span>
          <span className="text-[0.6875rem] text-slate-400">{plan.total_estimated}</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full min-h-[44px] min-w-[44px] inline-flex items-center justify-center" aria-label="Close">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Plan items */}
      <div className="px-4 py-2 space-y-0.5">
        {plan.plan.map((item: DayPlanData['plan'][0], i: number) => (
          <div
            key={item.id || i}
            className="flex items-start gap-3 py-2.5 border-b border-slate-50 dark:border-slate-800/50 last:border-0"
          >
            {/* Number */}
            <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[0.6875rem] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="text-[0.8125rem] font-medium text-slate-800 dark:text-slate-100">
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
            </div>

            {/* Duration */}
            <span className="text-[0.6875rem] text-slate-400 flex items-center gap-1 flex-shrink-0">
              <Clock className="w-3 h-3" />
              {item.suggested_duration}
            </span>
          </div>
        ))}
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
