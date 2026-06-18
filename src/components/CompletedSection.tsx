import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'

interface Props {
  userId: string | null
  context: string
  onTaskClick: (task: Task) => void
}

export default function CompletedSection({ userId, context, onTaskClick }: Props) {
  const [show, setShow] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!show || tasks.length > 0) return
    if (!userId) return

    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state before async fetch
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(50)

    if (context !== 'all') {
      query = query.eq('category', context)
    }

    query.then(({ data }) => {
      if (data) setTasks(data as Task[])
      setLoading(false)
    })
  }, [show, userId, context, tasks.length])

  return (
    <div className="mt-6 mb-20 lg:mb-0">
      <button
        onClick={() => setShow((v) => !v)}
        className="flex items-center gap-2 text-[0.875rem] text-slate-400 dark:text-slate-500
          hover:text-slate-600 dark:hover:text-slate-300 transition-colors font-medium"
      >
        <span className={`transition-transform motion-reduce:transition-none ${show ? 'rotate-90' : ''}`}>▸</span>
        Completed
        {tasks.length > 0 && (
          <span className="text-[0.75rem] text-slate-300 dark:text-slate-600">({tasks.length})</span>
        )}
      </button>

      {show && (
        <div className="mt-3 space-y-1">
          {loading ? (
            <p className="text-[0.75rem] text-slate-400 dark:text-slate-500 italic py-3 text-center">
              Loading...
            </p>
          ) : tasks.length === 0 ? (
            <p className="text-[0.75rem] text-slate-300 dark:text-slate-600 italic py-3 text-center">
              Nothing finished yet — completed tasks will appear here
            </p>
          ) : (
            tasks.map((task) => (
              <button
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="w-full text-left px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50
                  border border-slate-200 dark:border-slate-700/50 text-[0.875rem] text-slate-500
                  dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px]
                  line-through decoration-slate-300 dark:decoration-slate-600"
              >
                {task.title}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
