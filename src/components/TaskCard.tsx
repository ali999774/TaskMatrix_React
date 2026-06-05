import { useRef } from 'react'
import type { Task } from '../types'

interface Props {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onClick: (task: Task) => void
}

const STATUS_ICONS: Record<string, string> = {
  todo: '○',
  in_progress: '◐',
  done: '●',
}

export default function TaskCard({ task, onStatusChange, onDelete, onClick }: Props) {
  const dragged = useRef(false)

  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next: Record<string, string> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
    onStatusChange(task.id, next[task.status] || 'todo')
  }

  const handleDragStart = (e: React.DragEvent) => {
    dragged.current = true
    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.effectAllowed = 'move'
    ;(e.currentTarget as HTMLElement).classList.add('opacity-40')
  }

  const handleDragEnd = (e: React.DragEvent) => {
    ;(e.currentTarget as HTMLElement).classList.remove('opacity-40')
    // Reset after a tick so click handler sees it
    setTimeout(() => { dragged.current = false }, 0)
  }

  const handleClick = () => {
    if (dragged.current) return
    onClick(task)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(task.id)
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className={`p-3 rounded-lg border border-slate-200 dark:border-slate-700 
        bg-slate-50 dark:bg-slate-800/60 transition-all 
        hover:border-slate-400 dark:hover:border-slate-500 group cursor-grab active:cursor-grabbing
        ${task.status === 'done' ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={cycleStatus}
          className={`mt-0.5 text-lg flex-shrink-0 transition-colors
            ${task.status === 'done' ? 'text-emerald-500 dark:text-emerald-400' 
              : task.status === 'in_progress' ? 'text-amber-500 dark:text-amber-400' 
              : 'text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300'}`}
          title={`Status: ${task.status}`}
        >
          {STATUS_ICONS[task.status] || '○'}
        </button>
        <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
          {task.title}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <span className="text-xs text-slate-400 dark:text-slate-600" title={`Importance: ${task.importance}/5 · Urgency: ${task.urgency}/5`}>
            I{task.importance}U{task.urgency}
          </span>
          <button
            onClick={handleDelete}
            className="text-slate-300 dark:text-slate-500 hover:text-red-500 transition-colors text-xs px-1"
          >
            ✕
          </button>
        </div>
      </div>
      {task.notes && (
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-400 ml-7 line-clamp-2">{task.notes}</p>
      )}
      {(task.due_date || (task.subtasks && task.subtasks.length > 0)) && (
        <div className="mt-2 ml-7 flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          {task.due_date && (
            <span>
              📅 {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              {task.due_time && ` ${task.due_time}`}
            </span>
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <span>
              ✅ {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
