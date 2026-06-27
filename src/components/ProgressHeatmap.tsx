import { useMemo } from 'react'
import type { Task } from '../types'

// Generate last 12 weeks of dates (Mon-Sun weeks)
function getWeeks(count: number): Date[][] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Find last Sunday
  const lastSunday = new Date(today)
  lastSunday.setDate(today.getDate() - today.getDay())
  // Go back count-1 weeks
  const start = new Date(lastSunday)
  start.setDate(lastSunday.getDate() - (count - 1) * 7)

  const weeks: Date[][] = []
  const current = new Date(start)
  for (let w = 0; w < count; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatShortDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

interface Props {
  tasks: Task[]
}

const CELL_SIZE = 12

export default function ProgressHeatmap({ tasks }: Props) {
  const { weeks, colorMap, totalDone, maxCount } = useMemo(() => {
    const weeks = getWeeks(12)

    // Count done tasks per day
    const counts: Record<string, number> = {}
    for (const t of tasks) {
      if (t.status === 'done' && t.completed_at) {
        const d = new Date(t.completed_at)
        const key = dateKey(d)
        counts[key] = (counts[key] || 0) + 1
      }
    }

    const map: Record<string, number> = {}
    let total = 0
    let max = 0
    for (const week of weeks) {
      for (const day of week) {
        const key = dateKey(day)
        const count = counts[key] || 0
        map[key] = count
        total += count
        if (count > max) max = count
      }
    }

    return { weeks, colorMap: map, totalDone: total, maxCount: max }
  }, [tasks])

  const getColor = (count: number): string => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800/50'
    const intensity = Math.min(count / Math.max(maxCount, 1), 1)
    if (intensity <= 0.25) return 'bg-emerald-200 dark:bg-emerald-900/40'
    if (intensity <= 0.5) return 'bg-emerald-300 dark:bg-emerald-800/60'
    if (intensity <= 0.75) return 'bg-emerald-400 dark:bg-emerald-700/80'
    return 'bg-emerald-500 dark:bg-emerald-600'
  }

  const today = new Date()
  const todayKey = dateKey(today)

  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Activity
        </h3>
        <span className="text-[0.75rem] text-slate-400 dark:text-slate-500">
          {totalDone} tasks · 12 weeks
        </span>
      </div>
      <div className="flex gap-1">
        {/* Day labels (left) */}
        <div className="flex flex-col gap-[3px] mr-1 pt-[3px]">
          {['', 'M', '', 'W', '', 'F', ''].map((l, i) => (
            <span
              key={i}
              className="text-[0.5rem] text-slate-300 dark:text-slate-600 w-4 h-3 flex items-center"
              aria-hidden="true"
            >
              {l}
            </span>
          ))}
        </div>
        {/* Weeks grid */}
        <div className="flex gap-[3px] overflow-x-auto">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => {
                const key = dateKey(day)
                const count = colorMap[key] || 0
                const isToday = key === todayKey
                const isFuture = day > today
                return (
                  <div
                    key={key}
                    title={count > 0 ? `${count} task${count > 1 ? 's' : ''} on ${formatShortDate(day)}` : formatShortDate(day)}
                    className={`rounded-sm transition-colors ${
                      isFuture
                        ? 'bg-transparent'
                        : getColor(count)
                    } ${isToday ? 'ring-1 ring-slate-400 dark:ring-slate-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''}`}
                    style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    aria-label={isFuture ? undefined : `${count} task${count !== 1 ? 's' : ''} on ${formatShortDate(day)}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 justify-end">
        <span className="text-[0.5rem] text-slate-300 dark:text-slate-600">Less</span>
        <div className={`w-3 h-3 rounded-sm ${getColor(0)}`} />
        <div className={`w-3 h-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/40`} />
        <div className={`w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-800/60`} />
        <div className={`w-3 h-3 rounded-sm bg-emerald-400 dark:bg-emerald-700/80`} />
        <div className={`w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-600`} />
        <span className="text-[0.5rem] text-slate-300 dark:text-slate-600">More</span>
      </div>
    </div>
  )
}
