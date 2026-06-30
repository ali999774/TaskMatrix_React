// MorningBrief — judgment-first daily triage
// Rendered inside BottomSheet; compact by design — read in 15 seconds.
//
// v3: consumes structured card output (headline/support/kind) from edge function.
// No prose splitting — the model carries structure from generation to render.

import { Sparkles, AlertTriangle, Target, Shield, Layers, Zap, FileText, ClipboardList, RefreshCw } from 'lucide-react'
import type { MorningBrief as MorningBriefData, BriefCard } from '../lib/ai-parse'
import type { Task } from '../types'
import type { CategoryDef } from '../lib/categories'
import { getCategoryDef, CATEGORY_COLOR_HEX } from '../lib/categories'
import { localTodayStr } from '../lib/dates'
import { isInTodayView, isInUpcomingView } from '../lib/visibility'
import ActionableTaskLine from './ActionableTaskLine'
import type { LucideIcon } from 'lucide-react'

interface Props {
  brief: MorningBriefData | null
  loading: boolean
  error: string | null
  collapsed?: boolean
  onToggle?: () => void
  onDismiss: () => void
  onPlanDay: () => void
  onRetry: () => void
  tasks?: Task[]
  onComplete?: (id: string) => void
  onTaskClick?: (task: Task) => void
  categories?: CategoryDef[]
}

const iconClass = 'w-4 h-4 flex-shrink-0 mt-0.5'

/** Map card kind → visual treatment */
const cardConfig: Record<BriefCard['kind'], {
  icon: LucideIcon
  cardClass: string
  iconClass: string
  iconBg: string
}> = {
  priority: {
    icon: Target,
    cardClass: 'bg-[var(--color-brief-urgent-soft)] border-[var(--color-brief-urgent-border)]',
    iconClass: 'text-[var(--color-brief-urgent)]',
    iconBg: 'bg-[var(--color-brief-urgent)]/10',
  },
  protect: {
    icon: Shield,
    cardClass: 'bg-[var(--color-brief-protect-soft)] border-[var(--color-brief-protect-border)]',
    iconClass: 'text-[var(--color-brief-protect)]',
    iconBg: 'bg-[var(--color-brief-protect)]/10',
  },
  batch: {
    icon: Layers,
    cardClass: 'bg-[var(--color-brief-batch-soft)] border-[var(--color-brief-batch-border)]',
    iconClass: 'text-[var(--color-brief-batch)]',
    iconBg: 'bg-[var(--color-brief-batch)]/10',
  },
  quickwin: {
    icon: Zap,
    cardClass: 'bg-[var(--color-brief-quickwin-soft)] border-[var(--color-brief-quickwin-border)]',
    iconClass: 'text-[var(--color-brief-quickwin)]',
    iconBg: 'bg-[var(--color-brief-quickwin)]/10',
  },
  admin: {
    icon: FileText,
    cardClass: 'bg-[var(--color-brief-admin-soft)] border-[var(--color-brief-admin-border)]',
    iconClass: 'text-[var(--color-brief-admin)]',
    iconBg: 'bg-[var(--color-brief-admin)]/10',
  },
}

function InsightCard({ card }: { card: BriefCard }) {
  const cfg = cardConfig[card.kind]
  if (!cfg) return null
  const IconComponent = cfg.icon
  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.cardClass}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
        <IconComponent className={`w-4 h-4 ${cfg.iconClass}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-semibold text-slate-800 dark:text-slate-100">{card.headline}</p>
        <p className="text-[0.75rem] text-slate-500 dark:text-slate-400 mt-0.5">{card.support}</p>
      </div>
    </div>
  )
}

export default function MorningBrief({ brief, loading, error, collapsed: _c, onToggle: _t, onDismiss: _d, onPlanDay, onRetry, tasks, onComplete, onTaskClick, categories }: Props) {
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
          className="text-[0.75rem] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 px-3 py-1.5 rounded-lg transition-colors min-h-[44px] flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
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

  const todayStr = localTodayStr()
  const actionable =
    tasks && onComplete && onTaskClick
      ? tasks
          .filter((t) => t.status !== 'done' && (isInTodayView(t, todayStr) || isInUpcomingView(t, todayStr)))
          .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
      : []

  // Group actionable tasks by category
  const groups = new Map<string, Task[]>()
  const groupOrder: string[] = []
  for (const t of actionable) {
    const catLabel = t.category || '__none__'
    if (!groups.has(catLabel)) {
      groups.set(catLabel, [])
      groupOrder.push(catLabel)
    }
    groups.get(catLabel)!.push(t)
  }

  return (
    <div className="flex flex-col">
      {/* Title + date */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-start gap-2">
          <Sparkles className={`${iconClass} text-blue-500`} />
          <div>
            <p className="text-[0.9375rem] font-semibold text-slate-800 dark:text-slate-100 leading-snug">
              {brief.title}
            </p>
            <p className="text-[0.6875rem] text-slate-400 dark:text-slate-500 mt-0.5">
              {brief.date_label}
            </p>
          </div>
        </div>
      </div>

      {/* Insight cards */}
      <div className="px-4 pb-4 space-y-2.5">
        {brief.cards.map((card, i) => (
          <InsightCard key={`${card.kind}-${i}`} card={card} />
        ))}
      </div>

      {/* Actionable tasks — grouped by category */}
      {actionable.length > 0 && onComplete && onTaskClick && (
        <div className="px-4 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 mt-2">
            Act now
          </p>

          {groupOrder.map((catLabel) => {
            const catTasks = groups.get(catLabel)!
            const catDef = catLabel !== '__none__' ? getCategoryDef(categories ?? [], catLabel) : undefined
            const display = catDef?.display ?? 'Uncategorized'
            const dotColor = catDef?.color && CATEGORY_COLOR_HEX[catDef.color]
              ? CATEGORY_COLOR_HEX[catDef.color]
              : '#94a3b8'

            return (
              <div key={catLabel} className="mb-2 last:mb-0">
                <div className="flex items-center gap-1.5 mb-1 mt-2 first:mt-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dotColor }}
                    aria-hidden="true"
                  />
                  <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {display}
                  </span>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {catTasks.map((task) => (
                    <ActionableTaskLine
                      key={task.id}
                      task={task}
                      onComplete={onComplete}
                      onClick={onTaskClick}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Action button */}
      <div className="px-4 pb-4 pt-0">
        <button
          onClick={onPlanDay}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg text-[0.8125rem] font-medium transition-all min-h-[44px] flex items-center justify-center gap-1.5"
        >
          <ClipboardList className="w-4 h-4" />
          Plan my day
        </button>
      </div>
    </div>
  )
}
