import { useState, useEffect, useRef } from 'react'
import type { Task } from '../types'
import type { CategoryDef } from '../lib/categories'
import { breakDownTask } from '../lib/ai-parse'
import { useHaptics } from '../hooks/useHaptics'
import { REMINDER_OPTIONS, type ReminderPreset } from '../lib/notifications'

interface Props {
  task: Task
  onUpdate: (id: string, updates: Partial<Task>) => void
  onClose: () => void
  categories?: CategoryDef[]
}

export default function TaskDetail({ task, onUpdate, onClose, categories = [] }: Props) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes || '')
  const [dueDate, setDueDate] = useState(task.due_date || '')
  const [dueTime, setDueTime] = useState(task.due_time || '')
  const [reminder, setReminder] = useState<ReminderPreset>((task.reminder as ReminderPreset) || null)
  const [recurring, setRecurring] = useState(!!task.recurring)
  const [recurFrequency, setRecurFrequency] = useState(task.recur_frequency || 'daily')
  const [recurDays, setRecurDays] = useState<number[]>(task.recur_days || [])
  const [category, setCategory] = useState(task.category || '')
  const [subtasks, setSubtasks] = useState(task.subtasks || [])
  const [newSubtask, setNewSubtask] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const haptics = useHaptics()
  const [breakingDown, setBreakingDown] = useState(false)

  useEffect(() => {
    // Autofocus only with a fine pointer (mouse/trackpad). On touch it
    // pops the keyboard every time a task is opened just to read it.
    if (!window.matchMedia('(pointer: coarse)').matches) {
      titleRef.current?.focus()
    }
  }, [])

  // Sync local state when task prop changes (realtime updates)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing form fields from prop
    setTitle(task.title)
    setNotes(task.notes || '')
    setDueDate(task.due_date || '')
    setDueTime(task.due_time || '')
    setReminder((task.reminder as ReminderPreset) || null)
    setRecurring(!!task.recurring)
    setRecurFrequency(task.recur_frequency || 'daily')
    setRecurDays(task.recur_days || [])
    setCategory(task.category || '')
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

  const handleReminderChange = (val: string) => {
    const preset: ReminderPreset = val === 'null' ? null : val as ReminderPreset
    setReminder(preset)
    save({ reminder: preset })
  }

  const handleRecurringToggle = (checked: boolean) => {
    setRecurring(checked)
    save({
      recurring: checked,
      recur_frequency: checked ? recurFrequency : null,
      recur_interval: checked ? 1 : null,
      recur_days: checked ? (recurFrequency === 'weekly' ? recurDays : null) : null,
    })
  }

  const handleRecurFrequencyChange = (freq: string) => {
    setRecurFrequency(freq)
    const days = freq === 'weekly' ? (recurDays.length > 0 ? recurDays : [new Date().getDay()]) : null
    if (freq === 'weekly') setRecurDays(days || [])
    save({ recur_frequency: freq, recur_days: days })
  }

  const toggleRecurDay = (day: number) => {
    const next = recurDays.includes(day)
      ? recurDays.filter(d => d !== day)
      : [...recurDays, day].sort()
    setRecurDays(next)
    save({ recur_days: next.length > 0 ? next : null })
  }

  const handleCategoryChange = (val: string) => {
    setCategory(val)
    save({ category: val || null })
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

  const handleBreakdown = async () => {
    haptics('light')
    setBreakingDown(true)
    const result = await breakDownTask(task.title, task.notes || undefined)
    setBreakingDown(false)
    if ('subtasks' in result && result.subtasks.length > 0) {
      const newItems = result.subtasks.map(t => ({ title: t, done: false }))
      const updated = [...subtasks, ...newItems]
      setSubtasks(updated)
      save({ subtasks: updated })
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[max(15vh,env(safe-area-inset-top))]
        bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl 
        border border-slate-200 dark:border-slate-700 overflow-hidden animate-in motion-reduce:animate-none">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="flex-1 bg-transparent text-[1.125rem] font-semibold text-slate-800 dark:text-white 
              outline-none placeholder-slate-400"
            placeholder="Task title"
          />
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 
              text-[1.25rem] leading-none p-1 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
            aria-label="Close task details"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Category */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 
                dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 
                dark:text-slate-300 outline-none focus:border-slate-400 
                dark:focus:border-slate-500 transition-colors appearance-none
                bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.22%208.22a.75.75%200%200%201%201.06%200L10%2011.94l3.72-3.72a.75.75%200%201%201%201.06%201.06l-4.25%204.25a.75.75%200%200%201-1.06%200L5.22%209.28a.75.75%200%200%201%200-1.06Z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] 
                bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8"
            >
              <option value="">None</option>
              {categories.map((cat) => (
                <option key={cat.label} value={cat.label}>
                  {cat.icon} {cat.display}
                </option>
              ))}
            </select>
          </div>

          {/* Due date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 
                  dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 
                  dark:text-slate-300 outline-none focus:border-slate-400 
                  dark:focus:border-slate-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Due time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => handleDueTimeChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 
                  dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 
                  dark:text-slate-300 outline-none focus:border-slate-400 
                  dark:focus:border-slate-500 transition-colors"
              />
            </div>
          </div>

          {/* Reminder */}
          {dueDate && (
            <div>
              <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Reminder
              </label>
              <select
                value={reminder ?? 'null'}
                onChange={(e) => handleReminderChange(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 
                  dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 
                  dark:text-slate-300 outline-none focus:border-slate-400 
                  dark:focus:border-slate-500 transition-colors appearance-none
                  bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z' clip-rule='evenodd'/%3E%3C/svg%3E")` }}
              >
                {REMINDER_OPTIONS.map((opt) => (
                  <option key={opt.value ?? 'null'} value={opt.value ?? 'null'}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Recurrence */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => handleRecurringToggle(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-[0.75rem] font-medium text-slate-500 dark:text-slate-400">🔄 Repeat</span>
            </label>

            {recurring && (
              <div className="ml-6 mt-2 space-y-2">
                <select
                  value={recurFrequency}
                  onChange={(e) => handleRecurFrequencyChange(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 
                    dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 
                    dark:text-slate-300 outline-none focus:border-slate-400 
                    dark:focus:border-slate-500 transition-colors appearance-none
                    bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%2394a3b8'%3E%3Cpath fill-rule='evenodd' d='M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z' clip-rule='evenodd'/%3E%3C/svg%3E")` }}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>

                {recurFrequency === 'weekly' && (
                  <div className="flex gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleRecurDay(i)}
                        className={`w-9 h-9 rounded-full text-[0.75rem] font-medium transition-all active:scale-90 motion-reduce:scale-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center
                          ${recurDays.includes(i)
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        aria-label={['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][i]}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-2">
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
                      className={`flex-1 text-[0.875rem] ${
                        st.done
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {st.title}
                    </span>
                    {/* Always visible — hover-reveal is unreachable on touch */}
                    <button
                      onClick={() => deleteSubtask(i)}
                      className="text-slate-400 dark:text-slate-500
                        hover:text-red-500 transition-all text-[0.75rem] min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
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
                  dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 
                  dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 
                  outline-none focus:border-slate-400 dark:focus:border-slate-500 
                  transition-colors"
              />
              <button
                onClick={handleBreakdown}
                disabled={breakingDown}
                className="shrink-0 text-[0.75rem] font-medium px-3 py-2 rounded-lg border
                  border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20
                  text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30
                  transition-all active:scale-95 min-h-[44px] disabled:opacity-50"
              >
                {breakingDown ? '...' : '✨ Break down'}
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              rows={3}
              placeholder="Add notes..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 
                dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 
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
