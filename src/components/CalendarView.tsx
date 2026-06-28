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
  const [view, setView] = useState<'day' | 'week' | 'month'>('month')
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week
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

  const goToToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setWeekOffset(0)
    setSelectedDate(null)
  }

  // Week navigation
  const prevWeek = () => setWeekOffset(w => w - 1)
  const nextWeek = () => setWeekOffset(w => w + 1)

  // Get the 7 days for the current week view
  const getWeekDays = (): Date[] => {
    const d = new Date(today)
    d.setDate(d.getDate() + weekOffset * 7)
    const dayOfWeek = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - dayOfWeek) // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      return date
    })
  }

  const weekDays = getWeekDays()
  const weekLabel = (() => {
    const first = weekDays[0]
    const last = weekDays[6]
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (first.getMonth() === last.getMonth()) {
      return `${fmt(first)} – ${last.getDate()}, ${last.getFullYear()}`
    }
    return `${fmt(first)} – ${fmt(last)}, ${last.getFullYear()}`
  })()

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
      {/* Header: Today button + title + arrows */}
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={goToToday}
          className="text-[0.8125rem] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-90 transition-all min-h-[36px]"
        >
          Today
        </button>
        <h2 className="text-[1.0625rem] font-semibold text-slate-800 dark:text-slate-100 tabular-nums truncate px-2">
          {view === 'week' ? weekLabel : `${MONTHS[month]} ${year}`}
        </h2>
        <div className="flex gap-0.5">
          <button
            onClick={view === 'week' ? prevWeek : prevMonth}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-600 dark:text-slate-400"
            aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={view === 'week' ? nextWeek : nextMonth}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-600 dark:text-slate-400"
            aria-label={view === 'week' ? 'Next week' : 'Next month'}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Segmented view toggle — Apple Calendar style */}
      <div className="px-4 pb-2">
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          {(['day', 'week', 'month'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 text-[0.75rem] font-medium py-1.5 rounded-md transition-all capitalize
                ${view === v
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && (
        <>
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
        </>
      )}

      {view === 'day' && (
        (() => {
          const activeDay = selectedDate ? new Date(selectedDate + 'T00:00:00') : today
          const prevDay = () => {
            const d = new Date(activeDay)
            d.setDate(d.getDate() - 1)
            setSelectedDate(d.toISOString().split('T')[0])
          }
          const nextDay = () => {
            const d = new Date(activeDay)
            d.setDate(d.getDate() + 1)
            setSelectedDate(d.toISOString().split('T')[0])
          }
          const ds = activeDay.toISOString().split('T')[0]
          const dayTasks = getTasksOnDate(ds)
          const isToday = ds === todayStr

          return (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-2 shrink-0">
                <button onClick={prevDay} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-600 dark:text-slate-400">
                  <ChevronLeft size={18} />
                </button>
                <div className="text-center">
                  <div className={`text-[1.25rem] font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
                    {activeDay.toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                  <div className="text-[0.875rem] text-slate-500 dark:text-slate-400">
                    {activeDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <button onClick={nextDay} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-600 dark:text-slate-400">
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Task list */}
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {dayTasks.length === 0 ? (
                  <p className="text-[0.875rem] text-slate-400 dark:text-slate-500 italic text-center mt-8">No tasks</p>
                ) : (
                  <ul className="space-y-1">
                    {dayTasks.map(t => (
                      <li key={t.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'done' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                        <span className={`text-[0.875rem] flex-1 ${t.status === 'done' ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
                          {t.title}
                        </span>
                        {t.due_time && (
                          <span className="text-[0.75rem] text-slate-400 dark:text-slate-500">{t.due_time.slice(0, 5)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        })()
      )}

      {view === 'week' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 px-2 pb-1 shrink-0">
            {weekDays.map((d, i) => {
              const ds = d.toISOString().split('T')[0]
              const isToday = ds === todayStr
              const isSelected = ds === selectedDate
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(isSelected ? null : ds)}
                  className={`text-center py-1 rounded-lg transition-all
                    ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400'}
                    ${isSelected ? 'bg-slate-200 dark:bg-slate-700' : ''}`}
                >
                  <div className="text-[0.625rem] uppercase tracking-wide">{DAYS[i]}</div>
                  <div className={`text-[1rem] font-semibold ${isToday ? 'bg-blue-600 text-white w-8 h-8 rounded-full inline-flex items-center justify-center mx-auto' : ''}`}>
                    {d.getDate()}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Week columns */}
          <div className="grid grid-cols-7 flex-1 overflow-y-auto px-1 gap-1 pb-2">
            {weekDays.map((d, i) => {
              const ds = d.toISOString().split('T')[0]
              const dayTasks = getTasksOnDate(ds)
              const isToday = ds === todayStr
              const isSelected = ds === selectedDate
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(isSelected ? null : ds)}
                  className={`flex flex-col items-start rounded-lg p-1 text-left transition-all min-h-[60px]
                    ${isToday ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                    ${isSelected ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
                >
                  {dayTasks.slice(0, 4).map(t => (
                    <span key={t.id} className={`text-[0.625rem] leading-tight truncate w-full
                      ${t.status === 'done' ? 'line-through opacity-50' : 'text-blue-700 dark:text-blue-300'}`}>
                      {t.title}
                    </span>
                  ))}
                  {dayTasks.length > 4 && (
                    <span className="text-[0.5625rem] text-slate-400">+{dayTasks.length - 4}</span>
                  )}
                  {dayTasks.length === 0 && (
                    <span className="text-[0.625rem] text-slate-300 dark:text-slate-700">—</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

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
