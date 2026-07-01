shell-init: error retrieving current directory: getcwd: cannot access parent directories: Operation not permitted
chdir: error retrieving current directory: getcwd: cannot access parent directories: Operation not permitted
import { useRef, useState, useCallback } from 'react'
import type { Task, Quadrant } from '../types'
import { QUADRANT_LABELS, QUADRANT_ICONS } from '../types'
import type { CategoryDef } from '../lib/categories'
import { getCategoryDef } from '../lib/categories'
import { categoryColor } from '../lib/categoryColors'
import { Pin, ChevronDown, Check, X } from 'lucide-react'
import { useHaptics } from '../hooks/useHaptics'
import { parseLocalDate } from '../lib/dates'
import { AnimatePresence, motion } from 'framer-motion'
import CheckCircle from './matrix/CheckCircle'
import SwipeableRow from './SwipeableRow'

interface Props {
  task: Task
  onStatusChange: (id: string, status: string) => void
  onDelete: (id: string) => void
  onClick: (task: Task) => void
  onMove: (id: string, toQuadrant: Quadrant) => void
  onFlag: (id: string) => void
  categories?: CategoryDef[]
  expanded?: boolean
  onToggleExpand?: (taskId: string) => void
  onTaskUpdate?: (id: string, updates: Partial<Task>) => void
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

const IS_TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export default function TaskCard({
  task,
  onStatusChange,
  onDelete,
  onClick,
  onMove,
  onFlag,
  categories = [],
  expanded,
  onToggleExpand,
  onTaskUpdate,
}: Props) {
  const dragged = useRef(false)
  const haptics = useHaptics()
  const [showMove, setShowMove] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; flipUp: boolean } | null>(null)

  const openMove = useCallback(() => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (rect) {
      const menuH = 180
      const flipUp = window.innerHeight - rect.bottom < menuH
      setMenuPos({
        top: flipUp ? rect.top - 8 : rect.bottom + 4,
        left: rect.right - 130,
        flipUp,
      })
    }
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

  const hasSubtasks = task.subtasks && task.subtasks.length > 0
  const totalSubtasks = hasSubtasks ? task.subtasks!.length : 0
  let checkedCount = 0

  if (hasSubtasks) {
    task.subtasks!.forEach((st) => {
      if (st.done) checkedCount++
    })
  }

  const cardInner = (
    <div
      className="flex items-center gap-1.5"
      onTouchStart={startLongPress}
      onTouchEnd={cancelLongPress}
      onTouchMove={cancelLongPress}
    >
      <CheckCircle status={task.status} onToggle={cycleStatus} />
      {/* Text block: flex-1 so it absorbs free space and pushes pin to the right */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[0.78125rem] sm:text-[0.875rem] font-semibold leading-snug ${
            isDone
              ? 'line-through text-slate-400 dark:text-slate-500'
              : 'text-slate-800 dark:text-slate-100'
          }`}
          aria-hidden="true"
        >
          {task.title}
        </p>
        {(task.category || dueInfo || hasSubtasks) && (
          <p className="text-[0.65625rem] sm:text-[0.75rem] leading-relaxed mt-0.5 flex items-center gap-1.5 flex-wrap" aria-hidden="true">
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
            {hasSubtasks && (task.category || dueInfo) && (
              <span className="text-slate-300 dark:text-slate-600">·</span>
            )}
            {hasSubtasks && (
              <span className="bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-[4px] text-[0.6rem] font-semibold leading-none">
                {checkedCount}/{totalSubtasks}
              </span>
            )}
          </p>
        )}
      </div>
      {/* Pin button — always visible (no hover gate) so it works on iOS/Capacitor.
          shrink-0 prevents a long title from squishing it.
          fill-current makes the icon solid when pinned, outline when not. */}
      <button
        type="button"
        aria-pressed={!!task.pinned}
        aria-label={task.pinned ? 'Unpin task' : 'Pin task'}
        onClick={(e) => {
          e.stopPropagation()
          haptics('light')
          onFlag(task.id)
        }}
        onTouchEnd={(e) => e.stopPropagation()}
        className={`shrink-0 flex items-center justify-center w-[30px] h-[44px] rounded
          transition-colors
          ${task.pinned
            ? 'text-amber-500 dark:text-amber-400'
            : 'text-slate-300 dark:text-slate-600 hover:text-slate-400 dark:hover:text-slate-500'
          }`}
      >
        <Pin
          size={14}
          className={task.pinned ? 'fill-current' : ''}
          aria-hidden="true"
        />
      </button>
      {hasSubtasks && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation()
            haptics('light')
            onToggleExpand?.(task.id)
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          className="shrink-0 flex items-center justify-center w-[30px] h-[44px] rounded transition-colors text-slate-300 hover:text-slate-400 dark:text-slate-600 dark:hover:text-slate-500"
        >
          <ChevronDown
            size={18}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
    </div>
  )


  return (
    <>
      <div
        ref={cardRef}
        draggable={!IS_TOUCH}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onContextMenu={handleContextMenu}
        className={`pt-2 pb-1 px-2 transition-all relative
          bg-white dark:bg-slate-800 rounded-xl
          shadow-sm dark:shadow-none
          hover:shadow-md hover:-translate-y-px
          select-none [-webkit-touch-callout:none]
          active:bg-slate-100 dark:active:bg-slate-700 active:scale-[0.985]
          group cursor-grab active:cursor-grabbing
          border-l-[3px]
          ${isDone ? 'opacity-50' : ''}`}
        style={{ borderLeftColor: categoryColor(task.category) }}
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
              label: task.pinned ? 'Unpin' : 'Pin',
              icon: <Pin size={20} />,
              className: 'bg-[#FF9500]',
              onAction: () => { haptics('light'); onFlag(task.id) },
            },
            {
              label: 'Delete',
              icon: <X size={20} />,
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

        {/* Expanded Subtasks */}
        <AnimatePresence>
          {expanded && hasSubtasks && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div
                className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 space-y-1"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {task.subtasks!.map((st, i) => {
                  const isChecked = st.done || false
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Toggle subtask: ${st.title}`}
                      onClick={() => {
                        haptics('light')
                        const newSubtasks = [...task.subtasks!]
                        newSubtasks[i] = { ...st, done: !st.done }
                        onTaskUpdate?.(task.id, { subtasks: newSubtasks })
                      }}
                      className="flex items-start gap-2.5 w-full text-left py-1.5 px-1 rounded hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                    >
                      <div
                        className={`shrink-0 mt-0.5 w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-slate-400 border-slate-400 dark:bg-slate-500 dark:border-slate-500 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                      <span
                        className={`text-[0.78125rem] sm:text-[0.875rem] leading-snug flex-1 ${
                          isChecked
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {st.title}
                      </span>
                    </button>
                  )
                })}
                {checkedCount === totalSubtasks && (
                  <div className="pt-3 pb-1 flex justify-center">
                    <button
                      type="button"
                      aria-label="Mark all subtasks complete"
                      onClick={() => {
                        haptics('success')
                        onStatusChange(task.id, 'done')
                      }}
                      className="text-[0.75rem] font-semibold text-white bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 px-4 py-2 rounded-full transition-colors active:scale-95 shadow-sm"
                    >
                      Mark task done?
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Move popup */}
      {showMove && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => { e.stopPropagation(); setShowMove(false) }}
            aria-hidden="true"
          />
          {menuPos && (
          <div
            className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-1.5 flex flex-col gap-0.5 min-w-[130px] max-h-[50vh] overflow-y-auto"
            style={{
              top: menuPos.top,
              left: Math.max(8, menuPos.left),
            }}
          onClick={(e) => e.stopPropagation()}>
          <div className="text-[0.75rem] text-slate-400 dark:text-slate-500 px-2 pb-0.5">Move to…</div>
          {([1, 2, 3, 4] as Quadrant[]).map((q) => {
            const QIcon = QUADRANT_ICONS[q]
            return (
            <button
              key={q}
              onClick={(e) => handleMovePick(e, q)}
              className="text-[0.75rem] px-2.5 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-left flex items-center gap-2 active:scale-95 motion-reduce:scale-100 transition-all min-h-[44px]"
            >
              <QIcon className="w-4 h-4" aria-hidden="true" />
              <span className="text-slate-700 dark:text-slate-300">{QUADRANT_LABELS[q]}</span>
            </button>
            )
          })}
          </div>
          )}
        </>
      )}
    </>
  )
}
