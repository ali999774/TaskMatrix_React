import { useRef, useState, useCallback } from 'react'
import type { Task, Quadrant } from '../types'
import { QUADRANT_LABELS, QUADRANT_ICONS } from '../types'
import type { CategoryDef } from '../lib/categories'
import { getCategoryDef, CATEGORY_BORDER } from '../lib/categories'
import { useHaptics } from '../hooks/useHaptics'
import { parseLocalDate } from '../lib/dates'
import CheckCircle from './matrix/CheckCircle'
import SwipeableRow from './SwipeableRow'

interface Props {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onClick: (task: Task) => void
  onMove: (id: string, toQuadrant: Quadrant) => void
  categories?: CategoryDef[]
}

function dueLabel(dateStr: string): { text: string; urgent: boolean } {
  const due = parseLocalDate(dateStr)
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
    ;(e.currentTarget as HTMLElement).classList.add('opacity-40', 'scale-105', 'shadow-xl', 'z-10')
  }

  const handleDragEnd = (e: React.DragEvent) => {
    ;(e.currentTarget as HTMLElement).classList.remove('opacity-40', 'scale-105', 'shadow-xl', 'z-10')
    setTimeout(() => { dragged.current = false }, 0)
  }

  const handleClick = () => {
    if (dragged.current) return
    onClick(task)
  }

  const handleMovePick = (e: React.MouseEvent, q: Quadrant) => {
    e.stopPropagation()
    haptics('light')
    onMove(task.id, q)
    setShowMove(false)
  }

  // Long-press for move menu (touch) — attached to the inner content,
  // NOT the outer div, so SwipeableRow's pan gesture works.
  const startLongPress = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      haptics('medium')
      openMove()
    }, 500)
  }, [haptics, openMove])

  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current)
  }, [])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    openMove()
  }

  const dueInfo = task.due_date ? dueLabel(task.due_date) : null
  const catDef = getCategoryDef(categories, task.category)
  const isDone = task.status === 'done'

  const cardInner = (
    <div
      className="flex items-start gap-1.5"
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      <CheckCircle status={task.status} onToggle={cycleStatus} />
      <div className="flex-1 min-w-0">
        <p
          className="text-[0.8125rem] font-semibold leading-snug ${
            isDone
              ? 'line-through text-slate-400 dark:text-slate-500'
              : 'text-slate-800 dark:text-slate-100'
          }`}
          aria-hidden="true"
        >
          {task.title}
        </p>
        {(task.category || dueInfo) && (
          <p className="text-[0.6875rem] leading-relaxed mt-0.5 flex items-center gap-1.5 flex-wrap" aria-hidden="true">
            {dueInfo && (
              <span className={dueInfo.urgent ? 'text-red-500 dark:text-red-400 font-medium' : 'text-slate-400 dark:text-slate-500'}>
                {dueInfo.text}
              </span>
            )}
            {task.category && dueInfo && (
              <span className="text-slate-300 dark:text-slate-600">·</span>
            )}
            {task.category && (
              <span className="text-blue-500 dark:text-blue-400">
                #{catDef?.display || task.category}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  )

  return (
    <>
      <div
        ref={cardRef}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onContextMenu={handleContextMenu}
        className={`py-2 px-2.5 transition-all relative
          bg-white dark:bg-slate-800 rounded-xl
          shadow-sm dark:shadow-none
          hover:shadow-md hover:-translate-y-px
          select-none [-webkit-touch-callout:none]
          active:bg-slate-100 dark:active:bg-slate-700 active:scale-[0.985]
          group cursor-grab active:cursor-grabbing
          ${isDone ? 'opacity-50' : ''}
          ${catDef ? `border-l-[3px] ${CATEGORY_BORDER[catDef.color] || ''}` : 'border-l-[3px] border-transparent'}`}
      >
        <SwipeableRow
          actions={[
            {
              label: 'Details',
              icon: 'i',
              className: 'bg-[#8E8E93]',
              onAction: () => onClick(task),
            },
            {
              label: 'Flag',
              icon: '⚑',
              className: 'bg-[#FF9500]',
              onAction: () => haptics('light'),
            },
            {
              label: 'Delete',
              icon: '✕',
              className: 'bg-[#FF3B30]',
              onAction: () => onDelete(task.id),
            },
          ]}
          onTap={handleClick}
          aria-label={task.title}
          className="bg-white dark:bg-slate-800"
          showLabels={false}
        >
          {cardInner}
        </SwipeableRow>
      </div>

      {/* Move popup */}
      {showMove && (
        <>
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
    </>
  )
}
