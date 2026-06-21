import { useRef, useState, useCallback } from 'react'
import type { Task, Quadrant } from '../types'
import { QUADRANT_LABELS, QUADRANT_ICONS } from '../types'
import type { CategoryDef } from '../lib/categories'
import { getCategoryDef, CATEGORY_BORDER, CATEGORY_BADGE } from '../lib/categories'
import { useHaptics } from '../hooks/useHaptics'
import { parseLocalDate } from '../lib/dates'
import CheckCircle from './matrix/CheckCircle'

interface Props {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onClick: (task: Task) => void
  onMove: (id: string, toQuadrant: Quadrant) => void
  categories?: CategoryDef[]
}

// Status icons moved into CheckCircle component

function dueLabel(dateStr: string): { text: string; urgent: boolean } {
  const due = parseLocalDate(dateStr) // local midnight — new Date('YYYY-MM-DD') is UTC and shifts a day in US timezones
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { text: 'Overdue', urgent: true }
  if (diff === 0) return { text: 'Today', urgent: true }
  if (diff <= 7) return { text: 'This Week', urgent: false }
  return { text: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), urgent: false }
}

export default function TaskCard({ task, onStatusChange, onDelete, onClick, onMove, categories = [] }: Props) {
  const dragged = useRef(false)
  const haptics = useHaptics()
  const [showMove, setShowMove] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Open the move menu, flipping it above the card when there isn't
  // enough room below (cards near the bottom were rendering off-screen).
  const openMove = useCallback(() => {
    const rect = cardRef.current?.getBoundingClientRect()
    setFlipUp(!!rect && window.innerHeight - rect.bottom < 240)
    setShowMove(true)
  }, [])

  const cycleStatus = () => {
    const next: Record<string, string> = { todo: 'done', done: 'todo' }
    const newStatus = next[task.status] || 'todo'
    onStatusChange(task.id, newStatus)
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

  const handleMovePick = (e: React.MouseEvent, q: Quadrant) => {
    e.stopPropagation()
    haptics('light')
    onMove(task.id, q)
    setShowMove(false)
  }

  // Long-press for move menu (touch)
  const startLongPress = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      haptics('medium')
      openMove()
    }, 500)
  }, [haptics, openMove])

  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current)
  }, [])

  // Context menu (desktop right-click)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    openMove()
  }

  const dueInfo = task.due_date ? dueLabel(task.due_date) : null
  const catDef = getCategoryDef(categories, task.category)

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
      onContextMenu={handleContextMenu}
      className={`p-3 rounded-lg border border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-800/60 transition-all relative
        select-none [-webkit-touch-callout:none]
        hover:border-slate-400 dark:hover:border-slate-500 group cursor-grab active:cursor-grabbing
        ${task.status === 'done' ? 'opacity-50' : ''}
        ${catDef ? `border-l-4 ${CATEGORY_BORDER[catDef.color] || ''}` : ''}`}
    >
      <div className="flex items-start gap-2">
        <CheckCircle status={task.status} onToggle={cycleStatus} />
        <div className="flex-1 min-w-0">
          <span className={`text-[0.875rem] ${task.status === 'done' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'}`}>
            {task.title}
          </span>
          {(task.category || dueInfo) && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {task.category && (
                <span className={`text-[0.75rem] px-1.5 py-0.5 rounded-full font-medium
                  ${catDef ? CATEGORY_BADGE[catDef.color] || '' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                >
                  {catDef ? `${catDef.icon} ${catDef.display}` : task.category}
                </span>
              )}
              {dueInfo && (
                <span className={`text-[0.75rem] px-1.5 py-0.5 rounded-full font-medium
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
          <button
            onClick={handleDelete}
            className="text-slate-300 dark:text-slate-500 hover:text-red-500 transition-colors text-[0.75rem] px-1.5 py-1 active:scale-90 motion-reduce:scale-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            aria-label="Delete task"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Move popup */}
      {showMove && (
        <>
          {/* Invisible backdrop: tap anywhere outside to dismiss */}
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => { e.stopPropagation(); setShowMove(false) }}
            aria-hidden="true"
          />
          <div className={`absolute right-0 z-50 ${flipUp ? 'bottom-full mb-1' : 'top-full mt-1'} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5 min-w-[130px]`}
          onClick={(e) => e.stopPropagation()}>
          <div className="text-[0.75rem] text-slate-400 dark:text-slate-500 px-2 pb-0.5">Move to…</div>
          {([1, 2, 3, 4] as Quadrant[]).map((q) => (
            <button
              key={q}
              onClick={(e) => handleMovePick(e, q)}
              className="text-[0.75rem] px-2.5 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-left flex items-center gap-2 active:scale-95 motion-reduce:scale-100 transition-all min-h-[44px]"
            >
              <span>{QUADRANT_ICONS[q]}</span>
              <span className="text-slate-700 dark:text-slate-300">{QUADRANT_LABELS[q]}</span>
            </button>
          ))}
          </div>
        </>
      )}
    </div>
  )
}
