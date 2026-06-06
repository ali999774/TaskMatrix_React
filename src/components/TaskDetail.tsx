import { useState, useEffect, useRef } from 'react'
import type { Task } from '../types'

interface Props {
  task: Task
  onUpdate: (id: string, updates: Partial<Task>) => void
  onClose: () => void
}

export default function TaskDetail({ task, onUpdate, onClose }: Props) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes || '')
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [dueTime, setDueTime] = useState(task.due_time || '')
  const [subtasks, setSubtasks] = useState(task.subtasks || [])
  const [newSubtask, setNewSubtask] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // Sync local state when task prop changes (realtime updates)
  useEffect(() => {
    setTitle(task.title)
    setNotes(task.notes || '')
    setDueDate(task.due_date || '')
    setDueTime(task.due_time || '')
    setSubtasks(task.subtasks || [])
  }, [task])

  const save = (updates: Partial<Task>) => {
    onUpdate(task.id, updates)
  }

  const handleTitleBlur = () => {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) {
      save({ title: trimmed })
    } else if (!trimmed) {
      setTitle(task.title)
    }
  }

  const handleNotesBlur = () => {
    if (notes !== (task.notes || '')) {
      save({ notes: notes || null })
    }
  }

  const handleDueDateChange = (val: string) => {
    setDueDate(val)
    save({ due_date: val || null })
  }

  const handleDueTimeChange = (val: string) => {
    setDueTime(val)
    save({ due_time: val || null })
  }

  const addSubtask = () => {
    const text = newSubtask.trim()
    if (!text) return
    const updated = [...subtasks, { title: text, done: false }]
    setSubtasks(updated)
    setNewSubtask('')
    save({ subtasks: updated })
  }

  const toggleSubtask = (idx: number) => {
    const updated = subtasks.map((s, i) =>
      i === idx ? { ...s, done: !s.done } : s
    )
    setSubtasks(updated)
    save({ subtasks: updated })
  }

  const deleteSubtask = (idx: number) => {
    const updated = subtasks.filter((_, i) => i !== idx)
    setSubtasks(updated)
    save({ subtasks: updated })
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }

  const completed = subtasks.filter((s) => s.done).length

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[max(15vh,env(safe-area-inset-top))]
        bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl 
        border border-slate-200 dark:border-slate-700 overflow-hidden animate-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="flex-1 bg-transparent text-lg font-semibold text-slate-800 dark:text-white 
              outline-none placeholder-slate-400"
            placeholder="Task title"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 
              text-xl leading-none p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            aria-label="Close task details"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Due date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 
                  dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 
                  dark:text-slate-300 outline-none focus:border-slate-400 
                  dark:focus:border-slate-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                Due time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => handleDueTimeChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 
                  dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 
                  dark:text-slate-300 outline-none focus:border-slate-400 
                  dark:focus:border-slate-500 transition-colors"
              />
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Subtasks {subtasks.length > 0 && `(${completed}/${subtasks.length})`}
            </label>
            {subtasks.length > 0 && (
              <div className="space-y-1 mb-2">
                {subtasks.map((st, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={st.done}
                      onChange={() => toggleSubtask(i)}
                      className="rounded border-slate-300 dark:border-slate-600 
                        text-blue-500 focus:ring-blue-500"
                    />
                    <span
                      className={`flex-1 text-sm ${
                        st.done
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {st.title}
                    </span>
                    <button
                      onClick={() => deleteSubtask(i)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 
                        hover:text-red-500 transition-all text-xs min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                      aria-label={`Delete subtask: ${st.title}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                placeholder="+ Add subtask..."
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 
                  dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 
                  dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 
                  outline-none focus:border-slate-400 dark:focus:border-slate-500 
                  transition-colors"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              rows={3}
              placeholder="Add notes..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 
                dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-700 
                dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 
                outline-none focus:border-slate-400 dark:focus:border-slate-500 
                transition-colors resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
