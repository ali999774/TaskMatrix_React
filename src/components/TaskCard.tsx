import { useRef, useState, useCallback } from 'react'
import { motion, type PanInfo } from 'framer-motion'
import type { Task, Quadrant } from '../types'
import { QUADRANT_LABELS, QUADRANT_ICONS } from '../types'
import type { CategoryDef } from '../lib/categories'
import { getCategoryDef, CATEGORY_BORDER, CATEGORY_BADGE } from '../lib/categories'
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

const IS_TOUCH =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

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

const DROP_ID_TO_QUADRANT: Record<string, Quadrant> = {
  'do-first': 1,
  'invest': 2,
  'delegate': 3,
  'dont-do': 4,
}

export default function TaskCard({ task, onStatusChange, onDelete, onClick, onMove, categories = [] }: Props) {
  const haptics = useHaptics()
  const [showMove, setShowMove] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
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

  const handleClick = () => {
    onClick(task)
  }

  // ── framer-motion drag (desktop / fine pointer only) ──────────────────────

  const handleDragStart = () => {
    setIsDragging(true)
  }

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false)
    const dropTargets = document.querySelectorAll('[data-drop-id]')
    for (const target of dropTargets) {
      const rect = target.getBoundingClientRect()
      if (
        info.point.x >= rect.left &&
        info.point.x <= rect.right &&
        info.point.y >= rect.top &&
        info.point.y <= rect.bottom
      ) {
        const dropId = target.getAttribute('data-drop-id')!
        const [, quadrantId] = dropId.split(':')
        const toQuadrant = DROP_ID_TO_QUADRANT[quadrantId]
        if (toQuadrant) {
          haptics('light')
          onMove(task.id, toQuadrant)
          return
        }
      }
    }
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    openMove()
  }

  const dueInfo = task.due_date ? dueLabel(task.due_date) : null
  const catDef = getCategoryDef(categories, task.category)

  const isDone = task.status === 'done'

  const cardInner = (
    <div className="flex items-start gap-2">
      <CheckCircle status={task.status} onToggle={cycleStatus} />
      <div className="flex-1 min-w-0">
        <span
          className={`text-[0.9375rem] ${
            isDone
              ? 'line-through text-slate-400 dark:text-slate-500'
              : 'text-slate-700 dark:text-slate-200'
          }`}
          aria-hidden="true"
        >
          {task.title}
        </span>
        {(task.category || dueInfo) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap" aria-hidden="true">
            {task.category && (
              <span
                className={`text-[0.75rem] px-1.5 py-0.5 rounded-full font-medium
                  ${catDef ? CATEGORY_BADGE[catDef.color] || '' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
              >
                {catDef ? `${catDef.icon} ${catDef.display}` : task.category}
              </span>
            )}
            {dueInfo && (
              <span
                className={`text-[0.75rem] px-1.5 py-0.5 rounded-full font-medium
                  ${
                    dueInfo.urgent
                      ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'
                      : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
                  }`}
              >
                {dueInfo.urgent ? '⚠ ' : ''}
                {dueInfo.text}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <motion.div
        ref={cardRef}
        drag={!IS_TOUCH}
        dragElastic={0.08}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onContextMenu={handleContextMenu}
        className={`py-3 px-3 select-none [-webkit-touch-callout:none] relative
          bg-white dark:bg-slate-800 rounded-lg
          group
          ${!isDragging ? 'active:bg-slate-100 dark:active:bg-slate-700 active:scale-[0.985]' : ''}
          ${!IS_TOUCH && !isDragging ? 'cursor-grab' : ''}
          ${isDragging ? 'cursor-grabbing z-10 scale-105 shadow-xl' : ''}
          ${isDone ? 'opacity-50' : ''}
          ${catDef ? `border-l-[3px] ${CATEGORY_BORDER[catDef.color] || ''}` : 'border-l-[3px] border-transparent'}
          transition-shadow`}
        onTouchStart={IS_TOUCH ? startLongPress : undefined}
        onTouchEnd={IS_TOUCH ? cancelLongPress : undefined}
        onTouchMove={IS_TOUCH ? cancelLongPress : undefined}
      >
        <SwipeableRow
          actions={[
            {
              label: isDone ? 'Undo' : 'Done',
              icon: isDone ? '↩' : '✓',
              className: 'bg-emerald-500',
              onAction: cycleStatus,
            },
            {
              label: 'Delete',
              icon: '🗑️',
              className: 'bg-red-500',
              onAction: () => onDelete(task.id),
            },
          ]}
          onTap={handleClick}
          aria-label={task.title}
        >
          {cardInner}
        </SwipeableRow>
      </motion.div>

      {/* Move popup */}
      {showMove && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => {
              e.stopPropagation()
              setShowMove(false)
            }}
            aria-hidden="true"
          />
          <div
            className={`absolute right-0 z-50 ${
              flipUp ? 'bottom-full mb-1' : 'top-full mt-1'
            } bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5 min-w-[130px]`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[0.75rem] text-slate-400 dark:text-slate-500 px-2 pb-0.5">
              Move to…
            </div>
            {([1, 2, 3, 4] as Quadrant[]).map((q) => (
              <button
                key={q}
                onClick={(e) => handleMovePick(e, q)}
                className="text-[0.75rem] px-2.5 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-left flex items-center gap-2 active:scale-95 motion-reduce:scale-100 transition-all min-h-[44px]"
              >
                <span>{QUADRANT_ICONS[q]}</span>
                <span className="text-slate-700 dark:text-slate-300">
                  {QUADRANT_LABELS[q]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
