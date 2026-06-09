import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { StickyNote } from '../types'

const COLORS = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange']
const DEBOUNCE_MS = 400

interface OfflineQueue {
  enqueue: (table: 'tasks' | 'sticky_notes', op: 'create' | 'update' | 'delete', id: string, payload?: Record<string, unknown>) => Promise<void>
  online: boolean
}

export function useStickyNotes(userId: string | null, offlineQueue?: OfflineQueue) {
  const [notes, setNotes] = useState<StickyNote[]>([])
  const [loading, setLoading] = useState(true)

  // Dirty-flag + debounce: only sync what actually changed, and only after
  // activity stops. Dragging/resizing/typing updates local state immediately;
  // Supabase gets the final settled state.
  const dirtyRef = useRef<Map<string, Partial<StickyNote>>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncedSnapshotRef = useRef<Map<string, string>>(new Map()) // id → JSON snapshot

  const flushDirty = useCallback(async () => {
    const dirty = dirtyRef.current
    if (dirty.size === 0) return

    // Snapshot and clear before awaiting so new changes during flight aren't lost
    const entries = Array.from(dirty.entries())
    dirtyRef.current = new Map()

    for (const [id, updates] of entries) {
      const prevSnapshot = syncedSnapshotRef.current.get(id)
      const nextSnapshot = JSON.stringify(updates)
      if (prevSnapshot === nextSnapshot) continue // nothing actually changed

      if (offlineQueue && !offlineQueue.online) {
        await offlineQueue.enqueue('sticky_notes', 'update', id, updates)
      } else {
        await supabase.from('sticky_notes').update(updates).eq('id', id)
      }
      syncedSnapshotRef.current.set(id, nextSnapshot)
    }
  }, [offlineQueue])

  const scheduleFlush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flushDirty, DEBOUNCE_MS)
  }, [flushDirty])

  // Cleanup timer on unmount — also flush any pending changes
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        flushDirty() // fire-and-forget on unmount
      }
    }
  }, [flushDirty])

  const loadNotes = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('sticky_notes')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
    if (data) {
      setNotes(data as StickyNote[])
      // Seed the dirty-detection snapshot
      const snap = new Map<string, string>()
      for (const n of data as StickyNote[]) {
        snap.set(n.id, JSON.stringify({ content: n.content, color: n.color, position_x: n.position_x, position_y: n.position_y, pinned: n.pinned }))
      }
      syncedSnapshotRef.current = snap
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) loadNotes()
  }, [userId, loadNotes])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('sticky-notes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sticky_notes',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as StickyNote
            setNotes((prev) => {
              if (prev.some((n) => n.id === row.id)) return prev
              return [row, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as StickyNote
            setNotes((prev) =>
              prev.map((n) => (n.id === row.id ? row : n))
            )
          } else if (payload.eventType === 'DELETE') {
            setNotes((prev) => prev.filter((n) => n.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const addNote = useCallback(async (content: string) => {
    if (!userId) return null
    const note: StickyNote = {
      id: crypto.randomUUID(),
      user_id: userId,
      content,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      position_x: Math.floor(Math.random() * 200),
      position_y: Math.floor(Math.random() * 200),
      pinned: false,
    } as StickyNote
    setNotes((prev) => [note, ...prev])
    if (offlineQueue && !offlineQueue.online) {
      await offlineQueue.enqueue('sticky_notes', 'create', note.id, note as unknown as Record<string, unknown>)
    } else {
      await supabase.from('sticky_notes').upsert(note, { onConflict: 'id' })
    }
    return note
  }, [userId, offlineQueue])

  // Optimistic local update + debounced Supabase sync.
  // Only fires a write if the tracked fields actually changed from last sync.
  const updateNote = useCallback(async (id: string, updates: Partial<StickyNote>) => {
    // Optimistic: update local state immediately
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...updates } : n))
    )

    // Merge into dirty map — last write wins per field
    const dirty = dirtyRef.current
    const existing = dirty.get(id) || {}
    dirty.set(id, { ...existing, ...updates })

    scheduleFlush()
  }, [scheduleFlush])

  const deleteNote = useCallback(async (id: string) => {
    // Cancel any pending sync for this note
    dirtyRef.current.delete(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    if (offlineQueue && !offlineQueue.online) {
      await offlineQueue.enqueue('sticky_notes', 'delete', id)
    } else {
      await supabase.from('sticky_notes').delete().eq('id', id)
    }
  }, [offlineQueue])

  const reorderNote = useCallback(async (id: string, newIndex: number) => {
    setNotes((prev) => {
      const updated = [...prev]
      const currentIndex = updated.findIndex((n) => n.id === id)
      if (currentIndex === -1) return prev
      const [moved] = updated.splice(currentIndex, 1)
      updated.splice(newIndex, 0, moved)
      return updated.map((note, index) => ({ ...note, position: index }))
    })

    // Batch-upsert positions — debounced, not immediate
    const updatePositions = async () => {
      const { data } = await supabase.from('sticky_notes').select('id').eq('user_id', userId)
      if (data) {
        const updates = data.map((n, index) => ({ id: n.id, position: index }))
        await supabase.from('sticky_notes').upsert(updates, { onConflict: 'id' })
      }
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(updatePositions, DEBOUNCE_MS)
  }, [userId])

  const pinnedNotes = notes.filter((n) => n.pinned)

  return { notes, pinnedNotes, loading, addNote, updateNote, deleteNote, reorderNote, reload: loadNotes }
}
