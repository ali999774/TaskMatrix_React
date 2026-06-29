// MorningBrief — judgment-first daily triage
// Rendered inside BottomSheet; compact by design — read in 15 seconds.

import { Sparkles, AlertTriangle, Target, Shield, Layers } from 'lucide-react'
import type { MorningBrief as MorningBriefData } from '../lib/ai-parse'

interface Props {
  brief: MorningBriefData | null
  loading: boolean
  error: string | null
  collapsed?: boolean          // unused in new design; kept for API compat
  onToggle?: () => void        // unused in new design
  onDismiss: () => void
  onPlanDay: () => void
  onRetry: () => void
}

const iconClass = 'w-4 h-4 flex-shrink-0 mt-0.5'

export default function MorningBrief({ brief, loading, error, collapsed: _c, onToggle: _t, onDismiss: _d, onPlanDay, onRetry }: Props) {
  if (error) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className={iconClass} />
          <div>
            <p className="font-semibold text-[0.875rem]">Couldn't load morning brief</p>
            <p className="text-[0.8125rem] text-amber-500 dark:text-amber-400 mt-0.5">{error}</p>
          </div>
        </div>
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
      <div className="p-4">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-[0.8125rem] animate-pulse">
          <Sparkles className="w-4 h-4" />
          <span>Preparing your morning brief…</span>
        </div>
      </div>
    )
  }

  if (!brief) return null

  return (
    <div className="flex flex-col">
      {/* Headline */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start gap-2">
          <Sparkles className={`${iconClass} text-blue-500`} />
          <p className="text-[0.9375rem] font-semibold text-slate-800 dark:text-slate-100 leading-snug">
            {brief.headline}
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Top priority */}
        <div className="flex items-start gap-2">
          <Target className={`${iconClass} text-red-500`} />
          <p className="text-[0.8125rem] text-slate-700 dark:text-slate-300 leading-relaxed">
            {brief.topPriority}
          </p>
        </div>

        {/* Protect (nullable) */}
        {brief.protect && (
          <div className="flex items-start gap-2">
            <Shield className={`${iconClass} text-emerald-500`} />
            <p className="text-[0.8125rem] text-slate-700 dark:text-slate-300 leading-relaxed">
              {brief.protect}
            </p>
          </div>
        )}

        {/* Batch (nullable) */}
        {brief.batch && (
          <div className="flex items-start gap-2">
            <Layers className={`${iconClass} text-amber-500`} />
            <p className="text-[0.8125rem] text-slate-700 dark:text-slate-300 leading-relaxed">
              {brief.batch}
            </p>
          </div>
        )}

        {/* Closer (nullable) */}
        {brief.closer && (
          <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 italic pt-1 border-t border-slate-100 dark:border-slate-800">
            {brief.closer}
          </p>
        )}
      </div>

      {/* Action button */}
      <div className="px-4 pb-4 pt-0">
        <button
          onClick={onPlanDay}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg text-[0.8125rem] font-medium transition-all min-h-[44px]"
        >
          📋 Plan my day
        </button>
      </div>
    </div>
  )
}
