import { useRef } from 'react'
import type { Task } from '../types'
import { useHaptics } from '../hooks/useHaptics'

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

function dueLabel(dateStr: string): { text: string; urgent: boolean } {
  const due = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const diff = (due.getTime() - today.getTime()) / 86400000
  if (diff < 0) return { text: 'Overdue', urgent: true }
  if (diff === 0) return { text: 'Today', urgent: true }
  if (diff <= 7) return { text: 'This Week', urgent: false }
  return { text: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), urgent: false }
}

export default function TaskCard({ task, onStatusChange, onDelete, onClick }: Props) {
  const dragged = useRef(false)
  const haptics = useHaptics()

  const cycleStatus = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next: Record<string, string> = { todo: 'in_progress', in_progress: 'done', done: 'todo' }
    const newStatus = next[task.status] || 'todo'
    onStatusChange(task.id, newStatus)
    if (newStatus === 'done') haptics('success')
    else haptics('light')
  }

  const handleDragStart = (e: React.DragEvent) => {
    dragged.current = true
    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.effectAllowed = 'move'
    ;(e.currentTarget as HTMLElement).classList.add('opacity-40')
  }

  const handleDragEnd = (e: React.DragEvent) => {
    ;(e.currentTarget as HTMLElement).classList.remove('opacity-40')
    setTimeout(() => { dragged.current = false }, 0)
  }

  const handleClick = () => {
    if (dragged.current) return
    onClick(task)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    haptics('medium')
    onDelete(task.id)
  }

  const dueInfo = task.due_date ? dueLabel(task.due_date) : null

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className={`p-3 rounded-lg border border-slate-200 dark:border-slate-700 
        bg-white dark:bg-slate-800/60 transition-all 
        hover:border-slate-400 dark:hover:border-slate-500 group cursor-grab active:cursor-grabbing
        ${task.status === 'done' ? 'opacity-50' : ''}
        ${task.category === 'clinic' ? 'border-l-4 border-l-red-400' : 
          task.category === 'practice-launch' ? 'border-l-4 border-l-amber-400' :
          task.category === 'dev' ? 'border-l-4 border-l-blue-400' :
          task.category === 'personal' ? 'border-l-4 border-l-emerald-400' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={cycleStatus}
          className={`mt-0.5 text-lg flex-shrink-0 transition-colors active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center
            ${task.status === 'done' ? 'text-emerald-500 dark:text-emerald-400' 
              : task.status === 'in_progress' ? 'text-amber-500 dark:text-amber-400' 
              : 'text-slate-300 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300'}`}
          title={`Status: ${task.status}`}
          aria-label={`Cycle status: ${task.status}`}
        >
          {STATUS_ICONS[task.status] || '○'}
        </button>
        <div className="flex-1 min-w-0">
          <span className={`text-sm ${task.status === 'done' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
            {task.title}
          </span>
          {(task.category || dueInfo) && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {task.category && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                  ${task.category === 'clinic' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' :
                    task.category === 'practice-launch' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' :
                    task.category === 'dev' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400' :
                    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'}`}
                >
                  {task.category === 'practice-launch' ? 'Launch' : task.category.charAt(0).toUpperCase() + task.category.slice(1)}
                </span>
              )}
              {dueInfo && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                  ${dueInfo.urgent 
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' 
                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'}`}
                >
                  {dueInfo.urgent ? '⚠ ' : ''}{dueInfo.text}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] text-slate-400 dark:text-slate-600" title={`Importance: ${task.importance}/5 · Urgency: ${task.urgency}/5`}>
            I{task.importance}U{task.urgency}
          </span>
          <button
            onClick={handleDelete}
            className="text-slate-300 dark:text-slate-500 hover:text-red-500 transition-colors text-xs px-1.5 py-1 active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            aria-label="Delete task"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
