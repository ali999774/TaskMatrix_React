import { useState, useEffect, useRef } from 'react'
import type { Task } from '../types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  tasks: Task[]
  getTasksOnDate: (dateStr: string) => Task[]
  onAddTask: (title: string, dateStr: string) => void
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

export default function CalendarView({ getTasksOnDate, onAddTask }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input and clear previous text when a date is selected
  useEffect(() => {
    if (selectedDate) {
      setNewTaskTitle('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [selectedDate])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = today.toISOString().split('T')[0]

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const dateStr = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const selectedTasks = selectedDate ? getTasksOnDate(selectedDate) : []

  return (
    <div className="flex flex-col h-full">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center" aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <h2 className="text-[1.0625rem] font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
          {MONTHS[month]} {year}
        </h2>
        <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center" aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-2 pb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[0.6875rem] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 px-2 flex-1 overflow-y-auto content-start pb-2">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1
          const ds = dateStr(d)
          const dayTasks = getTasksOnDate(ds)
          const hasTask = dayTasks.length > 0
          const isToday = ds === todayStr
          const isSelected = ds === selectedDate

          return (
            <button
              key={d}
              onClick={() => setSelectedDate(isSelected ? null : ds)}
              className={`flex flex-col items-start rounded-xl text-[0.875rem] font-medium transition-all active:scale-90 motion-reduce:scale-100 min-h-[80px] p-2 gap-1
                ${isToday
                  ? 'bg-blue-600 text-white'
                  : isSelected
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
            >
              <span className={`text-[0.75rem] font-semibold w-6 text-center ${!isToday && 'text-slate-400 dark:text-slate-500'}`}>{d}</span>
              {hasTask && (
                <div className="flex flex-col gap-px w-full overflow-hidden">
                  {dayTasks.slice(0, 3).map(t => (
                    <span key={t.id} className={`text-[0.6875rem] leading-tight truncate w-full ${isToday ? 'text-white/80' : 'text-blue-600 dark:text-blue-400'}`}>
                      {t.title}
                    </span>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className={`text-[0.625rem] ${isToday ? 'text-white/50' : 'text-slate-400'}`}>+{dayTasks.length - 3} more</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected date task list */}
      {selectedDate && (
        <div className="border-t border-slate-200 dark:border-slate-800 px-4 py-3 max-h-[45%] overflow-y-auto shrink-0">
          <h3 className="text-[0.8125rem] font-semibold text-slate-500 dark:text-slate-400 mb-2">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (newTaskTitle.trim()) {
                onAddTask(newTaskTitle.trim(), selectedDate)
                setNewTaskTitle('')
              }
            }}
            className="mb-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="+ Add task for this date…"
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-[0.8125rem] text-slate-700 dark:text-slate-300 outline-none focus:border-blue-400 dark:focus:border-blue-600 placeholder-slate-400 dark:placeholder-slate-600"
            />
          </form>
          {selectedTasks.length === 0 ? (
            <p className="text-[0.8125rem] text-slate-400 dark:text-slate-500 italic">No tasks due</p>
          ) : (
            <ul className="space-y-1">
              {selectedTasks.map(t => (
                <li key={t.id} className="text-[0.875rem] text-slate-700 dark:text-slate-300 flex items-center gap-2 py-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === 'done' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                  <span className={t.status === 'done' ? 'line-through opacity-60' : ''}>{t.title}</span>
                  {t.due_time && (
                    <span className="text-[0.75rem] text-slate-400 dark:text-slate-500 ml-auto">{t.due_time.slice(0, 5)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
