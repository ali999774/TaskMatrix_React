import { useState } from 'react'
import type { Quadrant, Task } from '../types'
import { QUADRANT_LABELS, QUADRANT_DESCRIPTIONS, QUADRANT_DEFAULTS } from '../types'
import TaskCard from './TaskCard'

interface Props {
  quadrant: Quadrant
  tasks: Task[]
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onAdd: (title: string, importance: number, urgency: number) => void
  onMove: (id: string, toQuadrant: Quadrant) => void
  onTaskClick: (task: Task) => void
  compact?: boolean
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

export default function QuadrantPanel({ quadrant, tasks, onStatusChange, onDelete, onAdd, onMove, onTaskClick, compact }: Props) {
  const defaults = QUADRANT_DEFAULTS[quadrant]
  const [dragOver, setDragOver] = useState(false)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      onAdd(e.currentTarget.value.trim(), defaults.importance, defaults.urgency)
      e.currentTarget.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as HTMLElement)) return
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const taskId = e.dataTransfer.getData('text/plain')
    if (taskId) onMove(taskId, quadrant)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-xl border bg-white dark:bg-slate-900/50 ${QUADRANT_COLORS[quadrant]} 
        p-3 flex flex-col min-h-[160px] transition-all duration-150
        ${dragOver ? 'ring-2 ring-slate-400 dark:ring-slate-500 scale-[1.02]' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className={`text-xs font-semibold ${QUADRANT_HEADER_COLORS[quadrant]}`}>
            {QUADRANT_LABELS[quadrant]}
          </h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{QUADRANT_DESCRIPTIONS[quadrant]}</p>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">{tasks.length}</span>
      </div>

      <div className="flex-1 space-y-1.5">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onClick={onTaskClick}
          />
        ))}
        {tasks.length === 0 && (
          <p className="text-[11px] text-slate-300 dark:text-slate-600 italic text-center py-3">
            {dragOver ? 'Drop here' : 'Drop tasks here'}
          </p>
        )}
      </div>

      {!compact && (
        <input
          type="text"
          placeholder="+ Add task..."
          onKeyDown={handleKeyDown}
          className="w-full bg-slate-50 dark:bg-transparent border border-slate-200 dark:border-slate-700 
            rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 
            placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none 
            focus:border-slate-400 dark:focus:border-slate-500 transition-colors mt-2"
        />
      )}
    </div>
  )
}
