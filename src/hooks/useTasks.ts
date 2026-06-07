import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'

const DEBOUNCE_MS = 400

export function useTasks(userId: string | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Dirty-flag + debounce for updateTask (title edits, position changes, etc.)
  const dirtyRef = useRef<Map<string, Partial<Task>>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncedSnapshotRef = useRef<Map<string, string>>(new Map())

  const flushDirty = useCallback(async () => {
    const dirty = dirtyRef.current
    if (dirty.size === 0) return

    const entries = Array.from(dirty.entries())
    dirtyRef.current = new Map()

    for (const [id, updates] of entries) {
      const prevSnapshot = syncedSnapshotRef.current.get(id)
      const nextSnapshot = JSON.stringify(updates)
      if (prevSnapshot === nextSnapshot) continue

      await supabase.from('tasks').update(updates).eq('id', id)
      syncedSnapshotRef.current.set(id, nextSnapshot)
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flushDirty, DEBOUNCE_MS)
  }, [flushDirty])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        flushDirty()
      }
    }
  }, [flushDirty])

  const loadTasks = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .neq('status', 'completed')
      .neq('status', 'archived')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    if (data) {
      setTasks(data as Task[])
      const snap = new Map<string, string>()
      for (const t of data as Task[]) {
        snap.set(t.id, JSON.stringify({ title: t.title, status: t.status, category: t.category, importance: t.importance, urgency: t.urgency, position: t.position }))
      }
      syncedSnapshotRef.current = snap
    }
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
            if (row.status !== 'completed' && row.status !== 'archived' && !row.deleted_at) {
              setTasks((prev) => {
                if (prev.some((t) => t.id === row.id)) return prev
                return [row, ...prev]
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Task
            if (row.deleted_at || row.status === 'completed' || row.status === 'archived') {
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

  const addTask = useCallback(async (title: string, importance: number, urgency: number, category?: string) => {
    if (!userId) return
    const newTask: Partial<Task> = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      importance,
      urgency,
      category: category || null,
      status: 'todo',
      subtasks: [],
      tags: [],
      pinned: false,
      recurring: false,
    }
    setTasks((prev) => [newTask as Task, ...prev])
    await supabase.from('tasks').upsert(newTask, { onConflict: 'id' })
  }, [userId])

  // Status changes are user-initiated and infrequent — immediate sync is fine.
  // No debounce needed; these aren't continuous events like drag.
  const updateStatus = useCallback(async (id: string, status: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status } : t))
    )
    await supabase.from('tasks').update({ status }).eq('id', id)
  }, [])

  // Debounced sync for title edits, importance/urgency, position changes.
  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    )

    const dirty = dirtyRef.current
    const existing = dirty.get(id) || {}
    dirty.set(id, { ...existing, ...updates })

    scheduleFlush()
  }, [scheduleFlush])

  const deleteTask = useCallback(async (id: string) => {
    dirtyRef.current.delete(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
  }, [])

  return { tasks, loading, addTask, updateStatus, updateTask, deleteTask, reload: loadTasks }
}
