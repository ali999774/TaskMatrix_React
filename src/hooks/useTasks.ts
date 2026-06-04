import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Task, Quadrant } from '../types'

export function useTasks(userId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const loadTasks = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (data) setTasks(data as Task[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const addTask = useCallback(async (quadrant: Quadrant, title: string) => {
    if (!userId) return
    const newTask: Partial<Task> = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      quadrant,
      completed: false,
    }
    setTasks((prev) => [newTask as Task, ...prev])
    await supabase.from('tasks').upsert(newTask, { onConflict: 'id' })
  }, [userId])

  const toggleTask = useCallback(async (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    )
    const task = tasks.find((t) => t.id === id)
    if (task) {
      await supabase.from('tasks').update({ completed: !task.completed }).eq('id', id)
    }
  }, [tasks])

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  return { tasks, loading, addTask, toggleTask, deleteTask, reload: loadTasks }
}
