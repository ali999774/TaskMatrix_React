import { useState, useRef } from 'react'
import { ArrowLeft, SquarePen } from 'lucide-react'
import type { Quadrant } from '../types'
import type { CategoryDef } from '../lib/categories'
import { categoryDisplay } from '../lib/categories'
import { localTodayStr } from '../lib/dates'
import Row from './ui/Row'

interface Props {
  categories: CategoryDef[]
  onClose: () => void
  onAdd: (
    title: string,
    importance: number,
    urgency: number,
    category?: string,
    extras?: { due_date?: string; lead_days?: number }
  ) => void
}

const QUADRANT_OPTIONS: { q: Quadrant; label: string; importance: number; urgency: number }[] = [
  { q: 1, label: 'Do First', importance: 5, urgency: 5 },
  { q: 2, label: 'Schedule', importance: 5, urgency: 3 },
  { q: 3, label: 'Delegate', importance: 3, urgency: 5 },
  { q: 4, label: 'Don\'t Do', importance: 3, urgency: 3 },
]

export default function AddTaskModal({ categories, onClose, onAdd }: Props) {
  const [title, setTitle] = useState('')
  const [quadrant, setQuadrant] = useState<Quadrant>(1)
  const [category, setCategory] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [leadDays, setLeadDays] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose()
  }

  const handleSubmit = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    const q = QUADRANT_OPTIONS.find(o => o.q === quadrant)!
    onAdd(
      trimmed,
      q.importance,
      q.urgency,
      category || undefined,
      {
        due_date: dueDate || undefined,
        lead_days: leadDays ? parseInt(leadDays) : undefined,
      }
    )
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && title.trim()) handleSubmit()
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center
        bg-black/50 backdrop-blur-sm p-4 max-sm:items-end max-sm:p-0"
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl 
          border border-slate-200 dark:border-slate-700 overflow-hidden
          max-sm:rounded-b-none max-sm:max-h-[85vh] max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]
          transition-transform duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="Cancel"
            className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
          </button>
          <h2 className="flex-1 text-[1.125rem] font-semibold text-slate-800 dark:text-white">
            <SquarePen className="w-5 h-5 inline mr-1" />Add Task
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {/* Title */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Title
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) handleSubmit() }}
              placeholder="What needs to be done?"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 
                dark:border-slate-700 rounded-lg px-3 py-2.5 text-[1rem] text-slate-700 
                dark:text-slate-300 outline-none focus:border-blue-400 transition-colors"
              autoFocus
            />
          </div>

          {/* Quadrant */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Quadrant
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {QUADRANT_OPTIONS.map((opt) => (
                <button
                  key={opt.q}
                  onClick={() => setQuadrant(opt.q)}
                  className={`px-3 py-2.5 rounded-lg text-[0.8125rem] font-medium transition-all
                    active:scale-95 motion-reduce:scale-100 min-h-[44px] text-left
                    ${quadrant === opt.q
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-400/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  <span className="text-[0.6875rem] text-slate-400 dark:text-slate-500 block">Q{opt.q}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 
                dark:border-slate-700 rounded-lg px-3 py-2.5 text-[0.875rem] text-slate-700 
                dark:text-slate-300 outline-none focus:border-blue-400 transition-colors
                appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.22%208.22a.75.75%200%200%201%201.06%200L10%2011.94l3.72-3.72a.75.75%200%201%201%201.06%201.06l-4.25%204.25a.75.75%200%200%201-1.06%200L5.22%209.28a.75.75%200%200%201%200-1.06Z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] 
                bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat pr-8"
            >
              <option value="">None</option>
              {categories.map((cat) => (
                <option key={cat.label} value={cat.label}>
                  {categoryDisplay(categories, cat.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <Row label="Due date">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={localTodayStr()}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 
                dark:border-slate-700 rounded-lg px-3 py-2 text-[0.875rem] text-slate-700 
                dark:text-slate-300 outline-none focus:border-blue-400 transition-colors"
            />
          </Row>

          {/* Lead Time */}
          <div>
            <label className="block text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Lead time (days)
            </label>
            <p className="text-[0.6875rem] text-slate-400 dark:text-slate-500 mb-1.5">
              How many days before the due date should this task appear?
            </p>
            <input
              type="number"
              min="0"
              max="90"
              value={leadDays}
              onChange={(e) => setLeadDays(e.target.value)}
              placeholder="0"
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 
                dark:border-slate-700 rounded-lg px-3 py-2.5 text-[0.875rem] text-slate-700 
                dark:text-slate-300 outline-none focus:border-blue-400 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[0.875rem] text-slate-500 dark:text-slate-400 
              hover:text-slate-700 dark:hover:text-slate-200 transition min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className={`px-4 py-2 text-[0.875rem] font-medium rounded-lg transition-all min-h-[44px]
              ${title.trim()
                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              }`}
          >
            Add Task
          </button>
        </div>
      </div>
    </div>
  )
}
