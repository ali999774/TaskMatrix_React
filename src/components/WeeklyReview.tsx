shell-init: error retrieving current directory: getcwd: cannot access parent directories: Operation not permitted
chdir: error retrieving current directory: getcwd: cannot access parent directories: Operation not permitted
shell-init: error retrieving current directory: getcwd: cannot access parent directories: Operation not permitted
chdir: error retrieving current directory: getcwd: cannot access parent directories: Operation not permitted
// WeeklyReview — end-of-week AI reflection with stats, patterns, and guidance

import { X, Trophy, TrendingUp, Lightbulb, AlertTriangle, Sparkles, BarChart3 } from 'lucide-react'
import type { WeeklyReview as WeeklyReviewData } from '../lib/ai-parse'

interface Props {
  review: WeeklyReviewData | null
  loading: boolean
  error: string | null
  onClose: () => void
}

export default function WeeklyReview({ review, loading, error, onClose }: Props) {
  if (error) {
    return (
      <div className="mx-3 mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[0.8125rem] text-amber-700 dark:text-amber-300">
        <button onClick={onClose} className="float-right p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-full min-h-[44px] min-w-[44px] inline-flex items-center justify-center" aria-label="Close">
          <X className="w-4 h-4" />
        </button>
        <p className="font-semibold mb-1">Couldn't load weekly review</p>
        <p className="text-amber-600 dark:text-amber-400">{error}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-3 mb-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-[0.8125rem] animate-pulse">
          <Sparkles className="w-4 h-4" />
          <span>Reviewing your week…</span>
        </div>
      </div>
    )
  }

  if (!review) return null

  return (
    <div className="mx-3 mb-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
        <span className="text-[0.875rem] font-semibold text-slate-700 dark:text-slate-200"><BarChart3 className="w-4 h-4 inline mr-1.5 -mt-0.5" />Weekly Review</span>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full min-h-[44px] min-w-[44px] inline-flex items-center justify-center" aria-label="Close">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Summary */}
        <p className="text-[0.8125rem] text-slate-600 dark:text-slate-400 leading-relaxed">
          {review.summary}
        </p>

        {/* Stats row */}
        {review.stats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
              <div className="text-[1.125rem] font-bold text-green-600 dark:text-green-400">{review.stats.completed}</div>
              <div className="text-[0.625rem] text-green-500 dark:text-green-500">completed</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <div className="text-[1.125rem] font-bold text-blue-600 dark:text-blue-400">{Math.round(review.stats.completion_rate)}%</div>
              <div className="text-[0.625rem] text-blue-500 dark:text-blue-500">completion</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <div className="text-[1.125rem] font-bold text-purple-600 dark:text-purple-400">{review.stats.best_day}</div>
              <div className="text-[0.625rem] text-purple-500 dark:text-purple-500">best day</div>
            </div>
          </div>
        )}

        {/* Wins */}
        {review.wins.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[0.75rem] text-green-600 dark:text-green-400 font-medium">
              <Trophy className="w-3.5 h-3.5" />
              Wins
            </div>
            {review.wins.map((w: string, i: number) => (
              <div key={i} className="text-[0.8125rem] text-slate-700 dark:text-slate-300 pl-5">
                • {w}
              </div>
            ))}
          </div>
        )}

        {/* Patterns */}
        {review.patterns.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[0.75rem] text-blue-600 dark:text-blue-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              Patterns
            </div>
            {review.patterns.map((p: string, i: number) => (
              <div key={i} className="text-[0.8125rem] text-slate-700 dark:text-slate-300 pl-5">
                • {p}
              </div>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {review.suggestions.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[0.75rem] text-amber-600 dark:text-amber-400 font-medium">
              <Lightbulb className="w-3.5 h-3.5" />
              For next week
            </div>
            {review.suggestions.map((s: string, i: number) => (
              <div key={i} className="text-[0.8125rem] text-slate-700 dark:text-slate-300 pl-5">
                • {s}
              </div>
            ))}
          </div>
        )}

        {/* Stale tasks */}
        {review.stale_tasks.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[0.75rem] text-red-500 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              Needs attention
            </div>
            {review.stale_tasks.map((t: { title: string; id: string; days_stale: number }) => (
              <div key={t.id} className="text-[0.8125rem] text-slate-700 dark:text-slate-300 pl-5">
                • {t.title}
                <span className="text-[0.6875rem] text-slate-400 ml-1">({t.days_stale}d untouched)</span>
              </div>
            ))}
          </div>
        )}

        {/* Mood closer */}
        <p className="text-[0.8125rem] text-slate-500 dark:text-slate-400 italic text-center pt-1">
          {review.mood}
        </p>
      </div>
    </div>
  )
}
