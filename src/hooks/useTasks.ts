import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'

export function useTasks(userId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const loadTasks = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .neq('status', 'completed')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    if (data) setTasks(data as Task[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) loadTasks()
  }, [userId, loadTasks])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Task
            if (row.status !== 'completed' && !row.deleted_at) {
              setTasks((prev) => {
                if (prev.some((t) => t.id === row.id)) return prev
                return [row, ...prev]
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Task
            if (row.deleted_at || row.status === 'completed') {
              setTasks((prev) => prev.filter((t) => t.id !== row.id))
            } else {
              setTasks((prev) =>
                prev.map((t) => (t.id === row.id ? row : t))
              )
            }
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter((t) => t.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

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

  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    )
    await supabase.from('tasks').update(updates).eq('id', id)
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  return { tasks, loading, addTask, updateStatus, updateTask, deleteTask, reload: loadTasks }
}
