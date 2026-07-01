import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'

// Completed tasks sorted by completed_at (set by updateStatus when status → done).
// Backfilled existing done tasks from updated_at via migration add_completed_at_to_tasks.

interface Props {
  userId: string | null
  context: string
  /** Increment this to force a re-fetch (e.g. after a task is marked done or cleared). */
  reloadTrigger: number
  onUncomplete: (id: string) => void
  onClearCompleted: () => Promise<void>
  onTaskClick: (task: Task) => void
}

// ── Day grouping ───────────────────────────────────────────────────────

function getDayLabel(dateStr: string | null): string {
  if (!dateStr) return 'Earlier'
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const taskDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - taskDay.getTime()) / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' })
  return 'Earlier'
}

// Sort groups: Today → Yesterday → weekday (Mon–Sun) → Earlier
const GROUP_ORDER = ['Today', 'Yesterday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Earlier']

export default function CompletedSection({
  userId, context, reloadTrigger, onUncomplete, onClearCompleted, onTaskClick,
}: Props) {
  const [show, setShow] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (!show || !userId) return
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'done')
      .is('deleted_at', null)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(50)

    if (context !== 'all') {
      query = query.eq('category', context)
    }

    query.then(({ data }) => {
      if (data) setTasks(data as Task[])
      setLoading(false)
    })
  }, [show, userId, context, reloadTrigger])

  const handleClear = async () => {
    setClearing(true)
    await onClearCompleted()
    setTasks([])
    setClearing(false)
  }

  const handleUncomplete = (id: string) => {
    onUncomplete(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  // ── Group by day ───────────────────────────────────────────────────
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      const label = getDayLabel(task.completed_at ?? task.updated_at ?? null)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(task)
    }
    return GROUP_ORDER
      .filter((label) => map.has(label))
      .map((label) => ({ label, tasks: map.get(label)! }))
  }, [tasks])

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set(['Today']))

  const toggleGroup = (label: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label); else next.add(label)
      return next
    })

  return (
    <div className="mt-6 mb-20 lg:mb-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShow((v) => !v)}
          aria-expanded={show}
          aria-controls="tm-section-completed"
          className="flex items-center gap-2 text-[0.875rem] text-slate-400 dark:text-slate-500
            hover:text-slate-600 dark:hover:text-slate-300 transition-colors font-medium min-h-[44px]"
        >
          <span className={`transition-transform motion-reduce:transition-none ${show ? 'rotate-90' : ''}`} aria-hidden="true">▸</span>
          <span aria-hidden="true">Completed</span>
          {tasks.length > 0 && (
            <span className="text-[0.75rem] text-slate-300 dark:text-slate-600">({tasks.length})</span>
          )}
        </button>

        {show && tasks.length > 0 && (
          <button
            onClick={handleClear}
            disabled={clearing}
            className="text-[0.75rem] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700
              text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400
              hover:border-red-300 dark:hover:border-red-700 transition-colors disabled:opacity-50 min-h-[44px]"
            title="Permanently clear all completed tasks"
          >
            {clearing ? <span aria-hidden="true">Clearing…</span> : <span aria-hidden="true">Clear completed</span>}
          </button>
        )}
      </div>

      {show && (
        <div className="mt-3 space-y-3" id="tm-section-completed">
          {loading ? (
            <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 italic py-3 text-center">
              Loading...
            </p>
          ) : tasks.length === 0 ? (
            <p className="text-[0.75rem] text-slate-300 dark:text-slate-600 italic py-3 text-center">
              No completed tasks
            </p>
          ) : (
            groups.map((group) => {
              const isExpanded = expandedGroups.has(group.label)
              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-300 transition-colors min-h-[36px] w-full text-left"
                  >
                    <span className={`transition-transform motion-reduce:transition-none text-[0.5rem] ${isExpanded ? 'rotate-90' : ''}`} aria-hidden="true">▶</span>
                    {group.label}
                    <span className="text-slate-300 dark:text-slate-600 font-normal normal-case tracking-normal">· {group.tasks.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="space-y-1 mt-1">
                      {group.tasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-1 group">
                          <button
                            onClick={() => onTaskClick(task)}
                            className="flex-1 text-left px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50
                              border border-slate-200 dark:border-slate-700/50 text-[0.875rem] text-slate-500
                              dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]
                              line-through decoration-slate-300 dark:decoration-slate-600"
                          >
                            {task.title}
                          </button>
                          <button
                            onClick={() => handleUncomplete(task.id)}
                            className="shrink-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30
                              hover:bg-blue-100 dark:hover:bg-blue-900/50
                              active:scale-95 transition-all
                              inline-flex items-center justify-center
                              min-h-[44px] min-w-[44px]"
                            title="Move back to active tasks"
                            aria-label={`Undo completion: ${task.title}`}
                          >
                            <span aria-hidden="true" className="text-blue-500 dark:text-blue-400 text-[0.875rem]">↩</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
