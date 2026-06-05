import { useState } from 'react'
import type { Quadrant, Task } from '../types'
import { QUADRANT_LABELS, QUADRANT_DEFAULTS, QUADRANT_ICONS } from '../types'
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

const QUADRANT_BG: Record<Quadrant, string> = {
  1: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50',
  2: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50',
  3: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50',
  4: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50',
}

const QUADRANT_HEADER_BG: Record<Quadrant, string> = {
  1: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  2: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  3: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  4: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
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
      className={`rounded-xl border ${QUADRANT_BG[quadrant]} 
        p-4 flex flex-col min-h-[220px] transition-all duration-150
        ${dragOver ? 'ring-2 ring-slate-400 dark:ring-slate-500 scale-[1.02]' : ''}`}
    >
      {/* Quadrant header with icon + count */}
      <div className={`-mx-4 -mt-4 px-4 py-2.5 rounded-t-xl ${QUADRANT_HEADER_BG[quadrant]} mb-3 flex items-center justify-between`}>
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <span>{QUADRANT_ICONS[quadrant]}</span>
          {QUADRANT_LABELS[quadrant]}
        </h3>
        <span className="text-xs font-medium opacity-60 tabular-nums">{tasks.length}</span>
      </div>

      <div className="flex-1 space-y-2">
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
          <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-6">
            {dragOver ? 'Drop here' : 'Drag tasks here'}
          </p>
        )}
      </div>

      {!compact && (
        <input
          type="text"
          placeholder="+ Add task..."
          onKeyDown={handleKeyDown}
          className="w-full bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 
            rounded-lg px-3 py-2 text-sm text-slate-700 dark:text-slate-300 
            placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none 
            focus:border-slate-400 dark:focus:border-slate-500 transition-colors mt-3"
        />
      )}
    </div>
  )
}
