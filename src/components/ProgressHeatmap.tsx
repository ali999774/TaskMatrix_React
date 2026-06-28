import { useMemo, useState, useEffect } from 'react'
import type { Task } from '../types'
import { supabase } from '../lib/supabase'

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

// Extract YYYY-MM-DD from an ISO string or date string, returning local midnight Date
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  return new Date(y, m - 1, d)
}

interface Props {
  userId: string | null
  tasks: Task[]
}

export default function ProgressHeatmap({ userId, tasks }: Props) {
  const [historicalData, setHistoricalData] = useState<Record<string, { created_at?: string, completed_at?: string | null }>>({})

  // Fetch all task creation/completion timestamps to ensure historical done tasks are included,
  // since the parent tasks array only contains active (todo) tasks.
  useEffect(() => {
    if (!userId) {
      setHistoricalData({})
      return
    }
    supabase
      .from('tasks')
      .select('id, created_at, completed_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, { created_at?: string, completed_at?: string | null }> = {}
          data.forEach(t => map[t.id] = t)
          setHistoricalData(map)
        }
      })
  }, [userId])

  const { weeks, colorMap, activeDaysLast7, bestStreak, hasHistory } = useMemo(() => {
    const weeks = getWeeks(12)
    const counts: Record<string, number> = {}

    const allTasks = { ...historicalData }
    // Overlay current active tasks to ensure immediate UI updates (optimistic sync)
    for (const t of tasks) {
      allTasks[t.id] = t
    }

    // A day is "active" if a task was created or completed on that day.
    for (const t of Object.values(allTasks)) {
      if (t.created_at) {
        const key = dateKey(parseLocalDate(t.created_at))
        counts[key] = (counts[key] || 0) + 1
      }
      if (t.completed_at) {
        const key = dateKey(parseLocalDate(t.completed_at))
        counts[key] = (counts[key] || 0) + 1
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Compute Active days in last 7 days (rolling window)
    let activeDays7 = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      if (counts[dateKey(d)] > 0) activeDays7++
    }

    // Compute best streak of all time
    const activeDates = Object.keys(counts).sort()
    let calculatedBest = 0
    let tempStreak = 0
    let lastDate: Date | null = null

    for (const dateStr of activeDates) {
      const d = parseLocalDate(dateStr)
      if (!lastDate) {
        tempStreak = 1
      } else {
        const diffDays = Math.round((d.getTime() - lastDate.getTime()) / 86400000)
        if (diffDays === 1) {
          tempStreak++
        } else if (diffDays > 1) {
          tempStreak = 1
        }
      }
      if (tempStreak > calculatedBest) calculatedBest = tempStreak
      lastDate = d
    }

    // 1-day grace period for current streak:
    // If the streak was active yesterday but not today (yet), it's still alive in `tempStreak`.
    // We just want to make sure the best streak is recorded properly.
    const storedBest = parseInt(localStorage.getItem('tm_best_streak') || '0', 10)
    const finalBest = Math.max(calculatedBest, storedBest)
    if (finalBest > storedBest) {
      localStorage.setItem('tm_best_streak', finalBest.toString())
    }

    // For the 12-week grid rendering
    const map: Record<string, number> = {}
    for (const week of weeks) {
      for (const day of week) {
        const key = dateKey(day)
        map[key] = counts[key] || 0
      }
    }

    return { 
      weeks, 
      colorMap: map, 
      activeDaysLast7: activeDays7, 
      bestStreak: finalBest,
      hasHistory: activeDates.length > 0
    }
  }, [tasks, historicalData])

  const getColor = (count: number, isFuture: boolean): string => {
    if (isFuture) return 'bg-transparent'
    // Neutral warm past (no negative connotation)
    if (count === 0) return 'bg-slate-200/70 dark:bg-slate-700/40'
    // 3-level presence intensity
    if (count <= 2) return 'bg-emerald-300 dark:bg-emerald-700'
    if (count <= 5) return 'bg-emerald-400 dark:bg-emerald-600'
    return 'bg-emerald-500 dark:bg-emerald-500'
  }

  const today = new Date()
  const todayKey = dateKey(today)

  // Empty state for brand new users
  if (!hasHistory) {
    return (
      <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-6 flex items-center justify-center text-center">
        <p className="text-[0.875rem] text-slate-400 dark:text-slate-500 font-medium">
          Your progress fills in here as you go ✨
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          Activity
        </h3>
        <span className="text-[0.75rem] text-slate-400 dark:text-slate-500 font-medium">
          Active {activeDaysLast7} of last 7 days
          {bestStreak > 0 && <span className="hidden sm:inline"> · Best streak: {bestStreak}</span>}
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
                
                const titleText = count > 0 
                  ? `You showed up on ${formatShortDate(day)}` 
                  : formatShortDate(day)
                
                const ariaLabel = isFuture 
                  ? undefined 
                  : (count > 0 ? `Active on ${formatShortDate(day)}` : `${formatShortDate(day)}, not active`)

                return (
                  <div
                    key={key}
                    title={titleText}
                    className={`rounded-sm transition-colors w-[12px] h-[12px] sm:w-[15px] sm:h-[15px] ${getColor(count, isFuture)} ${isToday ? 'ring-1 ring-slate-400 dark:ring-slate-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''}`}
                    aria-label={ariaLabel}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-end">
        <div className="flex items-center gap-[3px]">
          <div className={`w-3 h-3 rounded-sm ${getColor(1, false)}`} />
          <div className={`w-3 h-3 rounded-sm ${getColor(3, false)}`} />
          <div className={`w-3 h-3 rounded-sm ${getColor(6, false)}`} />
        </div>
        <span className="text-[0.625rem] text-slate-400 dark:text-slate-500">
          ● = a day you showed up
        </span>
      </div>
    </div>
  )
}
