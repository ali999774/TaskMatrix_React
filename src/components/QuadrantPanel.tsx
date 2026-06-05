import type { Quadrant, Task } from '../types'
import { QUADRANT_LABELS, QUADRANT_DESCRIPTIONS } from '../types'
import TaskCard from './TaskCard'

interface Props {
  quadrant: Quadrant
  tasks: Task[]
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onAdd: (title: string, importance: number, urgency: number) => void
}

const QUADRANT_COLORS: Record<Quadrant, string> = {
  1: 'border-red-500/20 dark:border-red-500/30 bg-red-500/5',
  2: 'border-amber-500/20 dark:border-amber-500/30 bg-amber-500/5',
  3: 'border-blue-500/20 dark:border-blue-500/30 bg-blue-500/5',
  4: 'border-emerald-500/20 dark:border-emerald-500/30 bg-emerald-500/5',
}

const QUADRANT_HEADER_COLORS: Record<Quadrant, string> = {
  1: 'text-red-600 dark:text-red-400',
  2: 'text-amber-600 dark:text-amber-400',
  3: 'text-blue-600 dark:text-blue-400',
  4: 'text-emerald-600 dark:text-emerald-400',
}

const DEFAULT_VALUES: Record<Quadrant, { importance: number; urgency: number }> = {
  1: { importance: 5, urgency: 5 },
  2: { importance: 5, urgency: 2 },
  3: { importance: 2, urgency: 5 },
  4: { importance: 2, urgency: 2 },
}

export default function QuadrantPanel({ quadrant, tasks, onStatusChange, onDelete, onAdd }: Props) {
  const defaults = DEFAULT_VALUES[quadrant]

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      onAdd(e.currentTarget.value.trim(), defaults.importance, defaults.urgency)
      e.currentTarget.value = ''
    }
  }

  return (
    <div className={`rounded-xl border bg-white dark:bg-slate-950 ${QUADRANT_COLORS[quadrant]} p-4 flex flex-col min-h-[200px]`}>
      <div className="mb-3">
        <h3 className={`text-sm font-semibold ${QUADRANT_HEADER_COLORS[quadrant]}`}>
          {QUADRANT_LABELS[quadrant]}
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500">{QUADRANT_DESCRIPTIONS[quadrant]}</p>
      </div>

      <div className="flex-1 space-y-2 mb-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-xs text-slate-300 dark:text-slate-600 italic text-center py-4">Drop tasks here</p>
        )}
      </div>

      <input
        type="text"
        placeholder="+ Add task..."
        onKeyDown={handleKeyDown}
        className="w-full bg-slate-50 dark:bg-transparent border border-slate-200 dark:border-slate-700 
          rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 
          placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none 
          focus:border-slate-400 dark:focus:border-slate-500 transition-colors"
      />
    </div>
  )
}
