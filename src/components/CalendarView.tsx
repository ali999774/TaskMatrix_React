import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import type { Task } from '../types'
import { importanceUrgencyToQuadrant } from '../types'
import type { CategoryDef } from '../lib/categories'
import { categoryColor, URGENCY_COLOR } from '../lib/categoryColors'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import DayGrid, { RailChip, parseTime } from './DayGrid'

// ─── Gesture config ────────────────────────────────────────────────────────
// Change these numbers to tune the feel; everything else derives from them.
const MONTHS_BACK = 12          // panels to the left of today
const MONTHS_FORWARD = 12       // panels to the right of today
const TOTAL_PANELS = MONTHS_BACK + MONTHS_FORWARD + 1

// Velocity projection: how much finger momentum contributes to the commit
// decision. Higher = more responsive to flicks; lower = bias toward distance.
const VELOCITY_FACTOR = 0.2

// Spring settle after release. stiffness/damping chosen for iOS-like feel.
const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const

// ─── Static data ───────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAYS_LONG  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

// ─── Types ─────────────────────────────────────────────────────────────────
interface Props {
  tasks: Task[]
  getTasksOnDate: (dateStr: string) => Task[]
  onAddTask: (title: string, dateStr: string) => void
  categories?: CategoryDef[]
}

interface PanelMeta {
  year: number
  month: number   // 0-indexed
}

// ─── MonthPanel ────────────────────────────────────────────────────────────
// Extracted so CalendarView's render path is clean. Receives only primitives
// so it never re-renders due to parent motion-value changes (which bypass
// React's reconciler entirely).
interface MonthPanelProps {
  meta: PanelMeta
  todayStr: string
  selectedDate: string | null
  getTasksOnDate: (ds: string) => Task[]
  onSelect: (ds: string) => void
  pageWidth: number
  categories?: CategoryDef[]
}


function MonthPanel({ meta, todayStr, selectedDate, getTasksOnDate, onSelect, pageWidth, categories }: MonthPanelProps) {
  const { year, month } = meta
  const firstDay     = new Date(year, month, 1).getDay()
  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const monthRows    = Math.ceil((firstDay + daysInMonth) / 7)

  // Days in the previous month (for leading overflow cells)
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const dateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // Trailing cells needed to fill the last week row
  const trailingCount = Math.max(0, monthRows * 7 - firstDay - daysInMonth)

  return (
    // Each panel is exactly one "page" wide — the container clips to this width.
    <div
      className="flex-none flex flex-col"
      style={{ width: pageWidth }}
    >
      {/* Day-name header row — WHY uppercase + letter-spacing: scaffolding
          should recede; bold labels compete with day numbers */}
      <div className="grid grid-cols-7 border-b border-slate-200/60 dark:border-slate-800/60 shrink-0">
        {DAYS_SHORT.map((d, i) => (
          <div
            key={d}
            className={`text-center text-[0.625rem] font-medium py-2 uppercase tracking-[0.06em]
              ${i === 0 || i === 6
                ? 'text-slate-300 dark:text-slate-600'
                : 'text-slate-400 dark:text-slate-500'}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid — WHY no border-l / no per-cell border-r: removing vertical
          lines lets whitespace carry column separation (spreadsheet-y feel gone).
          A single faint border-b between week rows keeps horizontal rhythm. */}
      <div
        className="grid grid-cols-7 flex-1"
        style={{ gridTemplateRows: `repeat(${monthRows}, 1fr)` }}
      >
        {/* Leading out-of-month days — WHY show real dates at 35% opacity:
            fills dead corners with continuity instead of blank grey boxes */}
        {Array.from({ length: firstDay }).map((_, i) => {
          const dayNum = daysInPrevMonth - firstDay + 1 + i
          return (
            <div
              key={`lead-${i}`}
              className="flex flex-col items-start border-b border-slate-100/60 dark:border-slate-800/30 p-1.5 min-h-[68px] overflow-hidden"
            >
              <span className="text-[0.75rem] font-medium tabular-nums w-full text-right text-slate-300 dark:text-slate-700">
                {dayNum}
              </span>
            </div>
          )
        })}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1
          const ds = dateStr(d)
          const dayTasks  = getTasksOnDate(ds)
          const isToday   = ds === todayStr
          const isSelected = ds === selectedDate

          return (
            <button
              key={d}
              onClick={() => onSelect(ds)}
              // WHY no border-r: vertical gridlines removed; rows use border-b only
              className={`flex flex-col items-start border-b border-slate-100/60 dark:border-slate-800/30
                p-1.5 text-left transition-colors min-h-[68px] overflow-hidden
                ${isSelected ? 'bg-blue-100/60 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/20'}`}
            >
              {/* WHY circle wraps only the number, not the full-width span:
                  the number stays in its normal top-right corner position;
                  the circle is a 24px container around it — no reflow */}
              <span className="self-end mb-1">
                <span className={`text-[0.75rem] font-medium tabular-nums
                  ${isToday
                    // WHY bg-blue-600 w-6 h-6 rounded-full: matches Week view's
                    // today circle exactly — single source of truth for today style
                    ? 'bg-blue-600 text-white w-6 h-6 rounded-full inline-flex items-center justify-center'
                    : 'text-slate-700 dark:text-slate-300 inline-flex items-center justify-center w-6 h-6'}`}
                >
                  {d}
                </span>
              </span>
              {/* Chip stack — capped at 3 + "+N more" */}
              <div className="flex flex-col gap-[2px] w-full overflow-hidden">
                {dayTasks.slice(0, 3).map((t) => {
                  const catHex = categoryColor(t.category, categories)
                  return (
                    // WHY category hex for chip color: consistent with matrix stripe
                    // and schedule dot — same category always reads the same color
                    // across all views. Position carries priority, not fill color.
                    <span
                      key={t.id}
                      className="text-[0.625rem] leading-none truncate overflow-hidden text-ellipsis
                        whitespace-nowrap rounded-[3px] px-1 py-[3px] h-[18px] flex items-center"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${catHex} 18%, transparent)`,
                        color: catHex,
                      }}
                    >
                      {t.title}
                    </span>
                  )
                })}
                {dayTasks.length > 3 && (
                  <span className="text-[0.5625rem] tabular-nums text-slate-400 dark:text-slate-500 px-0.5">
                    +{dayTasks.length - 3} more
                  </span>
                )}
              </div>
            </button>
          )
        })}

        {/* Trailing out-of-month days — WHY real day numbers at low opacity:
            mirrors the leading treatment; grid feels complete not truncated */}
        {Array.from({ length: trailingCount }).map((_, i) => (
          <div
            key={`trail-${i}`}
            className="flex flex-col items-start border-b border-slate-100/60 dark:border-slate-800/30 p-1.5 min-h-[68px] overflow-hidden"
          >
            <span className="text-[0.75rem] font-medium tabular-nums w-full text-right text-slate-300 dark:text-slate-700">
              {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CalendarView ─────────────────────────────────────────────────────────────────
export default function CalendarView({ getTasksOnDate, onAddTask, categories }: Props) {
  const today = useMemo(() => new Date(), [])
  const todayStr = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`,
    [today]
  )

  // ── Panel list (computed once at mount; rolling from today) ──────────────
  // We build an array of {year, month} tuples for all TOTAL_PANELS months.
  // todayPanelIndex is the index that puts today's month in the viewport.
  const { panels, todayPanelIndex } = useMemo(() => {
    const list: PanelMeta[] = []
    for (let offset = -MONTHS_BACK; offset <= MONTHS_FORWARD; offset++) {
      const d = new Date(today.getFullYear(), today.getMonth() + offset, 1)
      list.push({ year: d.getFullYear(), month: d.getMonth() })
    }
    return { panels: list, todayPanelIndex: MONTHS_BACK }
  }, [today])

  // ── Page state — the ONLY React state that changes on swipe ─────────────
  // Motion value drives the visual position; page is committed after release.
  // Keeping them separate is what prevents re-renders on every drag frame.
  const [page, setPage] = useState(todayPanelIndex)

  // ── Other views / UI state ───────────────────────────────────────────────
  const [view, setView]               = useState<'day' | 'week' | 'month' | 'schedule'>('month')
  const [weekOffset, setWeekOffset]   = useState(0)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selectedDate) {
      setNewTaskTitle('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [selectedDate])

  // ── pageWidth — measured from the container, updated on resize ──────────
  // We can't know the exact pixel width at render time (responsive layout),
  // so we measure it and re-clamp the strip whenever the container resizes
  // (e.g., orientation change, split-screen on iPad).
  const [pageWidth, setPageWidth] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      if (w === 0) return
      setPageWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Motion value: strip's horizontal position ────────────────────────────
  // useMotionValue bypasses React reconciler — no re-render per drag frame.
  // Initialized to 0 and corrected once pageWidth is known (see effect below).
  const x = useMotionValue(0)

  // Snap to correct position whenever pageWidth becomes known or changes
  // (e.g., after first measure, or after rotation). Use animate so it's
  // smooth if rotation causes a layout shift mid-view.
  useEffect(() => {
    if (pageWidth === 0) return
    animate(x, -page * pageWidth, SPRING)
  }, [pageWidth]) // intentionally omit `page` and `x` — we only re-snap on resize

  // ── Commit a new page (shared by onDragEnd + chevron buttons) ────────────
  const commitPage = useCallback((newPage: number) => {
    const clamped = Math.max(0, Math.min(TOTAL_PANELS - 1, newPage))
    setPage(clamped)
    // animate() is imperative and does NOT go through React state,
    // so the spring runs without triggering a re-render.
    animate(x, -clamped * pageWidth, SPRING)
  }, [x, pageWidth])

  // ── Drag-end handler: velocity-aware page commit ─────────────────────────
  // WHY velocity projection: a short fast flick should feel different from a
  // slow drag past halfway. Without velocity, flicks feel sluggish because the
  // finger lifts before the 25% threshold is crossed.
  const handleDragEnd = useCallback((_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (pageWidth === 0) return
    const COMMIT_THRESHOLD = pageWidth * 0.25
    // Project where the strip "would have gone" given current velocity.
    const projected = info.offset.x + info.velocity.x * VELOCITY_FACTOR
    let nextPage = page
    if (projected < -COMMIT_THRESHOLD) nextPage = page + 1  // swiped left → next month
    else if (projected > COMMIT_THRESHOLD) nextPage = page - 1  // swiped right → prev month
    commitPage(nextPage)
  }, [page, pageWidth, commitPage])

  // ── Chevron navigation ───────────────────────────────────────────────────
  const goToToday = useCallback(() => {
    commitPage(todayPanelIndex)
    setWeekOffset(0)
    setSelectedDate(null)
  }, [todayPanelIndex, commitPage])

  // month-view chevrons work through commitPage so they also spring-settle
  const prevMonth = useCallback(() => commitPage(page - 1), [page, commitPage])
  const nextMonth = useCallback(() => commitPage(page + 1), [page, commitPage])

  // Derived label for the header
  const currentPanel = panels[page] ?? panels[todayPanelIndex]

  // ── Week view helpers (unchanged logic) ──────────────────────────────────
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
    const last  = weekDays[6]
    const fmt   = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    if (first.getFullYear() !== last.getFullYear()) return `${fmt(first)} – ${fmt(last)}`
    if (first.getMonth() === last.getMonth())       return `${fmt(first)} – ${last.getDate()}, ${last.getFullYear()}`
    return `${fmt(first)} – ${fmt(last)}, ${last.getFullYear()}`
  })()

  const scheduleDates = (() => {
    const { year, month } = currentPanel
    const dateMap = new Map<string, Task[]>()
    const start = new Date(year, month - 1, 1)
    const end   = new Date(year, month + 2, 0)
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0]
      const tasks = getTasksOnDate(ds)
      if (tasks.length > 0) dateMap.set(ds, tasks)
    }
    return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b))
  })()

  const selectedTasks = selectedDate ? getTasksOnDate(selectedDate) : []

  // ─────────────────────────────────────────────────────────────────────────
  return (
    // Outer wrapper: no touch handlers here — Motion owns horizontal gesture
    // on the strip; other views use chevrons only.
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">

      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-between px-4 sm:px-5 pt-[env(safe-area-inset-top)] pb-2 sm:pb-3 pl-16 sm:pl-14">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={goToToday}
              className="text-[0.75rem] sm:text-[0.8125rem] font-medium text-blue-600 dark:text-blue-400
                border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30
                px-2 sm:px-3 py-1 sm:py-1.5 rounded-md active:scale-95 transition-all shrink-0"
            >
              Today
            </button>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={view === 'week' ? prevWeek : prevMonth}
                disabled={view === 'month' && page === 0}
                className="p-1 sm:p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800
                  active:scale-90 transition-all text-slate-600 dark:text-slate-400
                  disabled:opacity-30 disabled:pointer-events-none"
                aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={view === 'week' ? nextWeek : nextMonth}
                disabled={view === 'month' && page === TOTAL_PANELS - 1}
                className="p-1 sm:p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800
                  active:scale-90 transition-all text-slate-600 dark:text-slate-400
                  disabled:opacity-30 disabled:pointer-events-none"
                aria-label={view === 'week' ? 'Next week' : 'Next month'}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <h2 className="text-[0.9375rem] sm:text-[1.125rem] font-normal text-slate-800 dark:text-slate-100 truncate">
              {view === 'week'
                ? weekLabel
                : `${MONTHS[currentPanel.month]} ${currentPanel.year}`}
            </h2>
          </div>

          {/* View toggle — desktop inline */}
          <div className="hidden sm:flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0">
            {(['day', 'week', 'month', 'schedule'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`text-[0.75rem] capitalize px-2.5 py-1 rounded-md transition-all
                  ${view === v
                    ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-medium'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* View toggle — mobile full-width row */}
        <div className="flex sm:hidden items-center bg-slate-100 dark:bg-slate-800 mx-4 mb-2 rounded-lg p-0.5">
          {(['day', 'week', 'month', 'schedule'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 text-[0.6875rem] capitalize py-1.5 rounded-md transition-all text-center
                ${view === v
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm font-medium'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Month view — gesture-driven strip ──────────────────────────── */}
      {view === 'month' && (
        // containerRef: we measure this element's width to know pageWidth.
        // overflow-hidden clips the strip to exactly one panel width.
        <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden relative">
          {pageWidth > 0 && (
            // WHY motion.div instead of a plain div + onTouchEnd:
            // motion.div binds x continuously to the pointer position via its
            // internal PointerEvent listener. The transform updates through the
            // motion value, bypassing React's reconciler entirely — zero
            // re-renders per frame, which is the root fix for WKWebView jank.
            <motion.div
              drag="x"
              // WHY dragConstraints: prevents dragging past the first/last panel.
              // dragElastic={0.18} gives a rubber-band feel at the bounds instead
              // of a hard stop, matching native iOS scroll behaviour.
              dragConstraints={{
                left:  -(TOTAL_PANELS - 1) * pageWidth,
                right: 0,
              }}
              dragElastic={0.18}
              // WHY touch-action pan-y: tells the browser to handle vertical
              // scroll natively while Motion captures horizontal panning.
              // Without this, dragging diagonally on iOS would prevent page scroll.
              style={{
                x,
                width: TOTAL_PANELS * pageWidth,
                display: 'flex',
                touchAction: 'pan-y',
                willChange: 'transform',   // promotes strip to its own compositor layer
              }}
              onDragEnd={handleDragEnd}
            >
              {panels.map((meta) => (
                <MonthPanel
                  key={`${meta.year}-${meta.month}`}
                  meta={meta}
                  todayStr={todayStr}
                  selectedDate={selectedDate}
                  getTasksOnDate={getTasksOnDate}
                  onSelect={(ds) => setSelectedDate(prev => prev === ds ? null : ds)}
                  pageWidth={pageWidth}
                  categories={categories}
                />
              ))}
            </motion.div>
          )}

          {/* Desktop-only side arrow overlays — hidden on touch screens so they
              don't overlap the swipe gesture area on iOS/Android.
              pointer-events-none on the wrapper lets clicks fall through to the
              calendar grid; only the buttons themselves are clickable. */}
          <div className="pointer-events-none absolute inset-y-0 inset-x-0 hidden sm:flex items-center justify-between px-1 z-10">
            <button
              onClick={prevMonth}
              disabled={page === 0}
              aria-label="Previous month"
              className="pointer-events-auto w-8 h-8 flex items-center justify-center
                rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm
                border border-slate-200/60 dark:border-slate-700/60
                text-slate-500 dark:text-slate-400
                hover:bg-white dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100
                shadow-sm transition-all active:scale-90
                disabled:opacity-0 disabled:pointer-events-none"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={nextMonth}
              disabled={page === TOTAL_PANELS - 1}
              aria-label="Next month"
              className="pointer-events-auto w-8 h-8 flex items-center justify-center
                rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm
                border border-slate-200/60 dark:border-slate-700/60
                text-slate-500 dark:text-slate-400
                hover:bg-white dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100
                shadow-sm transition-all active:scale-90
                disabled:opacity-0 disabled:pointer-events-none"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Week view ────────────────────────────────────────────────── */}
      {view === 'week' && (() => {

        // ── Chip cap: 4 visible + "+N more" overflow ─────────────────────────
        const WEEK_CHIP_CAP = 4

        // WHY untimed-first sort: consistent with Day view where untimed tasks
        // live in the rail above timed tasks — the same priority order reads
        // the same way in every view.
        function sortForWeek(tasks: Task[]) {
          return [...tasks].sort((a, b) => {
            const ta = parseTime(a.due_time)
            const tb = parseTime(b.due_time)
            if (!ta && !tb) return 0
            if (!ta) return -1   // untimed floats to top
            if (!tb) return 1
            return (ta.hour * 60 + ta.minute) - (tb.hour * 60 + tb.minute)
          })
        }

        return (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* ── 7-column header row (day name + date) ───────────────────── */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 shrink-0">
              {weekDays.map((d, i) => {
                const ds      = d.toISOString().split('T')[0]
                const isToday = ds === todayStr
                return (
                  // WHY navigate to Day view on tap: Week is a load overview;
                  // detail lives in Day view — tapping the header drills there.
                  <button
                    key={i}
                    onClick={() => { setSelectedDate(ds); setView('day') }}
                    className={`text-center py-2.5 transition-colors min-h-[44px]
                      ${ isToday ? 'bg-blue-50/40 dark:bg-blue-900/15' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30' }`}
                  >
                    <div className="text-[0.625rem] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      {DAYS_SHORT[i]}
                    </div>
                    <div className={`text-[1.125rem] font-normal mt-0.5
                      ${ isToday
                        ? 'bg-blue-600 text-white w-8 h-8 rounded-full inline-flex items-center justify-center text-[0.9375rem]'
                        : 'text-slate-800 dark:text-slate-200' }`}
                    >
                      {d.getDate()}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* ── 7-column body: chip stacks (wide) / dot heatmap (narrow) ──── */}
            <div className="grid grid-cols-7 flex-1 overflow-y-auto">
              {weekDays.map((d, i) => {
                const ds      = d.toISOString().split('T')[0]
                const isToday = ds === todayStr
                const sorted  = sortForWeek(getTasksOnDate(ds))
                const visible = sorted.slice(0, WEEK_CHIP_CAP)
                const extra   = sorted.length - WEEK_CHIP_CAP

                return (
                  <div
                    key={i}
                    className={`flex flex-col border-r border-slate-100 dark:border-slate-800/60
                      last:border-r-0 min-h-[80px]
                      ${ isToday ? 'bg-blue-50/20 dark:bg-blue-900/5' : '' }`}
                  >

                    {/* NARROW: colored dot heatmap (hidden on sm+) */}
                    {/* WHY category color dots: same hue as the task card stripe —
                        lets you spot "all my Personal tasks this week" at a glance.
                        Dots are too small for urgency ring overlay; keep them simple. */}
                    <button
                      onClick={() => { setSelectedDate(ds); setView('day') }}
                      className="flex sm:hidden flex-col items-center gap-0.5 py-2 px-0.5 min-h-[44px] w-full"
                      aria-label={`${d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${sorted.length} task${sorted.length !== 1 ? 's' : ''}`}
                    >
                      <div className="flex flex-wrap justify-center gap-[3px]">
                        {sorted.slice(0, 5).map(t => {
                          const catHex = categoryColor(t.category, categories)
                          return (
                            <span
                              key={t.id}
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: catHex }}
                            />
                          )
                        })}
                      </div>
                      {sorted.length > 0 && (
                        <span className="text-[0.5rem] tabular-nums text-slate-400 dark:text-slate-500 mt-0.5">
                          {sorted.length}
                        </span>
                      )}
                    </button>

                    {/* WIDE: text chip stack (hidden below sm) */}
                    {/* WHY RailChip reuse: one source of truth for chip appearance
                        — category color dot + title + time — so Week chips look
                        identical to Day view's untimed rail chips. */}
                    <div className="hidden sm:flex flex-col gap-1 p-1.5 flex-1">
                      {visible.map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setSelectedDate(ds); setView('day') }}
                          className="text-left min-h-[44px] w-full"
                        >
                          <RailChip task={t} categoryHex={categoryColor(t.category, categories)} />
                        </button>
                      ))}
                      {extra > 0 && (
                        // WHY "+N more" navigates to Day view: same as the dot
                        // column on narrow — overflow means "see Day view".
                        <button
                          onClick={() => { setSelectedDate(ds); setView('day') }}
                          className="text-[0.6875rem] text-slate-400 dark:text-slate-500
                            hover:text-slate-600 dark:hover:text-slate-300
                            text-left px-1 py-0.5 min-h-[44px] flex items-center"
                        >
                          +{extra} more
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Day view — two-zone layout: untimed rail + hour grid ─────────── */}
      {view === 'day' && (() => {
        const activeDay = selectedDate ? new Date(selectedDate + 'T00:00:00') : today
        const prevDay = () => {
          const d = new Date(activeDay); d.setDate(d.getDate() - 1)
          setSelectedDate(d.toISOString().split('T')[0])
        }
        const nextDay = () => {
          const d = new Date(activeDay); d.setDate(d.getDate() + 1)
          setSelectedDate(d.toISOString().split('T')[0])
        }
        const ds      = activeDay.toISOString().split('T')[0]
        const dayTasks = getTasksOnDate(ds)
        const isToday  = ds === todayStr

        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Day nav header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <button onClick={prevDay} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all text-slate-600 dark:text-slate-400">
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <div className={`text-[1.125rem] font-normal ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
                  {DAYS_LONG[activeDay.getDay()]}, {MONTHS[activeDay.getMonth()]} {activeDay.getDate()}
                </div>
              </div>
              <button onClick={nextDay} className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-90 transition-all text-slate-600 dark:text-slate-400">
                <ChevronRight size={18} />
              </button>
            </div>
            {/* DayGrid: untimed rail + scrollable hour grid */}
            <DayGrid tasks={dayTasks} isToday={isToday} categories={categories} />
          </div>
        )
      })()}


      {/* ── Schedule view — polished: quadrant dots, quiet dividers ────────── */}
      {view === 'schedule' && (
        <div className="flex-1 overflow-y-auto">
          {scheduleDates.length === 0 ? (
            <p className="text-[0.8125rem] text-slate-400 dark:text-slate-500 text-center mt-12">No upcoming tasks</p>
          ) : (
            scheduleDates.map(([ds, tasks]) => {
              const date    = new Date(ds + 'T00:00:00')
              const isToday = ds === todayStr
              return (
                <div key={ds}>
                  {/* Date group header — sticky, clearly separated from items */}
                  <div className={`sticky top-0 z-10 px-5 py-2
                    border-b border-slate-200/60 dark:border-slate-800/60
                    ${isToday ? 'bg-blue-50/60 dark:bg-blue-900/15' : 'bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm'}`}
                  >
                    <div className={`text-[0.75rem] font-semibold
                      ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {isToday ? 'Today' : DAYS_LONG[date.getDay()]} · {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  {/* Items within a date group — WHY no border-b between items,
                      only between date groups: quieter; the dot + spacing
                      give enough separation without horizontal lines fighting
                      for attention with the content */}
                  {tasks.map((t, idx) => {
                    const q      = importanceUrgencyToQuadrant(t.importance, t.urgency)
                    const isDone = t.status === 'done'
                    // Category hex is the base color; done tasks get a muted neutral.
                    const catHex = isDone ? 'var(--color-quad-dont-do)' : categoryColor(t.category, categories)
                    // Q1 (urgent+important): red ring overlaid ON TOP of category dot.
                    // Only shown where position stops carrying priority (schedule has no
                    // spatial quadrant grouping). NOT shown in the matrix — redundant there.
                    const isUrgent = q === 1 && !isDone
                    return (
                      <div
                        key={t.id}
                        // WHY faint separator only between items (not after last):
                        // keeps intra-group structure without heavy gridlines
                        className={`flex items-center gap-3 py-2.5 px-5 min-h-[44px]
                          hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors
                          ${idx < tasks.length - 1 ? 'border-b border-slate-100/50 dark:border-slate-800/20' : ''}`}
                      >
                        {/* WHY category hex for dot: same color as matrix stripe and
                            calendar chip — consistency across views. The urgency ring
                            (red outline) is layered ON TOP for Q1 tasks, earning its
                            place here where position doesn't encode priority. */}
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: catHex,
                            boxShadow: isUrgent ? `0 0 0 2px ${URGENCY_COLOR}` : 'none',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <span className={`text-[0.875rem] text-slate-700 dark:text-slate-300
                            ${isDone ? 'line-through opacity-50' : ''}`}>
                            {t.title}
                          </span>
                        </div>
                        {/* WHY tabular-nums: time column stays on a fixed grid
                            regardless of digit count (1-digit vs 2-digit hours) */}
                        {t.due_time && (
                          <span className="text-[0.6875rem] tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                            {t.due_time.slice(0, 5)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── Add-task drawer (unchanged) ─────────────────────────────────── */}
      {selectedDate && (
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 px-5 py-3 max-h-[30%] overflow-y-auto shrink-0">
          <div className="text-[0.6875rem] font-medium text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wide">
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
              className="w-full bg-transparent border-b border-slate-200 dark:border-slate-700 pb-1.5
                text-[0.875rem] text-slate-700 dark:text-slate-300 outline-none
                focus:border-blue-500 dark:focus:border-blue-500
                placeholder-slate-400 dark:placeholder-slate-600"
            />
          </form>
          {selectedTasks.length === 0 ? (
            <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 italic">No tasks</p>
          ) : (
            <ul className="space-y-1">
              {selectedTasks.map(t => (
                <li key={t.id} className="text-[0.8125rem] text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'done' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                  <span className={t.status === 'done' ? 'line-through opacity-50' : ''}>{t.title}</span>
                  {t.due_time && (
                    <span className="text-[0.6875rem] text-slate-400 dark:text-slate-500 ml-auto tabular-nums">{t.due_time.slice(0, 5)}</span>
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
