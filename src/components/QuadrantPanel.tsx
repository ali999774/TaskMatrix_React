import { useState } from 'react'
import type { Quadrant, Task } from '../types'
import { QUADRANT_LABELS, QUADRANT_ICONS } from '../types'
import TaskCard from './TaskCard'
import type { CategoryDef } from '../lib/categories'

// HTML5 drag-and-drop doesn't exist on iOS touch — the empty-state hint
// must describe the interaction that actually works there (long-press menu).
// `pointer: coarse` = primary input is touch; evaluated once at module load.
const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

interface Props {
  quadrant: Quadrant
  tasks: Task[]
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, toQuadrant: Quadrant) => void
  onTaskClick: (task: Task) => void
  categories?: CategoryDef[]
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

export default function QuadrantPanel({ quadrant, tasks, onStatusChange, onDelete, onMove, onTaskClick, categories = [] }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(`tm-q-${quadrant}`) === 'true'
  })

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(`tm-q-${quadrant}`, String(next))
      return next
    })
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
      className={`sm:rounded-xl rounded-none border ${QUADRANT_BG[quadrant]} w-full
        px-0 sm:px-4 py-4 flex flex-col transition-all duration-300
        ${collapsed ? 'min-h-0' : 'min-h-[220px]'}
        ${dragOver ? 'ring-2 ring-slate-400 dark:ring-slate-500 scale-[1.02]' : ''}`}
    >
      {/* Quadrant header with icon + count + collapse toggle */}
      <div className={`sm:-mx-4 sm:-mt-4 -mt-4 px-4 py-2 sm:rounded-t-xl rounded-none ${QUADRANT_HEADER_BG[quadrant]} ${collapsed ? 'mb-0 sm:rounded-b-xl rounded-none' : 'mb-3'} flex items-center justify-between`}>
        <h3 className="text-[0.875rem] font-semibold flex items-center gap-1.5">
          <span>{QUADRANT_ICONS[quadrant]}</span>
          {QUADRANT_LABELS[quadrant]}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[0.75rem] font-medium opacity-60 tabular-nums">{tasks.length}</span>
          <button
            onClick={toggleCollapsed}
            className="text-[0.75rem] opacity-50 hover:opacity-100 transition-all active:scale-75 motion-reduce:scale-100 ml-1 p-0.5 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            title={collapsed ? 'Expand' : 'Collapse'}
            aria-label={collapsed ? 'Expand quadrant' : 'Collapse quadrant'}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="flex-1 space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onClick={onTaskClick}
              onMove={onMove}
              categories={categories}
            />
          ))}
          {tasks.length === 0 && (
            <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 italic text-center py-6">
              {dragOver ? 'Drop here' : IS_TOUCH ? 'Long-press a task to move it here' : 'Drag tasks here'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
