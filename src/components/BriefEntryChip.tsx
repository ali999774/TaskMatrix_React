// BriefEntryChip — slim tappable row above the task matrix
// Acts as the entry point for Morning Brief (on-demand summon, not auto-generate)

import { Sparkles, Loader2, AlertTriangle } from 'lucide-react'

interface Props {
  overdueCount: number | null   // null = no cache available yet
  dueTodayCount: number | null
  loading: boolean
  error: string | null
  onTap: () => void
}

export default function BriefEntryChip({ overdueCount, dueTodayCount, loading, error, onTap }: Props) {
  const hasCounts = overdueCount !== null && dueTodayCount !== null

  // Error state
  if (error) {
    return (
      <button
        onClick={onTap}
        className="w-full text-left flex items-center gap-1 px-1 mb-1.5
          hover:opacity-80 transition-opacity
          min-h-[44px]"
        aria-label="Morning brief unavailable — tap to retry"
      >
        <span aria-hidden="true" className="text-[0.75rem] font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Brief unavailable
          </span>
        </span>
        <span aria-hidden="true" className="text-[0.75rem] text-amber-400 dark:text-amber-500 ml-2">
          · Retry
        </span>
        <span aria-hidden="true" className="text-[0.625rem] text-amber-400 dark:text-amber-500 ml-auto">›</span>
      </button>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div
        className="w-full text-left flex items-center gap-1 px-1 mb-1.5
          min-h-[44px]"
        aria-label="Generating morning brief"
      >
        <span aria-hidden="true" className="text-[0.75rem] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
          <span className="inline-flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Generating…
          </span>
        </span>
      </div>
    )
  }

  // Idle state — always tappable
  return (
    <button
      onClick={onTap}
      className="w-full text-left flex items-center gap-1 px-1 mb-1.5
        hover:opacity-80 transition-opacity
        min-h-[44px]"
      aria-label="Open morning brief"
    >
      <span aria-hidden="true" className="text-[0.75rem] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wider">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Morning brief
        </span>
      </span>
      {hasCounts && (
        <span aria-hidden="true" className="text-[0.75rem] text-slate-400 dark:text-slate-500 ml-2">
          · {overdueCount} earlier · {dueTodayCount} today
        </span>
      )}
      <span aria-hidden="true" className="text-[0.625rem] text-slate-400 dark:text-slate-500 ml-auto">›</span>
    </button>
  )
}
