import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { StickyNote } from '../types'
import { persistOrQueue } from '../lib/persist'

const COLORS = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange']
const DEBOUNCE_MS = 400

// Deleted notes live in Trash for 30 days, then are hard-purged on next load.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000

interface OfflineQueue {
  enqueue: (table: 'tasks' | 'sticky_notes' | 'user_settings', op: 'create' | 'update' | 'delete', id: string, payload?: Record<string, unknown>, conflictKey?: string) => Promise<void>
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
        await persistOrQueue(offlineQueue, 'sticky_notes', 'update', id,
          () => supabase.from('sticky_notes').update(updates).eq('id', id), updates)
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

  // Best-effort retention purge: hard-delete notes that have been in Trash
  // longer than the retention window. Runs on load; RLS scopes it to this user.
  const purgeExpiredDeleted = useCallback(async () => {
    if (!userId) return
    const cutoff = new Date(Date.now() - RETENTION_MS).toISOString()
    await supabase
      .from('sticky_notes')
      .delete()
      .eq('user_id', userId)
      .lt('deleted_at', cutoff)
  }, [userId])

  const loadNotes = useCallback(async () => {
    if (!userId) return
    // Active wall: exclude soft-deleted notes (they live in Trash).
    const { data } = await supabase
      .from('sticky_notes')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('position', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: false })
    void purgeExpiredDeleted()
    if (data) {
      setNotes(data as StickyNote[])
      // Seed the dirty-detection snapshot
      const snap = new Map<string, string>()
      for (const n of data as StickyNote[]) {
        snap.set(n.id, JSON.stringify({ content: n.content, color: n.color, position_x: n.position_x, position_y: n.position_y, pinned: n.pinned, position: n.position }))
      }
      syncedSnapshotRef.current = snap
    }
    setLoading(false)
  }, [userId, purgeExpiredDeleted])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount/user change
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
            if (row.deleted_at) return // born deleted (shouldn't happen) — ignore
            setNotes((prev) => {
              if (prev.some((n) => n.id === row.id)) return prev
              return [row, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as StickyNote
            if (row.deleted_at) {
              // Soft-deleted (here or on another device) → drop from the active wall.
              setNotes((prev) => prev.filter((n) => n.id !== row.id))
            } else {
              // Normal edit, or a restore from another device → upsert into the wall.
              setNotes((prev) =>
                prev.some((n) => n.id === row.id)
                  ? prev.map((n) => (n.id === row.id ? row : n))
                  : [row, ...prev]
              )
            }
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

  const addNote = useCallback(async (content: string, pinned = false) => {
    if (!userId) return null
    const note: StickyNote = {
      id: crypto.randomUUID(),
      user_id: userId,
      content,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      position_x: Math.floor(Math.random() * 200),
      position_y: Math.floor(Math.random() * 200),
      pinned,
    } as StickyNote
    setNotes((prev) => [note, ...prev])
    if (offlineQueue && !offlineQueue.online) {
      await offlineQueue.enqueue('sticky_notes', 'create', note.id, note as unknown as Record<string, unknown>)
    } else {
      await persistOrQueue(offlineQueue, 'sticky_notes', 'create', note.id,
        () => supabase.from('sticky_notes').upsert(note, { onConflict: 'id' }),
        note as unknown as Record<string, unknown>)
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
    // Soft delete (deleted_at) so the note can be restored from Trash. Both the
    // offline and error-retry paths enqueue the SAME 'update' — NOT a hard
    // 'delete', which on flush would drop the row and break restore/undo.
    // Restore is the inverse update (deleted_at: null); whichever the user does
    // last is enqueued last, and the queue flushes in timestamp order, so
    // last-action-wins survives an offline delete→restore→sync round-trip.
    const deletedAt = new Date().toISOString()
    if (offlineQueue && !offlineQueue.online) {
      await offlineQueue.enqueue('sticky_notes', 'update', id, { deleted_at: deletedAt })
    } else {
      await persistOrQueue(offlineQueue, 'sticky_notes', 'update', id,
        () => supabase.from('sticky_notes').update({ deleted_at: deletedAt }).eq('id', id),
        { deleted_at: deletedAt })
    }
  }, [offlineQueue])

  // Undo / Trash restore — inverse of deleteNote. Re-inserts locally and nulls
  // deleted_at. Uses 'update' (never 'create') so an offline restore can't
  // resurrect a note that was permanently purged elsewhere.
  const restoreNote = useCallback(async (note: StickyNote) => {
    setNotes((prev) =>
      prev.some((n) => n.id === note.id) ? prev : [{ ...note, deleted_at: null }, ...prev]
    )
    if (offlineQueue && !offlineQueue.online) {
      await offlineQueue.enqueue('sticky_notes', 'update', note.id, { deleted_at: null })
    } else {
      await persistOrQueue(offlineQueue, 'sticky_notes', 'update', note.id,
        () => supabase.from('sticky_notes').update({ deleted_at: null }).eq('id', note.id),
        { deleted_at: null })
    }
  }, [offlineQueue])

  // Trash listing — soft-deleted notes, newest deletion first. Fetched lazily
  // (the Trash view is rarely opened), not held in the main `notes` state.
  const fetchDeletedNotes = useCallback(async (): Promise<StickyNote[]> => {
    if (!userId) return []
    const { data } = await supabase
      .from('sticky_notes')
      .select('*')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    return (data as StickyNote[]) || []
  }, [userId])

  // "Delete forever" from Trash — the only path that issues a hard DELETE. It is
  // terminal (no restore follows), so a queued hard 'delete' is safe here.
  const permanentlyDeleteNote = useCallback(async (id: string) => {
    if (offlineQueue && !offlineQueue.online) {
      await offlineQueue.enqueue('sticky_notes', 'delete', id)
    } else {
      await persistOrQueue(offlineQueue, 'sticky_notes', 'delete', id,
        () => supabase.from('sticky_notes').delete().eq('id', id))
    }
  }, [offlineQueue])

  const reorderNote = useCallback((id: string, newIndex: number) => {
    // Compute new positions entirely from local state — never read from Supabase
    // to build a mutation payload (network read before offline check breaks offline)
    setNotes((prev) => {
      const updated = [...prev]
      const currentIndex = updated.findIndex((n) => n.id === id)
      if (currentIndex === -1) return prev
      const [moved] = updated.splice(currentIndex, 1)
      updated.splice(newIndex, 0, moved)
      const reordered = updated.map((note, index) => ({ ...note, position: index }))

      // Schedule a debounced flush for each note whose position changed.
      // Uses the same dirty-flag path as updateNote, so offline → queued,
      // online → flushed after DEBOUNCE_MS. No setTimeout + network read.
      for (const note of reordered) {
        const prev_note = prev.find((n) => n.id === note.id)
        if (!prev_note || prev_note.position !== note.position) {
          const dirty = dirtyRef.current
          const existing = dirty.get(note.id) || {}
          dirty.set(note.id, { ...existing, position: note.position })
        }
      }
      scheduleFlush()

      return reordered
    })
  }, [scheduleFlush])

  const pinnedNotes = notes.filter((n) => n.pinned)

  return { notes, pinnedNotes, loading, addNote, updateNote, deleteNote, restoreNote, fetchDeletedNotes, permanentlyDeleteNote, reorderNote, reload: loadNotes }
}
