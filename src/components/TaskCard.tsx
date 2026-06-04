import type { Task } from '../types'

interface Props {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
}

const STATUS_ICONS: Record<string, string> = {
  todo: '○',
  in_progress: '◐',
  done: '●',
}

export default function TaskCard({ task, onStatusChange, onDelete }: Props) {
  const cycleStatus = () => {
    const next: Record<string, string> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
    onStatusChange(task.id, next[task.status] || 'todo')
  }

  return (
    <div
      className={`p-3 rounded-lg border border-slate-700 bg-slate-800/60 
        transition-all hover:border-slate-500 group
        ${task.status === 'done' ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={cycleStatus}
          className={`mt-0.5 text-lg flex-shrink-0 transition-colors
            ${task.status === 'done' ? 'text-emerald-400' : task.status === 'in_progress' ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
          title={`Status: ${task.status}`}
        >
          {STATUS_ICONS[task.status] || '○'}
        </button>
        <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-200'}`}>
          {task.title}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <span className="text-xs text-slate-600" title={`Importance: ${task.importance}/5 · Urgency: ${task.urgency}/5`}>
            I{task.importance}U{task.urgency}
          </span>
          <button
            onClick={() => onDelete(task.id)}
            className="text-slate-500 hover:text-red-400 transition-colors text-xs px-1"
          >
            ✕
          </button>
        </div>
      </div>
      {task.notes && (
        <p className="mt-2 text-xs text-slate-400 ml-7">{task.notes}</p>
      )}
      {task.due_date && (
        <p className="mt-1 text-xs text-slate-500 ml-7">
          Due: {new Date(task.due_date).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}
