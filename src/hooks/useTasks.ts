import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'
import { scheduleTaskReminder, cancelTaskReminder } from '../lib/notifications'
import { persistOrQueue } from '../lib/persist'

const DEBOUNCE_MS = 400

/** Calculate the next occurrence for a recurring task. */
function getNextDueDate(
  dueDate: string | null,
  dueTime: string | null,
  frequency: string,
  recurDays: number[] | null,
): { date: string | null; time: string | null } {
  const base = dueDate ? new Date(dueDate + 'T00:00:00') : new Date()
  base.setHours(0, 0, 0, 0)

  if (frequency === 'daily') {
    base.setDate(base.getDate() + 1)
  } else if (frequency === 'weekly') {
    const targetDays = recurDays && recurDays.length > 0 ? recurDays : [base.getDay()]
    // Find the next matching day
    for (let i = 1; i <= 7; i++) {
      base.setDate(base.getDate() + 1)
      if (targetDays.includes(base.getDay())) break
    }
  } else if (frequency === 'monthly') {
    base.setMonth(base.getMonth() + 1)
  }

  const y = base.getFullYear()
  const m = String(base.getMonth() + 1).padStart(2, '0')
  const d = String(base.getDate()).padStart(2, '0')
  return { date: `${y}-${m}-${d}`, time: dueTime }
}

interface OfflineQueue {
  enqueue: (table: 'tasks' | 'sticky_notes' | 'user_settings', op: 'create' | 'update' | 'delete', id: string, payload?: Record<string, unknown>, conflictKey?: string) => Promise<void>
  getPendingDeleteIds: () => Promise<Set<string>>
  online: boolean
}

export function useTasks(userId: string | null, offlineQueue?: OfflineQueue) {
  // [TM] Build stamp — confirm which bundle is running on device/browser.
  // eslint-disable-next-line no-console
  console.log('[TM] build 4de1151+instr', new Date().toISOString())
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const locallyDeletedIdsRef = useRef<Set<string>>(new Set())
  const getPendingDeleteIds = offlineQueue?.getPendingDeleteIds

  // Track previous task IDs to cancel reminders for removed tasks
  const prevTaskIdsRef = useRef<Set<string>>(new Set())

  // Reactively schedule/cancel local notifications when tasks change
  useEffect(() => {
    const currentIds = new Set(tasks.map((t) => t.id))

    // Cancel reminders for tasks no longer in the active list (deleted/completed)
    for (const id of prevTaskIdsRef.current) {
      if (!currentIds.has(id)) {
        cancelTaskReminder(id)
      }
    }

    // Schedule/re-schedule for all current tasks
    for (const task of tasks) {
      scheduleTaskReminder(task)
    }

    prevTaskIdsRef.current = currentIds
  }, [tasks])

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

      if (offlineQueue && !offlineQueue.online) {
        await offlineQueue.enqueue('tasks', 'update', id, updates)
      } else {
        await persistOrQueue(offlineQueue, 'tasks', 'update', id,
          () => supabase.from('tasks').update(updates).eq('id', id), updates)
      }
      syncedSnapshotRef.current.set(id, nextSnapshot)
    }
  }, [offlineQueue])

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
    // Active-matrix filter: only todo tasks (done tasks live in CompletedSection).
    // Switched from neq('status','completed') to eq('status','todo') in
    // feat/completed-history — CompletedSection now owns status='done' tasks.
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'todo')
      .is('deleted_at', null)
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    if (data) {
      // Exclude any task that has a pending offline soft-delete in the Dexie
      // mutations queue.  Without this check, Supabase still returns the task
      // (deleted_at is null there until the queue flushes), and the wholesale
      // setTasks call would resurrect it on every reload.
      const pendingDeletes = getPendingDeleteIds
        ? await getPendingDeleteIds()
        : new Set<string>()
      for (const id of pendingDeletes) locallyDeletedIdsRef.current.add(id)
      const locallyDeleted = new Set([...locallyDeletedIdsRef.current, ...pendingDeletes])
      const active = locallyDeleted.size > 0
        ? (data as Task[]).filter((t) => !locallyDeleted.has(t.id))
        : (data as Task[])
      // [TM][LOAD-SUPABASE] log every row entering active state from the Supabase fetch
      for (const t of active) {
        // eslint-disable-next-line no-console
        console.log('[TM][LOAD-SUPABASE]', t.id, 'deleted_at ->', t.deleted_at ?? null)
      }
      setTasks(active)
      const snap = new Map<string, string>()
      for (const t of active) {
        snap.set(t.id, JSON.stringify({ title: t.title, status: t.status, category: t.category, importance: t.importance, urgency: t.urgency, position: t.position, pinned: t.pinned }))
      }
      syncedSnapshotRef.current = snap
    }
    setLoading(false)
  }, [userId, getPendingDeleteIds])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount/user change
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
            // [TM][RT-INSERT] log every realtime INSERT event, regardless of guard outcome
            // eslint-disable-next-line no-console
            console.log('[TM][RT-INSERT]', row.id, 'deleted_at ->', row.deleted_at ?? null, 'status ->', row.status)
            // Only surface todo tasks in the active matrix.
            if (row.status === 'todo' && !row.deleted_at && !locallyDeletedIdsRef.current.has(row.id)) {
              setTasks((prev) => {
                if (prev.some((t) => t.id === row.id)) return prev
                return [row, ...prev]
              })
            }
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Task
            // [TM][RT-UPDATE] log every realtime UPDATE event before any guard
            // eslint-disable-next-line no-console
            console.log('[TM][RT-UPDATE]', row.id, 'deleted_at ->', row.deleted_at ?? null, 'status ->', row.status)
            // Evict soft-deleted rows immediately regardless of their other fields.
            if (row.deleted_at) {
              setTasks((prev) => prev.filter((t) => t.id !== row.id))
            } else {
              setTasks((prev) => {
                const alreadyPresent = prev.some((t) => t.id === row.id)
                const locallyDeleted = locallyDeletedIdsRef.current.has(row.id)
                if (!alreadyPresent && !locallyDeleted && row.status === 'todo' && !row.deleted_at) {
                  // [TM][RT-UPDATE-REINSERT] task absent from local state is being re-inserted
                  // eslint-disable-next-line no-console
                  console.log('[TM][RT-UPDATE-REINSERT]', row.id, 'deleted_at ->', row.deleted_at ?? null)
                }
                return alreadyPresent
                  ? prev.map((t) => (t.id === row.id ? row : t))
                  // Guard: only re-insert a todo row that is absent from local state
                  // when it is NOT soft-deleted and NOT locally tombstoned. The
                  // local tombstone covers the window where deleteTask removed the
                  // row locally but the Supabase soft-delete is still pending or
                  // queued for retry.
                  : row.status === 'todo' && !row.deleted_at && !locallyDeleted ? [row, ...prev] : prev
              })
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

  const addTask = useCallback(async (
    title: string,
    importance: number,
    urgency: number,
    category?: string,
    opts?: { due_date?: string; due_time?: string; notes?: string; reminder?: string }
  ) => {
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
      due_date: opts?.due_date || null,
      due_time: opts?.due_time || null,
      reminder: opts?.reminder || null,
      notes: opts?.notes || null,
    }
    setTasks((prev) => [newTask as Task, ...prev])
    if (offlineQueue && !offlineQueue.online) {
      await offlineQueue.enqueue('tasks', 'create', newTask.id!, newTask)
    } else {
      await persistOrQueue(offlineQueue, 'tasks', 'create', newTask.id!,
        () => supabase.from('tasks').upsert(newTask, { onConflict: 'id' }),
        newTask as Record<string, unknown>)
    }
  }, [userId, offlineQueue])

  // Status changes are user-initiated and infrequent — immediate sync is fine.
  // No debounce needed; these aren't continuous events like drag.
  const updateStatus = useCallback(async (id: string, status: string) => {
    setTasks((prev) => {
      const updated = prev.map((t) => (t.id === id ? { ...t, status } : t))

      // Recurring task completed → create the next instance
      if (status === 'done') {
        const doneTask = prev.find((t) => t.id === id)
        if (doneTask?.recurring && doneTask.recur_frequency) {
          // Prevent spawn explosion: check if a live clone of this recurring task already exists
          const hasActiveClone = prev.some((t) => 
            t.id !== id &&
            t.status === 'todo' &&
            !t.deleted_at &&
            t.title === doneTask.title &&
            t.recurring === true &&
            t.recur_frequency === doneTask.recur_frequency
          )
          
          if (!hasActiveClone) {
            const nextDue = getNextDueDate(
              doneTask.due_date || null,
              doneTask.due_time || null,
              doneTask.recur_frequency,
              doneTask.recur_days || null
            )
            const nextTask: Task = {
              ...doneTask,
              id: crypto.randomUUID(),
              status: 'todo',
              due_date: nextDue.date,
              due_time: nextDue.time || doneTask.due_time || null,
              completed_at: undefined,
              created_at: undefined,
              updated_at: undefined,
            }
            // Fire-and-forget: save to Supabase in background
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const row = nextTask as any
            if (offlineQueue && !offlineQueue.online) {
              offlineQueue.enqueue('tasks', 'create', nextTask.id, row)
            } else {
              void persistOrQueue(offlineQueue, 'tasks', 'create', nextTask.id,
                () => supabase.from('tasks').upsert(row, { onConflict: 'id' }), row)
            }
            updated.push(nextTask)
          }
        }
      }
      return updated
    })
    const payload: Record<string, unknown> = { status }
    if (status === 'done') {
      payload.completed_at = new Date().toISOString()
    } else {
      payload.completed_at = null
    }
    if (offlineQueue && !offlineQueue.online) {
      await offlineQueue.enqueue('tasks', 'update', id, payload)
    } else {
      await persistOrQueue(offlineQueue, 'tasks', 'update', id,
        () => supabase.from('tasks').update(payload).eq('id', id), payload)
    }
  }, [offlineQueue])

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
    locallyDeletedIdsRef.current.add(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    // Soft delete (deleted_at) so the row can be restored. Both the offline and
    // error-retry paths enqueue the same UPDATE — NOT a hard 'delete', which on
    // flush would drop the row and break restore/completed-history.
    const deletedAt = new Date().toISOString()
    // [TM][DELETE] log the value being written to deleted_at
    // eslint-disable-next-line no-console
    console.log('[TM][DELETE]', id, 'deleted_at set ->', deletedAt)
    if (offlineQueue && !offlineQueue.online) {
      // [TM][DELETE-DEXIE] offline path — tombstone goes to Dexie queue (not direct Supabase)
      // eslint-disable-next-line no-console
      console.log('[TM][DELETE-DEXIE]', id, 'updated?', true, '(queued offline)')
      await offlineQueue.enqueue('tasks', 'update', id, { deleted_at: deletedAt })
    } else {
      // [TM][DELETE-DEXIE] online path — no Dexie task-row store; tombstone goes directly to Supabase.
      // Dexie is only used as a retry queue if persistOrQueue fails (see persist.ts enqueue call).
      // eslint-disable-next-line no-console
      console.log('[TM][DELETE-DEXIE]', id, 'updated?', false, '(online — direct Supabase write, no Dexie task row store)')
      await persistOrQueue(offlineQueue, 'tasks', 'update', id,
        () => supabase.from('tasks').update({ deleted_at: deletedAt }).eq('id', id),
        { deleted_at: deletedAt })
    }
  }, [offlineQueue])

  // Undo for deleteTask. Delete is already a soft delete (deleted_at
  // timestamp), so restore is just nulling it and re-inserting locally.
  const restoreTask = useCallback(async (task: Task) => {
    locallyDeletedIdsRef.current.delete(task.id)
    setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [task, ...prev]))
    if (offlineQueue && !offlineQueue.online) {
      await offlineQueue.enqueue('tasks', 'update', task.id, { deleted_at: null })
    } else {
      await persistOrQueue(offlineQueue, 'tasks', 'update', task.id,
        () => supabase.from('tasks').update({ deleted_at: null }).eq('id', task.id),
        { deleted_at: null })
    }
  }, [offlineQueue])

  // Batch soft-delete all status='done' tasks — used by "Clear completed".
  // Reuses the existing deleted_at soft-delete column and offline-queue path;
  // no schema migration required.
  const clearCompleted = useCallback(async () => {
    if (!userId) return

    // Fetch IDs of all done, non-deleted tasks for this user.
    const { data } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'done')
      .is('deleted_at', null)

    if (!data || data.length === 0) return

    const now = new Date().toISOString()

    for (const { id } of data as { id: string }[]) {
      if (offlineQueue && !offlineQueue.online) {
        await offlineQueue.enqueue('tasks', 'update', id, { deleted_at: now })
      } else {
        await persistOrQueue(offlineQueue, 'tasks', 'update', id,
          () => supabase.from('tasks').update({ deleted_at: now }).eq('id', id),
          { deleted_at: now })
      }
    }
  }, [userId, offlineQueue])

  return { tasks, loading, addTask, updateStatus, updateTask, deleteTask, restoreTask, clearCompleted, reload: loadTasks }
}
