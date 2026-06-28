import { useState, useEffect, useRef } from 'react'
import type { Task } from '../types'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  tasks: Task[]
  getTasksOnDate: (dateStr: string) => Task[]
  onAddTask: (title: string, dateStr: string) => void
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAYS_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

export default function CalendarView({ getTasksOnDate, onAddTask }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [view, setView] = useState<'day' | 'week' | 'month' | 'schedule'>('month')
  const [weekOffset, setWeekOffset] = useState(0)
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
  const monthRows = Math.ceil((firstDay + daysInMonth) / 7)

  const goToToday = () => {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setWeekOffset(0)
    setSelectedDate(null)
  }

  // Week navigation
  const prevWeek = () => setWeekOffset(w => w - 1)
  const nextWeek = () => setWeekOffset(w => w + 1)

  const getWeekDays = (): Date[] => {
    const d = new Date(today)
    d.setDate(d.getDate() + weekOffset * 7)
    const dayOfWeek = d.getDay()
    const start = new Date(d)
    start.setDate(d.getDate() - dayOfWeek)
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

  // Schedule: build a list of all dates with tasks, sorted chronologically
  const scheduleDates = (() => {
    const dateMap = new Map<string, Task[]>()
    // Collect all dates from month view's visible range +- a few months
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month + 2, 0)
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0]
      const tasks = getTasksOnDate(ds)
      if (tasks.length > 0) dateMap.set(ds, tasks)
    }
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b))
  })()

  return (
    <div className="flex flex-col h-full">
      {/* Google-style header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={goToToday}
            className="text-[0.8125rem] font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 px-3 py-1 rounded active:scale-90 transition-all min-h-[32px]"
          >
            Today
          </button>
          <div className="flex items-center gap-0.5">
            <button
              onClick={view === 'week' ? prevWeek : prevMonth}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-600 dark:text-slate-400"
              aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={view === 'week' ? nextWeek : nextMonth}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-600 dark:text-slate-400"
              aria-label={view === 'week' ? 'Next week' : 'Next month'}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <h2 className="text-[1.1875rem] font-normal text-slate-800 dark:text-slate-100 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
            {view === 'week' ? weekLabel : `${MONTHS[month]} ${year}`}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {(['day', 'week', 'month', 'schedule'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[0.75rem] capitalize px-2.5 py-1 rounded transition-colors
                ${view === v
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Month view — Google Calendar style */}
      {view === 'month' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 shrink-0">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-[0.6875rem] font-medium text-slate-500 dark:text-slate-400 py-2 border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${monthRows}, 1fr)` }}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1
              const ds = dateStr(d)
              const dayTasks = getTasksOnDate(ds)
              const isToday = ds === todayStr
              const isSelected = ds === selectedDate

              return (
                <button
                  key={d}
                  onClick={() => setSelectedDate(isSelected ? null : ds)}
                  className={`flex flex-col items-start border-b border-r border-slate-200 dark:border-slate-700 p-1 text-left transition-colors min-h-[72px] overflow-hidden
                    ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                    ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                >
                  <span className={`text-[0.75rem] font-medium mb-0.5 w-full text-right pr-1
                    ${isToday ? 'bg-blue-600 text-white rounded-full w-6 h-6 inline-flex items-center justify-center ml-auto' : 'text-slate-700 dark:text-slate-300'}`}>
                    {d}
                  </span>
                  <div className="flex flex-col gap-px w-full overflow-hidden">
                    {dayTasks.slice(0, 3).map(t => (
                      <span key={t.id} className="text-[0.625rem] leading-tight truncate rounded-sm px-1 py-px bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                        {t.title}
                      </span>
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-[0.5625rem] text-slate-400 dark:text-slate-500 px-1">+{dayTasks.length - 3} more</span>
                    )}
                  </div>
                </button>
              )
            })}
            {/* Fill remaining cells to complete the grid */}
            {Array.from({ length: Math.max(0, monthRows * 7 - firstDay - daysInMonth) }).map((_, i) => (
              <div key={`trail-${i}`} className="border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20" />
            ))}
          </div>
        </div>
      )}

      {/* Week view — Google Calendar style */}
      {view === 'week' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700 shrink-0">
            {weekDays.map((d, i) => {
              const ds = d.toISOString().split('T')[0]
              const isToday = ds === todayStr
              const isSelected = ds === selectedDate
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(isSelected ? null : ds)}
                  className={`text-center py-2 border-r border-slate-200 dark:border-slate-700 last:border-r-0 transition-colors
                    ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
                    ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                >
                  <div className="text-[0.625rem] uppercase tracking-wide text-slate-500 dark:text-slate-400">{DAYS_SHORT[i]}</div>
                  <div className={`text-[1.25rem] font-normal mt-0.5
                    ${isToday ? 'bg-blue-600 text-white w-9 h-9 rounded-full inline-flex items-center justify-center' : 'text-slate-800 dark:text-slate-200'}`}>
                    {d.getDate()}
                  </div>
                </button>
              )
            })}
          </div>
          <div className="grid grid-cols-7 flex-1 overflow-y-auto">
            {weekDays.map((d, i) => {
              const ds = d.toISOString().split('T')[0]
              const dayTasks = getTasksOnDate(ds)
              const isToday = ds === todayStr
              const isSelected = ds === selectedDate
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(isSelected ? null : ds)}
                  className={`flex flex-col items-start border-r border-slate-200 dark:border-slate-700 last:border-r-0 p-1 text-left transition-colors gap-px
                    ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}
                    ${isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                >
                  {dayTasks.slice(0, 6).map(t => (
                    <span key={t.id} className={`text-[0.625rem] leading-tight truncate w-full rounded-sm px-1 py-px bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200`}>
                      {t.title}
                    </span>
                  ))}
                  {dayTasks.length > 6 && (
                    <span className="text-[0.5625rem] text-slate-400 dark:text-slate-500 px-1">+{dayTasks.length - 6}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Day view — Google Calendar style */}
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
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
                <button onClick={prevDay} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-600 dark:text-slate-400">
                  <ChevronLeft size={18} />
                </button>
                <div className="text-center">
                  <div className={`text-[1.125rem] font-normal ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
                    {DAYS_LONG[activeDay.getDay()]}, {MONTHS[activeDay.getMonth()]} {activeDay.getDate()}
                  </div>
                </div>
                <button onClick={nextDay} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 min-h-[36px] min-w-[36px] inline-flex items-center justify-center text-slate-600 dark:text-slate-400">
                  <ChevronRight size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {dayTasks.length === 0 ? (
                  <p className="text-[0.8125rem] text-slate-400 dark:text-slate-500 text-center mt-12">No events</p>
                ) : (
                  <ul className="space-y-1">
                    {dayTasks.map(t => (
                      <li key={t.id} className="flex items-center gap-3 py-2.5 px-3 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.status === 'done' ? 'bg-emerald-400' : 'bg-blue-500'}`} />
                        <span className={`text-[0.875rem] text-slate-700 dark:text-slate-300 ${t.status === 'done' ? 'line-through' : ''}`}>{t.title}</span>
                        {t.due_time && (
                          <span className="text-[0.75rem] text-slate-400 dark:text-slate-500 ml-auto">{t.due_time.slice(0, 5)}</span>
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

      {/* Schedule view — Google Calendar style (list of upcoming tasks) */}
      {view === 'schedule' && (
        <div className="flex-1 overflow-y-auto">
          {scheduleDates.length === 0 ? (
            <p className="text-[0.8125rem] text-slate-400 dark:text-slate-500 text-center mt-12">No upcoming tasks</p>
          ) : (
            scheduleDates.map(([ds, tasks]) => {
              const date = new Date(ds + 'T00:00:00')
              const isToday = ds === todayStr
              return (
                <div key={ds}>
                  <div className={`sticky top-0 z-10 px-4 py-2 border-b border-slate-200 dark:border-slate-700
                    ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
                    <div className={`text-[0.75rem] font-medium ${isToday ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' })} ·
                      {' '}{date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  {tasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 py-2.5 px-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.status === 'done' ? 'bg-emerald-400' : 'bg-blue-500'}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-[0.875rem] text-slate-700 dark:text-slate-300 ${t.status === 'done' ? 'line-through' : ''}`}>
                          {t.title}
                        </span>
                      </div>
                      {t.due_time && (
                        <span className="text-[0.75rem] text-slate-400 dark:text-slate-500">{t.due_time.slice(0, 5)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Bottom add-task section — shown when a date is selected */}
      {selectedDate && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 max-h-[40%] overflow-y-auto shrink-0">
          <div className="text-[0.75rem] font-medium text-slate-500 dark:text-slate-400 mb-2">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (newTaskTitle.trim()) {
                onAddTask(newTaskTitle.trim(), selectedDate)
                setNewTaskTitle('')
              }
            }}
            className="mb-3"
          >
            <input
              ref={inputRef}
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add a task…"
              className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 pb-1.5 text-[0.875rem] text-slate-700 dark:text-slate-300 outline-none focus:border-blue-500 dark:focus:border-blue-500 placeholder-slate-400 dark:placeholder-slate-600"
            />
          </form>
          {selectedTasks.length === 0 ? (
            <p className="text-[0.8125rem] text-slate-400 dark:text-slate-500 italic">No tasks</p>
          ) : (
            <ul className="space-y-1">
              {selectedTasks.map(t => (
                <li key={t.id} className="text-[0.8125rem] text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'done' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                  <span className={t.status === 'done' ? 'line-through opacity-60' : ''}>{t.title}</span>
                  {t.due_time && (
                    <span className="text-[0.6875rem] text-slate-400 dark:text-slate-500 ml-auto">{t.due_time.slice(0, 5)}</span>
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
