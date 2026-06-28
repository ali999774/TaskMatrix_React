import { useRef, useEffect, useMemo } from 'react'
import type { Task } from '../types'
import { importanceUrgencyToQuadrant } from '../types'
import type { CategoryDef } from '../lib/categories'
import { categoryColor } from '../lib/categoryColors'

// ─── Grid constants — single source of truth ────────────────────────────────
// Change these to tune the layout; everything else derives from them.
const GRID_START_HOUR = 6    // 6 AM — earliest visible hour
const GRID_END_HOUR   = 21   // 9 PM — hour AFTER the last visible slot
const PX_PER_HOUR     = 64   // row height in px; tune per device feel
const PX_PER_MIN      = PX_PER_HOUR / 60
// Total scrollable height: 15 hours × 64px = 960px
const TOTAL_HEIGHT    = (GRID_END_HOUR - GRID_START_HOUR) * PX_PER_HOUR

// Quadrant → CSS variable map (reuses design tokens from index.css @theme)
const QUAD_COLOR: Record<number, string> = {
  1: 'var(--color-quad-do-first)',
  2: 'var(--color-quad-invest)',
  3: 'var(--color-quad-delegate)',
  4: 'var(--color-quad-dont-do)',
}

// ─── Hour-label formatting ───────────────────────────────────────────────────
function hourLabel(h: number): string {
  if (h === 0 || h === 24) return '12 AM'
  if (h === 12)            return '12 PM'
  return h < 12 ? `${h} AM` : `${h - 12} PM`
}

// ─── Parse due_time "HH:MM" or "HH:MM:SS" → { hour, minute } | null ─────────
// Exported so WeekView can reuse it for untimed-first sort without duplicating the parser.
export function parseTime(due_time: string | null | undefined): { hour: number; minute: number } | null {
  if (!due_time) return null
  const parts = due_time.split(':')
  const hour   = parseInt(parts[0], 10)
  const minute = parseInt(parts[1] ?? '0', 10)
  if (isNaN(hour) || isNaN(minute)) return null
  return { hour, minute }
}

// ─── Classify each task into timed-in-window vs. rail ───────────────────────
interface TimedTask {
  task: Task
  hour: number
  minute: number
  top: number   // px offset from top of grid
}

interface Classified {
  timed: TimedTask[]
  rail:  Task[]
}

function classifyTasks(tasks: Task[]): Classified {
  const timed: TimedTask[] = []
  const rail:  Task[]      = []

  for (const task of tasks) {
    const t = parseTime(task.due_time)
    if (t && t.hour >= GRID_START_HOUR && t.hour < GRID_END_HOUR) {
      // WHY: hours inside [GRID_START_HOUR, GRID_END_HOUR) get a pixel offset
      // using the minutes-from-start formula so they sit at their exact time.
      const minutesFromStart = (t.hour * 60 + t.minute) - GRID_START_HOUR * 60
      timed.push({ task, hour: t.hour, minute: t.minute, top: minutesFromStart * PX_PER_MIN })
    } else {
      // WHY: untimed tasks AND out-of-window timed tasks go to the rail so
      // nothing is silently dropped — the rail is the catch-all safety net.
      rail.push(task)
    }
  }

  return { timed, rail }
}

// ─── Untimed Rail chip ───────────────────────────────────────────────────────
// Exported so Week view can reuse the exact same chip — one source of truth for
// chip appearance across Day untimed-rail and Week column stacks.
export function RailChip({ task, categoryHex }: { task: Task; categoryHex?: string }) {
  const q     = importanceUrgencyToQuadrant(task.importance, task.urgency)
  // Use provided category hex; fall back to quadrant color if not supplied
  const color = categoryHex ?? QUAD_COLOR[q]
  const t     = parseTime(task.due_time)

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full
        bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
        shadow-sm min-h-[36px] min-w-[44px] shrink-0"
    >
      {/* Quadrant color dot */}
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-[0.75rem] font-medium text-slate-700 dark:text-slate-200 truncate max-w-[120px]">
        {task.title}
      </span>
      {/* Show out-of-window time so the user knows why it's in the rail */}
      {t && (
        <span className="text-[0.6875rem] text-slate-400 dark:text-slate-500 tabular-nums ml-0.5 shrink-0">
          {String(t.hour % 12 || 12).padStart(2, '0')}:{String(t.minute).padStart(2, '0')}{t.hour < 12 ? 'a' : 'p'}
        </span>
      )}
    </div>
  )
}

// ─── Hour-grid task pill ─────────────────────────────────────────────────────
// Fixed height (~44px min) — does NOT scale to duration in v1.
// If task.estimated_duration is ever used, set height = durationMinutes * PX_PER_MIN here.
function GridPill({ timedTask, overlapOffset, categoryHex }: { timedTask: TimedTask; overlapOffset: number; categoryHex?: string }) {
  const { task, top, hour, minute } = timedTask
  const q     = importanceUrgencyToQuadrant(task.importance, task.urgency)
  // Use provided category hex; fall back to quadrant color if not supplied
  const color = categoryHex ?? QUAD_COLOR[q]

  // 12-hour formatted time label
  const h12   = hour % 12 || 12
  const ampm  = hour < 12 ? 'AM' : 'PM'
  const label = `${h12}:${String(minute).padStart(2, '0')} ${ampm}`

  return (
    <div
      className="absolute flex items-start gap-2 px-2 py-1.5 rounded-lg
        bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
        shadow-sm transition-shadow hover:shadow-md active:scale-[0.98]
        cursor-pointer min-h-[44px]"
      style={{
        top: top + 1,                             // +1 so pill sits just below the hour line
        // WHY: left gutter is 56px for hour labels; overlapOffset staggers
        // same-minute tasks by 8px each to avoid full occlusion (v1 overlap).
        left: 56 + overlapOffset * 8,
        right: 8,
        borderLeftWidth: 3,
        borderLeftColor: color,
      }}
      role="button"
      tabIndex={0}
    >
      {/* Accent dot */}
      <span
        className="w-2 h-2 rounded-full mt-[3px] shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-[0.8125rem] font-semibold leading-snug
          ${task.status === 'done' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}
        >
          {task.title}
        </p>
        <p className="text-[0.6875rem] text-slate-400 dark:text-slate-500 tabular-nums mt-0.5">
          {label}
        </p>
      </div>
    </div>
  )
}

// ─── Now-line ─────────────────────────────────────────────────────────────────
function NowLine({ nowTop }: { nowTop: number }) {
  return (
    <div
      className="absolute left-0 right-0 pointer-events-none z-20"
      style={{ top: nowTop }}
    >
      {/* Accent dot at left end */}
      <div
        className="absolute w-2.5 h-2.5 rounded-full -translate-y-1/2"
        style={{ left: 50, backgroundColor: 'var(--color-accent)' }}
      />
      {/* Thin line across the full width */}
      <div
        className="absolute"
        style={{
          left: 56,
          right: 0,
          height: 1.5,
          top: '50%',
          transform: 'translateY(-50%)',
          backgroundColor: 'var(--color-accent)',
          opacity: 0.8,
        }}
      />
    </div>
  )
}

// ─── DayGrid ──────────────────────────────────────────────────────────────────
interface Props {
  tasks:      Task[]
  isToday:    boolean
  categories?: CategoryDef[]
}

export default function DayGrid({ tasks, isToday, categories }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)

  // ── Classify tasks once per render ──────────────────────────────────────
  const { timed, rail } = useMemo(() => classifyTasks(tasks), [tasks])

  // ── Now-line position (only if today and within grid bounds) ─────────────
  // WHY: guarded on isToday so the line never appears on past/future dates.
  // WHY guarded on [GRID_START_HOUR, GRID_END_HOUR): a misplaced now-line
  // outside valid grid bounds would be more confusing than helpful.
  const nowTop = useMemo((): number | null => {
    if (!isToday) return null
    const now  = new Date()
    const h    = now.getHours()
    const m    = now.getMinutes()
    if (h < GRID_START_HOUR || h >= GRID_END_HOUR) return null
    return ((h * 60 + m) - GRID_START_HOUR * 60) * PX_PER_MIN
  }, [isToday])

  // ── Auto-scroll to now on mount ──────────────────────────────────────────
  // WHY: a 15-hour grid defaults to 6 AM at top — unhelpfully empty in the
  // afternoon. Scrolling to "now − 80px" of breathing room makes it feel
  // alive and immediately useful. Runs once; no dependencies needed.
  useEffect(() => {
    if (!gridRef.current) return
    if (nowTop !== null) {
      // Today: scroll to current time with 80px of breathing room above
      gridRef.current.scrollTop = Math.max(0, nowTop - 80)
    } else if (!isToday) {
      // Past/future: scroll to 8 AM as a sensible default start
      const defaultTop = (8 - GRID_START_HOUR) * PX_PER_HOUR
      gridRef.current.scrollTop = Math.max(0, defaultTop - 40)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps — intentionally runs once

  // ── Overlap detection: group timed tasks by same minute bucket ───────────
  // Build a map from top offset → array of tasks, so we can assign
  // stagger indices when multiple tasks share the same pixel position.
  const overlapMap = useMemo(() => {
    const map     = new Map<string, number>()      // taskId → overlapOffset index
    const buckets = new Map<number, string[]>()    // rounded-top → [taskId, ...]
    for (const tt of timed) {
      const bucket = Math.round(tt.top)
      const list   = buckets.get(bucket) ?? []
      map.set(tt.task.id, list.length)
      list.push(tt.task.id)
      buckets.set(bucket, list)
    }
    return map
  }, [timed])

  // ── Hour ticks ───────────────────────────────────────────────────────────
  const hours = useMemo(() =>
    Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }, (_, i) => GRID_START_HOUR + i),
    []
  )

  // ── Rail cap: show up to 3 chips + "+N" overflow ──────────────────────────
  const RAIL_CAP  = 3
  const railChips = rail.slice(0, RAIL_CAP)
  const railExtra = rail.length - RAIL_CAP

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Untimed Rail ─────────────────────────────────────────────────── */}
      {/* Fixed, non-scrolling. Catches: no-time tasks + out-of-window timed. */}
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-3 py-2">
        {rail.length === 0 ? (
          <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 italic py-1">
            All tasks are timed
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[0.625rem] font-semibold uppercase tracking-widest
              text-slate-400 dark:text-slate-500 mr-0.5 shrink-0">
              Anytime
            </span>
            {railChips.map(t => <RailChip key={t.id} task={t} categoryHex={categoryColor(t.category, categories)} />)}
            {railExtra > 0 && (
              <span className="text-[0.75rem] font-medium text-slate-400 dark:text-slate-500
                px-2 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full shrink-0">
                +{railExtra}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Scrollable Hour Grid ──────────────────────────────────────────── */}
      <div
        ref={gridRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* WHY position:relative — task pills are position:absolute inside,
            so this establishes the containing block for offset calculation. */}
        <div className="relative" style={{ height: TOTAL_HEIGHT }}>

          {/* ── Hour lines + labels ──────────────────────────────────────── */}
          {hours.map(h => {
            const y = (h - GRID_START_HOUR) * PX_PER_HOUR
            return (
              <div
                key={h}
                className="absolute left-0 right-0 pointer-events-none"
                style={{ top: y }}
              >
                {/* Hour label — muted, tabular-nums, scaffolding type */}
                <span
                  className="absolute text-[0.625rem] font-medium tracking-wide tabular-nums
                    text-slate-400 dark:text-slate-500 select-none"
                  style={{ left: 0, width: 48, textAlign: 'right', top: -7 }}
                  aria-hidden="true"
                >
                  {hourLabel(h)}
                </span>
                {/* WHY 8% opacity: enough to scaffold structure at a glance,
                    quiet enough to never compete with task content. */}
                <div
                  className="absolute"
                  style={{
                    left: 56, right: 0,
                    height: 1,
                    top: 0,
                    backgroundColor: 'currentColor',
                    opacity: h === GRID_START_HOUR ? 0 : 0.08, // skip top edge line
                  }}
                />
              </div>
            )
          })}

          {/* ── Now-line ────────────────────────────────────────────────── */}
          {nowTop !== null && <NowLine nowTop={nowTop} />}

          {/* ── Timed task pills ─────────────────────────────────────────── */}
          {timed.map(tt => (
            <GridPill
              key={tt.task.id}
              timedTask={tt}
              overlapOffset={overlapMap.get(tt.task.id) ?? 0}
              categoryHex={categoryColor(tt.task.category, categories)}
            />
          ))}

          {/* Empty state (only shown when no timed tasks) */}
          {timed.length === 0 && (
            <p className="absolute text-[0.8125rem] text-slate-400 dark:text-slate-500
              text-center w-full"
              style={{ top: (8 - GRID_START_HOUR) * PX_PER_HOUR + 16 }}
            >
              No timed tasks
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
