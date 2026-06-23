import { useState, useEffect } from 'react'
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

export default function CompletedSection({
  userId,
  context,
  reloadTrigger,
  onUncomplete,
  onClearCompleted,
  onTaskClick,
}: Props) {
  const [show, setShow] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (!show || !userId) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state before async fetch
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      // status='done' — the only live completion value (phantom 'completed' removed in feat/completed-history)
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
    // reloadTrigger is intentionally included: it forces a re-fetch when the parent
    // signals that a task's status changed (done or cleared).
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

  return (
    <div className="mt-6 mb-20 lg:mb-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShow((v) => !v)}
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
        <div className="mt-3 space-y-1">
          {loading ? (
            <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 italic py-3 text-center">
              Loading...
            </p>
          ) : tasks.length === 0 ? (
            <p className="text-[0.75rem] text-slate-300 dark:text-slate-600 italic py-3 text-center">
              No completed tasks
            </p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-1 group"
              >
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
                  className="shrink-0 text-[0.75rem] px-2 py-1 rounded-lg text-slate-300 dark:text-slate-600
                    hover:text-blue-500 dark:hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100
                    focus:opacity-100 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                  title="Move back to active tasks"
                  aria-label={`Undo completion: ${task.title}`}
                >
                  <span aria-hidden="true">↩</span>
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
