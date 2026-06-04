import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'

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
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    if (data) setTasks(data as Task[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) loadTasks()
  }, [userId, loadTasks])

  const addTask = useCallback(async (title: string, importance: number, urgency: number) => {
    if (!userId) return
    const newTask: Partial<Task> = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      importance,
      urgency,
      status: 'todo',
      subtasks: [],
      tags: [],
      pinned: false,
      recurring: false,
    }
    setTasks((prev) => [newTask as Task, ...prev])
    await supabase.from('tasks').upsert(newTask, { onConflict: 'id' })
  }, [userId])

  const updateStatus = useCallback(async (id: string, status: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    )
    await supabase.from('tasks').update({ status }).eq('id', id)
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  return { tasks, loading, addTask, updateStatus, deleteTask, reload: loadTasks }
}
