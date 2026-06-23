import type { Task } from '../types'
import { parseLocalDate, localTodayStr } from '../lib/dates'

interface Props {
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

export default function TodayStrip({ tasks, onTaskClick }: Props) {
  // Local date string — toISOString() converts to UTC and can shift the day
  const todayStr = localTodayStr()

  // Status value is 'done' (see TaskCard cycle), not 'completed' — the old
  // check matched nothing, so finished tasks never left the strips.
  const overdue = tasks.filter((t) => {
    if (!t.due_date || t.status === 'done') return false
    return t.due_date < todayStr
  })

  const dueToday = tasks.filter((t) => {
    if (!t.due_date || t.status === 'done') return false
    return t.due_date === todayStr
  })

  if (overdue.length === 0 && dueToday.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {overdue.length > 0 && (
        <div>
          <div className="text-[0.75rem] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wider mb-1.5 px-1">
            ⚠ Overdue ({overdue.length})
          </div>
          <div className="space-y-1">
            {overdue.slice(0, 5).map((task) => (
              <button
                key={task.id}
                aria-label={`Task: ${task.title}`}
                onClick={() => onTaskClick(task)}
                className="w-full text-left px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30
                  border border-red-200 dark:border-red-800/40 text-[0.875rem] text-slate-700
                  dark:text-slate-300 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors min-h-[44px]"
              >
                <span className="font-medium" aria-hidden="true">{task.title}</span>
                <span className="ml-2 text-[0.75rem] text-red-400 dark:text-red-500" aria-hidden="true">
                  {task.due_date && parseLocalDate(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </button>
            ))}
            {overdue.length > 5 && (
              <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 px-1">
                +{overdue.length - 5} more overdue
              </p>
            )}
          </div>
        </div>
      )}

      {dueToday.length > 0 && (
        <div>
          <div className="text-[0.75rem] font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-wider mb-1.5 px-1">
            📅 Today ({dueToday.length})
          </div>
          <div className="space-y-1">
            {dueToday.slice(0, 5).map((task) => (
              <button
                key={task.id}
                aria-label={`Task: ${task.title}`}
                onClick={() => onTaskClick(task)}
                className="w-full text-left px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30
                  border border-amber-200 dark:border-amber-800/40 text-[0.875rem] text-slate-700
                  dark:text-slate-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors min-h-[44px]"
              >
                <span className="font-medium" aria-hidden="true">{task.title}</span>
              </button>
            ))}
            {dueToday.length > 5 && (
              <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 px-1">
                +{dueToday.length - 5} more due today
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
