import type { Task } from '../types'

interface Props {
  task: Task
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export default function TaskCard({ task, onToggle, onDelete }: Props) {
  return (
    <div
      className={`p-3 rounded-lg border border-slate-700 bg-slate-800/60 
        transition-all hover:border-slate-500 group
        ${task.completed ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={() => onToggle(task.id)}
          className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 
            flex items-center justify-center transition-colors
            ${task.completed
              ? 'bg-emerald-500 border-emerald-500 text-white'
              : 'border-slate-500 hover:border-slate-400'}`}
        >
          {task.completed && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className={`flex-1 text-sm ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>
          {task.title}
        </span>
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 text-slate-500 
            hover:text-red-400 transition-all text-xs px-1"
        >
          ✕
        </button>
      </div>
      {task.notes && (
        <p className="mt-2 text-xs text-slate-400 ml-7">{task.notes}</p>
      )}
    </div>
  )
}
