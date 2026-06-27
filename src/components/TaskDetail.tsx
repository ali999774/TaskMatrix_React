import { useState, useEffect, useRef } from 'react'
import { Calendar, Clock, Bell, Tag, Repeat } from 'lucide-react'
import type { Task } from '../types'
import type { CategoryDef } from '../lib/categories'
import { categoryDisplay } from '../lib/categories'
import { breakDownTask } from '../lib/ai-parse'
import { useHaptics } from '../hooks/useHaptics'
import { REMINDER_OPTIONS, type ReminderPreset } from '../lib/notifications'
import { formatLongDate, formatTime, localTodayStr } from '../lib/dates'
import Row from './ui/Row'
import { Section } from './ui/SettingsGroup'

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
  const sheetRef = useRef<HTMLDivElement>(null)
  const haptics = useHaptics()
  const [breakingDown, setBreakingDown] = useState(false)
  const [dragY, setDragY] = useState(0)
  const touchStart = useRef<{ y: number; timestamp: number } | null>(null)

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

  // Toggle gating the existing due_date field (re-presents data we already
  // hold). On → default to today; off → clear date and its dependents (time +
  // reminder) so we never leave an orphaned time/reminder with no date.
  const handleDueDateToggle = (on: boolean) => {
    if (on) {
      const today = localTodayStr()
      setDueDate(today)
      save({ due_date: today })
    } else {
      setDueDate('')
      setDueTime('')
      setReminder(null)
      save({ due_date: null, due_time: null, reminder: null })
    }
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
      series_id: checked ? (task.series_id || crypto.randomUUID()) : null,
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { y: e.touches[0].clientY, timestamp: Date.now() }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const dy = e.touches[0].clientY - touchStart.current.y
    if (dy > 0) setDragY(dy)
  }

  const handleTouchEnd = () => {
    if (!touchStart.current) return
    const dt = Date.now() - touchStart.current.timestamp
    if (dragY > 100 || (dragY > 50 && dt < 200)) {
      onClose()
    }
    setDragY(0)
    touchStart.current = null
  }

  const completed = subtasks.filter((s) => s.done).length
  const reminderLabel = REMINDER_OPTIONS.find((o) => o.value === reminder)?.label ?? 'None'

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
      className="fixed inset-0 z-50 flex max-sm:items-start items-center justify-center
        bg-black/50 backdrop-blur-sm max-sm:pt-[env(safe-area-inset-top)] max-sm:p-0 animate-modal-backdrop"
    >
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl
          border border-slate-200 dark:border-slate-700 overflow-hidden
          max-sm:rounded-b-none max-sm:max-h-[95dvh] max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:animate-modal-sheet
          transition-transform duration-200"
        style={{ transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-0 max-sm:block hidden">
          <div className="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
        </div>

        {/* Header — back-arrow dismiss. Edits auto-save per field (see save()),
            so there is no explicit commit/discard step; an X/✓ header would
            imply discard semantics this screen does not have. */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px] shrink-0"
          >
            <span aria-hidden="true" className="text-[1rem]">←</span>
          </button>
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
        </div>

        {/* Body — inset grouped-card layout */}
        <div className="px-4 py-5 space-y-6 max-h-[60vh] overflow-y-auto bg-slate-100 dark:bg-slate-950">
          {/* DATE & TIME */}
          <Section header="Date & Time">
            <Row
              icon={<Calendar />}
              label="Due Date"
              affordance="toggle"
              toggle={!!dueDate}
              onToggle={handleDueDateToggle}
              subtitle={dueDate ? formatLongDate(dueDate) : undefined}
              subtitleTone="accent"
            >
              {dueDate && (
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  aria-label="Change due date"
                  className="mt-1 w-full rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2
                    text-[0.875rem] text-slate-700 dark:text-slate-300 outline-none"
                />
              )}
            </Row>

            {dueDate && (
              <div className="relative">
                <Row
                  icon={<Clock />}
                  label="Time"
                  affordance="value"
                  value={
                    dueTime
                      ? formatTime(dueTime)
                      : <span className="text-slate-400 dark:text-slate-500">Add Time</span>
                  }
                />
                <input
                  type="time"
                  value={dueTime}
                  onChange={(e) => handleDueTimeChange(e.target.value)}
                  aria-label="Due time"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </div>
            )}

            {dueDate && (
              <div className="relative">
                <Row
                  icon={<Bell />}
                  label="Reminder"
                  affordance="disclosure"
                  value={reminderLabel}
                />
                <select
                  value={reminder ?? 'null'}
                  onChange={(e) => handleReminderChange(e.target.value)}
                  aria-label="Reminder"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                >
                  {REMINDER_OPTIONS.map((opt) => (
                    <option key={opt.value ?? 'null'} value={opt.value ?? 'null'}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Section>

          {/* CATEGORY */}
          <Section header="Category">
            <div className="relative">
              <Row
                icon={<Tag />}
                label="Category"
                affordance="disclosure"
                value={categoryDisplay(categories, category)}
              />
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                aria-label="Category"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              >
                <option value="">None</option>
                {categories.map((cat) => (
                  <option key={cat.label} value={cat.label}>
                    {cat.icon} {cat.display}
                  </option>
                ))}
              </select>
            </div>
          </Section>

          {/* REPEAT — behavior unchanged; restyled into the grouped card only. */}
          <Section header="Repeat">
            <Row
              icon={<Repeat />}
              label="Repeat"
              affordance="toggle"
              toggle={recurring}
              onToggle={handleRecurringToggle}
            >
              {recurring && (
                <div className="mt-2 space-y-2">
                  <select
                    value={recurFrequency}
                    onChange={(e) => handleRecurFrequencyChange(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-[0.875rem]
                      text-slate-700 dark:text-slate-300 outline-none appearance-none
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
            </Row>
          </Section>

          {/* SUBTASKS — behavior unchanged; restyled into the grouped card only. */}
          <Section header={`Subtasks${subtasks.length > 0 ? ` · ${completed}/${subtasks.length}` : ''}`}>
            {subtasks.length > 0 && (
              <div className="px-4 py-2 space-y-1">
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
                      className={`flex-1 text-[0.9375rem] ${
                        st.done
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-200'
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
            <div className="flex gap-2 px-4 py-2.5">
              <input
                type="text"
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                placeholder="+ Add subtask..."
                className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-[0.875rem]
                  text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600
                  outline-none"
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
          </Section>

          {/* NOTES */}
          <Section header="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              rows={3}
              placeholder="Add notes..."
              className="w-full bg-transparent px-4 py-3 text-[0.9375rem] text-slate-700 dark:text-slate-200
                placeholder-slate-400 dark:placeholder-slate-600 outline-none resize-none"
            />
          </Section>
        </div>
      </div>
    </div>
  )
}
