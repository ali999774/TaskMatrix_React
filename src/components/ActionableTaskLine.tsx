import type { Task } from '../types'
import CheckCircle from './matrix/CheckCircle'
import { parseLocalDate } from '../lib/dates'

interface Props {
  task: Task
  onComplete: (id: string) => void
  onClick: (task: Task) => void
}

/**
 * Compact, completable task row for prose-first surfaces (Morning Brief).
 * Real CheckCircle (working completion) + tap-to-open — tied to a live task id,
 * so a task seen here can always be acted on.
 */
export default function ActionableTaskLine({ task, onComplete, onClick }: Props) {
  const isDone = task.status === 'done'
  return (
    <div className="flex items-center gap-1.5">
      <CheckCircle status={task.status} onToggle={() => onComplete(task.id)} />
      <button
        type="button"
        onClick={() => onClick(task)}
        className="flex-1 min-w-0 text-left py-1"
        aria-label={`Open ${task.title}`}
      >
        <span className={`text-[0.8125rem] font-medium ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
          {task.title}
        </span>
        {task.due_date && (
          <span className="ml-2 text-[0.6875rem] text-slate-400 dark:text-slate-500">
            {parseLocalDate(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </button>
    </div>
  )
}
